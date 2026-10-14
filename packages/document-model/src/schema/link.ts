import { z } from "zod";
import { AssetIdSchema, NodeIdSchema, PageIdSchema } from "./values";

// `LinkValue` (DM-056). Link ke page memakai `pageId` (rename path tidak merusak link). Normalisasi nomor Indonesia
// (`0812…`/`+62…` → `62…`) dilakukan command (T1.8.13/T1.9.7), schema hanya menerima bentuk ternormalisasi.

// E.164 tanpa '+': kode negara + nomor, 7–15 digit, tidak diawali 0.
export const PhoneE164Schema = z
  .string()
  .regex(/^[1-9][0-9]{6,14}$/, "nomor harus format E.164 tanpa '+', mis. 6281234567890");

export const LinkValueSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("page"), pageId: PageIdSchema, anchorNodeId: NodeIdSchema.optional() }),
  // Hanya http(s): `javascript:`, `data:`, dll. ditolak (AC DM-056).
  z.strictObject({
    type: z.literal("url"),
    href: z.url({ protocol: /^https?$/ }).max(2048),
    newTab: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal("anchor"), nodeId: NodeIdSchema }),
  z.strictObject({ type: z.literal("email"), to: z.email().max(254), subject: z.string().max(200).optional() }),
  z.strictObject({ type: z.literal("phone"), phone: PhoneE164Schema }),
  z.strictObject({ type: z.literal("whatsapp"), phone: PhoneE164Schema, message: z.string().max(1000).optional() }),
  z.strictObject({ type: z.literal("asset"), assetId: AssetIdSchema }),
]);

export type LinkValue = z.infer<typeof LinkValueSchema>;
