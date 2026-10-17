import { type Fill, type Node, resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { ColorInput } from "./color/ColorInput";
import { InspectorSection } from "./InspectorSection";

// ED-102/DM-029: fill solid (tambah/hapus/toggle/warna). Hanya untuk node yang mengizinkan fills (frame/shape/page).
const FILLABLE = new Set<Node["type"]>(["frame", "shape", "page"]);

export function FillSection({
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
  if (!node || !nodes.every((n) => FILLABLE.has(n.type))) return null;
  const fills = resolveStyle(node.style, "base").fills ?? [];

  const setFills = (next: readonly Fill[]) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const target of nodes) {
        runCommand({ doc: runtime.doc, origin: runtime.origin }, updateStyle, {
          ids: [target.id],
          patch: { fills: next as Fill[] },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  const update = (index: number, patch: Partial<Extract<Fill, { type: "solid" }>>) =>
    setFills(fills.map((fill, i) => (i === index && fill.type === "solid" ? { ...fill, ...patch } : fill)));

  return (
    <InspectorSection id="fills" title={t("inspector.fill")}>
      <div className="flex flex-col gap-1">
        {fills.map((fill, index) => (
          // Fills adalah list terurut tanpa id stabil; index = identitas posisinya.
          // biome-ignore lint/suspicious/noArrayIndexKey: fill tidak punya id; posisi = identitas.
          <div key={index} className="flex items-center gap-2 text-xs">
            {fill.type === "solid" ? (
              <>
                <ColorInput
                  value={typeof fill.color === "string" ? fill.color : "#000000"}
                  readOnly={readOnly}
                  testId={`fill-color-${index}`}
                  onChange={(hex) => update(index, { color: hex })}
                />
                <span className="flex-1 truncate tabular-nums text-muted-foreground">
                  {typeof fill.color === "string" ? fill.color : t("inspector.token")}
                </span>
              </>
            ) : (
              <span className="flex-1 truncate text-muted-foreground">{t("nodeType.image")}</span>
            )}
            <button
              type="button"
              disabled={readOnly}
              aria-label={t("inspector.fillVisible")}
              data-testid={`fill-visible-${index}`}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={() => update(index, { visible: fill.visible === false })}
            >
              {fill.visible === false ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button
              type="button"
              disabled={readOnly}
              aria-label={t("inspector.removeFill")}
              data-testid={`fill-remove-${index}`}
              className="text-muted-foreground hover:text-destructive disabled:opacity-40"
              onClick={() => setFills(fills.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={readOnly}
          data-testid="fill-add"
          className="flex items-center gap-1 self-start rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          onClick={() => setFills([...fills, { type: "solid", color: "#000000" }])}
        >
          <Plus className="size-3.5" />
          {t("inspector.addFill")}
        </button>
      </div>
    </InspectorSection>
  );
}
