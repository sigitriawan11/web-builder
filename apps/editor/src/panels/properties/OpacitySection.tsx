import { type Node, resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput } from "./inputs/NumberInput";
import { mixedValue } from "./mixed";

// ED-110: opacity layer (0–100% di UI, 0–1 di dokumen). Shortcut angka 1–0 = use-opacity-shortcut.
export function OpacitySection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  if (nodes.length === 0) return null;
  const percentOf = (node: Node) => Math.round((resolveStyle(node.style, "base").opacity ?? 1) * 100);
  const value = mixedValue(nodes.map(percentOf));

  return (
    <InspectorSection id="opacity" title={t("inspector.opacity")}>
      <InspectorRow label={t("inspector.opacity")}>
        <div className="grid grid-cols-2 gap-1">
          <NumberInput
            label={t("inspector.opacity")}
            scrubLabel="%"
            value={value}
            min={0}
            max={100}
            testId="inspector-opacity"
            onCommit={(update) => {
              if (readOnly) return;
              runtime.undo.stopCapturing();
              runtime.doc.transact(() => {
                for (const node of nodes) {
                  const next = Math.max(0, Math.min(100, update(percentOf(node))));
                  runCommand(runtime.commandCtx, updateStyle, {
                    ids: [node.id],
                    patch: { opacity: next / 100 },
                  });
                }
              }, runtime.origin);
              runtime.undo.stopCapturing();
            }}
          />
        </div>
      </InspectorRow>
    </InspectorSection>
  );
}
