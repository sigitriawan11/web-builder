import { z } from "zod";

// Kontrak upload aset (ARCHITECTURE §9.9, ED-160). Dipakai api (validasi) & editor (upload client).

// MIME gambar yang diizinkan upload (M2 = gambar; video/font/file menyusul). SVG dipisah: disanitasi di worker.
export const ALLOWED_IMAGE_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

// Batas ukuran upload gambar (spec 02 ED-223 / 08): 10 MB.
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

/** MIME → `AssetEntry.kind` (svg terpisah dari image untuk sanitasi). */
export function assetKindForMime(mime: string): "image" | "svg" | null {
  if (mime === "image/svg+xml") return "svg";
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(mime) ? "image" : null;
}

export const PresignUploadRequestSchema = z.strictObject({
  mime: z.enum(ALLOWED_IMAGE_MIME),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_UPLOAD_BYTES),
  fileName: z.string().max(255).optional(),
});
export type PresignUploadRequest = z.infer<typeof PresignUploadRequestSchema>;

export interface PresignUploadResponse {
  assetId: string;
  storageKey: string;
  uploadUrl: string;
  // Header yang WAJIB dikirim browser pada PUT agar cocok tanda tangan presigned.
  headers: { "Content-Type": string };
}

export interface AssetSummary {
  id: string;
  kind: "image" | "video" | "file" | "font" | "svg";
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  status: "pending" | "ready" | "rejected";
  createdAt: string;
}
