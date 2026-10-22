// ED-058 / T3.6.3: hit-test resolved child di dalam instance. Resolved child hanya memakai `data-resolved-id`
// (bukan `data-node-id`) sehingga tak terseleksi oleh hit-test biasa (interior read-only). Double-click memanggil
// ini untuk masuk ke child. Hanya instance satu tingkat (bukan repeater `:i<idx>` / nested `inst:def:def`) —
// id resolved berbentuk `${instanceId}:${defNodeId}`; path dengan `:` berarti nested/repeater → M4.

export interface InstanceChildHit {
  // ID node definisi (satu segmen) = key override di `props.overrides`.
  path: string;
  // ID resolved penuh (`inst:def`) untuk overlay/pengukuran.
  resolvedId: string;
}

/** Path override (ID node definisi) dari id resolved `${instanceId}:${defNodeId}`. Null bila bukan milik instance
 * ini, atau nested/repeater (mengandung `:` setelah prefix) yang belum didukung override langsung (M4). */
export function instanceChildPath(resolvedId: string, instanceId: string): string | null {
  const prefix = `${instanceId}:`;
  if (!resolvedId.startsWith(prefix)) return null;
  const path = resolvedId.slice(prefix.length);
  if (path.length === 0 || path.includes(":")) return null;
  return path;
}

export function hitTestInstanceChild(clientX: number, clientY: number, instanceId: string): InstanceChildHit | null {
  const world = document.getElementById("world");
  const root: DocumentOrShadowRoot = world?.shadowRoot ?? document;
  for (const element of root.elementsFromPoint(clientX, clientY)) {
    const resolvedElement = element.closest("[data-resolved-id]");
    const resolvedId = resolvedElement?.getAttribute("data-resolved-id");
    if (!resolvedId) continue;
    const path = instanceChildPath(resolvedId, instanceId);
    // Hanya resolved child milik instance ini; nested/repeater → hentikan (jangan jatuh ke parent lain).
    if (resolvedId.startsWith(`${instanceId}:`)) return path ? { path, resolvedId } : null;
  }
  return null;
}
