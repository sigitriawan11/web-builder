// Path halaman `apps/web` yang dirujuk dari luar web (link email, redirect api). Satu sumber agar link email tidak
// patah saat route web dibuat (T1.14.4). Relatif terhadap PUBLIC_APP_URL.
export const APP_PATHS = {
  dashboard: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  // Hasil klik link verifikasi (sukses / `?error=token_expired` + kirim ulang) dan form kode 6 digit (ACC-003).
  verifyEmail: "/verify-email",
  // Form password baru setelah klik link reset (`?token=` atau `?error=INVALID_TOKEN`), ACC-005.
  resetPassword: "/reset-password",
} as const;

/**
 * `?next=` setelah login (ACC-004): hanya path internal. URL absolut, `//host`, `\\host`, skema (`javascript:`),
 * dan karakter kontrol ditolak → `fallback`. Mencegah open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback: string = APP_PATHS.dashboard): string {
  if (!next || next.length > 2048) return fallback;
  // Path internal: diawali satu "/" yang tidak diikuti "/" atau "\\" (browser memperlakukan "/\\host" seperti "//host").
  if (!/^\/(?![/\\])/.test(next)) return fallback;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: justru karakter kontrol yang ditolak.
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  // Backslash di mana pun ditolak: sebagian browser menormalkannya menjadi "/".
  if (next.includes("\\")) return fallback;
  return next;
}
