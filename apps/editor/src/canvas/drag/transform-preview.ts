// ED-024: preview pindah sebagai transform CSS sementara langsung di elemen (tanpa React & tanpa Yjs).
// Properti `translate` (bukan `transform`) agar tidak menimpa transform milik style node.
// Elemen node berada di dalam `#world`, jadi satuan px di sini = px world.

export function setPreviewTranslate(element: Element, dx: number, dy: number): void {
  if (element instanceof HTMLElement || element instanceof SVGElement) element.style.translate = `${dx}px ${dy}px`;
}

export function clearPreviewTranslate(element: Element): void {
  if (element instanceof HTMLElement || element instanceof SVGElement) element.style.removeProperty("translate");
}
