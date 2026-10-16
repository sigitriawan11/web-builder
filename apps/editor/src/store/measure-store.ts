import { createStore } from "zustand/vanilla";
import type { Measurement } from "../canvas/measure";

// ED-076: pengukuran jarak Alt+hover (world). UI state, tidak pernah masuk dokumen.
interface MeasureState {
  measurements: readonly Measurement[];
  setMeasurements(measurements: readonly Measurement[]): void;
}

const EMPTY: readonly Measurement[] = [];

export const measureStore = createStore<MeasureState>()((set, get) => ({
  measurements: EMPTY,
  setMeasurements: (measurements) => {
    // Referensi tetap saat kosong agar subscriber tidak render ulang.
    if (measurements.length === 0 && get().measurements.length === 0) return;
    set({ measurements: measurements.length === 0 ? EMPTY : measurements });
  },
}));
