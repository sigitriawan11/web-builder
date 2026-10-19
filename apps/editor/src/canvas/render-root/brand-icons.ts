import { createStore } from "zustand/vanilla";

// ED-163: logo merek (WhatsApp, Instagram, dll.) dari Simple Icons (CC0). Dimuat LAZY (dynamic import) → data ~3.4rb
// ikon tidak masuk bundle editor sampai dipakai (dibuka picker brand / ada node icon set "brand" di kanvas).

export interface BrandIcon {
  slug: string;
  title: string;
  path: string;
}

interface BrandIconsState {
  entries: Map<string, BrandIcon>;
  list: readonly BrandIcon[];
  loaded: boolean;
  loading: boolean;
  /** Muat data Simple Icons sekali (idempoten). */
  load(): void;
}

export const brandIconsStore = createStore<BrandIconsState>()((set, get) => ({
  entries: new Map(),
  list: [],
  loaded: false,
  loading: false,
  load: () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    import("simple-icons")
      .then((mod) => {
        const entries = new Map<string, BrandIcon>();
        const list: BrandIcon[] = [];
        for (const value of Object.values(mod as Record<string, unknown>)) {
          if (value && typeof value === "object" && "slug" in value && "path" in value && "title" in value) {
            const icon = value as { slug: string; title: string; path: string };
            if (typeof icon.slug === "string" && typeof icon.path === "string" && typeof icon.title === "string") {
              const entry: BrandIcon = { slug: icon.slug, title: icon.title, path: icon.path };
              entries.set(icon.slug, entry);
              list.push(entry);
            }
          }
        }
        list.sort((a, b) => a.title.localeCompare(b.title));
        set({ entries, list, loaded: true, loading: false });
      })
      .catch(() => set({ loading: false }));
  },
}));

/** Cari ikon brand (nama/slug) dari data yang sudah dimuat; dibatasi `limit`. */
export function searchBrandIcons(query: string, limit = 120): readonly BrandIcon[] {
  const { list } = brandIconsStore.getState();
  const q = query.trim().toLowerCase();
  const matched = q === "" ? list : list.filter((i) => i.title.toLowerCase().includes(q) || i.slug.includes(q));
  return matched.slice(0, limit);
}
