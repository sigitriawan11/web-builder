import type { z } from "zod";

// Server-Sent Events lewat fetch (ARCHITECTURE §10.5: progres publish M4, stream AI M6). Bukan EventSource:
// butuh event bertipe (Zod), header kustom, dan kontrol reconnect. Parser mengikuti spesifikasi WHATWG
// (https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation).

export interface SseMessage {
  // Nama event (default "message").
  event: string;
  data: string;
  // `id` terakhir yang diterima di stream ini (dipakai Last-Event-ID saat reconnect).
  id: string | undefined;
  // Jeda reconnect (ms) yang diminta server lewat field `retry`.
  retry: number | undefined;
}

/** Urai stream byte SSE menjadi pesan. Komentar (`: ping`) dan baris tak dikenal diabaikan. */
export async function* readSseEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = stream.getReader();
  // `stream: true`: karakter multi-byte UTF-8 yang terbelah antar chunk tetap utuh.
  const decoder = new TextDecoder();
  let buffer = "";
  let first = true;
  let lastId: string | undefined;
  let event = "";
  let data: string[] = [];
  let retry: number | undefined;

  const dispatch = (): SseMessage | null => {
    // Blok tanpa `data` tidak dikirim (spesifikasi), tetapi `id`-nya tetap tercatat.
    const message = data.length > 0 ? { event: event || "message", data: data.join("\n"), id: lastId, retry } : null;
    event = "";
    data = [];
    retry = undefined;
    return message;
  };

  const processLine = (line: string): SseMessage | null => {
    if (line === "") return dispatch();
    if (line.startsWith(":")) return null;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id" && !value.includes("\0")) lastId = value;
    else if (field === "retry" && /^\d+$/.test(value)) retry = Number(value);
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (first) {
        buffer = buffer.replace(/^﻿/, "");
        first = false;
      }
      // Baris lengkap: dipisah CRLF, LF, atau CR. CR di ujung buffer bisa jadi awal CRLF → tunggu chunk berikutnya.
      const lines = buffer.split(/\r\n|\n|\r(?!$)/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const message = processLine(line);
        if (message) yield message;
      }
    }
    // Stream selesai: CR yang ditahan di ujung buffer ternyata akhir baris yang sah → proses baris lengkapnya.
    buffer += decoder.decode();
    const rest = buffer.split(/\r\n|\n|\r/);
    rest.pop();
    for (const line of rest) {
      const message = processLine(line);
      if (message) yield message;
    }
  } finally {
    reader.releaseLock();
  }
  // Blok terakhir tanpa baris kosong penutup tidak dikirim (spesifikasi).
}

export interface SseSubscription {
  close: () => void;
  // Selesai saat stream ditutup (event terminal, close(), atau gagal permanen).
  done: Promise<void>;
}

export interface SubscribeSseOptions<T> {
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  // Decode data tiap pesan (mis. JSON + schema Zod union event). Data tidak valid → onError, stream lanjut.
  schema: z.ZodType<T>;
  onEvent: (event: T, message: SseMessage) => void;
  // Event yang mengakhiri stream (mis. `run.completed`) → tidak reconnect.
  isTerminal?: (event: T) => boolean;
  onError?: (error: unknown) => void;
  // Mulai dari setelah event ini (replay, ARCHITECTURE §10.5).
  lastEventId?: string;
  maxReconnects?: number;
  // Jeda reconnect bawaan bila server tidak mengirim `retry`.
  reconnectDelayMs?: number;
  signal?: AbortSignal;
}

export const DEFAULT_RECONNECT_DELAY_MS = 2_000;
export const DEFAULT_MAX_RECONNECTS = 5;

/** Berlangganan SSE dengan reconnect + Last-Event-ID; berhenti pada event terminal, close(), atau batas reconnect. */
export function subscribeSse<T>(url: string, options: SubscribeSseOptions<T>): SseSubscription {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  let lastEventId = options.lastEventId;
  let delayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const maxReconnects = options.maxReconnects ?? DEFAULT_MAX_RECONNECTS;

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      });
    });

  const run = async () => {
    let failures = 0;
    while (!signal.aborted) {
      let finished = false;
      try {
        const response = await fetchImpl(url, {
          headers: {
            accept: "text/event-stream",
            ...options.headers,
            ...(lastEventId ? { "last-event-id": lastEventId } : {}),
          },
          signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE HTTP ${response.status}`);
        for await (const message of readSseEvents(response.body)) {
          failures = 0;
          if (message.id !== undefined) lastEventId = message.id;
          if (message.retry !== undefined) delayMs = message.retry;
          let decoded: T;
          try {
            decoded = options.schema.parse(JSON.parse(message.data));
          } catch (error) {
            options.onError?.(error);
            continue;
          }
          options.onEvent(decoded, message);
          if (options.isTerminal?.(decoded)) {
            finished = true;
            break;
          }
        }
      } catch (error) {
        if (signal.aborted) return;
        options.onError?.(error);
        failures += 1;
      }
      if (finished || signal.aborted) return;
      // Stream putus (atau berakhir tanpa event terminal) → sambung ulang dari event terakhir.
      if (failures > maxReconnects) return;
      await wait(delayMs);
    }
  };

  return { close: () => controller.abort(), done: run() };
}
