import { useStore } from "zustand";
import { previewStore } from "../../store/preview-store";
import { cameraStore } from "../camera-store";

// ED-073: garis smart-guide (magenta 1px, px screen) di posisi snap selama drag. Koordinat guide dalam world.
export function SnapGuidesOverlay() {
  const guides = useStore(previewStore, (state) => state.guides);
  const camera = useStore(cameraStore);
  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((guide) => {
        if (guide.axis === "x") {
          const x = guide.position * camera.zoom + camera.x;
          const y = guide.start * camera.zoom + camera.y;
          return (
            <div
              key={`x-${guide.position}-${guide.start}`}
              className="overlay-snap-guide"
              data-axis="x"
              style={{
                transform: `translate(${x}px, ${y}px)`,
                width: 1,
                height: (guide.end - guide.start) * camera.zoom,
              }}
            />
          );
        }
        const y = guide.position * camera.zoom + camera.y;
        const x = guide.start * camera.zoom + camera.x;
        return (
          <div
            key={`y-${guide.position}-${guide.start}`}
            className="overlay-snap-guide"
            data-axis="y"
            style={{
              transform: `translate(${x}px, ${y}px)`,
              width: (guide.end - guide.start) * camera.zoom,
              height: 1,
            }}
          />
        );
      })}
    </>
  );
}
