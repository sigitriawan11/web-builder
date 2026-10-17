import { type Node, resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import { cn } from "@platform/ui";
import { Anchor } from "lucide-react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { useWorldRects } from "../../canvas/overlay/use-world-rects";
import { AlignToolbar } from "./AlignToolbar";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput, type NumberUpdate } from "./inputs/NumberInput";
import { isMixed, mixedValue } from "./mixed";

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

  // ED-085: min/max width & height (LengthSchema). Kosong = tak dibatasi; input mengisi nilai px.
  type Limit = "minWidth" | "maxWidth" | "minHeight" | "maxHeight";
  const limitOf = (node: Node, key: Limit) => {
    const value = resolveStyle(node.style, "base").size?.[key];
    return value && "value" in value ? value.value : undefined;
  };
  const limitValue = (key: Limit) => mixedValue(nodes.map((node) => limitOf(node, key)));
  const setLimit = (node: Node, key: Limit, value: number) => {
    runCommand(ctx(), updateStyle, {
      ids: [node.id],
      patch: { size: { [key]: { value: Math.max(0, value), unit: "px" } } },
    });
  };

  // ED-088: toggle "Absolute position" untuk anak auto-layout → keluar dari flow (keepVisualPosition).
  const firstPosition = nodes[0] ? resolveStyle(nodes[0].style, "base").position : undefined;
  const isAbsolute = firstPosition?.type === "absolute";
  const hasParent = nodes.every((node) => node.parentId !== null);
  const setAbsolute = (on: boolean) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      nodes.forEach((node, index) => {
        const rect = rects[index];
        const patch = on
          ? {
              type: "absolute" as const,
              x: rect ? round(rect.x - parentX(node)) : 0,
              y: rect ? round(rect.y - parentY(node)) : 0,
            }
          : { type: "flow" as const };
        runCommand(ctx(), updateStyle, { ids: [node.id], patch: { position: patch } });
      });
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  // ED-098: constraints horizontal/vertikal untuk node absolute (default Left/Top).
  const constraintsOf = (node: Node) => {
    const pos = resolveStyle(node.style, "base").position;
    return pos?.type === "absolute" ? pos.constraints : undefined;
  };
  const hConstraint = mixedValue(nodes.map((node) => constraintsOf(node)?.horizontal ?? "left"));
  const vConstraint = mixedValue(nodes.map((node) => constraintsOf(node)?.vertical ?? "top"));
  const setConstraint = (axis: "horizontal" | "vertical", value: string) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const node of nodes) {
        if (resolveStyle(node.style, "base").position?.type !== "absolute") continue;
        const current = constraintsOf(node) ?? { horizontal: "left", vertical: "top" };
        const constraints = { ...current, [axis]: value };
        runCommand(ctx(), updateStyle, { ids: [node.id], patch: { position: { constraints } } });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  // ED-084: mode sizing per sumbu (Fixed / Hug / Fill). Fixed memakai nilai terukur sebagai titik awal.
  const sizeModeValue = (axis: "width" | "height") =>
    mixedValue(nodes.map((node) => resolveStyle(node.style, "base").size?.[axis]?.mode ?? "fixed"));
  const setSizeMode = (axis: "width" | "height", mode: "fixed" | "hug" | "fill") => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      nodes.forEach((node, index) => {
        const rect = rects[index];
        const fixedValue = rect ? round(axis === "width" ? rect.width : rect.height) : 100;
        const patch = mode === "fixed" ? { mode, value: fixedValue, unit: "px" as const } : { mode };
        runCommand(ctx(), updateStyle, { ids: [node.id], patch: { size: { [axis]: patch } } });
      });
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  return (
    <InspectorSection id="layout-box" title={t("inspector.positionSize")}>
      <AlignToolbar runtime={runtime} selectedIds={ids} readOnly={readOnly} />
      <InspectorRow label={t("inspector.position")}>
        <div className="flex items-center gap-1">
          <div className="grid flex-1 grid-cols-2 gap-1">
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
          {hasParent ? (
            <button
              type="button"
              disabled={readOnly}
              aria-pressed={isAbsolute}
              aria-label={t("inspector.absolutePosition")}
              title={t("inspector.absolutePosition")}
              data-testid="inspector-absolute"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
                isAbsolute && "bg-accent text-foreground",
              )}
              onClick={() => setAbsolute(!isAbsolute)}
            >
              <Anchor className="size-3.5" />
            </button>
          ) : null}
        </div>
      </InspectorRow>
      <InspectorRow label={t("inspector.size")}>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <div className="min-w-0 flex-1">
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
            </div>
            <SizeModeSelect axis="width" value={sizeModeValue("width")} readOnly={readOnly} onChange={setSizeMode} />
          </div>
          <div className="flex gap-1">
            <div className="min-w-0 flex-1">
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
            <SizeModeSelect axis="height" value={sizeModeValue("height")} readOnly={readOnly} onChange={setSizeMode} />
          </div>
        </div>
      </InspectorRow>
      <InspectorRow label={t("inspector.minMax")}>
        <div className="grid grid-cols-2 gap-1">
          {(["minWidth", "maxWidth", "minHeight", "maxHeight"] as const).map((key) => (
            <NumberInput
              key={key}
              label={t(`inspector.${key}`)}
              scrubLabel={t(`inspector.${key}Short`)}
              value={limitValue(key)}
              min={0}
              testId={`inspector-${key}`}
              onCommit={(update) =>
                commit(
                  update,
                  (node) => limitOf(node, key) ?? 0,
                  (node, value) => setLimit(node, key, value),
                )
              }
            />
          ))}
        </div>
      </InspectorRow>
      {isAbsolute ? (
        <InspectorRow label={t("inspector.constraints")}>
          <div className="grid grid-cols-2 gap-1">
            <ConstraintSelect
              axis="horizontal"
              value={hConstraint}
              options={["left", "right", "leftRight", "center", "scale"]}
              readOnly={readOnly}
              onChange={setConstraint}
            />
            <ConstraintSelect
              axis="vertical"
              value={vConstraint}
              options={["top", "bottom", "topBottom", "center", "scale"]}
              readOnly={readOnly}
              onChange={setConstraint}
            />
          </div>
        </InspectorRow>
      ) : null}
    </InspectorSection>
  );
}

