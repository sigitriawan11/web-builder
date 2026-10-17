import { cn } from "@platform/ui";
import type { Editor } from "@tiptap/react";
import { BoldIcon, ItalicIcon, StrikethroughIcon, UnderlineIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../app/i18n";
import { ColorInput } from "../../panels/properties/color/ColorInput";
import { NumberInput } from "../../panels/properties/inputs/NumberInput";

// ED-122/ED-125: toolbar seleksi teks (bubble) hand-rolled. Editor berada di shadow root canvas; toolbar di-portal
// ke document.body (fixed, koordinat dari `coordsAtPos`) agar style chrome editor berlaku & tidak terpotong.
// Tombol mark menahan blur editor (`onMouseDown` preventDefault); kontrol color/size/weight memakai `state.selection`
// (tetap ada walau fokus DOM pindah ke popover/input).
const WEIGHTS = [300, 400, 500, 600, 700, 800] as const;
type Length = { value: number; unit: string };
const isLength = (value: unknown): value is Length =>
  !!value && typeof value === "object" && "value" in value && typeof (value as Length).value === "number";

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

  const ts = editor.getAttributes("textStyle");
  const colorValue = typeof ts.color === "string" ? ts.color : null;
  const sizeValue = isLength(ts.fontSize) ? ts.fontSize.value : undefined;
  const weightValue = typeof ts.fontWeight === "number" ? ts.fontWeight : undefined;

  // Set/hapus atribut textStyle di seleksi; buang null, dan unset mark bila tak ada atribut tersisa (skema menolak
  // textStyle kosong). Jalan di atas `state.selection` sehingga tidak butuh fokus DOM.
  const setTextStyle = (patch: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...editor.getAttributes("textStyle"), ...patch };
    for (const key of Object.keys(next)) if (next[key] == null) delete next[key];
    const chain = editor.chain().focus();
    if (Object.keys(next).length === 0) chain.unsetMark("textStyle");
    else chain.setMark("textStyle", next);
    chain.run();
  };

  const mark = (name: string, action: () => void, icon: ReactNode, title: string, testId: string) => (
    <button
      type="button"
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
      <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
      {/* ED-125: warna/size/weight per range (mark textStyle). */}
      <ColorInput
        value={colorValue ?? "#000000"}
        testId="mark-color"
        onChange={(hex) => setTextStyle({ color: hex })}
      />
      <div className="w-14">
        <NumberInput
          label={t("inspector.fontSize")}
          scrubLabel="S"
          value={sizeValue}
          min={1}
          testId="mark-size"
          onCommit={(updateValue) =>
            setTextStyle({ fontSize: { value: Math.max(1, updateValue(sizeValue ?? 16)), unit: "px" } })
          }
        />
      </div>
      <select
        aria-label={t("inspector.fontWeight")}
        data-testid="mark-weight"
        value={weightValue ?? ""}
        onChange={(event) => setTextStyle({ fontWeight: event.target.value ? Number(event.target.value) : null })}
        className="h-7 rounded border border-transparent bg-muted/50 px-1 text-xs hover:border-border focus:border-ring"
      >
        <option value="">—</option>
        {WEIGHTS.map((weight) => (
          <option key={weight} value={weight}>
            {weight}
          </option>
        ))}
      </select>
    </div>,
    document.body,
  );
}
