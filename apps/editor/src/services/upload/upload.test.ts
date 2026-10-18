import type { PlatformApi } from "@platform/sdk";
import { describe, expect, it, vi } from "vitest";
import { UploadError, uploadImage, validateImageUpload } from "./upload";

const pngFile = (size = 1000) => new File([new Uint8Array(size)], "logo.png", { type: "image/png" });

type Assets = Pick<PlatformApi["assets"], "presign" | "complete">;

describe("validateImageUpload", () => {
  it("menolak mime tak didukung & ukuran berlebih", () => {
    expect(validateImageUpload({ type: "application/zip", size: 10 })).toBe("unsupported-type");
    expect(validateImageUpload({ type: "image/png", size: 0 })).toBe("too-large");
    expect(validateImageUpload({ type: "image/png", size: 11 * 1024 * 1024 })).toBe("too-large");
    expect(validateImageUpload({ type: "image/png", size: 1000 })).toBeNull();
  });
});

describe("uploadImage", () => {
  it("presign → PUT → complete, mengembalikan assetId/status/entry", async () => {
    const presign = vi.fn(async () => ({
      assetId: "ast_abc123",
      storageKey: "uploads/ws/ast_abc123",
      uploadUrl: "http://minio.test/uploads/ws/ast_abc123?sig=1",
      headers: { "Content-Type": "image/png" },
    }));
    const complete = vi.fn(
      async () => ({ id: "ast_abc123", status: "pending" }) as Awaited<ReturnType<Assets["complete"]>>,
    );
    const httpPut = vi.fn(async () => ({ ok: true, status: 200 }));

    const result = await uploadImage(pngFile(), { siteId: "site-1", assets: { presign, complete }, httpPut });

    expect(result).toEqual({ assetId: "ast_abc123", status: "pending", entry: { kind: "image", mime: "image/png" } });
    expect(presign).toHaveBeenCalledWith("site-1", { mime: "image/png", sizeBytes: 1000, fileName: "logo.png" });
    expect(httpPut).toHaveBeenCalledWith("http://minio.test/uploads/ws/ast_abc123?sig=1", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: expect.any(File),
    });
    expect(complete).toHaveBeenCalledWith("site-1", "ast_abc123");
  });

  it("PUT gagal → UploadError", async () => {
    const presign = vi.fn(async () => ({
      assetId: "ast_x",
      storageKey: "k",
      uploadUrl: "http://x",
      headers: { "Content-Type": "image/png" },
    }));
    const complete = vi.fn();
    const httpPut = vi.fn(async () => ({ ok: false, status: 403 }));
    await expect(uploadImage(pngFile(), { siteId: "s", assets: { presign, complete }, httpPut })).rejects.toThrow(
      UploadError,
    );
    expect(complete).not.toHaveBeenCalled();
  });

  it("mime tak didukung → UploadError tanpa memanggil API", async () => {
    const presign = vi.fn();
    const complete = vi.fn();
    const zip = new File([new Uint8Array(10)], "x.zip", { type: "application/zip" });
    await expect(uploadImage(zip, { siteId: "s", assets: { presign, complete } })).rejects.toThrow(UploadError);
    expect(presign).not.toHaveBeenCalled();
  });
});
