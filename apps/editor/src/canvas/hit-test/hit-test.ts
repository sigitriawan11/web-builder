// ED-020: node di bawah pointer. `elementsFromPoint` menangani z-order, overflow clip, dan rotasi.
// Aturan kedalaman klik (pilih top-level dulu, ED-051) diterapkan di atas hasil ini (T0.5.4).

export interface HitResult {
  nodeId: string;
  // Rantai ID node dari node yang kena sampai page (terdalam → terluar), untuk resolver kedalaman.
  path: string[];
}

const NODE_SELECTOR = "[data-node-id]";

// Rantai node lewat DOM: elemen node bersarang sama persis dengan tree dokumen.
function nodePath(element: Element): string[] {
  const path: string[] = [];
  for (
    let current = element.closest(NODE_SELECTOR);
    current;
    current = current.parentElement?.closest(NODE_SELECTOR) ?? null
  ) {
    const id = current.getAttribute("data-node-id");
    if (id) path.push(id);
  }
  return path;
}

/**
 * Node teratas di titik screen yang boleh dipilih. Node yang tidak boleh dipilih (terkunci, atau
 * ancestor-nya terkunci) dilewati sehingga klik "tembus" ke node di bawahnya, biasanya parent.
 * Node tersembunyi (`display: none`) tidak pernah muncul di elementsFromPoint.
 */
export function hitTestNode(
  root: DocumentOrShadowRoot,
  clientX: number,
  clientY: number,
  isSelectable: (path: readonly string[]) => boolean,
): HitResult | null {
  const seen = new Set<Element>();
  for (const element of root.elementsFromPoint(clientX, clientY)) {
    const nodeElement = element.closest(NODE_SELECTOR);
    if (!nodeElement || seen.has(nodeElement)) continue;
    seen.add(nodeElement);
    const path = nodePath(nodeElement);
    const [nodeId] = path;
    if (nodeId && isSelectable(path)) return { nodeId, path };
  }
  return null;
}

// Aturan ED-020: terkunci = tidak bisa dipilih di canvas, termasuk semua turunan node terkunci.
export function isSelectablePath(path: readonly string[], isLocked: (id: string) => boolean): boolean {
  return !path.some(isLocked);
}
