import type { Shortcut } from "../app/chrome/shortcut";
import { TOOLS } from "../tools/tool-catalog";

// ED-202/ED-203: registry shortcut terpusat — SATU sumber kebenaran untuk handler, tooltip, menu, command palette, dan
// cheat sheet (tidak ada string shortcut hardcoded di UI). Memakai tipe `Shortcut` berbasis `event.code` (tak
// bergantung layout keyboard) + `matchesShortcut`/`formatShortcut` yang sudah ada — bukan tinykeys (lihat Lampiran D).

// Konteks aktif shortcut. `global` berlaku di semua konteks; huruf tunggal hanya di `canvas`/`layers` (bukan input).
export type ShortcutScope = "global" | "canvas" | "textEditing" | "layers" | "input" | "modal";

export interface ShortcutBinding {
  /** ID command stabil, mis. "edit.undo" — dipakai palette, context menu, dan telemetri. */
  id: string;
  /** Kunci i18n judul command (`command.<…>`) untuk palette/menu/cheat sheet. */
  titleKey: string;
  scope: ShortcutScope;
  /** Satu atau beberapa chord setara (mis. Redo = Mod+Shift+Z atau Mod+Y). */
  keys: readonly Shortcut[];
  prio: "P0" | "P1" | "P2";
  /**
   * `Mod+K` bermakna ganda (Add link saat ada seleksi/edit teks, selain itu command palette) — di-resolve saat
   * runtime, jadi dikecualikan dari cek konflik ketat agar alias yang sama tidak dianggap bentrok.
   */
  conditional?: boolean;
}

const chord = (code: string, mods: Omit<Shortcut, "code"> = {}): Shortcut => ({ code, ...mods });
const digits = (prefix: string): string[] => Array.from({ length: 10 }, (_, i) => `${prefix}${i}`);

// Tool = sumber dari tool-catalog (ED-006), supaya tidak ada definisi ganda.
const toolBindings: ShortcutBinding[] = TOOLS.map((tool) => ({
  id: `tool.${tool.id}`,
  titleKey: `command.tool.${tool.id}`,
  scope: "canvas",
  keys: tool.shortcuts,
  prio: tool.id === "line" ? "P1" : "P0",
}));

// Opacity 10–100% (digit 1–9, 0 = 100%) saat node terseleksi.
const opacityBindings: ShortcutBinding[] = digits("Digit").map((code, i) => ({
  id: `opacity.${i === 0 ? 100 : i * 10}`,
  titleKey: "command.opacity",
  scope: "canvas",
  keys: [chord(code)],
  prio: "P0",
}));

// Nudge 1px (Arrow) & 10px (Shift+Arrow).
const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const;
const nudgeBindings: ShortcutBinding[] = ARROWS.flatMap((code) => [
  {
    id: `nudge.${code}`,
    titleKey: "command.nudge",
    scope: "canvas" as const,
    keys: [chord(code)],
    prio: "P0" as const,
  },
  {
    id: `nudge.big.${code}`,
    titleKey: "command.nudgeBig",
    scope: "canvas" as const,
    keys: [chord(code, { shift: true })],
    prio: "P0" as const,
  },
]);

