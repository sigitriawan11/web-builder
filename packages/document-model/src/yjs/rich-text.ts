import * as Y from "yjs";
import type { Block, Inline, ListItem, Mark, RichTextDoc } from "../schema";

// DM-058: `props.content` node text = Y.XmlFragment agar edit teks per karakter ter-merge.
// Encoding SAMA dengan y-prosemirror / @tiptap/y-tiptap (dipakai editor untuk binding Tiptap):
//   blok   → Y.XmlElement(nama tipe), attrs → atribut elemen (nilai null tidak ditulis)
//   teks   → satu Y.XmlText per deretan teks berurutan; mark → atribut format `{ [mark]: attrs }`
//   inline non-teks (hardBreak) → Y.XmlElement tanpa anak
//   list (bulletList/orderedList → listItem → blok) → Y.XmlElement bersarang
// Ditulis sendiri (tanpa ProseMirror) agar document-model hanya bergantung pada yjs (keputusan T0.8.5);
// kompatibilitas dijaga test round-trip terhadap y-tiptap di apps/editor.

// Elemen Yjs yang merupakan node inline (bukan blok) saat dibaca kembali.
const INLINE_ELEMENTS = new Set(["hardBreak"]);

function marksToAttributes(marks: readonly Mark[] | undefined): Record<string, object> {
  const attributes: Record<string, object> = {};
  for (const mark of marks ?? []) attributes[mark.type] = "attrs" in mark && mark.attrs ? mark.attrs : {};
  return attributes;
}

function blockToElement(block: Block | ListItem): Y.XmlElement {
  const element = new Y.XmlElement(block.type);
  for (const [key, value] of Object.entries("attrs" in block && block.attrs ? block.attrs : {})) {
    // Y.XmlElement menerima nilai JSON apa pun walau tipenya ditulis string (y-prosemirror melakukan hal sama).
    if (value !== null && value !== undefined) element.setAttribute(key, value as string);
  }
  if (block.type === "bulletList" || block.type === "orderedList" || block.type === "listItem") {
    element.insert(0, (block.content as (Block | ListItem)[]).map(blockToElement));
    return element;
  }
  const children: (Y.XmlText | Y.XmlElement)[] = [];
  // Deretan teks dikumpulkan sebagai delta lalu ditulis sekali: Y.XmlText yang belum terpasang di Y.Doc
  // melaporkan `length` 0, jadi insert bertahap di akhir akan terbalik urutannya.
  let run: { insert: string; attributes: Record<string, object> }[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const text = new Y.XmlText();
    text.applyDelta(run);
    children.push(text);
    run = [];
  };
  for (const inline of (block.content ?? []) as Inline[]) {
    if (inline.type === "text") {
      run.push({ insert: inline.text, attributes: marksToAttributes(inline.marks) });
      continue;
    }
    flush();
    children.push(new Y.XmlElement(inline.type));
  }
  flush();
  element.insert(0, children);
  return element;
}

// Isi fragment (baru, belum terpasang di Y.Doc) dari rich text JSON.
export function richTextToYXmlFragment(doc: RichTextDoc, fragment: Y.XmlFragment = new Y.XmlFragment()): Y.XmlFragment {
  fragment.insert(0, doc.content.map(blockToElement));
  return fragment;
}

function attributesToMarks(attributes: Record<string, unknown> | undefined): Record<string, unknown>[] {
  return Object.entries(attributes ?? {}).map(([type, attrs]) =>
    attrs && typeof attrs === "object" && Object.keys(attrs).length > 0 ? { type, attrs } : { type },
  );
}

function elementToBlock(element: Y.XmlElement): Record<string, unknown> {
  const content: Record<string, unknown>[] = [];
  for (const child of element.toArray()) {
    if (child instanceof Y.XmlText) {
      for (const op of child.toDelta() as { insert: unknown; attributes?: Record<string, unknown> }[]) {
        if (typeof op.insert !== "string" || op.insert.length === 0) continue;
        const marks = attributesToMarks(op.attributes);
        content.push(marks.length > 0 ? { type: "text", text: op.insert, marks } : { type: "text", text: op.insert });
      }
    } else if (child instanceof Y.XmlElement) {
      // Inline non-teks (hardBreak) tanpa isi; selain itu blok bersarang (listItem, list di dalam item).
      content.push(INLINE_ELEMENTS.has(child.nodeName) ? { type: child.nodeName } : elementToBlock(child));
    }
  }
  const attrs = element.getAttributes();
  return {
    type: element.nodeName,
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    ...(content.length > 0 ? { content } : {}),
  };
}

// Hasilnya JSON mentah (fragment bisa berisi edit remote) → validasi dengan RichTextDocSchema/NodeSchema.
export function yXmlFragmentToRichText(fragment: Y.XmlFragment): unknown {
  return {
    type: "doc",
    content: fragment.toArray().flatMap((child) => (child instanceof Y.XmlElement ? [elementToBlock(child)] : [])),
  };
}
