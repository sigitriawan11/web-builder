import StarterKit from "@tiptap/starter-kit";

// Hanya node & mark yang ada di schema rich text dokumen (DM-013); sisanya dimatikan.
// `undoRedo` mati: riwayat teks ikut UndoController dokumen (satu stack untuk ketikan & aksi canvas).
// ED-121: list (bullet/numbered) aktif — ada di schema DM-013; input rule `- `/`1. ` & keymap list dari StarterKit.
export const richTextExtensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    dropcursor: false,
    gapcursor: false,
    horizontalRule: false,
    link: false,
    undoRedo: false,
  }),
];
