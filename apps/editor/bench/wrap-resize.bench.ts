import { expect, test } from "@playwright/test";

// T0.6.6 / ED-022: fps saat resize frame auto-layout wrap berisi 100 anak (target M0 ≥ 45 fps).
// Handle kanan di-drag bolak-balik dengan mouse sungguhan; tiap gerakan = preview resize + reflow 100 kartu.
// Angka headless WSL2 tanpa GPU = indikatif; pengukuran resmi di laptop referensi (T0.7.4).

type Spike = { selection: { getState(): { select(ids: string[]): void } } };
const DURATION_MS = 3000;

for (const zoom of [0.5, 1]) {
  test(`resize grid wrap 100 anak · zoom ${zoom * 100}%`, async ({ page }) => {
    await page.goto(`?fixture=wrap100&zoom=${zoom}&x=0&y=0`);
    await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.selection.getState().select(["n_wggrid0001"]));
    const handle = page.locator('.overlay-handle[data-handle="e"]');
    await expect(handle).toBeVisible();
    await page.waitForTimeout(500);
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle tidak terlihat");
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    // Rekam jarak antar animation frame di halaman selama drag.
    await page.evaluate(() => {
      const deltas: number[] = [];
      const w = window as unknown as { __deltas: number[]; __recording: boolean; __minGridWidth: number };
      w.__deltas = deltas;
      w.__recording = true;
      w.__minGridWidth = Number.POSITIVE_INFINITY;
      // Elemen grid ada di shadow root `#world` (isolasi Opsi A).
      const grid = document.getElementById("world")?.shadowRoot?.querySelector('[data-node-id="n_wggrid0001"]');
      let last = performance.now();
      const tick = (now: number) => {
        deltas.push(now - last);
        last = now;
        // Bukti resize benar-benar terjadi: lebar render grid (px CSS, sebelum transform kamera).
        if (grid instanceof HTMLElement) w.__minGridWidth = Math.min(w.__minGridWidth, grid.offsetWidth);
        if (w.__recording) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const began = Date.now();
    let moves = 0;
    // Lebar berayun 1200 → 500 → 1200 px world.
    while (Date.now() - began < DURATION_MS) {
      const t = (Date.now() - began) / DURATION_MS;
      const offsetWorld = -700 * Math.abs(Math.sin(t * Math.PI * 2));
      await page.mouse.move(start.x + offsetWorld * zoom, start.y);
      moves++;
    }
    await page.mouse.up();

    const { deltas, minGridWidth } = await page.evaluate(() => {
      const w = window as unknown as { __deltas: number[]; __recording: boolean; __minGridWidth: number };
      w.__recording = false;
      return { deltas: w.__deltas.slice(1), minGridWidth: w.__minGridWidth };
    });
    const sorted = [...deltas].sort((a, b) => a - b);
    const total = deltas.reduce((sum, value) => sum + value, 0);
    const fps = (deltas.length / total) * 1000;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const longFrames = deltas.filter((value) => value > 50).length;

    console.log(
      `zoom ${zoom * 100}%: ${fps.toFixed(1)} fps, p95 ${p95.toFixed(1)} ms, ${longFrames} frame > 50 ms, ` +
        `${moves} gerakan mouse, lebar grid minimum ${minGridWidth}px`,
    );
    expect(moves).toBeGreaterThan(30);
    // Lebar berayun sampai ±500px: benchmark benar-benar mengukur resize + reflow, bukan halaman diam.
    expect(minGridWidth).toBeLessThan(600);
  });
}
