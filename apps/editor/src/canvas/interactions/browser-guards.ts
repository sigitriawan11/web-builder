// ED-025: shortcut bawaan browser yang mengganggu saat bekerja di canvas.
const BLOCKED_MOD_KEYS = new Set(["s", "p", "d", "g"]);

export interface ShortcutInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

// Mod+S (simpan halaman), Mod+P (print), Mod+D (bookmark), Mod+G (find next).
export function isBlockedBrowserShortcut(input: ShortcutInput): boolean {
  return (input.ctrlKey || input.metaKey) && !input.altKey && BLOCKED_MOD_KEYS.has(input.key.toLowerCase());
}