const otherBindings: ShortcutBinding[] = [
  // Seleksi
  {
    id: "select.all",
    titleKey: "command.selectAll",
    scope: "canvas",
    keys: [chord("KeyA", { mod: true })],
    prio: "P0",
  },
  { id: "select.children", titleKey: "command.selectChildren", scope: "canvas", keys: [chord("Enter")], prio: "P0" },
  {
    id: "select.parent",
    titleKey: "command.selectParent",
    scope: "canvas",
    keys: [chord("Enter", { shift: true }), chord("Backslash")],
    prio: "P0",
  },
  { id: "select.next", titleKey: "command.selectNext", scope: "canvas", keys: [chord("Tab")], prio: "P0" },
  {
    id: "select.prev",
    titleKey: "command.selectPrev",
    scope: "canvas",
    keys: [chord("Tab", { shift: true })],
    prio: "P0",
  },
  { id: "select.clear", titleKey: "command.selectClear", scope: "canvas", keys: [chord("Escape")], prio: "P0" },

  // Edit & transform
  { id: "edit.undo", titleKey: "command.undo", scope: "global", keys: [chord("KeyZ", { mod: true })], prio: "P0" },
  {
    id: "edit.redo",
    titleKey: "command.redo",
    scope: "global",
    keys: [chord("KeyZ", { mod: true, shift: true }), chord("KeyY", { mod: true })],
    prio: "P0",
  },
  { id: "edit.copy", titleKey: "command.copy", scope: "canvas", keys: [chord("KeyC", { mod: true })], prio: "P0" },
  { id: "edit.cut", titleKey: "command.cut", scope: "canvas", keys: [chord("KeyX", { mod: true })], prio: "P0" },
  { id: "edit.paste", titleKey: "command.paste", scope: "canvas", keys: [chord("KeyV", { mod: true })], prio: "P0" },
  {
    id: "edit.pasteInPlace",
    titleKey: "command.pasteInPlace",
    scope: "canvas",
    keys: [chord("KeyV", { mod: true, shift: true })],
    prio: "P0",
  },
  {
    id: "edit.duplicate",
    titleKey: "command.duplicate",
    scope: "canvas",
    keys: [chord("KeyD", { mod: true })],
    prio: "P0",
  },
  {
    id: "edit.delete",
    titleKey: "command.delete",
    scope: "canvas",
    keys: [chord("Delete"), chord("Backspace")],
    prio: "P0",
  },
  { id: "edit.rename", titleKey: "command.rename", scope: "canvas", keys: [chord("KeyR", { mod: true })], prio: "P0" },
  {
    id: "edit.lock",
    titleKey: "command.lock",
    scope: "canvas",
    keys: [chord("KeyL", { mod: true, shift: true })],
    prio: "P0",
  },
  {
    id: "edit.hide",
    titleKey: "command.hide",
    scope: "canvas",
    keys: [chord("KeyH", { mod: true, shift: true })],
    prio: "P0",
  },

  // Arrange (z-order)
  {
    id: "arrange.forward",
    titleKey: "command.bringForward",
    scope: "canvas",
    keys: [chord("BracketRight", { mod: true })],
    prio: "P0",
  },
  {
    id: "arrange.backward",
    titleKey: "command.sendBackward",
    scope: "canvas",
    keys: [chord("BracketLeft", { mod: true })],
    prio: "P0",
  },
  {
    id: "arrange.front",
    titleKey: "command.bringToFront",
    scope: "canvas",
    keys: [chord("BracketRight", { mod: true, alt: true })],
    prio: "P0",
  },
  {
    id: "arrange.back",
    titleKey: "command.sendToBack",
    scope: "canvas",
    keys: [chord("BracketLeft", { mod: true, alt: true })],
    prio: "P0",
  },

  // Struktur & layout
  {
    id: "layout.addAuto",
    titleKey: "command.addAutoLayout",
    scope: "canvas",
    keys: [chord("KeyA", { shift: true })],
    prio: "P0",
  },
  {
    id: "layout.removeAuto",
    titleKey: "command.removeAutoLayout",
    scope: "canvas",
    keys: [chord("KeyA", { shift: true, alt: true })],
    prio: "P0",
  },
  {
    id: "structure.frameSelection",
    titleKey: "command.frameSelection",
    scope: "canvas",
    keys: [chord("KeyG", { mod: true, alt: true })],
    prio: "P0",
  },
  {
    id: "align.left",
    titleKey: "command.alignLeft",
    scope: "canvas",
    keys: [chord("KeyA", { alt: true })],
    prio: "P0",
  },
  {
    id: "align.center",
    titleKey: "command.alignCenter",
    scope: "canvas",
    keys: [chord("KeyH", { alt: true })],
    prio: "P0",
  },
  {
    id: "align.right",
    titleKey: "command.alignRight",
    scope: "canvas",
    keys: [chord("KeyD", { alt: true })],
    prio: "P0",
  },
  { id: "align.top", titleKey: "command.alignTop", scope: "canvas", keys: [chord("KeyW", { alt: true })], prio: "P0" },
  {
    id: "align.middle",
    titleKey: "command.alignMiddle",
    scope: "canvas",
    keys: [chord("KeyV", { alt: true })],
    prio: "P0",
  },
  {
    id: "align.bottom",
    titleKey: "command.alignBottom",
    scope: "canvas",
    keys: [chord("KeyS", { alt: true })],
    prio: "P0",
  },
  {
    id: "distribute.h",
    titleKey: "command.distributeH",
    scope: "canvas",
    keys: [chord("KeyH", { alt: true, shift: true })],
    prio: "P0",
  },
  {
    id: "distribute.v",
    titleKey: "command.distributeV",
    scope: "canvas",
    keys: [chord("KeyV", { alt: true, shift: true })],
    prio: "P0",
  },
  // Mod+K: Add link bila ada node terseleksi/edit teks (conditional — lihat palette).
  {
    id: "node.addLink",
    titleKey: "command.addLink",
    scope: "canvas",
    keys: [chord("KeyK", { mod: true })],
    prio: "P0",
    conditional: true,
  },

  // Teks (saat text editing)
  { id: "text.bold", titleKey: "command.bold", scope: "textEditing", keys: [chord("KeyB", { mod: true })], prio: "P0" },
  {
    id: "text.italic",
    titleKey: "command.italic",
    scope: "textEditing",
    keys: [chord("KeyI", { mod: true })],
    prio: "P0",
  },
  {
    id: "text.underline",
    titleKey: "command.underline",
    scope: "textEditing",
    keys: [chord("KeyU", { mod: true })],
    prio: "P0",
  },
  {
    id: "text.strike",
    titleKey: "command.strikethrough",
    scope: "textEditing",
    keys: [chord("KeyX", { mod: true, shift: true })],
    prio: "P0",
  },
  { id: "text.link", titleKey: "command.link", scope: "textEditing", keys: [chord("KeyK", { mod: true })], prio: "P0" },
  {
    id: "text.bulletList",
    titleKey: "command.bulletList",
    scope: "textEditing",
    keys: [chord("Digit8", { mod: true, shift: true })],
    prio: "P0",
  },
  {
    id: "text.numberList",
    titleKey: "command.numberList",
    scope: "textEditing",
    keys: [chord("Digit7", { mod: true, shift: true })],
    prio: "P0",
  },
  {
    id: "text.alignLeft",
    titleKey: "command.textAlignLeft",
    scope: "textEditing",
    keys: [chord("KeyL", { mod: true, alt: true })],
    prio: "P0",
  },
  {
    id: "text.alignCenter",
    titleKey: "command.textAlignCenter",
    scope: "textEditing",
    keys: [chord("KeyT", { mod: true, alt: true })],
    prio: "P0",
  },
  {
    id: "text.alignRight",
    titleKey: "command.textAlignRight",
    scope: "textEditing",
    keys: [chord("KeyR", { mod: true, alt: true })],
    prio: "P0",
  },
  {
    id: "text.alignJustify",
    titleKey: "command.textAlignJustify",
    scope: "textEditing",
    keys: [chord("KeyJ", { mod: true, alt: true })],
    prio: "P0",
  },
  {
    id: "text.lineBreak",
    titleKey: "command.lineBreak",
    scope: "textEditing",
    keys: [chord("Enter", { shift: true })],
    prio: "P0",
  },
  { id: "text.exit", titleKey: "command.exitText", scope: "textEditing", keys: [chord("Escape")], prio: "P0" },

  // View & navigasi
  { id: "zoom.in", titleKey: "command.zoomIn", scope: "canvas", keys: [chord("Equal", { mod: true })], prio: "P0" },
  { id: "zoom.out", titleKey: "command.zoomOut", scope: "canvas", keys: [chord("Minus", { mod: true })], prio: "P0" },
  {
    id: "zoom.fit",
    titleKey: "command.zoomFit",
    scope: "canvas",
    keys: [chord("Digit1", { shift: true })],
    prio: "P0",
  },
  {
    id: "zoom.selection",
    titleKey: "command.zoomSelection",
    scope: "canvas",
    keys: [chord("Digit2", { shift: true })],
    prio: "P0",
  },
  {
    id: "zoom.100",
    titleKey: "command.zoom100",
    scope: "canvas",
    keys: [chord("Digit0", { shift: true })],
    prio: "P0",
  },
  {
    id: "breakpoint.desktop",
    titleKey: "command.breakpointDesktop",
    scope: "global",
    keys: [chord("Digit1", { alt: true, shift: true })],
    prio: "P0",
  },
  {
    id: "breakpoint.tablet",
    titleKey: "command.breakpointTablet",
    scope: "global",
    keys: [chord("Digit2", { alt: true, shift: true })],
    prio: "P0",
  },
  {
    id: "breakpoint.mobile",
    titleKey: "command.breakpointMobile",
    scope: "global",
    keys: [chord("Digit3", { alt: true, shift: true })],
    prio: "P0",
  },
  {
    id: "panel.layers",
    titleKey: "command.panelLayers",
    scope: "global",
    keys: [chord("Digit1", { alt: true })],
    prio: "P0",
  },
  {
    id: "panel.assets",
    titleKey: "command.panelAssets",
    scope: "global",
    keys: [chord("Digit2", { alt: true })],
    prio: "P0",
  },
  {
    id: "panel.insert",
    titleKey: "command.panelInsert",
    scope: "global",
    keys: [chord("Digit3", { alt: true })],
    prio: "P0",
  },
  {
    id: "panel.pages",
    titleKey: "command.panelPages",
    scope: "global",
    keys: [chord("Digit4", { alt: true })],
    prio: "P0",
  },
  {
    id: "view.preview",
    titleKey: "command.preview",
    scope: "global",
    keys: [chord("Enter", { mod: true })],
    prio: "P0",
  },
  // Command palette: Mod+/ selalu; Mod+K hanya bila tak ada seleksi (conditional).
  {
    id: "view.palette",
    titleKey: "command.palette",
    scope: "global",
    keys: [chord("Slash", { mod: true }), chord("KeyK", { mod: true })],
    prio: "P0",
    conditional: true,
  },
  {
    id: "view.cheatSheet",
    titleKey: "command.cheatSheet",
    scope: "global",
    keys: [chord("Slash", { mod: true, shift: true })],
    prio: "P0",
  },
  { id: "view.save", titleKey: "command.save", scope: "global", keys: [chord("KeyS", { mod: true })], prio: "P0" },
];

