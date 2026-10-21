import { clearNodeState, type Node, runCommand, setNodeState } from "@platform/document-model";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput } from "./inputs/NumberInput";

// CMP-032 (Mode Admin): delta style per interaction state. Editor minimal — opacity per state (hover/focus/pressed/
// disabled) via setNodeState/clearNodeState. Style penuh per state (fill/typography) + toggle "Preview state" canvas =
// follow-up. Hanya untuk satu node terpilih.
const STATES = ["hover", "focus", "pressed", "disabled"] as const;

export function StatesSection({ runtime, node, readOnly }: { runtime: CanvasRuntime; node: Node; readOnly: boolean }) {
  const t = useT();
  const statePercent = (state: (typeof STATES)[number]): number | undefined => {
    const opacity = node.style.states?.[state]?.base?.opacity;
    return typeof opacity === "number" ? Math.round(opacity * 100) : undefined;
  };

  return (
    <InspectorSection id="states" title={t("inspector.states.title")}>
      {STATES.map((state) => {
        const current = statePercent(state);
        return (
          <InspectorRow key={state} label={t(`inspector.states.${state}`)}>
            <div className="flex items-center gap-1">
              <NumberInput
                label={`${t(`inspector.states.${state}`)} ${t("inspector.states.opacity")}`}
                scrubLabel="%"
                value={current}
                min={0}
                max={100}
                testId={`inspector-state-${state}-opacity`}
                onCommit={(update) => {
                  if (readOnly) return;
                  const next = Math.max(0, Math.min(100, update(current ?? 100)));
                  runtime.undo.stopCapturing();
                  runCommand(runtime.commandCtx, setNodeState, {
                    id: node.id,
                    state,
                    patch: { opacity: next / 100 },
                  });
                  runtime.undo.stopCapturing();
                }}
              />
              {current !== undefined && !readOnly ? (
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => runCommand(runtime.commandCtx, clearNodeState, { id: node.id, state })}
                >
                  {t("inspector.states.clear")}
                </button>
              ) : null}
            </div>
          </InspectorRow>
        );
      })}
    </InspectorSection>
  );
}
