import { type HitResult, hitTestNode } from "./hit-test";

/**
 * Hit-test canvas untuk semua mode: isolasi shadow/prefix (Opsi A/B) dan frame class/iframe (T0.4.6).
 * Mode iframe dipertahankan sampai keputusan T0.8.2; logika aturannya tetap di `hitTestNode`.
 */
export function hitTestCanvas(
  world: HTMLElement,
  clientX: number,
  clientY: number,
  isSelectable: (path: readonly string[]) => boolean,
): HitResult | null {
  // Opsi A isolasi: elementsFromPoint dokumen berhenti di host shadow; harus bertanya ke shadow root.
  const root: DocumentOrShadowRoot = world.shadowRoot ?? document;

  // Opsi (b) frame: iframe ber-pointer-events none tidak ikut elementsFromPoint, jadi dicari lewat rect,
  // lalu koordinat diterjemahkan ke dokumen iframe (dibagi skala zoom karena iframe ikut transform world).
  for (const iframe of (world.shadowRoot ?? world).querySelectorAll<HTMLIFrameElement>("iframe.bp-iframe")) {
    const rect = iframe.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
    const scale = rect.width / iframe.offsetWidth;
    const doc = iframe.contentDocument;
    return doc ? hitTestNode(doc, (clientX - rect.left) / scale, (clientY - rect.top) / scale, isSelectable) : null;
  }
  return hitTestNode(root, clientX, clientY, isSelectable);
}
