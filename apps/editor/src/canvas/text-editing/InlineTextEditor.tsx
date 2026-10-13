import { EditorContent, Extension, useEditor } from "@tiptap/react";
import { ySyncPlugin } from "@tiptap/y-tiptap";
import { useContext, useEffect, useMemo } from "react";
import type * as Y from "yjs";
import { UndoContext } from "../../document/undo-context";
import type { UndoController } from "../../document/undo-controller";
import { NodeStoreContext } from "../../document/use-node";
import { textEditingStore } from "../../store/text-editing-store";
import { richTextExtensions } from "./rich-text-extensions";

/**
 * DM-058 / T0.8.5: Tiptap terikat langsung ke `props.content` (Y.XmlFragment) lewat `ySyncPlugin`
 * (@tiptap/y-tiptap): setiap ketikan = transaksi Yjs ber-origin `ySyncPluginKey`, digabung per karakter.
 * Sengaja tanpa extension Collaboration: undo plugin-nya memanggil `destroy()` pada UndoManager yang
 * diberikan saat editor ditutup, sehingga undo dokumen global akan mati setelah sekali edit teks.
 */
function yjsBinding(fragment: Y.XmlFragment, undo: UndoController) {
  return Extension.create({
    name: "yjsBinding",
    addProseMirrorPlugins: () => [ySyncPlugin(fragment)],
    addKeyboardShortcuts: () => ({
      "Mod-z": () => {
        undo.undo();
        return true;
      },
      "Shift-Mod-z": () => {
        undo.redo();
        return true;
      },
      "Mod-y": () => {
        undo.redo();
        return true;
      },
    }),
  });
}

export function InlineTextEditor({ nodeId }: { nodeId: string }) {
  const nodeStore = useContext(NodeStoreContext);
  const undo = useContext(UndoContext);
  const fragment = nodeStore?.getRichTextFragment(nodeId) ?? null;
  if (!fragment || !undo) throw new Error(`InlineTextEditor: node "${nodeId}" tanpa rich text atau di luar UndoContext`);
  const extensions = useMemo(() => [...richTextExtensions, yjsBinding(fragment, undo)], [fragment, undo]);
  // ED-115: satu sesi edit = satu langkah undo setelah editor ditutup.
  useEffect(() => {
    const group = undo.beginGroup();
    return () => group.end();
  }, [undo]);

  const editor = useEditor(
    {
      extensions,
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
    },
    [extensions],
  );
  return <EditorContent editor={editor} className="text-editor-host" />;
}
