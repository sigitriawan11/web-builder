import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE, ownerAccount } from "./support/auth";
import { localhostRequest } from "./support/localhost";

// T1.16.4: smoke — stack hidup (api lewat proxy Next di `app.localhost`) & sesi owner dari global setup langsung masuk.
test.use({ locale: "en-US", storageState: OWNER_STATE });

test("smoke: api siap lewat app.localhost & owner dari global setup langsung di dashboard", async ({ page }) => {
  const ready = await localhostRequest(`${APP_URL}/api/health/ready`);
  expect(ready.status).toBe(200);

  await page.goto(`${APP_URL}/sites`);
  await expect(page).toHaveURL(`${APP_URL}/sites`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const profile = await page.evaluate(
    async () =>
      (await (await fetch("/api/v1/account/profile")).json()) as { data: { email: string; emailVerified: boolean } },
  );
  expect(profile.data).toMatchObject({ email: ownerAccount().email, emailVerified: true });
});
