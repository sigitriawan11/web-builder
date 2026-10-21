import { type Node, runCommand, setTag } from "@platform/document-model";
import { cn } from "@platform/ui";
import { useId } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { tagOptionsFor } from "./tag-options";

// ED-218: pilih tag semantik node (h1–h6, section/header/nav/… dll). Tag terpisah dari text style (ED-211). Satu node
// saja; tipe satu-tag (image/shape/icon/page) ditampilkan pemanggil sebagai teks statis.
export function TagSelect({
  runtime,
  node,
  current,
  readOnly,
}: {
  runtime: CanvasRuntime;
  node: Node;
  current: string;
  readOnly: boolean;
}) {
  const t = useT();
  const id = useId();
  const options = tagOptionsFor(node.type);
  if (!options) return <span className="text-muted-foreground">{current}</span>;

  const change = (tag: string) => {
    if (readOnly || tag === current) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, setTag, { id: node.id, tag });
    runtime.undo.stopCapturing();
  };

  return (
    <select
      id={id}
      aria-label={t("inspector.tag")}
      data-testid="node-tag"
      value={current}
      disabled={readOnly}
      onChange={(event) => change(event.target.value)}
      className={cn("h-7 w-full rounded border border-input bg-transparent px-1 text-xs", readOnly && "opacity-50")}
    >
      {options.map((tag) => (
        <option key={tag} value={tag}>
          {tag}
        </option>
      ))}
    </select>
  );
}
