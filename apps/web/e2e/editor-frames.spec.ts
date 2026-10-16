import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.3.3 / ED-034: breakpoint frames di canvas.
test.use({ locale: "en-US", storageState: OWNER_STATE });

test("default satu frame; Tampilkan semua device → 3 frame berdampingan dengan label & lebar dokumen", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Frames Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  const canvas = page.getByTestId("editor-canvas");

  await expect(canvas.locator(".bp-frame")).toHaveCount(1);
  await expect(canvas.locator('.bp-frame[data-breakpoint="base"]')).toHaveCSS("width", "1440px");
  await expect(canvas.locator('.bp-frame[data-breakpoint="base"] [data-fold]')).toBeAttached();

  await page.getByTestId("toggle-all-devices").click();
  await expect(canvas.locator(".bp-frame")).toHaveCount(3);
  await expect(canvas.locator('.bp-frame[data-breakpoint="tablet"]')).toHaveCSS("width", "768px");
  await expect(canvas.locator('.bp-frame[data-breakpoint="mobile"]')).toHaveCSS("width", "390px");
  await expect(page.getByTestId("frame-label-base")).toContainText("Desktop · 1440");
  await expect(page.getByTestId("frame-label-mobile")).toContainText("Mobile · 390");

  // Klik label (menempel di tepi atas canvas) → breakpoint aktif berganti.
  await page.getByTestId("frame-label-mobile").click();
  await expect(page.getByTestId("breakpoint-mobile")).toHaveAttribute("aria-pressed", "true");

  // Preferensi tersimpan setelah reload.
  await page.reload();
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await expect(page.getByTestId("editor-canvas").locator(".bp-frame")).toHaveCount(3);
});

test("AC ED-034: edit konten di Desktop tampil di semua frame; override mobile tidak mengubah Desktop", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Frames AC")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.getByTestId("toggle-all-devices").click();

  const pageId = await firstPageId(page);
  const text = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "text",
        props: {
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Halo dunia" }] }] },
        },
      })
    ).value,
  );
  const canvas = page.getByTestId("editor-canvas");
  // Konten (bukan per breakpoint) muncul di ketiga frame.
  for (const bp of ["base", "tablet", "mobile"]) {
    await expect(canvas.locator(`.bp-frame[data-breakpoint="${bp}"] [data-node-id="${text}"]`)).toHaveText(
      "Halo dunia",
    );
  }

  // Override warna hanya di mobile → frame mobile berubah, desktop tetap.
  const mobileNode = canvas.locator(`.bp-frame[data-breakpoint="mobile"] [data-node-id="${text}"]`);
  const desktopNode = canvas.locator(`.bp-frame[data-breakpoint="base"] [data-node-id="${text}"]`);
  const result = await editorCommand(page, "setBreakpointOverride", {
    id: text,
    breakpoint: "mobile",
    patch: { color: "#ff0000" },
  });
  expect(result.ok).toBe(true);
  await expect(mobileNode).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(desktopNode).not.toHaveCSS("color", "rgb(255, 0, 0)");
});
