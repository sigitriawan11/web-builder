import { describe, expect, it } from "vitest";
import { contentHash, formatImportPlan, planLibraryImport, uuidV5 } from "../src";

// T1.11.4: rencana import library (CMP-141/142) — dry-run tanpa DB.
describe("uuidV5", () => {
  it("sesuai vektor RFC (namespace DNS, 'www.example.com') dan deterministik", () => {
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
    expect(uuidV5("component:button-primary")).toBe(uuidV5("component:button-primary"));
    expect(uuidV5("component:button-primary")).not.toBe(uuidV5("component:button-secondary"));
  });
});

describe("contentHash", () => {
  it("tidak bergantung urutan key; berubah bila isi berubah", () => {
    expect(contentHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(contentHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
});

describe("planLibraryImport", () => {
  it("library repo: tanpa masalah, kunci stabil (dua kali = sama → idempoten)", () => {
    const plan = planLibraryImport();
    expect(plan.issues).toEqual([]);
    expect(plan.categories.length).toBe(36);
    const button = plan.components.find((component) => component.slug === "button-primary");
    expect(button).toMatchObject({
      kind: "element",
      categorySlug: "elements",
      componentId: uuidV5("component:button-primary"),
    });
    expect(button?.versions).toEqual([
      { version: "1.0.0", status: "published", contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
    ]);
    expect(planLibraryImport()).toEqual(plan);
    expect(formatImportPlan(plan)).toMatch(/Component: 1 \(1 versi\)\n {2}- button-primary \[element\/elements\]/);
  });
});
