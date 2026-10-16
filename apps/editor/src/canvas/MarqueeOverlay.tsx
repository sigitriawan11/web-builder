import { useStore } from "zustand";
import { interactionStore } from "../store/interaction-store";
import { marqueeSelection } from "../tools/select/marquee-selection";
import { useCanvasRuntime } from "./canvas-runtime";
import { GeometryOutline } from "./GeometryOutline";

// ED-053: kotak marquee + highlight live node yang akan terpilih.
export function MarqueeOverlay() {
  const { marquee } = useCanvasRuntime();
  const state = useStore(interactionStore, (store) => store.state);
  if (state.type !== "marquee") return null;

  // Titik state = koordinat client; overlay diposisikan relatif ke viewport.
  const offset = marquee.viewportOffset();
  const left = Math.min(state.origin.x, state.current.x) - offset.left;
  const top = Math.min(state.origin.y, state.current.y) - offset.top;
  const hits = marqueeSelection(state, marquee);

  return (
    <>
      {hits.map((id) => (
        <GeometryOutline key={id} nodeId={id} className="overlay-marquee-hit" />
      ))}
      <div
        className="overlay-marquee"
        style={{
          transform: `translate(${left}px, ${top}px)`,
          width: Math.abs(state.current.x - state.origin.x),
          height: Math.abs(state.current.y - state.origin.y),
        }}
      />
    </>
  );
}
