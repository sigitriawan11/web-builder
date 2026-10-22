import { schema } from "@platform/db";
import { ComponentKindSchema } from "@platform/shared/contracts";
import { describe, expect, it } from "vitest";

// CMP-001/CMP-003 (T3.10.1): enum `kind` component dipakai sama di kontrak (shared), DB (pgEnum), dan glosarium.
// Test ini mencegah drift antar paket (mis. lupa menambah `page` di salah satu tempat).
const CANONICAL_KINDS = ["element", "block", "section", "page", "layout"] as const;

describe("component kind (CMP-003)", () => {
  it("kontrak shared (ComponentKindSchema) = kanonik", () => {
    expect(ComponentKindSchema.options).toEqual([...CANONICAL_KINDS]);
  });

  it("DB pgEnum (component_kind) = kanonik", () => {
    expect([...schema.componentKindEnum.enumValues]).toEqual([...CANONICAL_KINDS]);
  });
});
