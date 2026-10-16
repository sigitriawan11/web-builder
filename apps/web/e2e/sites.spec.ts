import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { register } from "./support/auth";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T1.14.6 (ACC-050): halaman `/sites` di stack e2e — empty state, kartu situs, tautan editor, halaman berikutnya.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

/** Buat situs lewat api dari browser (sesi & Origin ikut), di workspace aktif (personal). */
async function createSites(page: Page, names: string[]): Promise<string[]> {
  return page.evaluate(async (siteNames) => {
    const workspaces = (await (await fetch("/api/v1/workspaces")).json()) as { data: { id: string }[] };
    const workspaceId = workspaces.data[0]?.id;
    const ids: string[] = [];
    for (const name of siteNames) {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/sites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(`buat situs gagal: ${response.status}`);
      ids.push(((await response.json()) as { data: { id: string } }).data.id);
    }
    return ids;
  }, names);
}

async function signUpAndOpenSites(page: Page) {
  await register(page, uniqueEmail("sites"));
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await page.goto(`${APP_URL}/sites`);
}

test("user baru → empty state; setelah membuat situs → kartu nama, status Draft, waktu edit, tautan editor (AC T1.14.6)", async ({
  page,
}) => {
  await signUpAndOpenSites(page);
  await expect(page.getByTestId("sites-empty")).toContainText("No websites yet");
  await expect(page.getByTestId("site-card")).toHaveCount(0);

  const [kopiId] = await createSites(page, ["Toko Kopi Sari", "Katering Bu Ani"]);
  await page.reload();
  await expect(page.getByTestId("sites-empty")).toHaveCount(0);
  const cards = page.getByTestId("site-card");
  await expect(cards).toHaveCount(2);
  // Urutan default: terakhir diedit dulu.
  await expect(cards.first()).toContainText("Katering Bu Ani");

  const kopi = page.getByRole("link", { name: "Open Toko Kopi Sari in the editor" });
  await expect(kopi).toHaveAttribute("href", `/editor/${kopiId}`);
  await expect(kopi).toContainText("Draft");
  await expect(kopi).toContainText(/Edited (now|\d+ seconds? ago)/);
});

test("lebih dari 24 situs → halaman berikutnya lewat cursor, lalu kembali ke halaman pertama", async ({ page }) => {
  await signUpAndOpenSites(page);
  await createSites(
    page,
    Array.from({ length: 25 }, (_, index) => `Situs ${String(index + 1).padStart(2, "0")}`),
  );
  await page.reload();
  await expect(page.getByTestId("site-card")).toHaveCount(24);
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/\/sites\?cursor=/);
  await expect(page.getByTestId("site-card")).toHaveCount(1);
  // Yang paling lama diedit ada di halaman terakhir.
  await expect(page.getByTestId("site-card")).toContainText("Situs 01");
  await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to first page" }).click();
  await expect(page.getByTestId("site-card")).toHaveCount(24);
});

test("situs user lain tidak tampil (isolasi tenant di UI)", async ({ page, context }) => {
  await signUpAndOpenSites(page);
  await createSites(page, ["Rahasia Milik A"]);
  await context.clearCookies();
  await signUpAndOpenSites(page);
  await expect(page.getByTestId("sites-empty")).toBeVisible();
  await expect(page.getByText("Rahasia Milik A")).toHaveCount(0);
});
