import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ColorSchema, cv, isPropRef, isTokenRef, LengthSchema, PropRefSchema, TokenRefSchema, tv } from "./values";

describe("TokenRefSchema", () => {
  it.each(["color.primary", "space.6", "type.h1", "color.brand.600", "size.content-narrow"])(
    "menerima path token %s",
    (path) => {
      expect(TokenRefSchema.safeParse({ $token: path }).success).toBe(true);
    },
  );

  it.each([
    ["tanpa nama", "color"],
    ["nested lebih dari 1 level (DM-041)", "color.brand.600.x"],
    ["group diawali huruf besar", "Color.primary"],
    ["segmen kosong", "color..primary"],
    ["karakter tidak valid", "color.primary_hover"],
  ])("menolak path %s", (_, path) => {
    expect(TokenRefSchema.safeParse({ $token: path }).success).toBe(false);
  });

  it("menolak key tambahan selain $token", () => {
    expect(TokenRefSchema.safeParse({ $token: "color.primary", alpha: 0.5 }).success).toBe(false);
  });
});

// T1.8.9: literal vs `$token` vs `$prop` (DM-025).
describe("tv() & cv()", () => {
  const sizeV = tv(z.number().int());
  const sizeCV = cv(z.number().int());

  it("tv menerima literal & token, menolak $prop", () => {
    expect(sizeV.safeParse(16).success).toBe(true);
    expect(sizeV.safeParse({ $token: "space.4" }).success).toBe(true);
    expect(sizeV.safeParse({ $prop: "gap" }).success).toBe(false);
    expect(sizeV.safeParse("16").success).toBe(false);
  });

  it("cv menerima $prop (+fallback JSON, eq) hanya dengan key camelCase", () => {
    expect(sizeCV.safeParse({ $prop: "gap" }).success).toBe(true);
    expect(sizeCV.safeParse({ $prop: "variant", eq: "outline" }).success).toBe(true);
    expect(sizeCV.safeParse({ $prop: "title", fallback: { text: "Halo" } }).success).toBe(true);
    for (const bad of [{ $prop: "Title" }, { $prop: "my-title" }, { $prop: "" }, { $prop: "x", extra: 1 }]) {
      expect(sizeCV.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(PropRefSchema.safeParse({ $prop: "x", fallback: Number.NaN }).success).toBe(false);
  });

  it("$bind tidak diterima sebagai nilai style", () => {
    expect(sizeCV.safeParse({ $bind: "item.price" }).success).toBe(false);
    expect(LengthSchema.safeParse({ $bind: "item.price" }).success).toBe(false);
  });

  it("type guard isTokenRef/isPropRef", () => {
    expect(isTokenRef({ $token: "color.primary", alpha: 0.5 })).toBe(true);
    expect(isTokenRef("#ffffff")).toBe(false);
    expect(isPropRef({ $prop: "title" })).toBe(true);
    expect(isPropRef({ $token: "color.primary" })).toBe(false);
    expect(isPropRef(null)).toBe(false);
  });
});

describe("LengthSchema & ColorSchema (DM-025)", () => {
  it("panjang wajib { value, unit } finite atau token; angka polos ditolak", () => {
    expect(LengthSchema.safeParse({ value: 16, unit: "px" }).success).toBe(true);
    expect(LengthSchema.safeParse({ $token: "space.4" }).success).toBe(true);
    for (const bad of [16, { value: 16 }, { value: 16, unit: "pt" }, { value: Number.POSITIVE_INFINITY, unit: "px" }]) {
      expect(LengthSchema.safeParse(bad).success, String(JSON.stringify(bad))).toBe(false);
    }
  });

  it.each(["#ff5a1f", "#FF5A1F", "#ff5a1f80", { $token: "color.primary" }, { $token: "color.primary", alpha: 0.4 }])(
    "warna valid %j",
    (color) => {
      expect(ColorSchema.safeParse(color).success).toBe(true);
    },
  );

  it.each([
    "rgb(0,0,0)",
    "red",
    "#fff",
    "#ff5a1",
    { $token: "color.primary", alpha: 1.5 },
    { $token: "x", alpha: 0.5 },
  ])("warna non-hex / tidak valid ditolak %j", (color) => {
    expect(ColorSchema.safeParse(color).success).toBe(false);
  });
});
