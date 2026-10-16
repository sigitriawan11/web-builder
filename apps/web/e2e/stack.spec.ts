import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";

// Stack e2e: browser → Next (/api) → api sungguhan di atas DB & Redis e2e.
test("api e2e terhubung lewat /api dan siap (DB + Redis)", async ({ page }) => {
  const response = await page.goto(`${APP_URL}/api/health/ready`);
  expect(response?.status()).toBe(200);
  expect(await response?.json()).toMatchObject({ status: "ready" });
});
