import { describe, expect, it } from "vitest";
import { GeometryStore, type ScreenRectLike } from "./geometry-store";

// DOM tiruan: elemen = objek, rect screen diatur manual, ResizeObserver & rAF dipicu manual.
function setup() {
  const screenRects = new Map<object, ScreenRectLike>();
  const reads: object[] = [];
  let origin = { left: 100, top: 50, zoom: 2 };
  let onResize: (elements: readonly Element[]) => void = () => {};
  const observed = new Set<object>();
  let scheduled: (() => void) | null = null;

  const store = new GeometryStore({
    readRect: (element) => {
      reads.push(element);
      return screenRects.get(element) ?? { left: 0, top: 0, width: 0, height: 0 };
    },
    readWorldOrigin: () => origin,
    observeSize: (callback) => {
      onResize = callback;
      return {
        observe: (element) => observed.add(element),
        unobserve: (element) => observed.delete(element),
        disconnect: () => observed.clear(),
      };
    },
    schedule: (callback) => {
      scheduled = callback;
    },
  });

  const element = (screen: ScreenRectLike) => {
    const el = {} as Element;
    screenRects.set(el, screen);
    return el;
  };

  return {
    store,
    reads,
    observed,
    element,
    setScreenRect: (el: Element, screen: ScreenRectLike) => screenRects.set(el, screen),
    setOrigin: (next: typeof origin) => {
      origin = next;
    },
    resize: (...elements: Element[]) => onResize(elements),
    flushFrame: () => {
      const callback = scheduled;
      scheduled = null;
      callback?.();
    },
    hasScheduled: () => scheduled !== null,
  };
}

describe("GeometryStore (ED-019)", () => {
  it("mengonversi rect screen ke world relatif ke origin #world dan zoom yang diterapkan", () => {
    const { store, element } = setup();
    store.register("n_card000001", element({ left: 300, top: 250, width: 200, height: 100 }));

    expect(store.getRect("n_card000001")).toEqual({ x: 100, y: 100, width: 100, height: 50 });
  });

  it("memakai cache: pembacaan kedua tidak menyentuh DOM", () => {
    const { store, element, reads } = setup();
    store.register("n_card000001", element({ left: 100, top: 50, width: 20, height: 20 }));

    store.getRect("n_card000001");
    store.getRect("n_card000001");

    expect(reads).toHaveLength(1);
  });

  it("pan/zoom tidak menginvalidasi rect world", () => {
    const { store, element, reads, setOrigin, setScreenRect } = setup();
    const card = element({ left: 300, top: 250, width: 200, height: 100 });
    store.register("n_card000001", card);
    const before = store.getRect("n_card000001");

    // Kamera berubah: rect screen ikut berubah, tapi geometry world tetap.
    setOrigin({ left: 0, top: 0, zoom: 1 });
    setScreenRect(card, { left: 100, top: 100, width: 100, height: 50 });

    expect(store.getRect("n_card000001")).toEqual(before);
    expect(reads).toHaveLength(1);
  });

  it("ResizeObserver hanya mengukur ulang node yang berubah ukuran", () => {
    const { store, element, reads, resize, setScreenRect, flushFrame } = setup();
    const a = element({ left: 100, top: 50, width: 20, height: 20 });
    const b = element({ left: 140, top: 50, width: 20, height: 20 });
    store.register("n_aaaaaa0001", a);
    store.register("n_bbbbbb0001", b);
    flushFrame();
    reads.length = 0;

    setScreenRect(a, { left: 100, top: 50, width: 60, height: 20 });
    resize(a);
    flushFrame();

    expect(reads).toEqual([a]);
    expect(store.peekRect("n_aaaaaa0001")?.width).toBe(30);
  });

  it("invalidateAll (transaksi dokumen / font termuat) mengukur ulang semua node dalam satu batch", () => {
    const { store, element, reads, flushFrame, hasScheduled } = setup();
    const a = element({ left: 100, top: 50, width: 20, height: 20 });
    const b = element({ left: 140, top: 50, width: 20, height: 20 });
    store.register("n_aaaaaa0001", a);
    store.register("n_bbbbbb0001", b);
    flushFrame();
    reads.length = 0;

    store.invalidateAll();
    expect(hasScheduled()).toBe(true);
    expect(reads).toHaveLength(0);

    // getRect sebelum frame terjadwal: mengukur SEMUA yang kedaluwarsa sekaligus, bukan satu per satu.
    store.getRect("n_aaaaaa0001");
    expect(reads).toEqual([a, b]);
    flushFrame();
    expect(reads).toHaveLength(2);
  });

  it("listener hanya dipanggil bila rect benar-benar berubah", () => {
    const { store, element, setScreenRect, flushFrame, resize } = setup();
    const card = element({ left: 100, top: 50, width: 20, height: 20 });
    store.register("n_card000001", card);
    flushFrame();
    let notified = 0;
    store.subscribe("n_card000001", () => notified++);

    store.invalidateAll();
    flushFrame();
    expect(notified).toBe(0);

    setScreenRect(card, { left: 120, top: 50, width: 20, height: 20 });
    resize(card);
    flushFrame();
    expect(notified).toBe(1);
  });

  it("unregister berhenti mengamati elemen dan menghapus rect", () => {
    const { store, element, observed } = setup();
    const card = element({ left: 100, top: 50, width: 20, height: 20 });
    store.register("n_card000001", card);
    expect(observed.has(card)).toBe(true);

    store.unregister("n_card000001");

    expect(observed.has(card)).toBe(false);
    expect(store.getRect("n_card000001")).toBeNull();
  });

  it("mendaftarkan ulang id dengan elemen baru mengganti elemen yang diamati", () => {
    const { store, element, observed } = setup();
    const first = element({ left: 100, top: 50, width: 20, height: 20 });
    const second = element({ left: 300, top: 250, width: 20, height: 20 });
    store.register("n_card000001", first);

    store.register("n_card000001", second);

    expect(observed.has(first)).toBe(false);
    expect(observed.has(second)).toBe(true);
    expect(store.getRect("n_card000001")).toEqual({ x: 100, y: 100, width: 10, height: 10 });
  });
});
