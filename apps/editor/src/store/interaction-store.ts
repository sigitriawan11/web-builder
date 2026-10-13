import { createStore } from "zustand/vanilla";
import {
  IDLE,
  type InteractionEffect,
  type InteractionEvent,
  type InteractionState,
  reduceInteraction,
} from "../canvas/interactions/interaction-machine";

type EffectListener = (effect: InteractionEffect) => void;

interface InteractionStoreState {
  state: InteractionState;
  dispatch(event: InteractionEvent): void;
  // Konsumen efek (seleksi T0.5.4, commit drag T0.6.x) berlangganan di sini.
  onEffect(listener: EffectListener): () => void;
}

// UI state (bukan dokumen): state interaksi pointer canvas (ED-023).
export function createInteractionStore() {
  const listeners = new Set<EffectListener>();
  return createStore<InteractionStoreState>()((set, get) => ({
    state: IDLE,
    dispatch: (event) => {
      const { state, effects } = reduceInteraction(get().state, event);
      if (state !== get().state) set({ state });
      for (const effect of effects) for (const listener of listeners) listener(effect);
    },
    onEffect: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  }));
}

export const interactionStore = createInteractionStore();
