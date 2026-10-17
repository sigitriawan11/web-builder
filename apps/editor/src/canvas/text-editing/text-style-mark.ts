import { Mark, mergeAttributes } from "@tiptap/react";

// ED-125 / DM-013: mark `textStyle` untuk warna, weight, size (& family) per range teks. Atribut disimpan apa adanya
// ke Yjs (y-prosemirror); converter document-model membuang `null`. Dirender ke <span style> untuk preview editor.
type Length = { value: number; unit: string };
const isLength = (value: unknown): value is Length =>
  !!value && typeof value === "object" && "value" in value && typeof (value as Length).value === "number";

export const TextStyleMark = Mark.create({
  name: "textStyle",
  parseHTML() {
    return [
      { tag: "span", getAttrs: (node) => (node instanceof HTMLElement && node.hasAttribute("style") ? {} : false) },
    ];
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
          const match = element.style.fontSize.match(/^([\d.]+)(px|rem|em|%)$/);
          return match ? { value: Number(match[1]), unit: match[2] } : null;
        },
        renderHTML: (attrs) =>
          isLength(attrs.fontSize) ? { style: `font-size: ${attrs.fontSize.value}${attrs.fontSize.unit}` } : {},
      },
      // Family per-range jarang di-set dari UI (picker family = node), tapi disimpan agar tidak hilang saat round-trip.
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily || null,
        renderHTML: (attrs) =>
          typeof attrs.fontFamily === "string" ? { style: `font-family: ${attrs.fontFamily}` } : {},
      },
    };
  },
});
