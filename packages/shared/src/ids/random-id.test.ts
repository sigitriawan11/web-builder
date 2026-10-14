import { describe, expect, it } from "vitest";
import { personalWorkspaceSlug, randomAlphanumeric } from "./random-id";

describe("randomAlphanumeric", () => {
  it("panjang tepat, hanya huruf kecil & angka", () => {
    for (const length of [1, 10, 64]) expect(randomAlphanumeric(length)).toMatch(new RegExp(`^[a-z0-9]{${length}}$`));
  });
  it("slug personal workspace: ws_ + 10 karakter, tidak berulang", () => {
    const slugs = new Set(Array.from({ length: 1000 }, personalWorkspaceSlug));
    expect(slugs.size).toBe(1000);
    for (const slug of slugs) expect(slug).toMatch(/^ws_[a-z0-9]{10}$/);
  });
});
