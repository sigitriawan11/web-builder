import { dataEnvelope, SiteSchema } from "@platform/shared/contracts";
import { describe, expect, it, vi } from "vitest";
import { createApiClient, REQUEST_ID_HEADER } from "./client";
import { createPlatformApi } from "./endpoints";
import { ApiError, isApiError } from "./errors";

const SITE = {
  id: "01a135f2-b67d-71b3-9fbc-775f6ef635e9",
  workspaceId: "01a135f2-b6cc-77fb-893d-af4f62d11c71",
  name: "Toko Kue",
  status: "draft",
  documentId: "01a135f2-b6cc-77fb-893d-af4f62d11c72",
  createdAt: "2026-10-14T01:00:00.000Z",
  updatedAt: "2026-10-14T01:00:00.000Z",
};

function mockFetch(response: Response | (() => Promise<Response>)) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    typeof response === "function" ? response() : response.clone(),
  );
}
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const call = (fetchMock: ReturnType<typeof mockFetch>) => {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init: init ?? {}, headers: new Headers(init?.headers) };
};

describe("createApiClient", () => {
  it("URL dari baseUrl + query (nilai kosong dibuang); x-request-id & Accept-Language; body JSON", async () => {
    const fetchMock = mockFetch(json({ data: SITE, meta: { requestId: "r1" } }));
    const client = createApiClient({ baseUrl: "/api/", fetch: fetchMock, locale: () => "en" });
    const data = await client.request("POST", "/v1/x", {
      query: { a: 1, b: undefined, c: "", d: null, e: false },
      body: { name: "Toko" },
      schema: dataEnvelope(SiteSchema),
    });
    expect(data.data.name).toBe("Toko Kue");
    const { url, init, headers } = call(fetchMock);
    expect(url).toBe("/api/v1/x?a=1&e=false");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "Toko" }));
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("en");
    expect(headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.credentials).toBe("same-origin");
  });

  it("header tambahan (server Next.js) diteruskan, termasuk x-request-id asal", async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));
    const client = createApiClient({
      baseUrl: "http://api.internal",
      fetch: fetchMock,
      getHeaders: () => ({ cookie: "platform.session_token=abc", [REQUEST_ID_HEADER]: "req-dari-web" }),
    });
    await expect(client.request("DELETE", "/v1/sites/1")).resolves.toBeUndefined();
    const { headers } = call(fetchMock);
    expect(headers.get("cookie")).toBe("platform.session_token=abc");
    expect(headers.get(REQUEST_ID_HEADER)).toBe("req-dari-web");
  });

  it("envelope error → ApiError (code, status, message, details, requestId, Retry-After)", async () => {
    const body = {
      error: { code: "RATE_LIMITED", message: "Terlalu banyak", details: { retryAfterSeconds: 30 }, requestId: "r9" },
    };
    const client = createApiClient({
      baseUrl: "/api",
      fetch: mockFetch(json(body, { status: 429, headers: { "retry-after": "30" } })),
    });
    const error = await client.request("GET", "/v1/x").catch((caught: unknown) => caught);
    expect(isApiError(error, "RATE_LIMITED")).toBe(true);
    expect(error).toMatchObject({ status: 429, message: "Terlalu banyak", requestId: "r9", retryAfterSeconds: 30 });
    expect((error as ApiError).details).toEqual({ retryAfterSeconds: 30 });
  });

  it("error bukan envelope (mis. HTML proxy 502) → INVALID_RESPONSE", async () => {
    const client = createApiClient({ baseUrl: "/api", fetch: mockFetch(new Response("<html>", { status: 502 })) });
    await expect(client.request("GET", "/v1/x")).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 502 });
  });

  it("respons sukses tidak sesuai kontrak → INVALID_RESPONSE dengan issues", async () => {
    const client = createApiClient({
      baseUrl: "/api",
      fetch: mockFetch(json({ data: { ...SITE, status: "aneh" }, meta: { requestId: "r" } })),
    });
    const error = await client
      .request("GET", "/v1/x", { schema: dataEnvelope(SiteSchema) })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "INVALID_RESPONSE" });
    expect((error as ApiError).details?.issues).toEqual([expect.objectContaining({ path: "data.status" })]);
  });

  it("jaringan gagal → NETWORK_ERROR; lewat batas waktu → TIMEOUT; dibatalkan pemanggil → error asli", async () => {
    const offline = createApiClient({
      baseUrl: "/api",
      fetch: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    });
    await expect(offline.request("GET", "/v1/x")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });

    const hanging = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          // Seperti fetch asli: signal yang sudah dibatalkan langsung ditolak.
          if (init?.signal?.aborted) reject(init.signal.reason);
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const slow = createApiClient({ baseUrl: "/api", fetch: hanging, timeoutMs: 20 });
    await expect(slow.request("GET", "/v1/x")).rejects.toMatchObject({ code: "TIMEOUT" });

    const controller = new AbortController();
    const pending = createApiClient({ baseUrl: "/api", fetch: hanging }).request("GET", "/v1/x", {
      signal: controller.signal,
    });
    controller.abort(new Error("batal"));
    await expect(pending).rejects.toThrow("batal");
    await expect(pending).rejects.not.toBeInstanceOf(ApiError);
    // Sudah dibatalkan sebelum dipanggil → fetch tidak pernah dijalankan.
    const neverCalled = vi.fn();
    const aborted = AbortSignal.abort(new Error("sudah batal"));
    await expect(
      createApiClient({ baseUrl: "/api", fetch: neverCalled }).request("GET", "/v1/x", { signal: aborted }),
    ).rejects.toThrow("sudah batal");
    expect(neverCalled).not.toHaveBeenCalled();
  });
});

describe("createPlatformApi", () => {
  it("sites.list → URL workspace + query; mengembalikan items & nextCursor", async () => {
    const fetchMock = mockFetch(json({ data: [SITE], meta: { requestId: "r", nextCursor: "c2" } }));
    const api = createPlatformApi(createApiClient({ baseUrl: "/api", fetch: fetchMock }));
    const page = await api.sites.list(SITE.workspaceId, { sort: "name", q: "kue" });
    expect(page).toEqual({ items: [SITE], nextCursor: "c2" });
    expect(call(fetchMock).url).toBe(`/api/v1/workspaces/${SITE.workspaceId}/sites?sort=name&q=kue`);
  });

  it("sites.get memakai rute level situs dan membuka envelope", async () => {
    const fetchMock = mockFetch(json({ data: SITE, meta: { requestId: "r" } }));
    const api = createPlatformApi(createApiClient({ baseUrl: "/api", fetch: fetchMock }));
    expect(await api.sites.get(SITE.id)).toEqual(SITE);
    expect(call(fetchMock).url).toBe(`/api/v1/sites/${SITE.id}`);
  });
});
