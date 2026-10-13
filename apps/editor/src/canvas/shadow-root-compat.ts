// ADR-012: library editor teks memperlakukan `view.root` (di canvas = ShadowRoot) seperti Document.
// y-tiptap memanggil `root.createRange()` & `root.getSelection()` saat menerapkan perubahan Yjs ke editor
// (undo/redo, edit remote); ShadowRoot tidak punya `createRange` (dan `getSelection` hanya di Chromium),
// sehingga update itu gagal sebelum di-dispatch. Range & seleksi dokumen tetap valid untuk node di shadow tree.
type DocumentLikeRoot = ShadowRoot & { createRange?: () => Range; getSelection?: () => Selection | null };

export function makeShadowRootDocumentLike(root: ShadowRoot): void {
  const target = root as DocumentLikeRoot;
  const ownerDocument = root.ownerDocument;
  if (typeof target.createRange !== "function") {
    Object.defineProperty(target, "createRange", { value: () => ownerDocument.createRange(), configurable: true });
  }
  if (typeof target.getSelection !== "function") {
    Object.defineProperty(target, "getSelection", { value: () => ownerDocument.getSelection(), configurable: true });
  }
}
