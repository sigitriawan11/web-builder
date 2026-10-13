import { expect, type Locator, type Page, test } from "@playwright/test";

// T0.4.7 / ED-016: font situs dimuat via FontFace tanpa mengubah font UI editor.
// Request ke CDN Fontsource dilayani file font lokal (monospace, lebarnya jelas berbeda) agar test tidak butuh internet.

const LOCAL_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
const TITLE_ID = "n_herottl001";

test.beforeEach(async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/fontsource/**", (route) =>
    route.fulfill({ path: LOCAL_FONT, contentType: "font/ttf" }),
  );
});

// Lebar teks hasil render: berubah hanya jika font yang benar-benar dipakai berubah.
const textWidth = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().width;
  });

const fontReady = (page: Page) =>
  page.waitForFunction(() => document.fonts.check('16px "pf-site Poppins"'), undefined, { timeout: 10_000 });

// Elemen chrome yang kebetulan meminta family "Poppins" (mis. UI editor memakai font bernama sama).
async function addChromeProbe(page: Page): Promise<Locator> {
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.id = "chrome-probe";
    probe.textContent = "Kue rumahan, fresh setiap hari";
    probe.style.cssText = 'position:fixed;left:0;top:0;font:16px "Poppins", serif;white-space:nowrap';
    document.body.append(probe);
  });
  return page.locator("#chrome-probe");
}

for (const isolation of ["shadow", "prefix"]) {
  test(`isolation=${isolation}: teks canvas memakai font situs, UI editor bernama font sama tidak berubah`, async ({ page }) => {
    // Baseline diukur di halaman tanpa font situs (font termuat sangat cepat, jadi "sebelum load" tidak bisa diandalkan).
    await page.goto(`?fixture=hero&isolation=${isolation}`);
    const title = page.locator(`[data-node-id="${TITLE_ID}"]`);
    const titleWidthBaseline = await textWidth(title);
    const probeWidthBaseline = await textWidth(await addChromeProbe(page));

    await page.goto(`?fixture=hero&isolation=${isolation}&siteFont=Poppins`);
    await fontReady(page);
    const probe = await addChromeProbe(page);

    await expect.poll(() => textWidth(title)).not.toBeCloseTo(titleWidthBaseline, 0);
    expect(await textWidth(probe)).toBeCloseTo(probeWidthBaseline, 1);
  });
}

test("bpMode=iframe: font situs dimuat di dokumen tiap iframe", async ({ page }) => {
  await page.goto("?fixture=hero&frames=all&bpMode=iframe");
  const title = page.frameLocator("iframe.bp-tablet").locator(`[data-node-id="${TITLE_ID}"]`);
  const widthWithoutFont = await textWidth(title);

  await page.goto("?fixture=hero&frames=all&bpMode=iframe&siteFont=Poppins");

  await expect.poll(() => textWidth(title)).not.toBeCloseTo(widthWithoutFont, 0);
});

test("font gagal dimuat: teks tetap tampil dengan fallback dan ada peringatan", async ({ page }) => {
  await page.unroute("https://cdn.jsdelivr.net/fontsource/**");
  await page.route("https://cdn.jsdelivr.net/fontsource/**", (route) => route.abort());
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });

  await page.goto("?fixture=hero&siteFont=Poppins");

  await expect(page.locator(`[data-node-id="${TITLE_ID}"]`)).toHaveText("Kue rumahan, fresh setiap hari");
  await expect.poll(() => warnings.join("\n")).toContain('Font situs "Poppins" gagal dimuat');
  // Bukan document.fonts.check(): nilainya true bila tidak ada face yang cocok sama sekali.
  const loadedFaces = await page.evaluate(
    () => [...document.fonts].filter((face) => face.family.includes("pf-site Poppins") && face.status === "loaded").length,
  );
  expect(loadedFaces).toBe(0);
});
