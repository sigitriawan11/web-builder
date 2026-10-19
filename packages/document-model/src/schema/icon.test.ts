import { describe, expect, it } from "vitest";
import { IconPropsSchema } from "./nodes";

// DM-015/ED-163: props node icon — set `lucide` (ikon umum) atau `brand` (logo Simple Icons).
describe("IconProps (DM-015/ED-163)", () => {
  it("menerima set lucide & brand", () => {
    expect(IconPropsSchema.safeParse({ set: "lucide", name: "phone" }).success).toBe(true);
    expect(IconPropsSchema.safeParse({ set: "brand", name: "whatsapp" }).success).toBe(true);
  });

  it("slug brand boleh diawali digit (mis. 1password, 500px)", () => {
    expect(IconPropsSchema.safeParse({ set: "brand", name: "1password" }).success).toBe(true);
    expect(IconPropsSchema.safeParse({ set: "brand", name: "500px" }).success).toBe(true);
  });

  it("menolak set tak dikenal & nama kosong/tak valid", () => {
    expect(IconPropsSchema.safeParse({ set: "material", name: "phone" }).success).toBe(false);
    expect(IconPropsSchema.safeParse({ set: "lucide", name: "" }).success).toBe(false);
    expect(IconPropsSchema.safeParse({ set: "lucide", name: "Phone Icon" }).success).toBe(false);
  });

  it("strokeWidth opsional & dibatasi", () => {
    expect(IconPropsSchema.safeParse({ set: "lucide", name: "phone", strokeWidth: 2 }).success).toBe(true);
    expect(IconPropsSchema.safeParse({ set: "lucide", name: "phone", strokeWidth: 0 }).success).toBe(false);
    expect(IconPropsSchema.safeParse({ set: "lucide", name: "phone", strokeWidth: 9 }).success).toBe(false);
  });
});
