import { BreakpointDefSchema, runCommand, setSettings, YDOC_KEYS } from "@platform/document-model";
import { useStore } from "zustand";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { usePreviewWidths } from "../../document/use-preview-widths";
import { NumberInput } from "../../panels/properties/inputs/NumberInput";
import { breakpointStore } from "../../store/breakpoint-store";
import { useT } from "../i18n";

// ED-174: lebar preview custom per breakpoint — tersimpan di `settings.breakpoints[].previewWidth` (DM-035). Mengubah
// nilai mengubah lebar artboard breakpoint aktif (usePreviewWidths → frame-layout). Clamp 240–10000 sesuai skema.
export function BreakpointWidthControl({ runtime, readOnly }: { runtime: CanvasRuntime; readOnly: boolean }) {
  const t = useT();
  const active = useStore(breakpointStore, (state) => state.active);
  const widths = usePreviewWidths(runtime.doc);

  const setWidth = (width: number) => {
    if (readOnly) return;
    const parsed = BreakpointDefSchema.array().safeParse(runtime.doc.getMap(YDOC_KEYS.settings).get("breakpoints"));
    if (!parsed.success) return;
    const clamped = Math.max(240, Math.min(10_000, Math.round(width)));
    const next = parsed.data.map((bp) => (bp.id === active ? { ...bp, previewWidth: clamped } : bp));
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, setSettings, { patch: { breakpoints: next } });
    runtime.undo.stopCapturing();
  };

  return (
    <div className="w-16">
      <NumberInput
        label={t("toolbar.previewWidth")}
        scrubLabel="W"
        value={widths[active]}
        min={240}
        max={10_000}
        testId="preview-width"
        onCommit={(update) => setWidth(update(widths[active]))}
      />
    </div>
  );
}
