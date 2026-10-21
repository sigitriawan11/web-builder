import { type Node, type RadiusValue, resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import { cn } from "@platform/ui";
import { SquareDashed } from "lucide-react";
import { useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput, type NumberUpdate } from "./inputs/NumberInput";
import { isMixed, mixedValue } from "./mixed";

// ED-107: corner radius (seragam & per sudut). Hanya node yang mendukung radius (frame/shape/image).
type Corner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";
const CORNERS: Corner[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const SHORT: Record<Corner, string> = { topLeft: "TL", topRight: "TR", bottomRight: "BR", bottomLeft: "BL" };
const RADIUS_TYPES = new Set<Node["type"]>(["frame", "shape", "image"]);

// Nilai px dari Length (`{value,unit:px}`); token/unit lain → undefined.
function lengthPx(value: unknown): number | undefined {
  return value && typeof value === "object" && "value" in value && "unit" in value && value.unit === "px"
    ? (value as { value: number }).value
    : undefined;
}

// Radius uniform (number) bila berupa Length tunggal; object per-sudut → undefined.
function uniformOf(radius: RadiusValue | undefined): number | undefined {
  if (!radius) return undefined;
  return "topLeft" in radius || "topRight" in radius ? undefined : lengthPx(radius);
}
function cornerOf(radius: RadiusValue | undefined, corner: Corner): number | undefined {
  if (!radius) return undefined;
  if ("topLeft" in radius || "topRight" in radius) return lengthPx((radius as Record<string, unknown>)[corner]);
  return lengthPx(radius); // Length tunggal berlaku untuk semua sudut.
}

export function RadiusSection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const [perCorner, setPerCorner] = useState(false);
  if (nodes.length === 0 || !nodes.every((node) => RADIUS_TYPES.has(node.type))) return null;

  const radiusOf = (node: Node) => resolveStyle(node.style, "base").radius;
  const uniformValue = mixedValue(nodes.map((node) => uniformOf(radiusOf(node)) ?? 0));
  const cornerValue = (corner: Corner) => mixedValue(nodes.map((node) => cornerOf(radiusOf(node), corner) ?? 0));

  const apply = (compute: (radius: RadiusValue | undefined) => RadiusValue) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const node of nodes) {
        runCommand(runtime.commandCtx, updateStyle, {
          ids: [node.id],
          patch: { radius: compute(radiusOf(node)) },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  const setUniform = (update: NumberUpdate) =>
    apply((radius) => ({ value: Math.max(0, update(uniformOf(radius) ?? 0)), unit: "px" }));
  const setCorner = (corner: Corner, update: NumberUpdate) =>
    apply((radius) => {
      const base: Record<Corner, { value: number; unit: "px" }> = {
        topLeft: { value: cornerOf(radius, "topLeft") ?? 0, unit: "px" },
        topRight: { value: cornerOf(radius, "topRight") ?? 0, unit: "px" },
        bottomRight: { value: cornerOf(radius, "bottomRight") ?? 0, unit: "px" },
        bottomLeft: { value: cornerOf(radius, "bottomLeft") ?? 0, unit: "px" },
      };
      base[corner] = { value: Math.max(0, update(cornerOf(radius, corner) ?? 0)), unit: "px" };
      return base;
    });

  return (
    <InspectorSection id="radius" title={t("inspector.radius")}>
      <InspectorRow label={t("inspector.radius")}>
        <div className="flex items-center gap-1">
          {perCorner ? (
            <div className="grid grid-cols-2 gap-1">
              {CORNERS.map((corner) => (
                <NumberInput
                  key={corner}
                  label={t(`inspector.radius_${corner}`)}
                  scrubLabel={SHORT[corner]}
                  value={cornerValue(corner)}
                  min={0}
                  testId={`radius-${corner}`}
                  onCommit={(update) => setCorner(corner, update)}
                />
              ))}
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-2 gap-1">
              <NumberInput
                label={t("inspector.radius")}
                scrubLabel={isMixed(uniformValue) ? "◳" : "R"}
                value={uniformValue}
                min={0}
                testId="radius-uniform"
                onCommit={setUniform}
              />
            </div>
          )}
          <button
            type="button"
            aria-pressed={perCorner}
            aria-label={t("inspector.radiusPerCorner")}
            title={t("inspector.radiusPerCorner")}
            data-testid="radius-per-corner"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
              perCorner && "bg-accent text-foreground",
            )}
            onClick={() => setPerCorner((value) => !value)}
          >
            <SquareDashed className="size-3.5" />
          </button>
        </div>
      </InspectorRow>
    </InspectorSection>
  );
}
