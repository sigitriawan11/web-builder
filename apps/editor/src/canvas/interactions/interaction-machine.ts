// ED-023: satu state machine untuk semua interaksi pointer di canvas, agar drag, marquee, dan pan
// tidak saling bertabrakan. Reducer murni; adapter DOM ada di use-interaction-machine.ts.

// ED-023: jarak minimal (px screen) sebelum tekan berubah menjadi drag, agar klik tidak menggeser node.
export const DRAG_THRESHOLD_PX = 3;

export interface Point {
  x: number;
  y: number;
}

export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

// Yang berada di bawah pointer saat ditekan.
export type PressTarget =
  // `path`: rantai node hasil hit-test (terdalam → page), untuk aturan kedalaman seleksi (ED-051).
  | { kind: "node"; nodeId: string; path: readonly string[] }
  | { kind: "handle"; nodeId: string; handle: ResizeHandle }
  // Area kosong: latar page, latar frame yang sedang "dimasuki", atau di luar page. `scopeId` = frame yang
  // anak-anaknya menjadi kandidat marquee (ED-053); null = top-level page aktif. `path` = hit-test di titik
  // itu (kosong di luar page), agar klik di latar frame yang dimasuki tetap memilih frame itu.
  | { kind: "empty"; scopeId: string | null; path: readonly string[] };

interface PointerTrack {
  pointerId: number;
  // Titik screen saat ditekan & posisi terakhir.
  origin: Point;
  current: Point;
  // Shift saat gerakan terakhir: kunci sumbu saat pindah (ED-062).
  shiftKey: boolean;
}

export type InteractionState =
  | { type: "idle" }
  | ({ type: "pressing"; target: PressTarget; additive: boolean; deep: boolean } & PointerTrack)
  // `path`: rantai hit-test node yang ditekan, untuk menentukan node yang dipindah (ED-038/ED-051).
  | ({ type: "dragMove"; nodeId: string; path: readonly string[] } & PointerTrack)
  | ({ type: "dragResize"; nodeId: string; handle: ResizeHandle } & PointerTrack)
  | ({ type: "marquee"; scopeId: string | null; additive: boolean } & PointerTrack)
  | { type: "panning"; pointerId: number };

export type DragState = Extract<InteractionState, { type: "dragMove" | "dragResize" | "marquee" }>;

export type InteractionEvent =
  | {
      type: "pointerDown";
      pointerId: number;
      button: number;
      point: Point;
      target: PressTarget;
      panTool: boolean;
      // Shift: marquee menambah ke seleksi (ED-053) / toggle multi-select (ED-052).
      additive: boolean;
      // Mod (Ctrl/Meta): deep select node terdalam (ED-054).
      deep: boolean;
    }
  | { type: "pointerMove"; pointerId: number; point: Point; shiftKey?: boolean }
  | { type: "pointerUp"; pointerId: number; point: Point }
  | { type: "pointerCancel"; pointerId: number }
  | { type: "escape" }
  | { type: "blur" };

export type InteractionEffect =
  // Tekan lalu lepas tanpa melewati threshold (seleksi: T0.5.4).
  | { type: "click"; target: PressTarget; point: Point; additive: boolean; deep: boolean }
  // Drag selesai: perubahan preview di-commit ke dokumen sebagai satu transaksi (ED-024).
  | { type: "commit"; drag: DragState }
  // Drag dibatalkan (Esc, pointercancel, jendela kehilangan fokus): preview dibuang (ED-024).
  | { type: "cancel"; drag: DragState };

export interface Transition {
  state: InteractionState;
  effects: InteractionEffect[];
}

export const IDLE: InteractionState = { type: "idle" };

const PRIMARY_BUTTON = 0;
const MIDDLE_BUTTON = 1;

const unchanged = (state: InteractionState): Transition => ({ state, effects: [] });

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Jenis drag ditentukan oleh yang ditekan: node → pindah, handle → resize, area kosong → marquee.
function startDrag(
  pressing: Extract<InteractionState, { type: "pressing" }>,
  point: Point,
  shiftKey: boolean,
): DragState {
  const track = { pointerId: pressing.pointerId, origin: pressing.origin, current: point, shiftKey };
  switch (pressing.target.kind) {
    case "node":
      return { type: "dragMove", nodeId: pressing.target.nodeId, path: pressing.target.path, ...track };
    case "handle":
      return { type: "dragResize", nodeId: pressing.target.nodeId, handle: pressing.target.handle, ...track };
    case "empty":
      return { type: "marquee", scopeId: pressing.target.scopeId, additive: pressing.additive, ...track };
  }
}

function isDrag(state: InteractionState): state is DragState {
  return state.type === "dragMove" || state.type === "dragResize" || state.type === "marquee";
}

/**
 * Transisi state interaksi. Event yang tidak berlaku di state saat ini (atau dari pointer lain)
 * diabaikan tanpa error (AC ED-023).
 */
export function reduceInteraction(state: InteractionState, event: InteractionEvent): Transition {
  switch (event.type) {
    case "pointerDown": {
      if (state.type !== "idle") return unchanged(state);
      if (event.button === MIDDLE_BUTTON || (event.button === PRIMARY_BUTTON && event.panTool)) {
        return { state: { type: "panning", pointerId: event.pointerId }, effects: [] };
      }
      // Tombol kanan dll. dibiarkan untuk context menu.
      if (event.button !== PRIMARY_BUTTON) return unchanged(state);
      return {
        state: {
          type: "pressing",
          pointerId: event.pointerId,
          origin: event.point,
          current: event.point,
          shiftKey: event.additive,
          target: event.target,
          additive: event.additive,
          deep: event.deep,
        },
        effects: [],
      };
    }

    case "pointerMove": {
      if (state.type === "idle" || state.type === "panning" || state.pointerId !== event.pointerId)
        return unchanged(state);
      const shiftKey = event.shiftKey ?? state.shiftKey;
      if (state.type === "pressing") {
        if (distance(state.origin, event.point) < DRAG_THRESHOLD_PX) {
          return { state: { ...state, current: event.point, shiftKey }, effects: [] };
        }
        return { state: startDrag(state, event.point, shiftKey), effects: [] };
      }
      return { state: { ...state, current: event.point, shiftKey }, effects: [] };
    }

    case "pointerUp": {
      if (state.type === "idle" || state.pointerId !== event.pointerId) return unchanged(state);
      if (state.type === "panning") return { state: IDLE, effects: [] };
      if (state.type === "pressing")
        return {
          state: IDLE,
          effects: [
            { type: "click", target: state.target, point: event.point, additive: state.additive, deep: state.deep },
          ],
        };
      return { state: IDLE, effects: [{ type: "commit", drag: { ...state, current: event.point } }] };
    }

    case "pointerCancel": {
      if (state.type === "idle" || state.pointerId !== event.pointerId) return unchanged(state);
      return { state: IDLE, effects: isDrag(state) ? [{ type: "cancel", drag: state }] : [] };
    }

    case "escape": {
      // Esc tidak menghentikan pan; saat ditekan membatalkan klik; saat drag membatalkan preview.
      if (state.type === "pressing") return { state: IDLE, effects: [] };
      if (isDrag(state)) return { state: IDLE, effects: [{ type: "cancel", drag: state }] };
      return unchanged(state);
    }

    case "blur": {
      if (state.type === "idle") return unchanged(state);
      return { state: IDLE, effects: isDrag(state) ? [{ type: "cancel", drag: state }] : [] };
    }
  }
}
