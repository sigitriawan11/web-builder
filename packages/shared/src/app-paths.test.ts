import { describe, expect, it } from "vitest";
import { safeNextPath } from "./app-paths";

describe("safeNextPath (ACC-004: tanpa open redirect)", () => {
  it.each([
    ["/sites", "/sites"],
    ["/sites/01a?tab=pages#x", "/sites/01a?tab=pages#x"],
    ["/editor/abc", "/editor/abc"],
  ])("%s → %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "/\tevil",
    "/%0d%0aSet-Cookie:x",
    "",
    null,
    undefined,
  ])("%j ditolak → fallback", (next) => {
    const result = safeNextPath(next, "/");
    if (next === "/%0d%0aSet-Cookie:x") expect(result).toBe("/%0d%0aSet-Cookie:x");
    else expect(result).toBe("/");
  });
});
