import { type Node, runCommand, setNodeProps } from "@platform/document-model";
import { Checkbox } from "@platform/ui";
import { useId } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorSection } from "./InspectorSection";
import { isMixed, mixedValue } from "./mixed";

// ED-112: "Clip content" pada frame → props.clipContent → renderer `overflow: hidden`. Overflow scroll = P1 (M4).
export function AppearanceSection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const clipId = useId();
  // clipContent hanya ada di frame (FramePropsSchema); kontrol muncul bila ada frame terpilih.
  const frames = nodes.filter((node) => node.type === "frame");
  if (frames.length === 0) return null;
  const value = mixedValue(frames.map((node) => (node.type === "frame" ? (node.props.clipContent ?? false) : false)));
  const checked: boolean | "indeterminate" = isMixed(value) ? "indeterminate" : (value ?? false);

  const setClip = (on: boolean) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const node of frames) {
        runCommand(runtime.commandCtx, setNodeProps, {
          id: node.id,
          patch: { clipContent: on ? true : null },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  return (
    <InspectorSection id="appearance" title={t("inspector.appearance")}>
      <div className="flex items-center gap-2 text-xs">
        <Checkbox
          id={clipId}
          checked={checked}
          disabled={readOnly}
          data-testid="clip-content"
          onCheckedChange={(next) => setClip(next === true)}
        />
        <label htmlFor={clipId}>{t("inspector.clipContent")}</label>
      </div>
    </InspectorSection>
  );
}
