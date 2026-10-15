import { describe, expect, it } from "vitest";
import { decideProxy, type ProxyInput } from "./decide";

const base: ProxyInput = {
  pathname: "/",
  search: "",
  host: "app.localhost:3000",
  cookies: new Map(),
  requestId: null,
  acceptLanguage: null,
  appUrl: "http://app.localhost:3000",
  marketingUrl: "http://localhost:3000",
  newRequestId: () => "rid-baru",
};
const decide = (overrides: Partial<ProxyInput>) => decideProxy({ ...base, ...overrides });
const session = new Map([["platform.session_token", "abc"]]);

describe("host routing", () => {
  it("path aplikasi di host marketing → 307 ke app. dengan path & query utuh", () => {
    expect(decide({ host: "localhost:3000", pathname: "/sites", search: "?q=1" })).toMatchObject({
      type: "redirect",
      status: 307,
      location: "http://app.localhost:3000/sites?q=1",
    });
    expect(decide({ host: "localhost:3000", pathname: "/api/v1/me" })).toMatchObject({
      location: "http://app.localhost:3000/api/v1/me",
    });
    // Prefix harus utuh per segmen.
    expect(decide({ host: "localhost:3000", pathname: "/sitesxyz" }).type).toBe("next");
    expect(decide({ host: "localhost:3000", pathname: "/" }).type).toBe("next");
  });

  it("`/` di host app → /sites; host tak dikenal tidak dialihkan", () => {
    expect(decide({ pathname: "/", cookies: session })).toMatchObject({ location: "http://app.localhost:3000/sites" });
    expect(decide({ host: "127.0.0.1:3000", pathname: "/" }).type).toBe("next");
  });

  it("host dinormalisasi (huruf besar, titik di akhir)", () => {
    expect(decide({ host: "APP.localhost.:3000", pathname: "/" }).type).toBe("redirect");
  });
});

describe("gate sesi", () => {
  it("path terlindungi tanpa cookie sesi → /login?next=<path+query> (AC T1.14.2)", () => {
    expect(decide({ pathname: "/sites" })).toMatchObject({
      type: "redirect",
      location: "http://app.localhost:3000/login?next=%2Fsites",
    });
    expect(decide({ pathname: "/editor/0199abc", search: "?page=pg_1" })).toMatchObject({
      location: "http://app.localhost:3000/login?next=%2Feditor%2F0199abc%3Fpage%3Dpg_1",
    });
  });

  it("cookie sesi (biasa atau __Secure-) → lanjut; halaman auth & /api tidak di-gate", () => {
    expect(decide({ pathname: "/sites", cookies: session }).type).toBe("next");
    expect(decide({ pathname: "/admin", cookies: new Map([["__Secure-platform.session_token", "x"]]) }).type).toBe(
      "next",
    );
    expect(decide({ pathname: "/login" }).type).toBe("next");
    expect(decide({ pathname: "/api/v1/me" }).type).toBe("next");
    expect(decide({ pathname: "/sites", cookies: new Map([["platform.session_token", ""]]) }).type).toBe("redirect");
  });
});

describe("permukaan header keamanan", () => {
  it("api, editor & app di host app; selain itu marketing", () => {
    expect(decide({ pathname: "/api/v1/me" })).toMatchObject({ surface: "api" });
    expect(decide({ pathname: "/editor/x", cookies: session })).toMatchObject({ surface: "editor" });
    expect(decide({ pathname: "/login" })).toMatchObject({ surface: "app" });
    expect(decide({ host: "localhost:3000", pathname: "/" })).toMatchObject({ surface: "marketing" });
    expect(decide({ host: "127.0.0.1:3000", pathname: "/editor" })).toMatchObject({ surface: "marketing" });
  });
});

describe("request id & locale", () => {
  it("x-request-id valid dipertahankan; kosong/tidak valid → baru", () => {
    expect(decide({ pathname: "/login", requestId: "req-123" })).toMatchObject({ requestId: "req-123" });
    expect(decide({ pathname: "/login", requestId: "ada spasi<script>" })).toMatchObject({ requestId: "rid-baru" });
    expect(decide({ pathname: "/sites" })).toMatchObject({ type: "redirect", requestId: "rid-baru" });
  });

  it("locale: cookie NEXT_LOCALE → Accept-Language → id", () => {
    expect(
      decide({ pathname: "/login", cookies: new Map([["NEXT_LOCALE", "en"]]), acceptLanguage: "id" }),
    ).toMatchObject({ locale: "en" });
    expect(
      decide({ pathname: "/login", cookies: new Map([["NEXT_LOCALE", "fr"]]), acceptLanguage: "en-US" }),
    ).toMatchObject({ locale: "en" });
    expect(decide({ pathname: "/login" })).toMatchObject({ locale: "id" });
  });
});
