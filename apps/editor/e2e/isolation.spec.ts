import { expect, type Page, test } from "@playwright/test";

// ED-016: CSS situs tidak boleh merusak UI editor, dan CSS editor tidak boleh merusak isi canvas.
// Mode `none` dipakai sebagai pembanding: kebocoran harus terlihat di sana, kalau tidak test ini tidak membuktikan apa-apa.

const CHROME_PREFLIGHT_CSS = `
  *, ::before, ::after { box-sizing: border-box; border: 0 solid; }
  h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
  img { display: block; max-width: 100%; height: auto; }
  body { font-family: monospace; color: rgb(1, 2, 3); line-height: 3; }
`;

const computed = (page: Page, selector: string, property: string) =>
  page.locator(selector).evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);

const HERO_TITLE = '[data-node-id="n_herottl001"]';
// Elemen chrome tanpa font eksplisit (mewarisi dari body), seperti kebanyakan UI berbasis Tailwind.
// Elemen dengan class ber-`font` sendiri tidak cocok: aturan `*` situs kalah spesifisitas di sana.
const CHROME_ELEMENT = "#editor-viewport";

test.describe("Opsi A: Shadow DOM", () => {
  test("CSS situs agresif berlaku di canvas tapi tidak menyentuh UI editor", async ({ page }) => {
    await page.goto("?fixture=hero");
    const chromeFontBefore = await computed(page, CHROME_ELEMENT, "font-family");
    await page.goto("?fixture=hero&siteCss=aggressive");

    expect(await computed(page, HERO_TITLE, "font-family")).toBe("serif");
    expect(await computed(page, HERO_TITLE, "letter-spacing")).toBe("7px");
    expect(await computed(page, CHROME_ELEMENT, "font-family")).toBe(chromeFontBefore);
    expect(await computed(page, CHROME_ELEMENT, "letter-spacing")).not.toBe("7px");
  });

  test("reset & pewarisan CSS editor tidak masuk ke canvas", async ({ page }) => {
    await page.goto("?fixture=hero");
    const before = {
      fontSize: await computed(page, HERO_TITLE, "font-size"),
      fontFamily: await computed(page, HERO_TITLE, "font-family"),
    };

    await page.addStyleTag({ content: CHROME_PREFLIGHT_CSS });

    expect(await computed(page, HERO_TITLE, "font-size")).toBe(before.fontSize);
    expect(await computed(page, HERO_TITLE, "font-family")).toBe(before.fontFamily);
    expect(await computed(page, HERO_TITLE, "color")).not.toBe("rgb(1, 2, 3)");
    expect(await computed(page, HERO_TITLE, "line-height")).not.toBe("48px");
  });
});

test.describe("Opsi B: prefix class", () => {
  test("CSS situs agresif (di-scope ke .pf-root) berlaku di canvas tapi tidak menyentuh UI editor", async ({ page }) => {
    await page.goto("?fixture=hero&isolation=prefix");
    const chromeFontBefore = await computed(page, CHROME_ELEMENT, "font-family");
    await page.goto("?fixture=hero&siteCss=aggressive&isolation=prefix");

    expect(await computed(page, HERO_TITLE, "font-family")).toBe("serif");
    expect(await computed(page, HERO_TITLE, "letter-spacing")).toBe("7px");
    expect(await computed(page, CHROME_ELEMENT, "font-family")).toBe(chromeFontBefore);
    expect(await computed(page, CHROME_ELEMENT, "letter-spacing")).not.toBe("7px");
  });

  test("pewarisan font & warna dari body editor terblokir oleh reset .pf-root", async ({ page }) => {
    await page.goto("?fixture=hero&isolation=prefix");
    const fontFamilyBefore = await computed(page, HERO_TITLE, "font-family");

    await page.addStyleTag({ content: "body { font-family: monospace; color: rgb(1, 2, 3); line-height: 3; }" });

    expect(await computed(page, HERO_TITLE, "font-family")).toBe(fontFamilyBefore);
    expect(await computed(page, HERO_TITLE, "color")).not.toBe("rgb(1, 2, 3)");
  });

  // Keterbatasan Opsi B yang terdokumentasi: setiap CSS editor wajib di-scope ke chrome
  // (mis. Tailwind preflight); aturan global seperti di bawah tetap mengenai isi canvas.
  test("KETERBATASAN: preflight editor yang tidak di-scope tetap menembus canvas", async ({ page }) => {
    await page.goto("?fixture=hero&isolation=prefix");
    const fontSizeBefore = await computed(page, HERO_TITLE, "font-size");

    await page.addStyleTag({ content: CHROME_PREFLIGHT_CSS });

    expect(await computed(page, HERO_TITLE, "font-size")).not.toBe(fontSizeBefore);
  });
});

test.describe("pembanding tanpa isolasi", () => {
  test("CSS situs agresif bocor ke UI editor", async ({ page }) => {
    await page.goto("?fixture=hero&siteCss=aggressive&isolation=none");

    expect(await computed(page, CHROME_ELEMENT, "font-family")).toBe("serif");
    expect(await computed(page, CHROME_ELEMENT, "letter-spacing")).toBe("7px");
  });

  test("reset & pewarisan CSS editor bocor ke canvas", async ({ page }) => {
    await page.goto("?fixture=hero&isolation=none");
    const fontSizeBefore = await computed(page, HERO_TITLE, "font-size");

    await page.addStyleTag({ content: CHROME_PREFLIGHT_CSS });

    expect(await computed(page, HERO_TITLE, "font-size")).not.toBe(fontSizeBefore);
    expect(await computed(page, HERO_TITLE, "color")).toBe("rgb(1, 2, 3)");
  });
});