// ED-098: pemilih constraint per sumbu (Left/Right/Both/Center/Scale, dst.).
type ConstraintValue = "left" | "right" | "leftRight" | "center" | "scale" | "top" | "bottom" | "topBottom";

function ConstraintSelect({
  axis,
  value,
  options,
  readOnly,
  onChange,
}: {
  axis: "horizontal" | "vertical";
  value: ReturnType<typeof mixedValue>;
  options: readonly ConstraintValue[];
  readOnly: boolean;
  onChange: (axis: "horizontal" | "vertical", value: string) => void;
}) {
  const t = useT();
  return (
    <select
      aria-label={t(axis === "horizontal" ? "inspector.constraintH" : "inspector.constraintV")}
      data-testid={`inspector-constraint-${axis}`}
      disabled={readOnly}
      value={isMixed(value) ? "" : String(value)}
      onChange={(event) => onChange(axis, event.target.value)}
      className="h-7 min-w-0 rounded border border-transparent bg-muted/50 px-1 text-xs hover:border-border focus:border-ring"
    >
      {isMixed(value) ? (
        <option value="" disabled>
          {t("inspector.mixed")}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {t(`inspector.constraint_${option}`)}
        </option>
      ))}
    </select>
  );
}

// ED-084: pemilih mode sizing (Fixed/Hug/Fill) per sumbu.
function SizeModeSelect({
  axis,
  value,
  readOnly,
  onChange,
}: {
  axis: "width" | "height";
  value: ReturnType<typeof mixedValue>;
  readOnly: boolean;
  onChange: (axis: "width" | "height", mode: "fixed" | "hug" | "fill") => void;
}) {
  const t = useT();
  return (
    <select
      aria-label={t(axis === "width" ? "inspector.widthMode" : "inspector.heightMode")}
      data-testid={`inspector-${axis}-mode`}
      disabled={readOnly}
      value={isMixed(value) ? "" : String(value)}
      onChange={(event) => onChange(axis, event.target.value as "fixed" | "hug" | "fill")}
      className="h-7 w-24 shrink-0 rounded border border-transparent bg-muted/50 px-1 text-xs hover:border-border focus:border-ring"
    >
      {isMixed(value) ? (
        <option value="" disabled>
          {t("inspector.mixed")}
        </option>
      ) : null}
      <option value="fixed">{t("inspector.sizeFixed")}</option>
      <option value="hug">{t("inspector.sizeHug")}</option>
      <option value="fill">{t("inspector.sizeFill")}</option>
    </select>
  );
}
