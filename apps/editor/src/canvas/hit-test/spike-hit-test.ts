// SPIKE T0.4.6: hit-test titik screen → ID node, untuk membandingkan kompleksitas tiap mode frame.
// Hit-test resmi (locked/hidden, kedalaman klik) dikerjakan di T0.5.2.

function nodeIdAt(root: DocumentOrShadowRoot, x: number, y: number): string | null {
  for (const element of root.elementsFromPoint(x, y)) {
    // Bukan `instanceof HTMLElement`: elemen dokumen iframe dibuat oleh window iframe (realm lain),
    // sehingga instanceof terhadap constructor halaman utama selalu false (temuan T0.4.6).
    const id = element.getAttribute("data-node-id");
    if (id) return id;
  }
  return null;
}

export function hitTestNodeId(world: HTMLElement, clientX: number, clientY: number): string | null {
  // Opsi A isolasi: elementsFromPoint dokumen berhenti di host shadow; harus bertanya ke shadow root.
  const root: DocumentOrShadowRoot = world.shadowRoot ?? document;

  // Opsi (b) frame: iframe ber-pointer-events none tidak ikut elementsFromPoint, jadi dicari lewat rect,
  // lalu koordinat diterjemahkan ke dokumen iframe (dibagi skala zoom karena iframe ikut transform world).
  for (const iframe of (world.shadowRoot ?? world).querySelectorAll<HTMLIFrameElement>("iframe.bp-iframe")) {
    const rect = iframe.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
    const scale = rect.width / iframe.offsetWidth;
    const doc = iframe.contentDocument;
    return doc ? nodeIdAt(doc, (clientX - rect.left) / scale, (clientY - rect.top) / scale) : null;
  }
  return nodeIdAt(root, clientX, clientY);
}
