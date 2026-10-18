import type { AssetEntry } from "@platform/document-model";
import type { PlatformApi } from "@platform/sdk";
import {
  type AllowedImageMime,
  type AssetSummary,
  assetKindForMime,
  MAX_IMAGE_UPLOAD_BYTES,
} from "@platform/shared/contracts";

// Orkestrasi upload gambar dari editor (ED-160, ARCHITECTURE §9.9): presign → PUT langsung ke storage → complete
// (antre image-processing). Murni terhadap transport: endpoint `assets` dari PlatformApi + `httpPut` (bisa di-fake di
// test). Validasi mime/ukuran di klien juga (fail cepat sebelum request).

export class UploadError extends Error {}

export interface UploadDeps {
  siteId: string;
  assets: Pick<PlatformApi["assets"], "presign" | "complete">;
  // PUT ke URL presigned (bukan lewat /api). Default: fetch global.
  httpPut?: (
    url: string,
    init: { method: "PUT"; headers: Record<string, string>; body: Blob },
  ) => Promise<{ ok: boolean; status: number }>;
}

export interface UploadResult {
  assetId: string;
  status: AssetSummary["status"];
  // AssetEntry untuk didaftarkan ke dokumen (registerAsset). width/height/blurhash menyusul saat `ready`.
  entry: AssetEntry;
}

/** Validasi cepat di klien (server tetap otoritatif). */
export function validateImageUpload(file: { type: string; size: number }): string | null {
  if (!assetKindForMime(file.type)) return "unsupported-type";
  if (file.size <= 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) return "too-large";
  return null;
}

export async function uploadImage(file: File, deps: UploadDeps): Promise<UploadResult> {
  const invalid = validateImageUpload(file);
  if (invalid) throw new UploadError(invalid);
  const kind = assetKindForMime(file.type);
  if (!kind) throw new UploadError("unsupported-type");

  const presign = await deps.assets.presign(deps.siteId, {
    // Sudah divalidasi allowlist oleh validateImageUpload di atas.
    mime: file.type as AllowedImageMime,
    sizeBytes: file.size,
    fileName: file.name,
  });

  const put = await (deps.httpPut ?? defaultPut)(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  });
  if (!put.ok) throw new UploadError(`upload-failed-${put.status}`);

  const complete = await deps.assets.complete(deps.siteId, presign.assetId);
  return { assetId: presign.assetId, status: complete.status, entry: { kind, mime: file.type } };
}

const defaultPut: NonNullable<UploadDeps["httpPut"]> = async (url, init) => {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status };
};
