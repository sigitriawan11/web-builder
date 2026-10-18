import { AppError } from "@platform/shared";
import type { Response } from "express";
import type { ValidatedHandler } from "../../middleware/validate";
import { requireSiteTenant } from "../../tenant";
import type {
  completeRequest,
  contentRequest,
  deleteRequest,
  getAssetRequest,
  listRequest,
  presignRequest,
} from "./assets.schema";
import type { AssetsService } from "./assets.service";

// Controller assets: request tervalidasi → service → envelope (ARCHITECTURE §5.3). Tanpa logika bisnis.

const meta = (res: Response) => ({ requestId: String(res.getHeader("x-request-id") ?? "") });

export function createAssetsController(service: AssetsService) {
  const presign: ValidatedHandler<typeof presignRequest> = async (req, res) => {
    const data = await service.presign(requireSiteTenant(req), req.valid.body, meta(res).requestId);
    res.status(201).json({ data, meta: meta(res) });
  };
  const complete: ValidatedHandler<typeof completeRequest> = async (req, res) => {
    const data = await service.complete(requireSiteTenant(req), req.valid.params.assetId, meta(res).requestId);
    res.json({ data, meta: meta(res) });
  };
  const get: ValidatedHandler<typeof getAssetRequest> = async (req, res) => {
    res.json({ data: await service.get(requireSiteTenant(req), req.valid.params.assetId), meta: meta(res) });
  };
  const list: ValidatedHandler<typeof listRequest> = async (req, res) => {
    const { search } = req.valid.query;
    const data = await service.list(requireSiteTenant(req), search ? { search } : {});
    res.json({ data, meta: meta(res) });
  };
  const remove: ValidatedHandler<typeof deleteRequest> = async (req, res) => {
    await service.remove(requireSiteTenant(req), req.valid.params.assetId);
    res.status(204).end();
  };
  // Redirect ke URL presigned varian webp (ED-161) — dipakai langsung sebagai `<img src>` di editor.
  const content: ValidatedHandler<typeof contentRequest> = async (req, res) => {
    const url = await service.contentUrl(requireSiteTenant(req), req.valid.params.assetId);
    if (!url) throw new AppError("NOT_FOUND");
    // Redirect berumur pendek: URL presigned kedaluwarsa, jangan di-cache lama oleh browser/CDN.
    res.setHeader("Cache-Control", "private, max-age=60");
    res.redirect(302, url);
  };
  return { presign, complete, get, list, remove, content };
}
