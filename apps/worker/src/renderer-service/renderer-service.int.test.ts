import { describe, expect, it } from "vitest";
import { createRendererService } from "./renderer-service";

// T3.7.1 / CMP-014: renderer-service me-render HTML → PNG lewat Chromium Playwright. Integration (butuh browser).
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const HTML = "<body style='margin:0'><div style='width:120px;height:80px;background:#f00'></div></body>";

describe("renderer-service", () => {
  it("screenshot HTML sederhana → PNG non-kosong", async () => {
    const service = createRendererService({ contexts: 2 });
    try {
      const buffer = await service.screenshot({ html: HTML, viewport: { width: 200, height: 120 }, fullPage: false });
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);
    } finally {
      await service.close();
    }
  });

  it("pool N=2 menangani 3 permintaan paralel (antrian context)", async () => {
    const service = createRendererService({ contexts: 2 });
    try {
      const results = await Promise.all(
        [0, 1, 2].map(() => service.screenshot({ html: HTML, viewport: { width: 100, height: 60 }, fullPage: false })),
      );
      for (const buffer of results) expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true);
    } finally {
      await service.close();
    }
  });

  it("menolak html+url bersamaan (validasi Zod)", async () => {
    const service = createRendererService({ contexts: 1 });
    try {
      await expect(
        service.screenshot({ html: "<p>x</p>", url: "http://example.test", viewport: { width: 10, height: 10 } }),
      ).rejects.toThrow();
    } finally {
      await service.close();
    }
  });

  it("menolak screenshot setelah close", async () => {
    const service = createRendererService({ contexts: 1 });
    await service.close();
    await expect(service.screenshot({ html: HTML, viewport: { width: 10, height: 10 } })).rejects.toThrow();
  });
});
