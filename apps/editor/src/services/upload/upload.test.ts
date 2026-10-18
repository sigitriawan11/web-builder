import type { ApiClient } from "@platform/sdk";
import { describe, expect, it, vi } from "vitest";
import { UploadError, uploadImage, validateImageUpload } from "./upload";

// File palsu (lingkungan jsdom punya File/Blob).
const pngFile = (size = 1000) => {
  const file = new File([new Uint8Array(size)], "logo.png", { type: "image/png" });
  return file;
};

function fakeClient(responses: Record<string, unknown>): ApiClient {
  return {
    request: vi.fn(async (_method, path) => {
      const key = Object.keys(responses).find((k) => path.includes(k));
      if (!key) throw new Error(`no stub for ${path}`);
      return responses[key];
    }) as ApiClient["request"],
  };
}

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
    const client = fakeClient({
      "/assets": { data: { status: "pending" }, meta: { requestId: "r" } }, // fallback for complete path
    });
    // Stub spesifik: presign dulu (POST /assets tanpa /complete), lalu complete.
    const calls: string[] = [];
    client.request = vi.fn(async (_method, path) => {
      calls.push(path);
      if (path.endsWith("/complete")) return { data: { status: "pending", id: "ast_x" }, meta: { requestId: "r" } };
      return {
        data: {
          assetId: "ast_abc123",
          storageKey: "uploads/ws/ast_abc123",
          uploadUrl: "http://minio.test/uploads/ws/ast_abc123?sig=1",
          headers: { "Content-Type": "image/png" },
        },
        meta: { requestId: "r" },
      };
    }) as ApiClient["request"];

    const httpPut = vi.fn(async () => ({ ok: true, status: 200 }));
    const result = await uploadImage(pngFile(), { siteId: "site-1", client, httpPut });

    expect(result).toEqual({ assetId: "ast_abc123", status: "pending", entry: { kind: "image", mime: "image/png" } });
    expect(httpPut).toHaveBeenCalledWith("http://minio.test/uploads/ws/ast_abc123?sig=1", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: expect.any(File),
    });
    expect(calls).toEqual(["/v1/sites/site-1/assets", "/v1/sites/site-1/assets/ast_abc123/complete"]);
  });

  it("PUT gagal → UploadError", async () => {
    const client = fakeClient({});
    client.request = vi.fn(async () => ({
      data: { assetId: "ast_x", storageKey: "k", uploadUrl: "http://x", headers: { "Content-Type": "image/png" } },
      meta: { requestId: "r" },
    })) as ApiClient["request"];
    const httpPut = vi.fn(async () => ({ ok: false, status: 403 }));
    await expect(uploadImage(pngFile(), { siteId: "s", client, httpPut })).rejects.toThrow(UploadError);
  });

  it("mime tak didukung → UploadError tanpa memanggil API", async () => {
    const client = fakeClient({});
    const spy = vi.fn();
    client.request = spy as ApiClient["request"];
    const svgAsZip = new File([new Uint8Array(10)], "x.zip", { type: "application/zip" });
    await expect(uploadImage(svgAsZip, { siteId: "s", client })).rejects.toThrow(UploadError);
    expect(spy).not.toHaveBeenCalled();
  });
});