export const SHORTCUT_REGISTRY: readonly ShortcutBinding[] = [
  ...toolBindings,
  ...opacityBindings,
  ...nudgeBindings,
  ...otherBindings,
];

/** Kunci kanonik satu chord (code + modifier) untuk deteksi duplikat. */
export function chordKey(shortcut: Shortcut): string {
  return `${shortcut.code}|${shortcut.mod ? 1 : 0}${shortcut.shift ? 1 : 0}${shortcut.alt ? 1 : 0}`;
}

/** Dua scope bentrok bila sama, atau salah satunya `global` (berlaku di semua konteks). */
function scopesOverlap(a: ShortcutScope, b: ShortcutScope): boolean {
  return a === b || a === "global" || b === "global";
}

export interface ShortcutConflict {
  chord: string;
  a: string;
  b: string;
}

/**
 * Konflik = dua binding berbagi chord pada scope yang beririsan, dan keduanya bukan `conditional`
 * (Mod+K ganda di-resolve runtime). ED-202 AC: tidak ada duplikat dalam konteks yang sama.
 */
export function findShortcutConflicts(registry: readonly ShortcutBinding[] = SHORTCUT_REGISTRY): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = [];
  for (let i = 0; i < registry.length; i++) {
    for (let j = i + 1; j < registry.length; j++) {
      const a = registry[i];
      const b = registry[j];
      if (!a || !b || a.conditional || b.conditional || !scopesOverlap(a.scope, b.scope)) continue;
      const shared = a.keys.find((ka) => b.keys.some((kb) => chordKey(ka) === chordKey(kb)));
      if (shared) conflicts.push({ chord: chordKey(shared), a: a.id, b: b.id });
    }
  }
  return conflicts;
}

export const bindingById = (id: string): ShortcutBinding | undefined =>
  SHORTCUT_REGISTRY.find((binding) => binding.id === id);

/** Chord utama (pertama) untuk sebuah command — dipakai tooltip/menu. */
export const primaryShortcut = (id: string): Shortcut | undefined => bindingById(id)?.keys[0];

export const bindingsInScope = (scope: ShortcutScope): ShortcutBinding[] =>
  SHORTCUT_REGISTRY.filter((binding) => binding.scope === scope || binding.scope === "global");
