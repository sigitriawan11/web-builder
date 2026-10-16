import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import { breakpointStore } from "../../store/breakpoint-store";
import { selectionStore } from "../../store/selection-store";
import { cameraStore } from "../camera-store";
import { useCanvasRuntime } from "../canvas-runtime";
import { useFrames } from "../frames/frames-context";

// ED-034: label nama + lebar di atas tiap frame (screen space, tidak ikut ter-scale); klik = pilih page root di
// breakpoint itu & aktifkan.
export function FrameLabels() {
  const t = useT();
  const runtime = useCanvasRuntime();
  const frames = useFrames();
  const camera = useStore(cameraStore);
  const active = useStore(breakpointStore, (state) => state.active);
  return (
    <>
      {frames.map((frame) => (
        <button
          key={frame.breakpoint}
          type="button"
          data-testid={`frame-label-${frame.breakpoint}`}
          aria-pressed={active === frame.breakpoint}
          className="overlay-frame-label"
          style={{
            // Frame top di world y=0 → screen y = camera.y. Label menempel di atas frame, tetapi tidak naik di atas
            // tepi atas canvas (sticky) agar selalu terlihat & bisa diklik.
            transform: `translate(${frame.x * camera.zoom + camera.x}px, ${Math.max(2, camera.y - 22)}px)`,
            fontWeight: active === frame.breakpoint ? 600 : 400,
          }}
          onClick={() => {
            breakpointStore.getState().setActive(frame.breakpoint);
            selectionStore.getState().select([runtime.pageId]);
          }}
        >
          {t(`breakpoints.${frame.breakpoint}`)} · {frame.width}
        </button>
      ))}
    </>
  );
}
