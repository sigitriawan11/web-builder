import { expect, test } from "@playwright/test";

test("canvas merender dokumen dari Y.Doc dan mengikuti perubahan lewat op", async ({ page }) => {
  await page.goto("?fixture=hero");
  const hero = page.locator('[data-node-id="n_hero000001"]');
  await expect(hero).toHaveCSS("background-color", "rgb(255, 248, 240)");

  const result = await page.evaluate(() => {
    const spike = (window as unknown as { __spike: { run: (op: unknown, input: unknown) => { ok: boolean }; ops: Record<string, unknown> } }).__spike;
    return spike.run(spike.ops.updateStyle, {
      ids: ["n_hero000001"],
      patch: { fills: [{ type: "solid", color: "#FF0000" }] },
    });
  });

  expect(result.ok).toBe(true);
  await expect(hero).toHaveCSS("background-color", "rgb(255, 0, 0)");
});

test("fixture landing2000 dirender lengkap", async ({ page }) => {
  await page.goto("?fixture=landing2000");
  await expect(page.locator("[data-node-id]")).toHaveCount(2000);
});
