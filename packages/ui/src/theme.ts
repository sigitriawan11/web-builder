// Preferensi tema chrome (ED-012): ikuti OS (`system`) atau dipaksa. Disimpan di cookie agar server bisa memasang
// kelas di <html> sejak render pertama (tanpa script inline — CSP nonce, PUB-211); `system` = tanpa kelas, CSS
// mengikuti `prefers-color-scheme`.

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const THEME_COOKIE = "theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Kelas untuk <html>: `light`/`dark` saat dipaksa, tanpa kelas saat mengikuti OS. */
export function themeClassName(preference: ThemePreference): "light" | "dark" | undefined {
  return preference === "system" ? undefined : preference;
}

/** Terapkan & simpan preferensi di browser (cookie 1 tahun, path `/`). */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  const className = themeClassName(preference);
  if (className) root.classList.add(className);
  // biome-ignore lint/suspicious/noDocumentCookie: cookie sederhana non-rahasia; Cookie Store API belum merata.
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=31536000; samesite=lax`;
}
