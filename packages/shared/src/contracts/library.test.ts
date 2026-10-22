import { describe, expect, it } from "vitest";
import { LibraryAdminComponentSchema, LibraryCategorySchema, LibraryEntityIdSchema } from "./library";

// Regresi (bug INVALID_RESPONSE pada /admin/library): ID entitas library bisa UUID **v5** (seed, deterministik dari
// slug — lihat packages/library-seed uuidV5) ATAU **v7** (dibuat editor). Schema DTO harus menerima keduanya.
const V5_UUID = "8b0a4f8e-3c2d-5e6f-9a1b-7c4d2e8f6a10"; // version nibble = 5
const V7_UUID = "0199f3e0-0000-7000-8000-000000000000"; // version nibble = 7

describe("library entity id (CMP-141)", () => {
  it("LibraryEntityIdSchema menerima UUID v5 & v7", () => {
    expect(LibraryEntityIdSchema.safeParse(V5_UUID).success).toBe(true);
    expect(LibraryEntityIdSchema.safeParse(V7_UUID).success).toBe(true);
  });

  it("LibraryCategorySchema menerima id v5 (kategori seed)", () => {
    expect(
      LibraryCategorySchema.safeParse({ id: V5_UUID, slug: "hero", type: "functional", name: { id: "H", en: "H" } })
        .success,
    ).toBe(true);
  });

  it("LibraryAdminComponentSchema menerima id v5 (component seed)", () => {
    const parsed = LibraryAdminComponentSchema.safeParse({
      id: V5_UUID,
      publicId: "cmp_buttonprimary",
      name: "Button",
      displayName: { id: "Tombol", en: "Button" },
      kind: "element",
      categorySlug: "buttons",
      status: "published",
      latestVersion: "1.0.0",
      usageSiteCount: 0,
      hasDraft: true,
      updatedAt: "2026-10-22T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });
});
