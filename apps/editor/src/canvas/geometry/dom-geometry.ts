import { GeometryStore } from "./geometry-store";

export interface DomGeometry {
  store: GeometryStore;
  // Zoom yang sedang diterapkan ke transform `#world` (diisi CanvasViewport saat menulis transform),
  // bukan nilai cameraStore yang bisa satu frame lebih baru.
  setAppliedZoom(zoom: number): void;
  destroy(): void;
}

/** GeometryStore canvas dengan DOM & ResizeObserver sungguhan; world origin dibaca dari `#world`. */
export function createDomGeometry(): DomGeometry {
  let appliedZoom = 1;
  const store = new GeometryStore({
    readRect: (element) => element.getBoundingClientRect(),
    readWorldOrigin: () => {
      const rect = document.getElementById("world")?.getBoundingClientRect();
      return { left: rect?.left ?? 0, top: rect?.top ?? 0, zoom: appliedZoom };
    },
    observeSize: (onResize) => {
      const observer = new ResizeObserver((entries) => onResize(entries.map((entry) => entry.target)));
      return {
        observe: (element) => observer.observe(element),
        unobserve: (element) => observer.unobserve(element),
        disconnect: () => observer.disconnect(),
      };
    },
    schedule: (callback) => requestAnimationFrame(callback),
  });
  // Font termuat mengubah ukuran teks tanpa transaksi dokumen (edge case ED-019).
  const onFontsLoaded = () => store.invalidateAll();
  document.fonts.addEventListener("loadingdone", onFontsLoaded);
  return {
    store,
    setAppliedZoom: (zoom) => {
      appliedZoom = zoom;
    },
    destroy: () => {
      document.fonts.removeEventListener("loadingdone", onFontsLoaded);
      store.destroy();
    },
  };
}
