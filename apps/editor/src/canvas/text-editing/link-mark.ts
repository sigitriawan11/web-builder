import { Mark, mergeAttributes } from "@tiptap/react";

// ED-122 / DM-013: mark `link` membawa objek LinkValue (bukan href string). href fungsional di-resolve saat publish
// oleh renderer (sanitasi berlapis di renderer/links.ts); di editor hanya tampil bergaya link. Atribut `link` tidak
// dirender ke HTML (disimpan di state/Yjs), jadi tak ada href aktif di canvas edit.
export const LinkMark = Mark.create({
  name: "link",
  // Mengetik tepat setelah link tidak ikut menjadi link.
  inclusive: false,
  parseHTML() {
    return [{ tag: "a[data-link]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, { "data-link": "", style: "text-decoration: underline; cursor: pointer" }),
      0,
    ];
  },
  addAttributes() {
    return {
      link: {
        default: null,
        renderHTML: () => ({}),
        parseHTML: () => null,
      },
    };
  },
});
