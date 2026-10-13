import { expect, type Page, test } from "@playwright/test";

// T0.4.5 / ED-115: perilaku editor teks inline (Tiptap) di tiap mode isolasi canvas.
// Hasil per browser dicatat di ROADMAP; suite ini otomatis untuk Chromium.

const TITLE = '[data-node-id="n_herottl001"]';
const EDITOR = `${TITLE} .ProseMirror`;

// ED-038/ED-051: double-click pertama masuk dari section hero ke judul, double-click kedua mengedit teks.
async function startEditing(page: Page, isolation: string) {
  await page.goto(`?fixture=hero&isolation=${isolation}`);
  await page.locator(TITLE).dblclick();
  await page.locator(TITLE).dblclick();
  await expect(page.locator(EDITOR)).toBeFocused();
}

for (const isolation of ["shadow", "prefix"]) {
  test.describe(`isolation=${isolation}`, () => {
    test("double-click memulai edit; mengetik spasi & huruf shortcut (v, h, -) masuk ke teks", async ({ page }) => {
      await startEditing(page, isolation);

      await page.keyboard.press("End");
      await page.keyboard.type(" v h -");

      await expect(page.locator(EDITOR)).toHaveText("Kue rumahan, fresh setiap hari v h -");
      await expect(page.getByTestId("editor-viewport")).not.toHaveAttribute("data-pan");
    });

    test("seleksi + Ctrl+B menebalkan teks terpilih", async ({ page }) => {
      await startEditing(page, isolation);

      await page.keyboard.press("Control+A");
      await page.keyboard.press("Control+B");

      await expect(page.locator(`${EDITOR} strong`)).toHaveText("Kue rumahan, fresh setiap hari");
    });

    test("IME: komposisi lalu commit menghasilkan teks akhir tanpa sisa komposisi", async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "Simulasi IME lewat CDP hanya ada di Chromium; browser lain diuji manual.");
      await startEditing(page, isolation);
      const cdp = await page.context().newCDPSession(page);

      await page.keyboard.press("End");
      await cdp.send("Input.imeSetComposition", { text: "に", selectionStart: 1, selectionEnd: 1 });
      await cdp.send("Input.imeSetComposition", { text: "にほん", selectionStart: 3, selectionEnd: 3 });
      await cdp.send("Input.insertText", { text: "日本" });

      await expect(page.locator(EDITOR)).toHaveText("Kue rumahan, fresh setiap hari日本");
    });

    test("paste HTML: mark tebal dipertahankan, font asing dibuang", async ({ page, browserName }) => {
      test.skip(
        browserName !== "chromium",
        "Firefox/WebKit mengabaikan clipboardData pada ClipboardEvent sintetis; paste diuji manual.",
      );
      await startEditing(page, isolation);
      // Ctrl+A ditangani keymap ProseMirror (sinkron); paste mengganti seluruh isi.
      await page.keyboard.press("Control+A");

      await page.locator(EDITOR).evaluate((editor) => {
        const data = new DataTransfer();
        data.setData("text/html", '<b>Tebal</b> <span style="font-family: Comic Sans MS">biasa</span>');
        data.setData("text/plain", "Tebal biasa");
        editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
      });

      await expect(page.locator(EDITOR)).toHaveText("Tebal biasa");
      await expect(page.locator(`${EDITOR} strong`)).toHaveText("Tebal");
      expect(await page.locator(EDITOR).innerHTML()).not.toContain("Comic Sans");
    });

    test("copy: teks terpilih masuk ke clipboard", async ({ page }) => {
      await startEditing(page, isolation);
      await page.evaluate(() => {
        window.addEventListener("copy", (event) => {
          (window as unknown as { __copied: string }).__copied = event.clipboardData?.getData("text/plain") ?? "";
        });
      });

      await page.keyboard.press("Control+A");
      await page.keyboard.press("Control+C");

      expect(await page.evaluate(() => (window as unknown as { __copied?: string }).__copied)).toBe(
        "Kue rumahan, fresh setiap hari",
      );
    });

    test("Esc & klik di luar mengakhiri edit; ketikan tersimpan ke dokumen (T0.8.5)", async ({ page }) => {
      await startEditing(page, isolation);
      await page.keyboard.type("xyz");
      await page.keyboard.press("Escape");
      await expect(page.locator(EDITOR)).toHaveCount(0);
      // Teks dirender ulang dari Y.XmlFragment (bukan dari editor yang sudah ditutup).
      await expect(page.locator(TITLE)).toHaveText("Kue rumahan, fresh setiap harixyz");

      await page.locator(TITLE).dblclick();
      await expect(page.locator(EDITOR)).toBeFocused();
      await expect(page.locator(EDITOR)).toHaveText("Kue rumahan, fresh setiap harixyz");
      await page.mouse.click(5, 5);
      await expect(page.locator(EDITOR)).toHaveCount(0);
    });
  });
}
