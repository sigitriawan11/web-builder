import { expect, type Page, test } from "@playwright/test";
import { idByName } from "./doc-helpers";

// T2.15.4 / ED-181, DM-055: tautan navigasi pada node. Node berlink dirender `<a>` (DM-011); klik di preview
// berpindah page (navigate). Link dipasang via command setLink (dev API) — UI LinkSection diuji unit terpisah.

type Spike = {
  pages(): string[];
  ops: { setLink: unknown };
  run(op: unknown, input: unknown): { ok: boolean };
};
const spike = (page: Page) => page.evaluate(() => (window as unknown as { __spike: Spike }).__spike && true);

test("AC ED-181: node berlink page → klik di preview pindah page", async ({ page }) => {
  await page.goto("?fixture=pages2");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
  expect(await spike(page)).toBe(true);

  const heroId = await idByName(page, "Hero");
  // Page kedua (benchPagesDocument: path "/bench-b").
  const pageB = await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.pages()[1]);
  expect(pageB).toBeTruthy();

  const result = await page.evaluate(
    ([id, target]) => {
      const spike = (window as unknown as { __spike: Spike }).__spike;
      return spike.run(spike.ops.setLink, { id, link: { type: "page", pageId: target } });
    },
    [heroId, pageB],
  );
  expect(result.ok).toBe(true);

  // Masuk preview (merender page pertama), lalu klik node Hero yang berlink → pindah ke page B.
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("preview-iframe")).toBeVisible();
  await expect(page.getByTestId("preview-page")).toHaveValue(
    await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.pages()[0] ?? ""),
  );

  const frame = page.frameLocator("[data-testid=preview-iframe]");
  await frame.locator('a[href="/bench-b"]').first().click();

  await expect(page.getByTestId("preview-page")).toHaveValue(pageB ?? "");
});
