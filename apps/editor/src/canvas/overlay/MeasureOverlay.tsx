import { useStore } from "zustand";
import { measureStore } from "../../store/measure-store";
import { cameraStore } from "../camera-store";
import { formatDistance } from "../measure";

// ED-076: garis ukur merah + label jarak (px world). Koordinat measurement dalam world → screen via kamera.
export function MeasureOverlay() {
  const measurements = useStore(measureStore, (state) => state.measurements);
  const camera = useStore(cameraStore);
  if (measurements.length === 0) return null;

  const toScreen = (value: number, axis: "x" | "y") =>
    axis === "x" ? value * camera.zoom + camera.x : value * camera.zoom + camera.y;

  return (
    <>
      {measurements.map((m) => {
        const mid = (m.start + m.end) / 2;
        if (m.axis === "x") {
          const left = toScreen(m.start, "x");
          const top = toScreen(m.cross, "y");
          return (
            <div key={`x-${m.start}-${m.end}-${m.cross}`}>
              <div
                className="overlay-measure-line"
                style={{
                  transform: `translate(${left}px, ${top}px)`,
                  width: (m.end - m.start) * camera.zoom,
                  height: 1,
                }}
              />
              <div
                className="overlay-measure-label"
                data-testid="measure-label"
                style={{ transform: `translate(${toScreen(mid, "x")}px, ${top}px)` }}
              >
                {formatDistance(m.distance)}
              </div>
            </div>
          );
        }
        const top = toScreen(m.start, "y");
        const left = toScreen(m.cross, "x");
        return (
          <div key={`y-${m.start}-${m.end}-${m.cross}`}>
            <div
              className="overlay-measure-line"
              style={{ transform: `translate(${left}px, ${top}px)`, width: 1, height: (m.end - m.start) * camera.zoom }}
            />
            <div
              className="overlay-measure-label"
              data-testid="measure-label"
              style={{ transform: `translate(${left}px, ${toScreen(mid, "y")}px)` }}
            >
              {formatDistance(m.distance)}
            </div>
          </div>
        );
      })}
    </>
  );
}
