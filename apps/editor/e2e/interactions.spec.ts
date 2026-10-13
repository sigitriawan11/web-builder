import { expect, type Page, test } from "@playwright/test";

// T0.5.3 / ED-023, ED-025: adapter DOM state machine interaksi tersambung di browser.

type Effect = { type: string; target?: { kind: string; nodeId?: string }; drag?: { type: string } };
type Spike = {
  interaction: {
    getState(): { state: { type: string }; onEffect(listener: (effect: Effect) => void): () => void };
  };
};

// Rekam efek ke window agar bisa dibaca test.
async function recordEffects(page: Page) {
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __effects: string[] }).__effects = log;
    (window as unknown as { __spike: Spike }).__spike.interaction.getState().onEffect((effect) => {
      const detail = effect.target ? `${effect.target.kind}:${effect.target.nodeId ?? ""}` : (effect.drag?.type ?? "");
      log.push(`${effect.type}(${detail})`);
    });
  });
}

const effects = (page: Page) => page.evaluate(() => (window as unknown as { __effects: string[] }).__effects);
const stateType = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.interaction.getState().state.type);

async function center(page: Page, id: string) {
  const box = await page.locator(`[data-node-id="${id}"]`).boundingBox();
  if (!box) throw new Error(`${id} tidak terlihat`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=hero&zoom=0.5&x=20&y=20");
  await expect(page.locator('[data-node-id="n_heroimg001"]')).toBeVisible();
  await recordEffects(page);
});

test("klik tanpa bergeser = efek click pada node di bawah pointer", async ({ page }) => {
  const image = await center(page, "n_heroimg001");
  await page.mouse.click(image.x, image.y);

  expect(await effects(page)).toEqual(["click(node:n_heroimg001)"]);
  expect(await stateType(page)).toBe("idle");
});

test("drag node melewati threshold = dragMove lalu commit saat dilepas", async ({ page }) => {
  const image = await center(page, "n_heroimg001");
  await page.mouse.move(image.x, image.y);
  await page.mouse.down();
  await page.mouse.move(image.x + 40, image.y + 10, { steps: 4 });
  expect(await stateType(page)).toBe("dragMove");
  await page.mouse.up();

  expect(await effects(page)).toEqual(["commit(dragMove)"]);
  expect(await stateType(page)).toBe("idle");
});

test("Esc saat drag membatalkan tanpa commit", async ({ page }) => {
  const image = await center(page, "n_heroimg001");
  await page.mouse.move(image.x, image.y);
  await page.mouse.down();
  await page.mouse.move(image.x + 40, image.y, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();

  expect(await effects(page)).toEqual(["cancel(dragMove)"]);
});

test("drag dari area kosong = marquee", async ({ page }) => {
  // Tetap di dalam viewport 1280×720: Firefox (Playwright) tidak bisa mengirim event pointer di luar viewport.
  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(1000, 560, { steps: 4 });
  expect(await stateType(page)).toBe("marquee");
  await page.mouse.up();

  expect(await effects(page)).toEqual(["commit(marquee)"]);
});

test("pan (tombol tengah) tidak memulai drag maupun klik", async ({ page }) => {
  const image = await center(page, "n_heroimg001");
  await page.mouse.move(image.x, image.y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(image.x + 60, image.y, { steps: 4 });
  expect(await stateType(page)).toBe("panning");
  await page.mouse.up({ button: "middle" });

  expect(await effects(page)).toEqual([]);
});

test("drag di dalam teks yang sedang diedit = seleksi teks, bukan drag node", async ({ page }) => {
  await page.locator('[data-node-id="n_herottl001"]').dblclick();
  await expect(page.locator('[data-node-id="n_herottl001"] .ProseMirror')).toBeFocused();
  await page.evaluate(() => (window as unknown as { __effects: string[] }).__effects.splice(0));

  const title = await page.locator('[data-node-id="n_herottl001"]').boundingBox();
  if (!title) throw new Error("judul tidak terlihat");
  // Drag melintasi seluruh lebar judul (teks rata tengah) agar seluruh teks terseleksi.
  await page.mouse.move(title.x + 2, title.y + title.height / 2);
  await page.mouse.down();
  await page.mouse.move(title.x + title.width - 2, title.y + title.height / 2, { steps: 6 });
  expect(await stateType(page)).toBe("idle");
  await page.mouse.up();

  expect(await effects(page)).toEqual([]);
  // Bukti teks terseleksi tanpa getSelection() (tidak menembus shadow root): tebalkan seleksi.
  await page.keyboard.press("Control+B");
  await expect(page.locator('[data-node-id="n_herottl001"] .ProseMirror strong')).toHaveText(
    "Kue rumahan, fresh setiap hari",
  );
});

test("ED-025: context menu, drag native gambar, dan Ctrl+S browser dicegah di canvas", async ({ page }) => {
  const prevented = await page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="editor-viewport"]') as HTMLElement;
    const fire = (event: Event) => {
      viewport.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const ctrlS = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ctrlS);
    return {
      contextMenu: fire(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
      dragStart: fire(new DragEvent("dragstart", { bubbles: true, cancelable: true })),
      ctrlS: ctrlS.defaultPrevented,
    };
  });

  expect(prevented).toEqual({ contextMenu: true, dragStart: true, ctrlS: true });
});
