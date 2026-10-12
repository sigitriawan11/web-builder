import { expect, test } from "@playwright/test";
import { readCamera } from "./camera";

const cameraOffset = async (page: Parameters<typeof readCamera>[0]) => {
  const { x, y } = await readCamera(page);
  return { x, y };
};

test.beforeEach(async ({ page }) => {
  await page.goto("");
  await expect.poll(() => cameraOffset(page)).toEqual({ x: 0, y: 0 });
  await page.mouse.move(400, 300);
});

test("Space + drag menggeser world sejauh gerakan pointer", async ({ page }) => {
  const viewport = page.getByTestId("editor-viewport");

  await page.keyboard.down("Space");
  await expect(viewport).toHaveAttribute("data-pan", "ready");
  await page.mouse.down();
  await page.mouse.move(500, 350, { steps: 5 });
  await expect(viewport).toHaveAttribute("data-pan", "active");
  await page.mouse.up();
  await page.keyboard.up("Space");

  await expect.poll(() => cameraOffset(page)).toEqual({ x: 100, y: 50 });
  await expect(viewport).not.toHaveAttribute("data-pan");
});

test("drag kiri tanpa Space tidak menggeser world", async ({ page }) => {
  await page.mouse.down();
  await page.mouse.move(500, 350, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => cameraOffset(page)).toEqual({ x: 0, y: 0 });
});

test("drag tombol tengah menggeser world", async ({ page }) => {
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(340, 220, { steps: 5 });
  await page.mouse.up({ button: "middle" });

  await expect.poll(() => cameraOffset(page)).toEqual({ x: -60, y: -80 });
});

test("wheel menggeser vertikal, Shift + wheel menggeser horizontal", async ({ page }) => {
  await page.mouse.wheel(0, 120);
  await expect.poll(() => cameraOffset(page)).toEqual({ x: 0, y: -120 });

  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 100);
  await page.keyboard.up("Shift");
  await expect.poll(() => cameraOffset(page)).toEqual({ x: -100, y: -120 });
});
