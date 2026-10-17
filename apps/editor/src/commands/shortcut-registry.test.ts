import { describe, expect, it } from "vitest";
import {
  bindingById,
  chordKey,
  findShortcutConflicts,
  primaryShortcut,
  SHORTCUT_REGISTRY,
  type ShortcutBinding,
} from "./shortcut-registry";

describe("SHORTCUT_REGISTRY", () => {
  it("tidak ada konflik chord dalam konteks yang sama (ED-202 AC)", () => {
    expect(findShortcutConflicts()).toEqual([]);
  });

  it("setiap command id unik", () => {
    const ids = SHORTCUT_REGISTRY.map((binding) => binding.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("setiap binding punya minimal satu chord & titleKey command.*", () => {
    for (const binding of SHORTCUT_REGISTRY) {
      expect(binding.keys.length).toBeGreaterThan(0);
      expect(binding.titleKey).toMatch(/^command\./);
    }
  });

  it("memuat baris P0 penting dari tabel ED-203", () => {
    // Tools, edit, view — sampel kunci yang harus ada.
    expect(primaryShortcut("tool.select")).toEqual({ code: "KeyV" });
    expect(primaryShortcut("edit.undo")).toEqual({ code: "KeyZ", mod: true });
    expect(primaryShortcut("view.preview")).toEqual({ code: "Enter", mod: true });
    expect(bindingById("edit.redo")?.keys).toContainEqual({ code: "KeyY", mod: true });
  });

  it("Mod+K ganda (add link vs palette) tidak dianggap konflik", () => {
    const addLink = bindingById("node.addLink");
    const palette = bindingById("view.palette");
    expect(addLink?.conditional).toBe(true);
    expect(palette?.conditional).toBe(true);
    // Keduanya memang berbagi Mod+K tetapi conditional → bukan konflik.
    expect(chordKey({ code: "KeyK", mod: true })).toBe(chordKey(palette?.keys[1] ?? { code: "" }));
  });
});

describe("findShortcutConflicts", () => {
  const base: ShortcutBinding = {
    id: "x",
    titleKey: "command.x",
    scope: "canvas",
    keys: [{ code: "KeyX" }],
    prio: "P0",
  };

  it("mendeteksi chord sama di scope sama", () => {
    const conflicts = findShortcutConflicts([base, { ...base, id: "y", titleKey: "command.y" }]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ a: "x", b: "y" });
  });

  it("scope berbeda (canvas vs textEditing) bukan konflik", () => {
    expect(findShortcutConflicts([base, { ...base, id: "y", scope: "textEditing" }])).toEqual([]);
  });

  it("global bentrok dengan scope apa pun", () => {
    expect(findShortcutConflicts([base, { ...base, id: "y", scope: "global" }])).toHaveLength(1);
  });

  it("conditional dikecualikan", () => {
    expect(findShortcutConflicts([base, { ...base, id: "y", conditional: true }])).toEqual([]);
  });
});
