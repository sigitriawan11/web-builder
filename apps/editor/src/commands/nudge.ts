// ED-064: nudge keyboard. Logika murni; pemanggil menjalankan command updateStyle (absolute) atau reorderNode (flow).

export type Arrow = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export const ARROW_KEYS = new Set<string>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export function isArrow(key: string): key is Arrow {
  return ARROW_KEYS.has(key);
}

// Geseran posisi absolute per arrow (hanya satu sumbu). `amount` = 1 (default) atau big nudge (Shift).
export function nudgeOffset(arrow: Arrow, amount: number): { x: number; y: number } {
  switch (arrow) {
    case "ArrowLeft":
      return { x: -amount, y: 0 };
    case "ArrowRight":
      return { x: amount, y: 0 };
    case "ArrowUp":
      return { x: 0, y: -amount };
    case "ArrowDown":
      return { x: 0, y: amount };
  }
}

// Arah reorder untuk child auto-layout (ED-063): ←/↑ satu indeks sebelumnya, →/↓ sesudahnya.
export function reorderDirection(arrow: Arrow): "up" | "down" {
  return arrow === "ArrowLeft" || arrow === "ArrowUp" ? "up" : "down";
}
