import type { Page } from "@playwright/test";

// Kamera dibaca dari transform `#world` (diterapkan di requestAnimationFrame).
export async function readCamera(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  const transform = await page.locator("#world").evaluate((element) => (element as HTMLElement).style.transform);
  const match = /translate3d\((-?[\d.e-]+)px, (-?[\d.e-]+)px, 0px\) scale\(([\d.e-]+)\)/.exec(transform);
  if (!match) throw new Error(`transform tidak dikenali: "${transform}"`);
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
}
