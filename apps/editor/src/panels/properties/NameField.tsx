import { type Node, renameNode, runCommand } from "@platform/document-model";
import { Input } from "@platform/ui";
import { useEffect, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";

// ED-008: ganti nama layer dari tab Settings. Commit saat blur/Enter; nama kosong diabaikan (renameNode min 1).
export function NameField({ runtime, node, readOnly }: { runtime: CanvasRuntime; node: Node; readOnly: boolean }) {
  const t = useT();
  const [value, setValue] = useState(node.name);
  // biome-ignore lint/correctness/useExhaustiveDependencies: sinkron saat ganti node/nama dokumen.
  useEffect(() => setValue(node.name), [node.id, node.name]);

  const commit = () => {
    const name = value.trim();
    if (readOnly || name === "" || name === node.name) {
      setValue(node.name);
      return;
    }
    runtime.undo.stopCapturing();
    runCommand({ doc: runtime.doc, origin: runtime.origin }, renameNode, { id: node.id, name });
    runtime.undo.stopCapturing();
  };

  return (
    <Input
      value={value}
      disabled={readOnly}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
      aria-label={t("inspector.name")}
      data-testid="node-name"
      className="h-7 text-xs"
    />
  );
}
