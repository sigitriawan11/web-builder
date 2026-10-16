import { type Node, resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { useWorldRects } from "../../canvas/overlay/use-world-rects";
import { AlignToolbar } from "./AlignToolbar";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput, type NumberUpdate } from "./inputs/NumberInput";
import { mixedValue } from "./mixed";

// ED-070: panel posisi & ukuran (X, Y, W, H) dengan input ekspresi. W/H dari rect terukur (apa yang terlihat),
// diedit → ukuran Fixed. X/Y relatif parent; hanya node absolute yang bisa digeser lewat input (flow = auto-layout).

const round = (value: number) => Math.round(value);

export function PositionSizeSection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const ids = nodes.map((node) => node.id);
  const rects = useWorldRects(runtime.geometry.store, ids);

  const parentX = (node: Node) => (node.parentId ? (runtime.geometry.store.peekRect(node.parentId)?.x ?? 0) : 0);
  const parentY = (node: Node) => (node.parentId ? (runtime.geometry.store.peekRect(node.parentId)?.y ?? 0) : 0);

  const widthValue = mixedValue(rects.map((rect) => (rect ? round(rect.width) : undefined)));
  const heightValue = mixedValue(rects.map((rect) => (rect ? round(rect.height) : undefined)));
  const xValue = mixedValue(nodes.map((node, i) => (rects[i] ? round((rects[i]?.x ?? 0) - parentX(node)) : undefined)));
  const yValue = mixedValue(nodes.map((node, i) => (rects[i] ? round((rects[i]?.y ?? 0) - parentY(node)) : undefined)));

  // Terapkan `update` per node dalam satu transaksi (= satu langkah undo); `current` dihitung per node.
  const commit = (
    update: NumberUpdate,
    current: (node: Node, index: number) => number | undefined,
    apply: (node: Node, value: number) => void,
  ) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      nodes.forEach((node, index) => {
        const base = current(node, index);
        if (base === undefined) return;
        apply(node, update(base));
      });
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  const ctx = () => ({ doc: runtime.doc, origin: runtime.origin });
  const setSize = (node: Node, axis: "width" | "height", value: number) => {
    runCommand(ctx(), updateStyle, {
      ids: [node.id],
      patch: { size: { [axis]: { mode: "fixed", value, unit: "px" } } },
    });
  };
  const setPosition = (node: Node, axis: "x" | "y", value: number) => {
    // Hanya node absolute yang punya X/Y bebas; flow mengikuti auto-layout.
    if (resolveStyle(node.style, "base").position?.type !== "absolute") return;
    runCommand(ctx(), updateStyle, { ids: [node.id], patch: { position: { [axis]: value } } });
  };

  return (
    <InspectorSection id="layout-box" title={t("inspector.positionSize")}>
      <AlignToolbar runtime={runtime} selectedIds={ids} readOnly={readOnly} />
      <InspectorRow label={t("inspector.position")}>
        <div className="grid grid-cols-2 gap-1">
          <NumberInput
            label={t("inspector.x")}
            scrubLabel="X"
            value={xValue}
            testId="inspector-x"
            onCommit={(update) =>
              commit(
                update,
                (node, i) => (rects[i] ? (rects[i]?.x ?? 0) - parentX(node) : undefined),
                (node, value) => setPosition(node, "x", value),
              )
            }
          />
          <NumberInput
            label={t("inspector.y")}
            scrubLabel="Y"
            value={yValue}
            testId="inspector-y"
            onCommit={(update) =>
              commit(
                update,
                (node, i) => (rects[i] ? (rects[i]?.y ?? 0) - parentY(node) : undefined),
                (node, value) => setPosition(node, "y", value),
              )
            }
          />
        </div>
      </InspectorRow>
      <InspectorRow label={t("inspector.size")}>
        <div className="grid grid-cols-2 gap-1">
          <NumberInput
            label={t("inspector.width")}
            scrubLabel="W"
            value={widthValue}
            min={1}
            testId="inspector-width"
            onCommit={(update) =>
              commit(
                update,
                (_node, i) => rects[i]?.width,
                (node, value) => setSize(node, "width", value),
              )
            }
          />
          <NumberInput
            label={t("inspector.height")}
            scrubLabel="H"
            value={heightValue}
            min={1}
            testId="inspector-height"
            onCommit={(update) =>
              commit(
                update,
                (_node, i) => rects[i]?.height,
                (node, value) => setSize(node, "height", value),
              )
            }
          />
        </div>
      </InspectorRow>
    </InspectorSection>
  );
}
