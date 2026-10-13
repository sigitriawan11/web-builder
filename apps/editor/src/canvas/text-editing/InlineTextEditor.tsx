import type { RichTextDoc } from "@platform/document-model";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { textEditingStore } from "../../store/text-editing-store";

// Hanya node & mark yang ada di schema rich text dokumen (DM-013); sisanya dimatikan.
const extensions = [
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
  }),
];

// Rich text dokumen sudah berformat ProseMirror JSON (DM-013); serialisasi membuang field
// `undefined` yang ditolak tipe JSONContent di bawah exactOptionalPropertyTypes.
function toJsonContent(doc: RichTextDoc): JSONContent {
  return JSON.parse(JSON.stringify(doc)) as JSONContent;
}

/**
 * SPIKE T0.4.5: editor teks inline di posisi node (ED-115) untuk menguji seleksi, IME, dan
 * copy/paste di tiap mode isolasi. Perubahan BELUM disimpan ke dokumen; binding
 * `Y.XmlFragment` + `y-prosemirror` diputuskan di T0.8.5.
 */
export function InlineTextEditor({ content }: { content: RichTextDoc }) {
  const editor = useEditor({
    extensions,
    content: toJsonContent(content),
    autofocus: "end",
    // CSS bawaan Tiptap disuntik ke document.head dan tidak berlaku di shadow root,
    // jadi CSS dasar ProseMirror ikut stylesheet canvas (lihat isolation.ts).
    injectCSS: false,
    immediatelyRender: true,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key !== "Escape") return false;
        textEditingStore.getState().stopEditing();
        return true;
      },
    },
  });
  return <EditorContent editor={editor} className="text-editor-host" />;
}
