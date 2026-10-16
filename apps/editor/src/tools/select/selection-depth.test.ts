import { describe, expect, it } from "vitest";
import { isEffectivelyLocked, type NodeInfo, resolveClickSelection, resolveDoubleClick } from "./selection-depth";

// Pohon mirip fixture landing: page > section Hero > Row > Copy > Title/Button>Label, Row > Photo;
// page > section Fitur > Grid > Card(card) > Foto/Judul.
const TREE: Record<string, NodeInfo> = {
  page: { type: "page", parentId: null },
  hero: { type: "frame", parentId: "page", role: "section" },
  row: { type: "frame", parentId: "hero" },
  copy: { type: "frame", parentId: "row" },
  title: { type: "text", parentId: "copy" },
  button: { type: "frame", parentId: "copy", role: "button" },
  label: { type: "text", parentId: "button" },
  photo: { type: "image", parentId: "row" },
  fitur: { type: "frame", parentId: "page", role: "section" },
  grid: { type: "frame", parentId: "fitur", role: "list" },
  card: { type: "frame", parentId: "grid", role: "card" },
  cardPhoto: { type: "image", parentId: "card" },
  cardTitle: { type: "text", parentId: "card" },
};
const lookup = (id: string) => TREE[id] ?? null;

// Path hit-test (terdalam → page) dari pohon.
function pathTo(id: string): string[] {
  const path: string[] = [];
  for (let current: string | null = id; current; current = TREE[current]?.parentId ?? null) path.push(current);
  return path;
}

const click = (target: string, selection: string[] = []) => resolveClickSelection(pathTo(target), selection, lookup);
const dblclick = (target: string, selection: string[]) => resolveDoubleClick(pathTo(target), selection, lookup);

describe("resolveClickSelection (ED-051)", () => {
  it("tanpa seleksi, klik di mana pun dalam section memilih section-nya", () => {
    expect(click("title")).toBe("hero");
    expect(click("label")).toBe("hero");
    expect(click("cardTitle")).toBe("fitur");
  });

  it("klik di latar page atau path kosong mengosongkan seleksi", () => {
    expect(click("page")).toBeNull();
    expect(click("page", ["hero"])).toBeNull();
    expect(resolveClickSelection([], ["hero"], lookup)).toBeNull();
  });

  it("section terseleksi: klik lagi di dalamnya tetap section; klik section lain memilih section lain", () => {
    expect(click("title", ["hero"])).toBe("hero");
    expect(click("cardTitle", ["hero"])).toBe("fitur");
  });

  it("setelah masuk (anak terseleksi), klik saudara memilih saudara di level yang sama", () => {
    expect(click("photo", ["copy"])).toBe("photo");
    expect(click("label", ["title"])).toBe("button");
  });

  it("klik di luar konteks seleksi naik ke konteks luar", () => {
    expect(click("cardTitle", ["title"])).toBe("fitur");
    expect(click("photo", ["title"])).toBe("photo");
  });

  it("pengecualian: teks/gambar langsung terpilih bila frame induk non-section terseleksi", () => {
    expect(click("cardTitle", ["card"])).toBe("cardTitle");
    expect(click("cardPhoto", ["card"])).toBe("cardPhoto");
    expect(click("label", ["button"])).toBe("label");
  });

  it("pengecualian tidak berlaku untuk section: anak frame tetap mengikuti aturan konteks", () => {
    expect(click("title", ["hero"])).toBe("hero");
  });
});

describe("resolveDoubleClick (ED-038)", () => {
  it("AC ED-051: klik judul → section; double-click → container; lalu turun sampai teks; lalu edit", () => {
    const first = click("title");
    expect(first).toBe("hero");
    expect(dblclick("title", ["hero"])).toEqual({ type: "select", nodeId: "row" });
    expect(dblclick("title", ["row"])).toEqual({ type: "select", nodeId: "copy" });
    expect(dblclick("title", ["copy"])).toEqual({ type: "select", nodeId: "title" });
    expect(dblclick("title", ["title"])).toEqual({ type: "editText", nodeId: "title" });
  });

  it("double-click di luar seleksi atau pada frame terseleksi tanpa anak di titik itu tidak berbuat apa-apa", () => {
    expect(dblclick("cardTitle", ["hero"])).toEqual({ type: "none" });
    expect(dblclick("photo", ["photo"])).toEqual({ type: "none" });
    expect(dblclick("title", [])).toEqual({ type: "none" });
  });
});

describe("node yang tidak dikenal (dokumen sedang berubah)", () => {
  const partial = (id: string) => (id === "title" ? { type: "text", parentId: "missing" } : (TREE[id] ?? null));

  it("rantai konteks berhenti di parent yang tidak dikenal; tetap jatuh ke konteks page", () => {
    expect(resolveClickSelection(pathTo("cardTitle"), ["title"], partial)).toBe("fitur");
  });

  it("anak di path yang tidak dikenal tidak memicu pengecualian teks/gambar; aturan konteks berlaku", () => {
    // Konteks = grid (parent kartu) → anak grid pada path = kartu itu sendiri.
    expect(resolveClickSelection(["ghostChild", "card", "grid", "fitur", "page"], ["card"], lookup)).toBe("card");
  });

  it("seleksi berisi node yang sudah tidak ada diabaikan", () => {
    expect(resolveClickSelection(pathTo("title"), ["ghost"], lookup)).toBe("hero");
    expect(resolveDoubleClick(pathTo("title"), ["ghost"], lookup)).toEqual({ type: "none" });
  });
});

describe("isEffectivelyLocked (ED-059)", () => {
  const lockedLookup = (locked: Set<string>) => (id: string) => {
    const info = TREE[id];
    return info ? { ...info, locked: locked.has(id) } : null;
  };

  it("node terkunci langsung → true", () => {
    expect(isEffectivelyLocked("card", lockedLookup(new Set(["card"])))).toBe(true);
  });

  it("descendant dari ancestor terkunci → true", () => {
    const lk = lockedLookup(new Set(["grid"]));
    expect(isEffectivelyLocked("card", lk)).toBe(true);
    expect(isEffectivelyLocked("cardTitle", lk)).toBe(true);
  });

  it("node tanpa ancestor terkunci → false", () => {
    expect(isEffectivelyLocked("cardTitle", lockedLookup(new Set(["hero"])))).toBe(false);
  });

  it("node tidak dikenal → false", () => {
    expect(isEffectivelyLocked("ghost", lockedLookup(new Set()))).toBe(false);
  });
});
