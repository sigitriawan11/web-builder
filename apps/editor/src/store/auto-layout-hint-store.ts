import { createStore } from "zustand/vanilla";

// ED-099: banner anjuran auto-layout di-dismiss per frame (sesi editor ini; UI state, bukan dokumen).
interface AutoLayoutHintState {
  dismissed: ReadonlySet<string>;
  dismiss(frameId: string): void;
}

export const autoLayoutHintStore = createStore<AutoLayoutHintState>()((set, get) => ({
  dismissed: new Set<string>(),
  dismiss: (frameId) => set({ dismissed: new Set(get().dismissed).add(frameId) }),
}));
