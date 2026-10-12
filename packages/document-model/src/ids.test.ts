import { describe, expect, it } from "vitest";
import { createId, ID_PATTERN, ID_PREFIXES } from "./ids";

describe("createId", () => {
  it("menghasilkan ID node yang cocok dengan regex DM-007", () => {
    const id = createId("n");

    expect(id).toMatch(ID_PATTERN);
    expect(id).toMatch(/^n_[0-9a-z]{10}$/);
  });

  it("memakai prefix yang diminta untuk setiap jenis entitas", () => {
    for (const prefix of ID_PREFIXES) {
      const id = createId(prefix);

      expect(id.startsWith(`${prefix}_`)).toBe(true);
      expect(id).toMatch(ID_PATTERN);
    }
  });

  it("tidak menghasilkan duplikat dalam 1 juta ID", () => {
    const count = 1_000_000;
    const ids = new Set<string>();
    for (let i = 0; i < count; i++) {
      ids.add(createId("n"));
    }

    expect(ids.size).toBe(count);
  });
});

describe("ID_PATTERN", () => {
  it("menerima ID seed manusiawi dan menolak format lain", () => {
    expect(ID_PATTERN.test("cmp_navbar0001")).toBe(true);
    expect(ID_PATTERN.test("pg_k3m9x2a7qp")).toBe(true);

    expect(ID_PATTERN.test("n_ABC1234567")).toBe(false);
    expect(ID_PATTERN.test("x_a8f3k2m1zx")).toBe(false);
    expect(ID_PATTERN.test("n_abc12")).toBe(false);
    expect(ID_PATTERN.test("n_a8f3-k2m1z")).toBe(false);
  });
});
