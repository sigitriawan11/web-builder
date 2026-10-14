import { isTimeZone } from "@platform/shared";
import { z } from "zod";

// Body registrasi email + password (ACC-001), divalidasi sebelum diteruskan ke Better Auth. `strict`: field lain
// (mis. `emailVerified`, `image`) ditolak, bukan diam-diam diteruskan.

export const SignUpBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  // Normalisasi email: trim + huruf kecil (unik global, ARCHITECTURE §6.3).
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  // Batas atas longgar; kebijakan sebenarnya di `checkPassword` (error WEAK_PASSWORD dengan alasan).
  password: z.string().max(1024),
  // Persetujuan S&K + Kebijakan Privasi wajib dicentang; tidak pre-checked di form.
  acceptTerms: z.literal(true),
  // Consent marketing terpisah, default off.
  marketingOptIn: z.boolean().default(false),
  // Dari browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`); tidak dikirim → default kolom.
  timezone: z.string().max(64).refine(isTimeZone, "zona waktu IANA tidak dikenal").optional(),
  callbackURL: z.string().max(2048).optional(),
  rememberMe: z.boolean().optional(),
});

export type SignUpBody = z.infer<typeof SignUpBodySchema>;
