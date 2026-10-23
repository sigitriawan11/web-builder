import type { Response } from "express";
import type { Redis } from "../../lib/redis";

// AI-051 / ARCHITECTURE §10.5: event run AI di-stream lewat SSE. Worker PUBLISH ke `airun:<runId>` (live) + XADD ke
// Redis Stream `airun-log:<runId>` (TTL 1 jam) agar klien reconnect dengan `Last-Event-ID` bisa replay. Heartbeat 15 s.

const LOG_TTL_SECONDS = 3600;
const HEARTBEAT_MS = 15_000;

const streamKey = (runId: string) => `airun-log:${runId}`;
const channel = (runId: string) => `airun:${runId}`;

/** Catat + publish satu event run (dipakai worker). Kembalikan id stream (dipakai `Last-Event-ID`). */
export async function publishRunEvent(redis: Redis, runId: string, event: string, data: unknown): Promise<string> {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  const id = (await redis.xadd(streamKey(runId), "*", "event", event, "data", payload)) ?? "";
  await redis.expire(streamKey(runId), LOG_TTL_SECONDS);
  await redis.publish(channel(runId), JSON.stringify({ id, event, data: payload }));
  return id;
}

/** Format satu frame SSE (id/event/data). */
export function sseFrame(id: string, event: string, data: string): string {
  return `id: ${id}\nevent: ${event}\ndata: ${data}\n\n`;
}

/** Replay backlog dari `Last-Event-ID` (XRANGE eksklusif) → frame SSE. */
export async function replayBacklog(redis: Redis, runId: string, lastEventId: string | undefined): Promise<string> {
  const start = lastEventId ? `(${lastEventId}` : "0";
  const entries = (await redis.xrange(streamKey(runId), start, "+")) as [string, string[]][];
  let out = "";
  for (const [id, fields] of entries) {
    const map = new Map<string, string>();
    for (let i = 0; i < fields.length; i += 2) map.set(fields[i] as string, fields[i + 1] as string);
    out += sseFrame(id, map.get("event") ?? "message", map.get("data") ?? "");
  }
  return out;
}

/**
 * Stream SSE event run: replay backlog lalu subscribe live + heartbeat. Bersih saat koneksi ditutup. `close`=true
 * (klien hanya ingin backlog, mis. reconnect/replay) → tutup setelah backlog tanpa subscribe.
 */
export async function streamRunEvents(opts: {
  redis: Redis;
  runId: string;
  res: Response;
  lastEventId?: string;
  closeAfterBacklog?: boolean;
  onClose: (cleanup: () => void) => void;
}): Promise<void> {
  const { redis, runId, res, lastEventId, closeAfterBacklog, onClose } = opts;
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.write(`retry: 3000\n\n`);
  res.write(await replayBacklog(redis, runId, lastEventId));

  if (closeAfterBacklog) {
    res.end();
    return;
  }

  const sub = redis.duplicate();
  await sub.subscribe(channel(runId));
  sub.on("message", (_channel: string, message: string) => {
    try {
      const { id, event, data } = JSON.parse(message) as { id: string; event: string; data: string };
      res.write(sseFrame(id, event, data));
    } catch {
      /* abaikan pesan rusak */
    }
  });
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), HEARTBEAT_MS);

  onClose(() => {
    clearInterval(heartbeat);
    void sub.unsubscribe(channel(runId)).finally(() => sub.disconnect());
  });
}
