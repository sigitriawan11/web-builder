import { resolveStyle } from "@platform/document-model";
import { previewStore } from "../../store/preview-store";
import { cameraStore } from "../camera-store";
import type { CanvasRuntime } from "../canvas-runtime";
import { screenPoint, screenToWorld } from "../geometry/coordinates";
import {
  type ChildBox,
  type FlexDirection,
  type InsertionMarker,
  insertionMarker,
  type Rect,
  reorderIndex,
} from "./reorder";

// T3.6.2/ED-170: sisip "smart" saat drag component dari Insert panel ke canvas. Memakai geometri reorder (ED-063):
// cari container auto-layout terdalam di bawah pointer, hitung indeks sisip + garis penanda. "Antara dua section"
// muncul karena, saat pointer dekat tepi atas/bawah sebuah container anak, kita batal masuk ke dalamnya dan sisip
// sebagai saudara di parent-nya (edge-band bubbling).

const BAND_RATIO = 0.25;
const BAND_MIN = 8;
const BAND_MAX = 48;
const GHOST_SIZE = { width: 180, height: 56 };
const DRAG_THRESHOLD = 4;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Pointer berada di zona-dalam rect (bukan pita tepi sepanjang sumbu utama `direction`). */
export function innerBandContains(rect: Rect, pointer: { x: number; y: number }, direction: FlexDirection): boolean {
  if (direction === "row") {
    const band = clamp(rect.width * BAND_RATIO, BAND_MIN, BAND_MAX);
    return pointer.x > rect.x + band && pointer.x < rect.x + rect.width - band;
  }
  const band = clamp(rect.height * BAND_RATIO, BAND_MIN, BAND_MAX);
  return pointer.y > rect.y + band && pointer.y < rect.y + rect.height - band;
}

export interface FlexContainer {
  id: string;
  direction: FlexDirection;
  wrap: boolean;
}

/**
 * Pilih container drop dari rantai flex (urut TERLUAR→terdalam) berdasarkan pointer: turun ke anak hanya bila
 * pointer berada di zona-dalam anak itu (relatif sumbu utama parent); bila dekat tepi, berhenti di parent agar
 * sisipan jadi saudara (mis. "antara dua section"). Mengembalikan indeks terpilih dalam `chain`.
 */
export function chooseDropContainer(
  chain: readonly FlexContainer[],
  pointer: { x: number; y: number },
  rectOf: (id: string) => Rect | null,
): number {
  let chosen = 0;
  for (let i = 1; i < chain.length; i++) {
    const child = chain[i];
    const parent = chain[chosen];
    const rect = child ? rectOf(child.id) : null;
    if (child && parent && rect && innerBandContains(rect, pointer, parent.direction)) chosen = i;
    else break;
  }
  return chosen;
}

export interface InsertTarget {
  parentId: string;
  index: number;
  marker: InsertionMarker | null;
}

// Container drop di bawah pointer: node dengan `children`. Flex → arah/ wrap-nya; non-flex (page / frame block-flow)
// → diperlakukan KOLOM (urutan dokumen = tumpukan vertikal), karena sisip baru hanya butuh indeks (tak ada posisi
// visual yang dipertahankan seperti reorder freeform).
const containerOf = (runtime: CanvasRuntime, id: string): (FlexContainer & { children: readonly string[] }) | null => {
  const node = runtime.nodeStore.getNode(id);
  if (!node || !("children" in node)) return null;
  const layout = resolveStyle(node.style, "base").layout;
  return layout?.mode === "flex"
    ? { id, direction: layout.direction, wrap: layout.wrap === true, children: node.children }
    : { id, direction: "column", wrap: false, children: node.children };
};

/** Hitung target sisip {parentId, index, marker} untuk titik screen. Fallback: append ke page aktif. */
export function computeInsertTarget(runtime: CanvasRuntime, clientX: number, clientY: number): InsertTarget | null {
  const geometry = runtime.geometry.store;
  const hit = runtime.hitTest(clientX, clientY);
  const path = hit?.path ?? [];

  // Rantai container di bawah pointer, terdalam→terluar (urutan path), lalu dibalik jadi terluar→terdalam.
  const innerToOuter = path.flatMap((id) => {
    const container = containerOf(runtime, id);
    return container ? [container] : [];
  });
  if (innerToOuter.length === 0) {
    const page = containerOf(runtime, runtime.pageId);
    if (page) innerToOuter.push(page);
    else return null;
  }
  const chain = [...innerToOuter].reverse();

  const pointer = screenToWorld(
    screenPoint(clientX, clientY),
    cameraStore.getState(),
    runtime.marquee.viewportOffset(),
  );
  const chosen = chain[chooseDropContainer(chain, pointer, (id) => geometry.peekRect(id))];
  if (!chosen) return null;

  const siblings: ChildBox[] = chosen.children.flatMap((childId) => {
    const rect = geometry.peekRect(childId);
    return rect ? [{ id: childId, rect }] : [];
  });
  const index = reorderIndex(siblings, pointer, chosen.direction, chosen.wrap);
  const containerRect = geometry.peekRect(chosen.id);
  const marker = containerRect ? insertionMarker(siblings, index, chosen.direction, chosen.wrap, containerRect) : null;
  return { parentId: chosen.id, index, marker };
}

/**
 * Mulai sesi drag dari Insert panel. Setelah pointer melewati ambang, tampilkan ghost + penanda sisip (reuse
 * ReorderOverlay via previewStore). Saat dilepas: `onDrop(target)` dengan target geometrik (atau null bila belum
 * sempat men-drag — pemanggil bisa fallback ke sisip-klik). Membersihkan preview & listener di akhir.
 */
export function startPanelInsertDrag(opts: {
  runtime: CanvasRuntime;
  startX: number;
  startY: number;
  onDrop: (target: { parentId: string; index: number } | null, dragged: boolean) => void;
}): void {
  const { runtime, startX, startY, onDrop } = opts;
  let dragging = false;
  let last: { parentId: string; index: number } | null = null;

  const move = (event: PointerEvent) => {
    if (!dragging && Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD) return;
    dragging = true;
    const target = computeInsertTarget(runtime, event.clientX, event.clientY);
    last = target ? { parentId: target.parentId, index: target.index } : null;
    const world = screenToWorld(
      screenPoint(event.clientX, event.clientY),
      cameraStore.getState(),
      runtime.marquee.viewportOffset(),
    );
    previewStore.getState().setReorder({
      ghost: { x: world.x - GHOST_SIZE.width / 2, y: world.y - GHOST_SIZE.height / 2, ...GHOST_SIZE },
      marker: target?.marker ?? null,
    });
  };

  const end = (commit: boolean) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    previewStore.getState().setReorder(null);
    if (dragging && commit) onDrop(last, true);
  };
  const up = () => end(true);
  const cancel = () => end(false);

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
}
