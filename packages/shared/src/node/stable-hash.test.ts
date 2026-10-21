import { describe, expect, it } from "vitest";
import { stableHash } from "./stable-hash";

describe("stableHash", () => {
  it("stabil terhadap urutan key (kanonik), termasuk bersarang & array", () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
    expect(stableHash({ x: { p: 1, q: 2 } })).toBe(stableHash({ x: { q: 2, p: 1 } }));
    expect(stableHash({ list: [{ a: 1, b: 2 }] })).toBe(stableHash({ list: [{ b: 2, a: 1 }] }));
  });

  it("beda nilai → beda hash; urutan array tetap signifikan", () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
  });
});
