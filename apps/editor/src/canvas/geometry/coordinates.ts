// ED-015: tiga sistem koordinat. Titik diberi tag `__space` agar titik screen tidak bisa
// dipakai sebagai titik world (atau sebaliknya) tanpa konversi eksplisit.
//
// - Screen: clientX/clientY dari pointer event.
// - World: CSS px pada zoom 100%, origin = pojok kiri atas `#world`.
// - Local: relatif ke content box parent (yang disimpan dokumen untuk node absolute).
//
// Rotasi ancestor (DM-033) belum didukung: transform baru masuk di M2.

export type ScreenPoint = { readonly x: number; readonly y: number; readonly __space: "screen" };
export type WorldPoint = { readonly x: number; readonly y: number; readonly __space: "world" };
export type LocalPoint = { readonly x: number; readonly y: number; readonly __space: "local" };

export const screenPoint = (x: number, y: number): ScreenPoint => ({ x, y, __space: "screen" });
export const worldPoint = (x: number, y: number): WorldPoint => ({ x, y, __space: "world" });
export const localPoint = (x: number, y: number): LocalPoint => ({ x, y, __space: "local" });

export interface CameraState {
  // Offset world terhadap pojok kiri atas viewport, dalam px screen.
  x: number;
  y: number;
  zoom: number;
}

// Posisi `#editor-viewport` di halaman (dari getBoundingClientRect).
export interface ViewportOffset {
  left: number;
  top: number;
}

export function screenToWorld(point: ScreenPoint, camera: CameraState, viewport: ViewportOffset): WorldPoint {
  return worldPoint(
    (point.x - viewport.left - camera.x) / camera.zoom,
    (point.y - viewport.top - camera.y) / camera.zoom,
  );
}

export function worldToScreen(point: WorldPoint, camera: CameraState, viewport: ViewportOffset): ScreenPoint {
  return screenPoint(point.x * camera.zoom + camera.x + viewport.left, point.y * camera.zoom + camera.y + viewport.top);
}

// Selisih gerak pointer (screen) → selisih di world; offset kamera tidak berpengaruh pada delta.
export function screenDeltaToWorld(dx: number, dy: number, zoom: number): { dx: number; dy: number } {
  return { dx: dx / zoom, dy: dy / zoom };
}

// Posisi content box tiap ancestor relatif ke content box parent-nya, urut dari terluar ke terdalam.
// Ancestor pertama relatif ke origin world.
export type AncestorOffsets = readonly { readonly x: number; readonly y: number }[];

export function nodeLocalToWorld(point: LocalPoint, ancestors: AncestorOffsets): WorldPoint {
  let x = point.x;
  let y = point.y;
  for (const offset of ancestors) {
    x += offset.x;
    y += offset.y;
  }
  return worldPoint(x, y);
}

export function worldToNodeLocal(point: WorldPoint, ancestors: AncestorOffsets): LocalPoint {
  let x = point.x;
  let y = point.y;
  for (const offset of ancestors) {
    x -= offset.x;
    y -= offset.y;
  }
  return localPoint(x, y);
}
