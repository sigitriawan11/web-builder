import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readSseEvents, type SseMessage, subscribeSse } from "./sse";

const encoder = new TextEncoder();

/** Stream dari potongan byte persis seperti diberikan (untuk menguji batas chunk). */
function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<SseMessage[]> {
  const messages: SseMessage[] = [];
  for await (const message of readSseEvents(stream)) messages.push(message);
  return messages;
}

describe("readSseEvents (WHATWG)", () => {
  it("chunk terbelah di tengah baris & karakter multi-byte; data multi-baris; event & id", async () => {
    const emoji = encoder.encode("data: kue 🍰\n\n");
    const cut = emoji.length - 5; // memotong di tengah byte emoji
    const messages = await collect(
      streamOf([
        "﻿event: text.del",
        "ta\nid: 7\ndata: baris 1\nda",
        "ta: baris 2\n\n",
        emoji.slice(0, cut),
        emoji.slice(cut),
      ]),
    );
    expect(messages).toEqual([
      { event: "text.delta", data: "baris 1\nbaris 2", id: "7", retry: undefined },
      { event: "message", data: "kue 🍰", id: "7", retry: undefined },
    ]);
  });

  it("CRLF & CR; komentar heartbeat diabaikan; retry; tanpa spasi setelah titik dua", async () => {
    const messages = await collect(streamOf([": ping\r\n\r\nretry: 3000\r\ndata:satu\r\n\r", "\ndata: dua\r\r"]));
    expect(messages.map((message) => [message.data, message.retry])).toEqual([
      ["satu", 3000],
      ["dua", undefined],
    ]);
  });

  it("blok tanpa data tidak dikirim (id tetap tercatat); blok terakhir tanpa baris kosong tidak dikirim", async () => {
    const messages = await collect(streamOf(["id: 9\n\ndata: a\n\ndata: terpotong"]));
    expect(messages).toEqual([{ event: "message", data: "a", id: "9", retry: undefined }]);
  });
});

const EventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("progress"), percent: z.number() }),
  z.object({ type: z.literal("done") }),
]);
type TestEvent = z.infer<typeof EventSchema>;

const sse = (id: string, payload: unknown) => `id: ${id}\ndata: ${JSON.stringify(payload)}\n\n`;

describe("subscribeSse", () => {
  it("stream putus → sambung ulang dengan Last-Event-ID; berhenti pada event terminal", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(streamOf([sse("1", { type: "progress", percent: 40 })])))
      .mockResolvedValueOnce(
        new Response(streamOf([sse("2", { type: "progress", percent: 90 }), sse("3", { type: "done" })])),
      );
    const events: TestEvent[] = [];
    const subscription = subscribeSse("/api/v1/publish/1/events", {
      fetch: fetchMock,
      schema: EventSchema,
      onEvent: (event) => events.push(event),
      isTerminal: (event) => event.type === "done",
      reconnectDelayMs: 1,
    });
    await subscription.done;
    expect(events.map((event) => event.type)).toEqual(["progress", "progress", "done"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(secondHeaders.get("last-event-id")).toBe("1");
    expect(secondHeaders.get("accept")).toBe("text/event-stream");
  });

  it("data tidak sesuai schema → onError, stream lanjut", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(streamOf(['data: {"type":"aneh"}\n\n', sse("2", { type: "done" })])));
    const errors: unknown[] = [];
    const events: TestEvent[] = [];
    await subscribeSse("/s", {
      fetch: fetchMock,
      schema: EventSchema,
      onEvent: (event) => events.push(event),
      onError: (error) => errors.push(error),
      isTerminal: (event) => event.type === "done",
    }).done;
    expect(errors).toHaveLength(1);
    expect(events).toEqual([{ type: "done" }]);
  });

  it("gagal terus → berhenti setelah batas reconnect; close() menghentikan langganan", async () => {
    const failing = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    await subscribeSse("/s", {
      fetch: failing,
      schema: EventSchema,
      onEvent: () => {},
      maxReconnects: 2,
      reconnectDelayMs: 1,
    }).done;
    expect(failing).toHaveBeenCalledTimes(3);

    const hanging = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
    );
    const subscription = subscribeSse("/s", { fetch: hanging, schema: EventSchema, onEvent: () => {} });
    subscription.close();
    await expect(subscription.done).resolves.toBeUndefined();
  });
});
