// ED-051: aturan kedalaman seleksi klik tunggal & double-click (ED-038), meniru Figma. Logika murni.

export interface NodeInfo {
  type: string;
  parentId: string | null;
  // Petunjuk semantik frame (DM-011); "section" tidak kena pengecualian teks/gambar.
  role?: string | undefined;
}

export type NodeLookup = (id: string) => NodeInfo | null;

// Hasil: node yang dipilih, atau null = kosongkan seleksi.
export type ClickSelection = string | null;

const DIRECT_LEAF_TYPES = new Set(["text", "image"]);

// Rantai konteks dari parent node terseleksi sampai page (terdalam → terluar).
function contextChain(selectedId: string, lookup: NodeLookup): string[] {
  const chain: string[] = [];
  let current = lookup(selectedId)?.parentId ?? null;
  while (current) {
    chain.push(current);
    current = lookup(current)?.parentId ?? null;
  }
  return chain;
}

/**
 * Klik tunggal di titik dengan `path` hit-test (terdalam → page). Pilih node pada path yang merupakan
 * anak langsung dari konteks seleksi (parent node terseleksi, lalu ancestor-nya, sampai page).
 */
export function resolveClickSelection(
  path: readonly string[],
  selection: readonly string[],
  lookup: NodeLookup,
): ClickSelection {
  if (path.length === 0) return null;
  const pageId = path[path.length - 1] ?? null;

  // Pengecualian ED-051: teks/gambar langsung terpilih bila frame induknya (bukan section) terseleksi.
  for (const selectedId of selection) {
    const index = path.indexOf(selectedId);
    const child = index > 0 ? path[index - 1] : undefined;
    const selected = lookup(selectedId);
    if (
      child &&
      selected?.type === "frame" &&
      selected.role !== "section" &&
      DIRECT_LEAF_TYPES.has(lookup(child)?.type ?? "")
    ) {
      return child;
    }
  }

  const [anchor] = selection;
  const contexts = anchor ? contextChain(anchor, lookup) : [];
  if (pageId && !contexts.includes(pageId)) contexts.push(pageId);

  for (const context of contexts) {
    const index = path.indexOf(context);
    // Klik di dalam konteks ini, pada salah satu anaknya → pilih anak itu.
    if (index > 0) return path[index - 1] ?? null;
  }
  // Klik tepat di latar page (atau di luar konteks mana pun) → kosongkan seleksi.
  return null;
}

export type DoubleClickAction =
  | { type: "select"; nodeId: string }
  | { type: "editText"; nodeId: string }
  | { type: "none" };

/**
 * Double-click (ED-038): pada node terseleksi → masuk ke anak di bawah pointer; pada teks yang sudah
 * terseleksi → mode edit teks. Image (crop/replace) & instance menyusul di fase berikutnya.
 */
export function resolveDoubleClick(
  path: readonly string[],
  selection: readonly string[],
  lookup: NodeLookup,
): DoubleClickAction {
  for (const selectedId of selection) {
    const index = path.indexOf(selectedId);
    if (index > 0) {
      const child = path[index - 1];
      if (child) return { type: "select", nodeId: child };
    }
    if (index === 0 && lookup(selectedId)?.type === "text") return { type: "editText", nodeId: selectedId };
  }
  return { type: "none" };
}
