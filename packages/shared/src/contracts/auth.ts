// Kontrak auth yang dipakai api & web. `WEAK_PASSWORD` (422) membawa `details.reason` salah satu nilai ini (ACC-001):
// web menampilkan pesan per alasan.
export const WEAK_PASSWORD_REASONS = ["too_short", "too_long", "too_common"] as const;
export type WeakPasswordReason = (typeof WEAK_PASSWORD_REASONS)[number];

export function isWeakPasswordReason(value: unknown): value is WeakPasswordReason {
  return typeof value === "string" && (WEAK_PASSWORD_REASONS as readonly string[]).includes(value);
}
