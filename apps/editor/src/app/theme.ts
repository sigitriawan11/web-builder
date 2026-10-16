import { isThemePreference, THEME_COOKIE, themeClassName } from "@platform/ui";

// Tema chrome editor (ED-012) = preferensi yang sama dengan dashboard (cookie `theme`, sama origin). Dipasang sebelum
// render pertama agar tidak berkedip; tanpa preferensi → CSS mengikuti OS.
export function applyThemeFromCookie(
  cookie: string = document.cookie,
  root: HTMLElement = document.documentElement,
): void {
  const value = cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === THEME_COOKIE)?.[1];
  const className = themeClassName(isThemePreference(value) ? value : "system");
  root.classList.remove("light", "dark");
  if (className) root.classList.add(className);
}
