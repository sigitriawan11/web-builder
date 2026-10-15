import { describe, expect, it } from "vitest";
import { buildCsp, createNonce, type SecurityEnv, securityHeaders } from "./headers";

const env: SecurityEnv = {
  isDev: false,
  isProduction: true,
  connectOrigins: ["https://api.platformmu.com", "wss://realtime.platformmu.com"],
  imageOrigins: ["https://assets.platformmu.site"],
  editorDevSocket: "ws://app.localhost:5173",
};
const directive = (csp: string, name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

describe("CSP per permukaan (PUB-211)", () => {
  it("app: nonce + strict-dynamic, tanpa unsafe-inline/eval di production; tidak bisa di-iframe", () => {
    const csp = buildCsp("app", env, "abc123");
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "connect-src")).toBe(
      "connect-src 'self' https://api.platformmu.com wss://realtime.platformmu.com",
    );
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("editor: script-src 'self' saja di production; dev menambah preamble inline & socket HMR", () => {
    expect(directive(buildCsp("editor", env), "script-src")).toBe("script-src 'self'");
    const dev = buildCsp("editor", { ...env, isDev: true, isProduction: false });
    expect(directive(dev, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(directive(dev, "connect-src")).toContain("ws://app.localhost:5173");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("dev app: unsafe-eval untuk React dev; marketing tanpa nonce (SSG)", () => {
    expect(directive(buildCsp("app", { ...env, isDev: true }, "n"), "script-src")).toContain("'unsafe-eval'");
    expect(directive(buildCsp("marketing", env), "script-src")).toBe("script-src 'self' 'unsafe-inline'");
  });

  it("header lengkap; HSTS hanya production; api tidak disentuh", () => {
    const headers = securityHeaders("app", env, "n");
    expect(headers).toMatchObject({
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "cross-origin-opener-policy": "same-origin",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    });
    expect(securityHeaders("editor", { ...env, isProduction: false })).not.toHaveProperty("strict-transport-security");
    expect(securityHeaders("api", env)).toEqual({});
  });

  it("nonce acak base64 berbeda tiap panggilan", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });
});
