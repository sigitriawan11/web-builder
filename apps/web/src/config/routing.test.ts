import { describe, expect, it } from "vitest";
import { loadWebEnv, platformRewrites } from "./routing";

describe("platformRewrites (ARCHITECTURE §3.4)", () => {
  it("/api → api tanpa prefix; /editor → origin editor dengan base /editor/", () => {
    expect(
      platformRewrites({ API_INTERNAL_URL: "http://localhost:4000/", EDITOR_ORIGIN: "http://localhost:5173" }),
    ).toEqual({
      beforeFiles: [
        { source: "/api/:path*", destination: "http://localhost:4000/:path*" },
        { source: "/editor", destination: "http://localhost:5173/editor/" },
        { source: "/editor/:path*", destination: "http://localhost:5173/editor/:path*" },
      ],
    });
  });

  it("env wajib & harus URL; pesan menyebut field yang salah", () => {
    const valid = {
      API_INTERNAL_URL: "http://localhost:4000",
      EDITOR_ORIGIN: "http://localhost:5173",
      PUBLIC_APP_URL: "http://app.localhost:3000",
      PUBLIC_MARKETING_URL: "http://localhost:3000",
    };
    expect(loadWebEnv(valid)).toEqual(valid);
    expect(() => loadWebEnv({ ...valid, EDITOR_ORIGIN: undefined })).toThrow(/EDITOR_ORIGIN/);
    expect(() => loadWebEnv({ ...valid, API_INTERNAL_URL: "bukan url" })).toThrow(/API_INTERNAL_URL/);
  });
});
