import { z } from "zod";
import { isTimeZone } from "../time-zone";

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

// Profil pengguna (ACC-008). Avatar (`image`) diunggah lewat pipeline aset (T2.12.1); sampai itu null → inisial.
export const ProfileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  locale: z.enum(["id", "en"]),
  timezone: z.string(),
  // Menentukan cara re-auth (password vs login ulang) & apakah tautan Google boleh diputus.
  hasPassword: z.boolean(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileBodySchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    // Bahasa UI & email (ACC-009); berlaku untuk email berikutnya.
    locale: z.enum(["id", "en"]).optional(),
    // Zona waktu tampilan tanggal (ACC-008).
    timezone: z.string().max(64).refine(isTimeZone, "zona waktu IANA tidak dikenal").optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "minimal satu field");
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;
