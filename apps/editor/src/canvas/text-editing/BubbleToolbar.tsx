import { cn } from "@platform/ui";
import type { Editor } from "@tiptap/react";
import { BoldIcon, ItalicIcon, StrikethroughIcon, UnderlineIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../app/i18n";

// ED-122/ED-125: toolbar seleksi teks (bubble) hand-rolled. Editor berada di shadow root canvas; toolbar di-portal
// ke document.body (fixed, koordinat dari `coordsAtPos`) agar style chrome editor berlaku & tidak terpotong.
// `onMouseDown` preventDefault menjaga seleksi editor saat tombol ditekan.
export function BubbleToolbar({ editor }: { editor: Editor | null }) {
  const t = useT();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const update = () => setTick((value) => value + 1);
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!editor || editor.state.selection.empty) return null;
  const { from, to } = editor.state.selection;
  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);
  const left = (start.left + end.right) / 2;
  const top = Math.min(start.top, end.top);

  const mark = (name: string, action: () => void, icon: ReactNode, title: string, testId: string) => (
    <button
      type="button"
      // Tahan blur editor agar seleksi tidak hilang saat klik.
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
      aria-pressed={editor.isActive(name)}
      aria-label={title}
      title={title}
      data-testid={testId}
      className={cn(
        "flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
        editor.isActive(name) && "bg-accent text-foreground",
      )}
    >
      {icon}
    </button>
  );

  return createPortal(
    <div
      role="toolbar"
      aria-label={t("inspector.textDecoration")}
      data-testid="text-bubble-toolbar"
      onMouseDown={(event) => event.preventDefault()}
      style={{ position: "fixed", left, top: top - 8, transform: "translate(-50%, -100%)", zIndex: 50 }}
      className="flex items-center gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {mark(
        "bold",
        () => editor.chain().focus().toggleBold().run(),
        <BoldIcon className="size-3.5" />,
        t("inspector.bold"),
        "mark-bold",
      )}
      {mark(
        "italic",
        () => editor.chain().focus().toggleItalic().run(),
        <ItalicIcon className="size-3.5" />,
        t("inspector.italic"),
        "mark-italic",
      )}
      {mark(
        "underline",
        () => editor.chain().focus().toggleUnderline().run(),
        <UnderlineIcon className="size-3.5" />,
        t("inspector.underline"),
        "mark-underline",
      )}
      {mark(
        "strike",
        () => editor.chain().focus().toggleStrike().run(),
        <StrikethroughIcon className="size-3.5" />,
        t("inspector.strikethrough"),
        "mark-strike",
      )}
    </div>,
    document.body,
  );
}
