import { describe, expect, it, vi } from "vitest";
import { REQUEST_ID_HEADER } from "./client";
import { apiServer, forwardedHeaders } from "./server";

const incoming = new Headers({
  cookie: "platform.session_token=abc.sig",
  [REQUEST_ID_HEADER]: "req-dari-web-12345",
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Browser/1.0",
  "x-forwarded-for": "203.0.113.7",
  host: "app.localhost:3000",
  "content-length": "123",
  authorization: "Bearer bocor",
  "x-lain": "tidak",
});

describe("apiServer (Next.js server → api)", () => {
  it("hanya header allowlist yang diteruskan", () => {
    expect(forwardedHeaders(incoming)).toEqual({
      cookie: "platform.session_token=abc.sig",
      [REQUEST_ID_HEADER]: "req-dari-web-12345",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Browser/1.0",
      "x-forwarded-for": "203.0.113.7",
    });
  });

  it("request ke API_INTERNAL_URL membawa cookie, x-request-id asal, bahasa & IP user; tanpa cookie jar", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              id: "01a135f2-b67d-71b3-9fbc-775f6ef635e9",
              name: "Budi",
              email: "budi@contoh.id",
              emailVerified: true,
              image: null,
              locale: "en",
              timezone: "Asia/Jakarta",
              hasPassword: true,
            },
            meta: { requestId: "req-dari-web-12345" },
          }),
          { status: 200 },
        ),
    );
    const api = apiServer(incoming, { baseUrl: "http://api.internal:4000", fetch: fetchMock });
    const profile = await api.account.profile();
    expect(profile.name).toBe("Budi");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://api.internal:4000/v1/account/profile");
    const headers = new Headers(init?.headers);
    expect(headers.get("cookie")).toBe("platform.session_token=abc.sig");
    expect(headers.get(REQUEST_ID_HEADER)).toBe("req-dari-web-12345");
    expect(headers.get("accept-language")).toBe("en-US,en;q=0.9");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(headers.get("host")).toBeNull();
    expect(headers.get("authorization")).toBeNull();
    expect(init?.credentials).toBe("omit");
  });

  it("tanpa x-request-id dari web → dibuat baru", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    await apiServer(new Headers({ cookie: "a=b" }), { baseUrl: "http://api", fetch: fetchMock }).sites.remove("x");
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
