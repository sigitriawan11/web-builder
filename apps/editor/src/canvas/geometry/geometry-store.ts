// ED-019: layout (flexbox, text wrap) dihitung browser, jadi editor mengukur DOM untuk mendapatkan
// bounding box tiap node dalam koordinat world. Rotasi (DM-033) belum didukung (M2).

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Listener = () => void;

export interface GeometryStoreDeps {
  // Rect screen elemen (getBoundingClientRect); di-inject agar bisa diuji tanpa layout browser.
  readRect(element: Element): ScreenRectLike;
  // Origin world di screen (rect `#world`) & zoom yang SEDANG diterapkan ke DOM
  // (bisa tertinggal satu frame dari cameraStore karena transform diterapkan di rAF).
  readWorldOrigin(): { left: number; top: number; zoom: number };
  // Pengamat ukuran; di browser = ResizeObserver.
  observeSize(onResize: (elements: readonly Element[]) => void): {
    observe(element: Element): void;
    unobserve(element: Element): void;
    disconnect(): void;
  };
  // Penjadwal batch pengukuran; di browser = requestAnimationFrame.
  schedule(callback: () => void): void;
}

interface Entry {
  element: Element;
  rect: WorldRect | null;
  // Rect valid hanya jika generasinya sama dengan generasi store (invalidasi massal O(1)).
  generation: number;
}

function sameRect(a: WorldRect | null, b: WorldRect | null): boolean {
  return (
    a !== null && b !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

export class GeometryStore {
  private readonly entries = new Map<string, Entry>();
  private readonly idByElement = new Map<Element, string>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly sizeObserver: ReturnType<GeometryStoreDeps["observeSize"]>;
  private generation = 1;
  private measureScheduled = false;

  constructor(private readonly deps: GeometryStoreDeps) {
    this.sizeObserver = deps.observeSize((elements) => {
      for (const element of elements) {
        const id = this.idByElement.get(element);
        const entry = id ? this.entries.get(id) : undefined;
        if (entry) entry.generation = 0;
      }
      this.scheduleMeasure();
    });
  }

  register(id: string, element: Element): void {
    const previous = this.entries.get(id);
    if (previous?.element === element) return;
    if (previous) this.unregister(id);
    this.entries.set(id, { element, rect: null, generation: 0 });
    this.idByElement.set(element, id);
    this.sizeObserver.observe(element);
    this.scheduleMeasure();
  }

  unregister(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.sizeObserver.unobserve(entry.element);
    this.idByElement.delete(entry.element);
    this.entries.delete(id);
  }

  // Perubahan dokumen bisa menggeser saudara tanpa mengubah ukurannya (ResizeObserver tidak terpicu),
  // jadi setiap transaksi & font termuat menandai semua rect kedaluwarsa. Pan/zoom TIDAK (ED-019).
  invalidateAll(): void {
    this.generation += 1;
    this.scheduleMeasure();
  }

  /**
   * Rect world node; mengukur ulang (bersama semua rect kedaluwarsa lain, satu batch) bila perlu.
   * Jangan dipanggil di pointermove: pakai `peekRect` agar tidak memaksa layout sinkron (AC ED-019).
   */
  getRect(id: string): WorldRect | null {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (entry.generation !== this.generation) this.measureStale();
    return entry.rect;
  }

  // Elemen DOM node (untuk preview transform sementara, ED-024).
  getElement(id: string): Element | null {
    return this.entries.get(id)?.element ?? null;
  }

  // Rect terakhir di cache tanpa mengukur (boleh sedikit basi).
  peekRect(id: string): WorldRect | null {
    return this.entries.get(id)?.rect ?? null;
  }

  subscribe(id: string, listener: Listener): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(id);
    };
  }

  destroy(): void {
    this.sizeObserver.disconnect();
    this.entries.clear();
    this.idByElement.clear();
    this.listeners.clear();
  }

  private scheduleMeasure(): void {
    if (this.measureScheduled) return;
    this.measureScheduled = true;
    this.deps.schedule(() => {
      this.measureScheduled = false;
      this.measureStale();
    });
  }

  // Semua baca dulu (rect DOM), baru tulis cache & beri tahu listener: menghindari layout thrashing.
  private measureStale(): void {
    const stale = [...this.entries].filter(([, entry]) => entry.generation !== this.generation);
    if (stale.length === 0) return;

    const origin = this.deps.readWorldOrigin();
    const measured = stale.map(([id, entry]) => {
      const screen = this.deps.readRect(entry.element);
      const rect: WorldRect = {
        x: (screen.left - origin.left) / origin.zoom,
        y: (screen.top - origin.top) / origin.zoom,
        width: screen.width / origin.zoom,
        height: screen.height / origin.zoom,
      };
      return { id, entry, rect };
    });

    const changed: string[] = [];
    for (const { id, entry, rect } of measured) {
      if (!sameRect(entry.rect, rect)) changed.push(id);
      entry.rect = rect;
      entry.generation = this.generation;
    }
    for (const id of changed) {
      for (const listener of this.listeners.get(id) ?? []) listener();
    }
  }
}
