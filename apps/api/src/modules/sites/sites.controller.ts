import type { Response } from "express";
import type { ValidatedHandler } from "../../middleware/validate";
import { requireSiteTenant, requireWorkspaceTenant } from "../../tenant";
import type {
  createSiteRequest,
  deleteSiteRequest,
  getSiteRequest,
  listSitesRequest,
  updateSiteRequest,
} from "./sites.schema";
import type { SitesService } from "./sites.service";

// Controller: request tervalidasi → service → envelope response (ARCHITECTURE §5.3). Tanpa logika bisnis.

const meta = (res: Response) => ({ requestId: String(res.getHeader("x-request-id") ?? "") });

export function createSitesController(service: SitesService) {
  const list: ValidatedHandler<typeof listSitesRequest> = async (req, res) => {
    const result = await service.list(requireWorkspaceTenant(req), req.valid.query);
    res.json({ data: result.items, meta: { ...meta(res), nextCursor: result.nextCursor } });
  };
  const get: ValidatedHandler<typeof getSiteRequest> = async (req, res) => {
    res.json({ data: await service.get(requireSiteTenant(req)), meta: meta(res) });
  };
  const create: ValidatedHandler<typeof createSiteRequest> = async (req, res) => {
    res.status(201).json({ data: await service.create(requireWorkspaceTenant(req), req.valid.body), meta: meta(res) });
  };
  const update: ValidatedHandler<typeof updateSiteRequest> = async (req, res) => {
    res.json({ data: await service.rename(requireSiteTenant(req), req.valid.body), meta: meta(res) });
  };
  const remove: ValidatedHandler<typeof deleteSiteRequest> = async (req, res) => {
    await service.remove(requireSiteTenant(req));
    res.status(204).end();
  };
  return { list, get, create, update, remove };
}
