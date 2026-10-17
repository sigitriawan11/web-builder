import { Mark, mergeAttributes } from "@tiptap/react";

// ED-125 / DM-013: mark `textStyle` untuk warna, weight, size (& family) per range teks. Atribut disimpan apa adanya
// ke Yjs (y-prosemirror); converter document-model membuang `null`. Dirender ke <span style> untuk preview editor.
type Length = { value: number; unit: string };
const isLength = (value: unknown): value is Length =>
  !!value && typeof value === "object" && "value" in value && typeof (value as Length).value === "number";

const FONT_SIZE = /^([\d.]+)(px|rem|em|%)$/;
// Atribut yang DIDUKUNG & diimpor dari HTML (DM-013): color, font-weight, font-size. `font-family` sengaja TIDAK
// diimpor (paste membuang font asing, ED-125). Mark hanya dipasang bila ada ≥1 atribut didukung — kalau tidak,
// span akan jadi mark `textStyle` kosong yang ditolak schema (RichTextDoc: textStyle wajib ≥1 atribut).
const hasSupportedStyle = (element: HTMLElement): boolean =>
  element.style.color !== "" || element.style.fontWeight !== "" || FONT_SIZE.test(element.style.fontSize);

export const TextStyleMark = Mark.create({
  name: "textStyle",
  parseHTML() {
    return [{ tag: "span", getAttrs: (node) => (node instanceof HTMLElement && hasSupportedStyle(node) ? {} : false) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attrs) => (typeof attrs.color === "string" ? { style: `color: ${attrs.color}` } : {}),
      },
      fontWeight: {
        default: null,
        parseHTML: (element) => (element.style.fontWeight ? Number(element.style.fontWeight) : null),
        renderHTML: (attrs) =>
          typeof attrs.fontWeight === "number" ? { style: `font-weight: ${attrs.fontWeight}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: (element) => {
          const match = FONT_SIZE.exec(element.style.fontSize);
          return match ? { value: Number(match[1]), unit: match[2] } : null;
        },
        renderHTML: (attrs) =>
          isLength(attrs.fontSize) ? { style: `font-size: ${attrs.fontSize.value}${attrs.fontSize.unit}` } : {},
      },
      // Family per-range tidak di-set dari UI (picker family = node) & disimpan/di-round-trip lewat Yjs, bukan HTML.
      // `parseHTML` sengaja TIDAK membaca `font-family`: paste dari Word/Docs/dll membuang font asing (ED-125), bukan
      // mengimpornya (mis. "Comic Sans"). Attr & renderHTML tetap ada untuk nilai yang di-set programatik.
      fontFamily: {
        default: null,
        parseHTML: () => null,
        renderHTML: (attrs) =>
          typeof attrs.fontFamily === "string" ? { style: `font-family: ${attrs.fontFamily}` } : {},
      },
    };
  },
});
