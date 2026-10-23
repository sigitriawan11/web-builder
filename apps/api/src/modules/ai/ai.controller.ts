import type { Request, Response } from "express";
import type { Redis } from "../../lib/redis";
import type { ValidatedHandler } from "../../middleware/validate";
import type { createRunRequest, runEventsRequest } from "./ai.schema";
import type { AiService } from "./ai.service";
import { streamRunEvents } from "./ai.sse";

const meta = (res: Response) => ({ requestId: String(res.getHeader("x-request-id") ?? "") });

function actorId(req: Request): string {
  const userId = req.ctx.user?.id;
  if (!userId) throw new Error("actor tanpa sesi (requireStaffRole seharusnya menolak lebih dulu)");
  return userId;
}

export function createAiController(service: AiService, redis: Redis | undefined) {
  const create: ValidatedHandler<typeof createRunRequest> = async (req, res) => {
    res.status(201).json({ data: await service.createRun({ userId: actorId(req) }, req.valid.body), meta: meta(res) });
  };

  // AI-051: SSE stream event run. `Last-Event-ID` (header) atau query `lastEventId` untuk replay (ARCHITECTURE §10.5).
  const events: ValidatedHandler<typeof runEventsRequest> = async (req, res) => {
    const run = await service.getRun(req.valid.params.runId); // 404 bila tak ada
    if (!redis) {
      res.status(503).json({ error: { code: "UNAVAILABLE" }, meta: meta(res) });
      return;
    }
    const lastEventId = (req.get("last-event-id") ?? req.valid.query.lastEventId) || undefined;
    await streamRunEvents({
      redis,
      runId: run.id,
      res,
      ...(lastEventId ? { lastEventId } : {}),
      ...(req.valid.query.close ? { closeAfterBacklog: true } : {}),
      onClose: (cleanup) => req.on("close", cleanup),
    });
  };

  return { create, events };
}
