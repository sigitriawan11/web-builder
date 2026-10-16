// ED-036: urutan satu langkah (Mod+] turun / Mod+[ naik) di dalam siblings. Murni; pemanggil menjalankan command
// `reorderNode` dengan index hasilnya.
export function reorderStepIndex(count: number, from: number, direction: "up" | "down"): number | null {
  if (from < 0 || from >= count) return null;
  const to = direction === "up" ? from - 1 : from + 1;
  return to < 0 || to >= count ? null : to;
}

// ED-091: z-order (urutan DOM = stacking). `forward`/`backward` = ±1; `front`/`back` = ujung. null = tanpa gerak.
export type ZOrderOp = "forward" | "backward" | "front" | "back";
export function zOrderIndex(count: number, from: number, op: ZOrderOp): number | null {
  if (from < 0 || from >= count) return null;
  const to = op === "forward" ? from + 1 : op === "backward" ? from - 1 : op === "front" ? count - 1 : 0;
  return to < 0 || to >= count || to === from ? null : to;
}
