import { isIP } from "node:net";
import type { Request, Response } from "express";
import type { ValidatedHandler } from "../../middleware/validate";
import type {
  adminListComponentsRequest,
  archiveRequest,
  capabilitiesRequest,
  categoriesRequest,
  createComponentRequest,
  deprecateRequest,
  draftDefinitionRequest,
  editorSessionRequest,
  getThemeRequest,
  listThemesRequest,
  publishRequest,
  realtimeTokenRequest,
  saveDraftRequest,
  saveThemeRequest,
  usageRequest,
  versionsRequest,
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
  const versions: ValidatedHandler<typeof versionsRequest> = async (req, res) => {
    res.json({ data: await service.versions(req.valid.params.id), meta: meta(res) });
  };
  const editorSession: ValidatedHandler<typeof editorSessionRequest> = async (req, res) => {
    res.json({ data: await service.getEditorSession(actor(req), req.valid.params.id), meta: meta(res) });
  };
  const categories: ValidatedHandler<typeof categoriesRequest> = async (_req, res) => {
    res.json({ data: await service.listCategories(), meta: meta(res) });
  };
  const listComponents: ValidatedHandler<typeof adminListComponentsRequest> = async (req, res) => {
    res.json({ data: await service.listComponents(req.valid.query), meta: meta(res) });
  };
  const capabilities: ValidatedHandler<typeof capabilitiesRequest> = async (req, res) => {
    res.json({ data: await service.capabilities(actor(req).userId), meta: meta(res) });
  };
  const realtimeToken: ValidatedHandler<typeof realtimeTokenRequest> = async (req, res) => {
    const data = await service.issueRealtimeToken(actor(req), req.valid.params.id);
    res.set("Cache-Control", "no-store"); // token berumur pendek; jangan di-cache.
    res.json({ data, meta: meta(res) });
  };
  const draftDefinition: ValidatedHandler<typeof draftDefinitionRequest> = async (req, res) => {
    const data = await service.getDraftDefinition(req.valid.params.componentId);
    res.set("Cache-Control", "no-store"); // draft berubah terus; jangan di-cache.
    res.json({ data, meta: meta(res) });
  };
  const listThemes: ValidatedHandler<typeof listThemesRequest> = async (_req, res) => {
    res.json({ data: await service.listThemes(), meta: meta(res) });
  };
  const getTheme: ValidatedHandler<typeof getThemeRequest> = async (req, res) => {
    res.json({ data: await service.getTheme(req.valid.params.slug), meta: meta(res) });
  };
  const saveTheme: ValidatedHandler<typeof saveThemeRequest> = async (req, res) => {
    res.json({ data: await service.saveTheme(actor(req), req.valid.params.slug, req.valid.body), meta: meta(res) });
  };
  return {
    create,
    saveDraft,
    publish,
    deprecate,
    archive,
    usage,
    editorSession,
    realtimeToken,
    draftDefinition,
    categories,
    listComponents,
    capabilities,
    versions,
    listThemes,
    getTheme,
    saveTheme,
  };
}
