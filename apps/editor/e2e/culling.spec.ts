import { expect, test } from "@playwright/test";

// T2.2.4 / ED-021 Level 1: breakpoint frame non-aktif yang sepenuhnya di luar viewport (+1 layar) mendapat
// content-visibility:hidden lewat IntersectionObserver → browser melewati render/layout-nya (hemat saat beberapa
// breakpoint frame berdampingan). Level 2 (content-visibility:auto per section) ditunda: containment paint-nya
// mengklip anak yang meluber (regresi hit-test ED-020) → butuh culling IO per-section yang sadar geometri.
test("ED-021: frame breakpoint non-aktif di luar viewport ter-cull (content-visibility:hidden)", async ({ page }) => {
  // Semua breakpoint frame berdampingan, zoom 2 → frame kanan jauh di luar viewport (> 1 layar margin).
  await page.goto("?fixture=landing200&frames=all&zoom=2&x=0&y=0");
  await expect(page.locator(".bp-frame").first()).toBeVisible();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const root = document.getElementById("world")?.shadowRoot ?? document;
          let hidden = 0;
          for (const el of root.querySelectorAll(".bp-frame")) {
            if ((el as HTMLElement).style.contentVisibility === "hidden") hidden++;
          }
          return hidden;
        }),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);
});
