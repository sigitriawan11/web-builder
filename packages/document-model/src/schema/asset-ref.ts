import { z } from "zod";
import { AssetIdSchema } from "./values";

// ── Asset reference (DM-057) ───────────────────────────────────────────────

// Crop non-destruktif, ternormalisasi 0..1 terhadap gambar asli; tidak boleh keluar bidang gambar.
const CropSchema = z
  .strictObject({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .refine((crop) => crop.x + crop.width <= 1 + 1e-9 && crop.y + crop.height <= 1 + 1e-9, "crop keluar dari gambar");

export const AssetRefSchema = z.strictObject({
  assetId: AssetIdSchema,
  // Per pemakaian: gambar sama bisa beda alt.
  alt: z.string().max(500).optional(),
  focalPoint: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  crop: CropSchema.optional(),
});

export type AssetRef = z.infer<typeof AssetRefSchema>;
