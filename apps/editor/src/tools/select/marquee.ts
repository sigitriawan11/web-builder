import type { PressTarget } from "../../canvas/interactions/interaction-machine";
import type { NodeLookup } from "./selection-depth";

// ED-053: marquee selection. Logika murni; rect dalam koordinat world.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

// ED-053: node terpilih jika bounding box-nya bersinggungan dengan marquee (default Figma), bukan harus tercakup.
// Bersentuhan di tepi saja (luas irisan 0) tidak dihitung.
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function marqueeHits(marquee: Rect, candidates: readonly { id: string; rect: Rect | null }[]): string[] {
  if (marquee.width === 0 && marquee.height === 0) return [];
  return candidates.filter(({ rect }) => rect !== null && rectsIntersect(marquee, rect)).map(({ id }) => id);
}

/**
 * Target saat pointer ditekan (selain handle). Drag di latar page atau di luar page = marquee top-level;
 * drag di latar frame yang sedang "dimasuki" (parent dari node terseleksi) = marquee di dalam frame itu;
 * drag di node lain = pindah node (ED-053: drag latar frame biasa memindah frame).
 */
export function resolvePressTarget(
  hit: { nodeId: string; path: readonly string[] } | null,
  selection: readonly string[],
  lookup: NodeLookup,
): Exclude<PressTarget, { kind: "handle" }> {
  if (!hit) return { kind: "empty", scopeId: null, path: [] };
  if (lookup(hit.nodeId)?.type === "page") return { kind: "empty", scopeId: hit.nodeId, path: hit.path };
  const entered = selection.some((id) => lookup(id)?.parentId === hit.nodeId);
  if (entered) return { kind: "empty", scopeId: hit.nodeId, path: hit.path };
  return { kind: "node", nodeId: hit.nodeId, path: hit.path };
}
