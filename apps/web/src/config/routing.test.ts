import { describe, expect, it } from "vitest";
import { loadRoutingEnv, platformRewrites } from "./routing";

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
    expect(() => loadRoutingEnv({ API_INTERNAL_URL: "http://localhost:4000" })).toThrow(/EDITOR_ORIGIN/);
    expect(() => loadRoutingEnv({ API_INTERNAL_URL: "bukan url", EDITOR_ORIGIN: "http://x" })).toThrow(
      /API_INTERNAL_URL/,
    );
  });
});
