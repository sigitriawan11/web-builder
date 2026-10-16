import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { register } from "./support/auth";
import { unsaved } from "./support/editor";
import { resetRateLimits, uniqueEmail, waitForEmail } from "./support/stack";

// M1.d exit criteria — demo end-to-end sebagai satu e2e: daftar (verifikasi via Mailpit) → buat situs kosong →
// editor → tambah frame & teks (tombol dev) → resize & drag → undo/redo → tutup tab → buka lagi → perubahan ada.
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

interface DocJson {
  pageOrder: string[];
  nodes: Record<string, { children?: string[]; style: { base: { size?: { height?: { value?: number } } } } }>;
}
const docOf = async (page: Page) => (await page.evaluate(() => window.__editorTestApi?.getDoc())) as DocJson;
const selected = async (page: Page) =>
  (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] ?? "";
const heightOf = async (page: Page, id: string) => (await docOf(page)).nodes[id]?.style.base.size?.height?.value;

test("demo M1: daftar → situs → editor → tambah, resize, drag, undo → tutup & buka lagi → tetap ada", async ({
  context,
  page,
}) => {
  test.slow();
  // 1) Daftar + verifikasi email dari Mailpit.
  const email = uniqueEmail("demo");
  await register(page, email);
  await expect(page).toHaveURL(`${APP_URL}/verify-email?step=code`);
  const code = (await waitForEmail(email, /Verify your email/)).text.match(/\b\d{6}\b/)?.[0] ?? "";
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Your email is verified.")).toBeVisible();

  // 2) Buat situs kosong dari dashboard → editor terbuka.
  await page.goto(`${APP_URL}/sites`);
  await page.getByRole("button", { name: "Create website" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a new website" });
  await dialog.getByLabel("Website name").fill("Demo M1");
  await dialog.getByRole("button", { name: "Create and open editor" }).click();
  await expect(page).toHaveURL(/\/editor\//);
  const editorUrl = page.url();
  await expect(page.locator("[data-connection-status]")).toHaveAttribute("data-connection-status", "synced");
  const canvas = page.getByTestId("editor-canvas");

  // 3) Tambah frame A + teks di dalamnya (tombol dev).
  await page.getByTestId("dev-insert-frame").click();
  const frameA = await selected(page);
  await page.getByTestId("dev-insert-text").click();
  const text = await selected(page);
  await expect(canvas.locator(`[data-node-id="${frameA}"] [data-node-id="${text}"]`)).toHaveText("New text");

  // 4) Resize: pilih frame A, tarik handle bawah +60 px (zoom 100%) → tinggi 160 → 220.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frameA);
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 40, y: 40, zoom: 1 }));
  const handle = page.locator('.overlay-handle[data-handle="s"]');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error("handle tidak terlihat");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => heightOf(page, frameA)).toBe(220);

  // 5) Undo/redo resize.
  await page.keyboard.press("Control+z");
  await expect.poll(() => heightOf(page, frameA)).toBe(160);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => heightOf(page, frameA)).toBe(220);

  // 6) Drag (reorder, ED-063): teks kedua di frame A (auto-layout kolom); teks pertama diseret ke bawahnya.
  //    Page situs kosong ber-layout blok (bukan auto-layout) → reorder dilakukan di dalam frame.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frameA);
  await page.getByTestId("dev-insert-text").click();
  const text2 = await selected(page);
  expect((await docOf(page)).nodes[frameA]?.children).toEqual([text, text2]);
  await page.evaluate((id) => window.__editorTestApi?.select([id]), text);
  const first = await canvas.locator(`[data-node-id="${text}"]`).boundingBox();
  const second = await canvas.locator(`[data-node-id="${text2}"]`).boundingBox();
  if (!first || !second) throw new Error("teks tidak terlihat");
  await page.mouse.move(first.x + 8, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + 8, second.y + second.height - 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await docOf(page)).nodes[frameA]?.children).toEqual([text2, text]);
  // Undo drag → urutan semula; redo → urutan baru.
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await docOf(page)).nodes[frameA]?.children).toEqual([text, text2]);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(async () => (await docOf(page)).nodes[frameA]?.children).toEqual([text2, text]);

  // 7) Tunggu terkonfirmasi server, tutup tab, buka lagi → semua perubahan ada.
  await expect.poll(() => unsaved(page)).toBe(false);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(editorUrl);
  await expect(reopened.locator("[data-connection-status]")).toHaveAttribute("data-connection-status", "synced");
  const after = await docOf(reopened);
  expect(after.nodes[frameA]?.children).toEqual([text2, text]);
  expect(after.nodes[frameA]?.style.base.size?.height?.value).toBe(220);
  await expect(reopened.getByTestId("editor-canvas").locator(`[data-node-id="${text}"]`)).toHaveText("New text");
});
