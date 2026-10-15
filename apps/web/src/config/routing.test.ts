import { describe, expect, it } from "vitest";
import { editorRewriteUrl, loadWebEnv, platformRewrites } from "./routing";

describe("platformRewrites & editorRewriteUrl (ARCHITECTURE §3.4)", () => {
  it("/api → api tanpa prefix (next.config)", () => {
    expect(platformRewrites({ API_INTERNAL_URL: "http://localhost:4000/" })).toEqual({
      beforeFiles: [{ source: "/api/:path*", destination: "http://localhost:4000/:path*" }],
    });
  });

  it("/editor… → origin editor dengan base /editor/ & query utuh (proxy)", () => {
    const env = { EDITOR_ORIGIN: "http://localhost:5173/" };
    expect(editorRewriteUrl(env, "/editor", "")).toBe("http://localhost:5173/editor/");
    expect(editorRewriteUrl(env, "/editor/0199abc", "?page=pg_1")).toBe(
      "http://localhost:5173/editor/0199abc?page=pg_1",
    );
  });

  it("env wajib & harus URL; pesan menyebut field yang salah", () => {
    const valid = {
      API_INTERNAL_URL: "http://localhost:4000",
      EDITOR_ORIGIN: "http://localhost:5173",
      PUBLIC_APP_URL: "http://app.localhost:3000",
      PUBLIC_MARKETING_URL: "http://localhost:3000",
      PUBLIC_API_URL: "http://api.localhost:4000",
      PUBLIC_REALTIME_URL: "ws://realtime.localhost:4100",
      PUBLIC_ASSETS_URL: "http://localhost:9000/assets",
    };
    expect(loadWebEnv(valid)).toEqual({ ...valid, APP_ENV: "local" });
    expect(() => loadWebEnv({ ...valid, EDITOR_ORIGIN: undefined })).toThrow(/EDITOR_ORIGIN/);
    expect(() => loadWebEnv({ ...valid, API_INTERNAL_URL: "bukan url" })).toThrow(/API_INTERNAL_URL/);
  });
});
