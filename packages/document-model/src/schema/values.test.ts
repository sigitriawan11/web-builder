import { describe, expect, it } from "vitest";
import { TokenRefSchema } from "./values";

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
