import COMMON_PASSWORD_LIST from "./common-passwords.json" with { type: "json" };

// Kebijakan password ACC-001: 8–128 karakter, tanpa aturan komposisi, tolak password umum.
// `common-passwords.json` = SecLists `Pwdb_top-10000.txt` (MIT): top 10k dari kebocoran kredensial, disaring ke
// panjang 8–128 (yang lebih pendek sudah ditolak aturan panjang), huruf kecil, unik. Dibandingkan tanpa membedakan
// huruf besar/kecil, sehingga `Password123` juga ditolak.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS: ReadonlySet<string> = new Set(COMMON_PASSWORD_LIST);

export type PasswordProblem = "too_short" | "too_long" | "too_common";

/** Masalah pertama pada password, atau `null` bila memenuhi kebijakan. Panjang dihitung seperti Better Auth. */
export function checkPassword(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "too_short";
  if (password.length > PASSWORD_MAX_LENGTH) return "too_long";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "too_common";
  return null;
}
