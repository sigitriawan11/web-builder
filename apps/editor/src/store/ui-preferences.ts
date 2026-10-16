import { z } from "zod";
import { createStore } from "zustand/vanilla";

// ED-007 / T2.1.6: preferensi UI editor per user (tab & lebar sidebar, …) di localStorage — kenyamanan per
// perangkat, bukan state penting (bisa kosong di mode privat; semua akses dibungkus try/catch).

export const LEFT_SIDEBAR_MIN = 200;
export const LEFT_SIDEBAR_MAX = 480;
export const LEFT_SIDEBAR_DEFAULT = 260;

export const RIGHT_SIDEBAR_MIN = 240;
export const RIGHT_SIDEBAR_MAX = 400;
export const RIGHT_SIDEBAR_DEFAULT = 280;

export const LEFT_TABS = ["layers", "assets", "insert"] as const;
// ED-008: tab inspector M2 (Prototype P1 M4, Data M7, Component M3 menyusul).
export const RIGHT_TABS = ["design", "settings"] as const;
export type RightTab = (typeof RIGHT_TABS)[number];
export type LeftTab = (typeof LEFT_TABS)[number];

const PreferencesSchema = z.object({
  leftTab: z.enum(LEFT_TABS).catch("layers"),
  leftWidth: z.number().min(LEFT_SIDEBAR_MIN).max(LEFT_SIDEBAR_MAX).catch(LEFT_SIDEBAR_DEFAULT),
  leftCollapsed: z.boolean().catch(false),
  pagesOpen: z.boolean().catch(true),
  rightTab: z.enum(RIGHT_TABS).catch("design"),
  rightWidth: z.number().min(RIGHT_SIDEBAR_MIN).max(RIGHT_SIDEBAR_MAX).catch(RIGHT_SIDEBAR_DEFAULT),
  // ED-008: section inspector yang diciutkan (ID section).
  collapsedSections: z.array(z.string().max(40)).max(50).catch([]),
  // ED-009: bar bawah bisa disembunyikan lewat menu View.
  bottomBarHidden: z.boolean().catch(false),
  // ED-034: tampilkan semua frame device berdampingan (selain itu mode fokus: breakpoint aktif saja).
  showAllFrames: z.boolean().catch(false),
});
export type UiPreferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: UiPreferences = {
  leftTab: "layers",
  leftWidth: LEFT_SIDEBAR_DEFAULT,
  leftCollapsed: false,
  pagesOpen: true,
  rightTab: "design",
  rightWidth: RIGHT_SIDEBAR_DEFAULT,
  collapsedSections: [],
  bottomBarHidden: false,
  showAllFrames: false,
};

export const clampSidebarWidth = (width: number) =>
  Math.round(Math.min(LEFT_SIDEBAR_MAX, Math.max(LEFT_SIDEBAR_MIN, width)));
export const clampInspectorWidth = (width: number) =>
  Math.round(Math.min(RIGHT_SIDEBAR_MAX, Math.max(RIGHT_SIDEBAR_MIN, width)));

export interface PreferenceStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

const browserStorage: PreferenceStorage = {
  read: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Penyimpanan diblokir/penuh: preferensi hanya berlaku di sesi ini.
    }
  },
};

export const preferencesKey = (userId: string | null) => `platform.editor.ui:${userId ?? "anon"}`;

export function parsePreferences(raw: string | null): UiPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return PreferencesSchema.parse({ ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as object) });
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

interface UiPreferencesState extends UiPreferences {
  userId: string | null;
  // Muat preferensi user (dipanggil setelah profil diketahui).
  loadFor(userId: string | null): void;
  update(patch: Partial<UiPreferences>): void;
}

export function createUiPreferencesStore(storage: PreferenceStorage = browserStorage) {
  return createStore<UiPreferencesState>()((set, get) => ({
    ...DEFAULT_PREFERENCES,
    userId: null,
    loadFor: (userId) => set({ ...parsePreferences(storage.read(preferencesKey(userId))), userId }),
    update: (patch) => {
      const { userId, loadFor: _l, update: _u, ...current } = get();
      const next = {
        ...current,
        ...patch,
        leftWidth: clampSidebarWidth(patch.leftWidth ?? current.leftWidth),
        rightWidth: clampInspectorWidth(patch.rightWidth ?? current.rightWidth),
      };
      set(next);
      storage.write(preferencesKey(userId), JSON.stringify(next));
    },
  }));
}

export const uiPreferencesStore = createUiPreferencesStore();
