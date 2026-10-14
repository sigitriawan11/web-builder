import { type Node, resolveStyle } from "@platform/document-model";
import { responsiveSectionsDocument } from "@platform/document-model/fixtures";
import {
  estimateAvailableWidth,
  estimateMaxContentWidth,
  isStackRowsCandidate,
  rowOverflowsStatic,
  type WidthEstimateContext,
} from "@platform/renderer";
import { expect, type Page, test } from "@playwright/test";

// T0.8.4 / OPEN-DM-5 (DM-038): akurasi deteksi overflow `stackRows` statis vs DOM pada 10 section.
// DOM: lebar max-content tiap row diukur di frame Mobile (390 px) dengan `width: max-content`.
// Statis: `estimateMaxContentWidth` dengan metrik font yang dikalibrasi SEKALI per font dari kalimat
// terpisah (meniru katalog font), bukan dari isi fixture — agar tidak overfit.

const MOBILE_WIDTH = 390;
// Margin keamanan yang diusulkan (≈ galat estimasi maksimum yang teramati): row ditumpuk bila ≥ 90% penuh.
const SAFETY = 0.9;
const FONTS = [null, "Inter", "Poppins"] as const;
const CALIBRATION = "Selamat datang di toko kami, pesan sekarang dan nikmati Penawaran Terbaik Minggu Ini";

const { document: fixture, sections } = responsiveSectionsDocument();

type Metrics = { regular: number; bold: number };

async function calibrate(page: Page): Promise<Metrics> {
  return page.evaluate(
    ({ sample, pageId }) => {
      // Di dalam elemen page agar mewarisi font situs yang sama dengan teks yang diukur.
      const frame = document
        .getElementById("world")
        ?.shadowRoot?.querySelector(`.bp-mobile [data-node-id="${pageId}"]`);
      if (!frame) throw new Error("page di frame mobile tidak ada");
      const measure = (weight: number) => {
        const span = document.createElement("span");
        span.textContent = sample;
        span.style.cssText = `position:absolute;white-space:nowrap;font-size:100px;font-weight:${weight}`;
        frame.appendChild(span);
        const width = span.getBoundingClientRect().width;
        span.remove();
        return width;
      };
      // Zoom kamera 1 → px layar = px CSS.
      return { regular: measure(400) / (sample.length * 100), bold: measure(700) / (sample.length * 100) };
    },
    { sample: CALIBRATION, pageId: fixture.pageOrder[0] },
  );
}

async function measureMaxContent(page: Page, ids: string[]): Promise<Record<string, number>> {
  return page.evaluate((rowIds) => {
    const frame = document.getElementById("world")?.shadowRoot?.querySelector(".bp-mobile");
    const widths: Record<string, number> = {};
    for (const id of rowIds) {
      const element = frame?.querySelector(`[data-node-id="${id}"]`);
      if (!(element instanceof HTMLElement)) continue;
      const original = element.style.cssText;
      element.style.width = "max-content";
      element.style.flex = "none";
      element.style.alignSelf = "flex-start";
      widths[id] = element.getBoundingClientRect().width;
      element.style.cssText = original;
    }
    return widths;
  }, ids);
}

// Estimator renderer (DM-038, dipindah dari document-model di T1.10.4); ukuran font dari tag (UA default) karena
// fixture tidak memakai typography eksplisit.
function context(metrics: Metrics): WidthEstimateContext {
  return {
    doc: fixture,
    breakpoint: "mobile",
    styleOf: (node) => resolveStyle(node.style, "mobile"),
    fonts: { charWidthEm: (_family, bold) => (bold ? metrics.bold : metrics.regular) },
  };
}

// Section pemilik node (ancestor langsung di bawah page).
function sectionOf(node: Node): string {
  let current: Node | undefined = node;
  while (current?.parentId && fixture.nodes[current.parentId]?.type !== "page")
    current = fixture.nodes[current.parentId];
  return sections.find((section) => section.id === current?.id)?.name ?? "?";
}

test("akurasi deteksi overflow stackRows: statis vs DOM (10 section × 3 font)", async ({ page }) => {
  test.setTimeout(120_000);
  const summary: string[] = [];
  const detail: string[] = [];
  for (const font of FONTS) {
    await page.goto(`?fixture=responsive10&frames=all&bpMode=class&zoom=1&x=0&y=0${font ? `&siteFont=${font}` : ""}`);
    await expect(page.locator(".bp-frame").first()).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const metrics = await calibrate(page);
    const ctx = context(metrics);
    const rows = Object.values(fixture.nodes).filter((node) => isStackRowsCandidate(node, ctx));
    const dom = await measureMaxContent(
      page,
      rows.map((row) => row.id),
    );

    const perSection = new Map<string, boolean>(sections.map((section) => [section.name, true]));
    let correct = 0;
    // Dengan margin: "benar" = tidak ada row meluber yang lolos; row muat yang ikut ditumpuk dihitung terpisah.
    let missedWithSafety = 0;
    let extraStacksWithSafety = 0;
    let absErrorSum = 0;
    for (const row of rows) {
      const domWidth = dom[row.id];
      if (domWidth === undefined) throw new Error(`row ${row.name} tidak terukur`);
      const available = estimateAvailableWidth(row, MOBILE_WIDTH, ctx);
      const staticWidth = estimateMaxContentWidth(row, ctx);
      const staticOverflow = rowOverflowsStatic(row, MOBILE_WIDTH, ctx);
      const domOverflow = domWidth > available;
      const ok = staticOverflow === domOverflow;
      const safeOverflow = rowOverflowsStatic(row, MOBILE_WIDTH, ctx, SAFETY);
      if (domOverflow && !safeOverflow) missedWithSafety++;
      if (!domOverflow && safeOverflow) extraStacksWithSafety++;
      if (ok) correct++;
      else perSection.set(sectionOf(row), false);
      absErrorSum += Math.abs(staticWidth - domWidth) / domWidth;
      detail.push(
        `| ${font ?? "system-ui"} | ${sectionOf(row)} | ${row.name} | ${available} | ${domWidth.toFixed(0)} | ${staticWidth.toFixed(0)} | ${(((staticWidth - domWidth) / domWidth) * 100).toFixed(1)}% | ${domOverflow ? "stack" : "row"} | ${staticOverflow ? "stack" : "row"} | ${ok ? "✅" : "❌"} |`,
      );
    }
    const sectionsCorrect = [...perSection.values()].filter(Boolean).length;
    summary.push(
      `| ${font ?? "system-ui"} | ${metrics.regular.toFixed(3)} / ${metrics.bold.toFixed(3)} | ${correct}/${rows.length} | ${sectionsCorrect}/${sections.length} | ${((absErrorSum / rows.length) * 100).toFixed(1)}% | ${missedWithSafety} | ${extraStacksWithSafety} |`,
    );
  }
  console.log(
    [
      "",
      `| Font | em/karakter (400 / 700) | Row benar | Section benar | Rata-rata galat lebar | Margin ${SAFETY}: row meluber lolos | Margin ${SAFETY}: tumpuk tak perlu |`,
      "|---|---|---|---|---|---|---|",
      ...summary,
      "",
      "| Font | Section | Row | Tersedia | DOM px | Statis px | Galat | DOM | Statis | |",
      "|---|---|---|---|---|---|---|---|---|---|",
      ...detail,
    ].join("\n"),
  );
});
