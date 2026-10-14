import { z } from "zod";

// Persetujuan legal user (ACC-001, ACC-002, ACC-313). Dipakai web untuk layar persetujuan S&K: user Google pertama
// kali (belum mencentang form registrasi) dan penerimaan ulang saat versi S&K/privasi naik.

const LegalAcceptanceSchema = z.object({
  // `true` bila versi terakhir yang disetujui = versi berlaku.
  accepted: z.boolean(),
  currentVersion: z.string(),
  acceptedVersion: z.string().nullable(),
});

export const ConsentStatusSchema = z.object({
  terms: LegalAcceptanceSchema,
  privacy: LegalAcceptanceSchema,
  marketing: z.object({ granted: z.boolean() }),
});
export type ConsentStatus = z.infer<typeof ConsentStatusSchema>;

export const AcceptConsentsBodySchema = z.strictObject({
  // S&K + Kebijakan Privasi versi berlaku (wajib, tidak pre-checked).
  acceptTerms: z.literal(true),
  // Tidak dikirim = pilihan marketing tidak berubah.
  marketingOptIn: z.boolean().optional(),
});
export type AcceptConsentsBody = z.infer<typeof AcceptConsentsBodySchema>;

// Sesi & perangkat (ACC-007). Token sesi tidak pernah dikirim ke klien; `id` dipakai untuk mencabut.
export const SessionInfoSchema = z.object({
  id: z.uuid(),
  // Sesi request ini ("Perangkat ini") — tidak bisa dicabut dari daftar, pakai logout.
  current: z.boolean(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  geo: z.object({ country: z.string().optional(), city: z.string().optional() }).nullable(),
  createdAt: z.iso.datetime(),
  lastActiveAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime(),
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
