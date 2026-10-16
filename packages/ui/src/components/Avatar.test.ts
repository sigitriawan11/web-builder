import { describe, expect, it } from "vitest";
import { initials } from "./Avatar";

describe("initials", () => {
  it("maks dua huruf kapital dari kata pertama; nama kosong → ?", () => {
    expect(initials("sari wulandari putri")).toBe("SW");
    expect(initials("  Budi ")).toBe("B");
    expect(initials("")).toBe("?");
  });
});
