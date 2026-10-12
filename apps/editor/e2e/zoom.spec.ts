import { expect, test } from "@playwright/test";
import { readCamera } from "./camera";

test.beforeEach(async ({ page }) => {
  await page.goto("");
  await expect.poll(() => readCamera(page)).toEqual({ x: 0, y: 0, zoom: 1 });
});

test("Ctrl + wheel zoom dengan titik di bawah kursor tetap di tempat", async ({ page }) => {
  const pointer = { x: 400, y: 300 };
  await page.mouse.move(pointer.x, pointer.y);

  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");

  await expect.poll(async () => (await readCamera(page)).zoom).toBeCloseTo(Math.E, 3);
  const camera = await readCamera(page);
  // Titik world di bawah kursor sebelum zoom = (400, 300) karena kamera awal di origin & zoom 1.
  expect((pointer.x - camera.x) / camera.zoom).toBeCloseTo(400, 1);
  expect((pointer.y - camera.y) / camera.zoom).toBeCloseTo(300, 1);
});

test("Ctrl + wheel tidak pernah keluar dari batas 5%–1600%", async ({ page }) => {
  await page.mouse.move(400, 300);
  await page.keyboard.down("Control");
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 500);
  await expect.poll(async () => (await readCamera(page)).zoom).toBe(0.05);
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -500);
  await page.keyboard.up("Control");

  await expect.poll(async () => (await readCamera(page)).zoom).toBe(16);
});

test("Ctrl + = dan Ctrl + - melompat ke preset berikutnya di tengah viewport", async ({ page }) => {
  const size = page.viewportSize();
  if (!size) throw new Error("viewport tidak diketahui");
  const center = { x: size.width / 2, y: size.height / 2 };

  await page.keyboard.press("Control+Equal");
  await expect.poll(() => readCamera(page)).toEqual({ x: center.x - center.x * 1.5, y: center.y - center.y * 1.5, zoom: 1.5 });

  await page.keyboard.press("Control+Minus");
  await page.keyboard.press("Minus");
  await expect.poll(async () => (await readCamera(page)).zoom).toBe(0.75);
});
