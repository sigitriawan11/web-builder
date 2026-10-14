import { z } from "zod";
import { AssetIdSchema, NodeIdSchema, PageIdSchema } from "./values";

// `LinkValue` (DM-056). Link ke page memakai `pageId` (rename path tidak merusak link). Schema hanya menerima nomor
// ternormalisasi; command/AI tool menormalkan input pengguna dulu lewat `normalizePhone`/`normalizeLinkInput`.

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

// Kode negara default untuk nomor lokal berawalan 0 (pasar utama Indonesia).
const DEFAULT_COUNTRY_CODE = "62";

/**
 * Normalisasi nomor telepon ke E.164 tanpa '+' (AC DM-056): `0812-3456-7890` / `+62 812 3456 7890` / `62812…`
 * → `6281234567890`. Spasi, titik, tanda hubung, dan kurung diabaikan. `null` bila hasilnya bukan nomor E.164.
 */
export function normalizePhone(input: string, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  const compact = input.trim().replace(/[\s.\-()]/g, "");
  let digits: string;
  if (compact.startsWith("+")) digits = compact.slice(1);
  else if (compact.startsWith("00")) digits = compact.slice(2);
  else if (compact.startsWith("0")) digits = countryCode + compact.slice(1);
  else digits = compact;
  // Kebiasaan menulis "+62 0812…": nol setelah kode negara dibuang.
  if (digits.startsWith(`${countryCode}0`)) digits = countryCode + digits.slice(countryCode.length + 1);
  return PhoneE164Schema.safeParse(digits).success ? digits : null;
}

/**
 * Siapkan input link dari pengguna/AI sebelum validasi `LinkValueSchema`: nomor `phone`/`whatsapp` dinormalisasi,
 * `href`/`to` di-trim. Nilai lain dikembalikan apa adanya (validasi tetap oleh schema).
 */
export function normalizeLinkInput(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const link: Record<string, unknown> = { ...input };
  if ((link.type === "phone" || link.type === "whatsapp") && typeof link.phone === "string") {
    link.phone = normalizePhone(link.phone) ?? link.phone;
  }
  if (link.type === "url" && typeof link.href === "string") link.href = link.href.trim();
  if (link.type === "email" && typeof link.to === "string") link.to = link.to.trim();
  return link;
}
