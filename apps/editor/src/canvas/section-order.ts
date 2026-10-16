// ED-036: urutan satu langkah (Mod+] turun / Mod+[ naik) di dalam siblings. Murni; pemanggil menjalankan command
// `reorderNode` dengan index hasilnya.
export function reorderStepIndex(count: number, from: number, direction: "up" | "down"): number | null {
  if (from < 0 || from >= count) return null;
  const to = direction === "up" ? from - 1 : from + 1;
  return to < 0 || to >= count ? null : to;
}
