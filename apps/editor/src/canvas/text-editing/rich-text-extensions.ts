import StarterKit from "@tiptap/starter-kit";

// Hanya node & mark yang ada di schema rich text dokumen (DM-013); sisanya dimatikan.
// `undoRedo` mati: riwayat teks ikut UndoController dokumen (satu stack untuk ketikan & aksi canvas).
export const richTextExtensions = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    dropcursor: false,
    gapcursor: false,
    horizontalRule: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    undoRedo: false,
  }),
];
