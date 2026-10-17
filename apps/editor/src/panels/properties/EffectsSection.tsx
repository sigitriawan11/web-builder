import { type Node, resolveStyle, runCommand, type Shadow, updateStyle } from "@platform/document-model";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { ColorInput } from "./color/ColorInput";
import { InspectorSection } from "./InspectorSection";
import { NumberInput } from "./inputs/NumberInput";

// ED-108/DM-031: effects bayangan (drop/inner, multi). Berlaku untuk semua node.
const TYPES = ["dropShadow", "innerShadow"] as const;

export function EffectsSection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const node = nodes[0];
  if (!node) return null;
  const effects = resolveStyle(node.style, "base").effects ?? [];

  const setEffects = (next: Shadow[]) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const target of nodes) {
        runCommand({ doc: runtime.doc, origin: runtime.origin }, updateStyle, {
          ids: [target.id],
          patch: { effects: next },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };
  const patchAt = (index: number, patch: Partial<Shadow>) =>
    setEffects(effects.map((effect, i) => (i === index ? { ...effect, ...patch } : effect)));

  const field = (shadow: Shadow, key: "x" | "y" | "blur" | "spread") =>
    key === "spread" ? (shadow.spread ?? 0) : shadow[key];

  return (
    <InspectorSection id="effects" title={t("inspector.effects")}>
      <div className="flex flex-col gap-3">
        {effects.map((shadow, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: effect tidak punya id; posisi = identitas.
          <div key={index} className="flex flex-col gap-1 border-b pb-2 last:border-b-0 last:pb-0">
            <div className="flex items-center gap-2">
              <select
                aria-label={t("inspector.effectType")}
                data-testid={`effect-type-${index}`}
                disabled={readOnly}
                value={shadow.type}
                onChange={(event) => patchAt(index, { type: event.target.value as (typeof TYPES)[number] })}
                className="h-7 flex-1 rounded border border-transparent bg-muted/50 px-1 text-xs hover:border-border"
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`inspector.effectType_${type}`)}
                  </option>
                ))}
              </select>
              <ColorInput
                value={typeof shadow.color === "string" ? shadow.color : "#000000"}
                readOnly={readOnly}
                testId={`effect-color-${index}`}
                onChange={(hex) => patchAt(index, { color: hex })}
              />
              <button
                type="button"
                disabled={readOnly}
                aria-label={t("inspector.removeEffect")}
                data-testid={`effect-remove-${index}`}
                className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                onClick={() => setEffects(effects.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(["x", "y", "blur", "spread"] as const).map((key) => (
                <NumberInput
                  key={key}
                  label={t(`inspector.effect_${key}`)}
                  scrubLabel={t(`inspector.effect_${key}`)}
                  value={field(shadow, key)}
                  testId={`effect-${key}-${index}`}
                  onCommit={(update) =>
                    patchAt(
                      index,
                      key === "blur"
                        ? { blur: Math.max(0, update(field(shadow, key))) }
                        : { [key]: update(field(shadow, key)) },
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={readOnly}
          data-testid="effect-add"
          className="flex items-center gap-1 self-start rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          onClick={() =>
            setEffects([...effects, { type: "dropShadow", x: 0, y: 2, blur: 4, spread: 0, color: "#00000040" }])
          }
        >
          <Plus className="size-3.5" />
          {t("inspector.addEffect")}
        </button>
      </div>
    </InspectorSection>
  );
}
