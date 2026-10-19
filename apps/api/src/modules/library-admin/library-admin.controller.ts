import { isIP } from "node:net";
import type { Request, Response } from "express";
import type { ValidatedHandler } from "../../middleware/validate";
import type {
  archiveRequest,
  createComponentRequest,
  deprecateRequest,
  publishRequest,
  saveDraftRequest,
  usageRequest,
} from "./library-admin.schema";
import type { LibraryAdminService, StaffActor } from "./library-admin.service";

const meta = (res: Response) => ({ requestId: String(res.getHeader("x-request-id") ?? "") });

function actor(req: Request): StaffActor {
  const userId = req.ctx.user?.id;
  if (!userId) throw new Error("actor tanpa sesi (requireStaffRole seharusnya menolak lebih dulu)");
  const userAgent = req.get("user-agent");
  return {
    userId,
    ...(req.ip && isIP(req.ip) ? { ip: req.ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

export function createLibraryAdminController(service: LibraryAdminService) {
  const create: ValidatedHandler<typeof createComponentRequest> = async (req, res) => {
    res.status(201).json({ data: await service.createComponent(actor(req), req.valid.body), meta: meta(res) });
  };
  const saveDraft: ValidatedHandler<typeof saveDraftRequest> = async (req, res) => {
    await service.saveDraft(actor(req), req.valid.params.id, req.valid.body);
    res.status(204).end();
  };
  const publish: ValidatedHandler<typeof publishRequest> = async (req, res) => {
    res.json({ data: await service.publish(actor(req), req.valid.params.id, req.valid.body), meta: meta(res) });
  };
  const deprecate: ValidatedHandler<typeof deprecateRequest> = async (req, res) => {
    await service.deprecate(actor(req), req.valid.params.id, req.valid.body);
    res.status(204).end();
  };
  const archive: ValidatedHandler<typeof archiveRequest> = async (req, res) => {
    await service.archive(actor(req), req.valid.params.id, req.valid.body ?? {});
    res.status(204).end();
  };
  const usage: ValidatedHandler<typeof usageRequest> = async (req, res) => {
    res.json({ data: await service.usage(req.valid.params.id), meta: meta(res) });
  };
  return { create, saveDraft, publish, deprecate, archive, usage };
}
