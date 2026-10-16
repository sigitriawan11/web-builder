import { describe, expect, it } from "vitest";
import { isMixed, MIXED, mixedValue } from "./mixed";

describe("mixedValue (ED-008)", () => {
  it("seleksi kosong → undefined; satu node → nilainya", () => {
    expect(mixedValue([])).toBeUndefined();
    expect(mixedValue(["frame"])).toBe("frame");
  });

  it("semua sama → nilai; berbeda → MIXED", () => {
    expect(mixedValue(["frame", "frame", "frame"])).toBe("frame");
    expect(mixedValue(["frame", "text"])).toBe(MIXED);
    expect(isMixed(mixedValue([1, 2]))).toBe(true);
  });

  it("objek dibandingkan struktural, urutan key & field undefined diabaikan", () => {
    const a = { type: "solid", color: "#FF0000", opacity: undefined };
    const b = { color: "#FF0000", type: "solid" };
    expect(mixedValue([a, b])).toEqual(a);
    expect(
      mixedValue([
        { value: 10, unit: "px" },
        { value: 10, unit: "%" },
      ]),
    ).toBe(MIXED);
    expect(mixedValue([[{ x: 1 }], [{ x: 1 }]])).toEqual([{ x: 1 }]);
    expect(
      mixedValue([
        [1, 2],
        [2, 1],
      ]),
    ).toBe(MIXED);
  });

  it("null vs undefined vs tidak ada dibedakan", () => {
    expect(mixedValue([null, undefined])).toBe(MIXED);
    expect(mixedValue([undefined, undefined])).toBeUndefined();
  });
});
