import { GeometryStore } from "./geometry-store";

// SEMENTARA (spike M0): satu GeometryStore untuk canvas, dengan DOM & ResizeObserver sungguhan.

// Zoom yang sedang diterapkan ke transform `#world` (diisi CanvasViewport saat menulis transform),
// bukan nilai cameraStore yang bisa satu frame lebih baru.
let appliedZoom = 1;
export function setAppliedZoom(zoom: number): void {
  appliedZoom = zoom;
}

export const spikeGeometry = new GeometryStore({
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
document.fonts.addEventListener("loadingdone", () => spikeGeometry.invalidateAll());
