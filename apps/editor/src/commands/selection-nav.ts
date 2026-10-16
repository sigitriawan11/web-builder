import type { Node } from "@platform/document-model";

// ED-055: navigasi hierarki seleksi dengan keyboard. Fungsi murni agar bisa diuji lepas dari DOM/event.

export type NavAction = "child" | "parent" | "nextSibling" | "prevSibling";

export type NavResult =
  | { type: "select"; ids: string[] }
  // Enter pada node teks → masuk mode edit (bukan mengubah seleksi).
  | { type: "editText"; id: string }
  | { type: "none" };

type Lookup = (id: string) => Node | null;

const childrenOf = (node: Node | null): readonly string[] | null => (node && "children" in node ? node.children : null);

/**
 * ED-056: `Mod+A` memilih semua sibling dalam konteks seleksi saat ini — yaitu semua anak dari parent node
 * terseleksi. Tanpa seleksi (atau node tanpa parent, mis. page root) konteksnya adalah page root `rootId`,
 * sehingga memilih semua section top-level. Mengembalikan daftar anak konteks (kosong bila konteks bukan container).
 */
export function selectAllInContext(selectedIds: readonly string[], lookup: Lookup, rootId: string): string[] {
  const first = selectedIds[0];
  const contextId = first ? (lookup(first)?.parentId ?? rootId) : rootId;
  const children = childrenOf(lookup(contextId));
  return children ? [...children] : [];
}

/**
 * Hitung efek navigasi seleksi (ED-055):
 * - `child` (Enter): node teks → edit; container → pilih semua anak langsung.
 * - `parent` (Shift+Enter / `\`): pilih parent unik dari node terseleksi; page root (tanpa parent) → tidak ada efek.
 * - `nextSibling`/`prevSibling` (Tab / Shift+Tab): sibling berikut/sebelum dalam parent, wrap around.
 */
export function navigateSelection(action: NavAction, selectedIds: readonly string[], lookup: Lookup): NavResult {
  const first = selectedIds[0];
  if (!first) return { type: "none" };
  const node = lookup(first);
  if (!node) return { type: "none" };

  if (action === "parent") {
    const parents: string[] = [];
    for (const id of selectedIds) {
      const parentId = lookup(id)?.parentId;
      if (parentId && !parents.includes(parentId)) parents.push(parentId);
    }
    return parents.length > 0 ? { type: "select", ids: parents } : { type: "none" };
  }

  // child & sibling hanya untuk seleksi tunggal (Figma).
  if (selectedIds.length !== 1) return { type: "none" };

  if (action === "child") {
    if (node.type === "text") return { type: "editText", id: node.id };
    const children = childrenOf(node);
    return children && children.length > 0 ? { type: "select", ids: [...children] } : { type: "none" };
  }

  const siblings = node.parentId ? childrenOf(lookup(node.parentId)) : null;
  if (!siblings || siblings.length === 0) return { type: "none" };
  const index = siblings.indexOf(first);
  if (index < 0) return { type: "none" };
  const delta = action === "nextSibling" ? 1 : -1;
  const next = siblings[(index + delta + siblings.length) % siblings.length];
  return next && next !== first ? { type: "select", ids: [next] } : { type: "none" };
}
