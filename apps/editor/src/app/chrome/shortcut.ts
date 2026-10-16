// Representasi & tampilan shortcut keyboard (ED-006 tooltip "nama + shortcut", ED-190 sheet). `Mod` = Ctrl
// (Windows/Linux) / ⌘ (Mac). Tampilan tooltip mengikuti OS; atribut `aria-keyshortcuts` memakai nama kunci ARIA.

export interface Shortcut {
  // `KeyboardEvent.code` (tidak bergantung layout keyboard), mis. "KeyZ", "Digit0", "Equal".
  code: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export const isMacPlatform = (platform: string = globalThis.navigator?.platform ?? ""): boolean =>
  /Mac|iPhone|iPad/.test(platform);

const KEY_LABEL: Record<string, string> = {
  Equal: "+",
  Minus: "-",
  Backslash: "\\",
  Slash: "/",
  Escape: "Esc",
  Delete: "Del",
  Backspace: "⌫",
  Enter: "Enter",
  Space: "Space",
};

function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return KEY_LABEL[code] ?? code;
}

/** Teks untuk tooltip/menu: "Ctrl+Shift+K" atau "⇧⌘K" di Mac. */
export function formatShortcut(shortcut: Shortcut, mac = isMacPlatform()): string {
  const key = keyLabel(shortcut.code);
  if (mac) return `${shortcut.alt ? "⌥" : ""}${shortcut.shift ? "⇧" : ""}${shortcut.mod ? "⌘" : ""}${key}`;
  return [shortcut.mod ? "Ctrl" : null, shortcut.alt ? "Alt" : null, shortcut.shift ? "Shift" : null, key]
    .filter(Boolean)
    .join("+");
}

/** Nilai `aria-keyshortcuts` (WAI-ARIA): "Control+Shift+K" / "Meta+Shift+K". */
export function ariaShortcut(shortcut: Shortcut, mac = isMacPlatform()): string {
  const key = keyLabel(shortcut.code);
  return [
    shortcut.mod ? (mac ? "Meta" : "Control") : null,
    shortcut.alt ? "Alt" : null,
    shortcut.shift ? "Shift" : null,
    key,
  ]
    .filter(Boolean)
    .join("+");
}

/** Event keyboard cocok dengan shortcut (modifier harus persis — Ctrl+Shift+Z ≠ Ctrl+Z). */
export function matchesShortcut(
  event: Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
  shortcut: Shortcut,
): boolean {
  const mod = event.ctrlKey || event.metaKey;
  return (
    event.code === shortcut.code &&
    mod === (shortcut.mod ?? false) &&
    event.shiftKey === (shortcut.shift ?? false) &&
    event.altKey === (shortcut.alt ?? false)
  );
}
