import { type Node, runCommand, setHtmlId, slugify } from "@platform/document-model";
import { cn, Input } from "@platform/ui";
import { useEffect, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";

// ED-220: Anchor ID (node.htmlId) — slug unik per page untuk tautan #anchor. Input di-slugify saat commit; bentrok
// ditolak command → tampilkan error inline.
export function AnchorIdField({ runtime, node, readOnly }: { runtime: CanvasRuntime; node: Node; readOnly: boolean }) {
  const t = useT();
  const [value, setValue] = useState(node.htmlId ?? "");
  const [error, setError] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: sinkron saat ganti node/htmlId dokumen.
  useEffect(() => setValue(node.htmlId ?? ""), [node.id, node.htmlId]);

  const commit = () => {
    if (readOnly) return;
    const slug = slugify(value);
    if (slug === (node.htmlId ?? "")) {
      setValue(slug);
      return;
    }
    runtime.undo.stopCapturing();
    const result = runCommand(runtime.commandCtx, setHtmlId, {
      id: node.id,
      htmlId: slug === "" ? null : slug,
    });
    runtime.undo.stopCapturing();
    if (!result.ok) {
      setError(true);
      return;
    }
    setValue(slug);
    setError(false);
  };

  return (
    <Input
      value={value}
      disabled={readOnly}
      onChange={(event) => {
        setValue(event.target.value);
        setError(false);
      }}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
      placeholder={t("inspector.anchorPlaceholder")}
      aria-label={t("inspector.anchorId")}
      aria-invalid={error || undefined}
      data-testid="node-anchor-id"
      className={cn("h-7 text-xs", error && "border-destructive")}
    />
  );
}
