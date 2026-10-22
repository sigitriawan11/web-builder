import { type Browser, type BrowserContext, chromium, type LaunchOptions } from "playwright";
import { z } from "zod";

// CMP-014 / ARCHITECTURE §5.4: layanan render internal worker. Satu browser Chromium, pool N context (default 2)
// untuk membatasi konkurensi. Dipakai processor `thumbnails`, AI (render_preview), dan visual check publish (P1).
// API: `screenshot({ html | url, viewport, fullPage })` → PNG Buffer. `url` HARUS tepercaya/internal (SSRF guard di
// pemanggil) — thumbnail me-render HTML milik kita sendiri.

export const ViewportSchema = z.strictObject({
  width: z.number().int().positive().max(4000),
  height: z.number().int().positive().max(8000),
});
export type Viewport = z.infer<typeof ViewportSchema>;

export const ScreenshotRequestSchema = z
  .strictObject({
    html: z.string().max(5_000_000).optional(),
    url: z.string().url().optional(),
    viewport: ViewportSchema,
    fullPage: z.boolean().default(true),
    timeoutMs: z.number().int().positive().max(60_000).default(15_000),
  })
  .refine((request) => (request.html != null) !== (request.url != null), {
    message: "sediakan tepat satu dari `html` atau `url`",
  });
export type ScreenshotRequest = z.input<typeof ScreenshotRequestSchema>;

export interface RendererService {
  screenshot(request: ScreenshotRequest): Promise<Buffer>;
  close(): Promise<void>;
}

export interface RendererOptions {
  // Jumlah context dalam pool (batas konkurensi). Default 2 (ARCHITECTURE §5.4).
  contexts?: number;
  // DSF sama untuk semua context (DSF per-request butuh context baru → tak di-pool). Default 1; thumbnail retina = 2.
  deviceScaleFactor?: number;
  launchOptions?: LaunchOptions;
}

/**
 * Pool sederhana: lazy-launch 1 browser; buat sampai N context sesuai permintaan; `acquire` memakai context idle
 * atau menunggu antrian. Satu `page` per screenshot (ditutup setelahnya) agar state tak bocor antar render.
 */
export function createRendererService(options?: RendererOptions): RendererService {
  const size = Math.max(1, options?.contexts ?? 2);
  const deviceScaleFactor = options?.deviceScaleFactor ?? 1;
  let browser: Browser | null = null;
  let launching: Promise<Browser> | null = null;
  const idle: BrowserContext[] = [];
  const waiters: ((context: BrowserContext) => void)[] = [];
  let created = 0;
  let closed = false;

  const getBrowser = (): Promise<Browser> => {
    if (browser) return Promise.resolve(browser);
    if (!launching)
      launching = chromium.launch({ args: ["--no-sandbox"], ...options?.launchOptions }).then((launched) => {
        browser = launched;
        return launched;
      });
    return launching;
  };

  const acquire = async (): Promise<BrowserContext> => {
    const existing = idle.pop();
    if (existing) return existing;
    if (created < size) {
      created++;
      try {
        return await (await getBrowser()).newContext({ deviceScaleFactor });
      } catch (error) {
        created--;
        throw error;
      }
    }
    return new Promise<BrowserContext>((resolve) => waiters.push(resolve));
  };

  const release = (context: BrowserContext): void => {
    const waiter = waiters.shift();
    if (waiter) waiter(context);
    else idle.push(context);
  };

  return {
    async screenshot(request) {
      if (closed) throw new Error("renderer service sudah ditutup");
      const parsed = ScreenshotRequestSchema.parse(request);
      const context = await acquire();
      let page = null;
      try {
        page = await context.newPage();
        await page.setViewportSize({ width: parsed.viewport.width, height: parsed.viewport.height });
        if (parsed.html != null) await page.setContent(parsed.html, { waitUntil: "load", timeout: parsed.timeoutMs });
        else if (parsed.url != null) await page.goto(parsed.url, { waitUntil: "load", timeout: parsed.timeoutMs });
        return await page.screenshot({ fullPage: parsed.fullPage, type: "png" });
      } finally {
        if (page) await page.close().catch(() => {});
        release(context);
      }
    },
    async close() {
      closed = true;
      const contexts = [...idle];
      idle.length = 0;
      await Promise.all(contexts.map((context) => context.close().catch(() => {})));
      if (browser) await browser.close().catch(() => {});
      browser = null;
      launching = null;
    },
  };
}
