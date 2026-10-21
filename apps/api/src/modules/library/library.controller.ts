import type { Response } from "express";
import type { ValidatedHandler } from "../../middleware/validate";
import type { getDefinitionRequest, listComponentsRequest } from "./library.schema";
import type { LibraryService } from "./library.service";

const meta = (res: Response) => ({ requestId: String(res.getHeader("x-request-id") ?? "") });

export function createLibraryController(service: LibraryService) {
  const getDefinition: ValidatedHandler<typeof getDefinitionRequest> = async (req, res) => {
    const data = await service.getDefinition(req.valid.params.componentId, req.valid.params.version);
    // CMP-050: versi published immutable → boleh di-cache selamanya (editor juga cache per componentId@version).
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.json({ data, meta: meta(res) });
  };
  const listComponents: ValidatedHandler<typeof listComponentsRequest> = async (req, res) => {
    const { category, search } = req.valid.query;
    const data = await service.listComponents({
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
    });
    res.json({ data, meta: meta(res) });
  };
  return { getDefinition, listComponents };
}
