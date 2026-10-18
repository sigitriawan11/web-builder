import type { Response } from "express";
import type { ValidatedHandler } from "../../middleware/validate";
import { requireSiteTenant } from "../../tenant";
import type { completeRequest, getAssetRequest, presignRequest } from "./assets.schema";
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
  return { presign, complete, get };
}
