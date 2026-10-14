import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  autolayoutDocument,
  freeformDocument,
  fullTopLevelDocument,
  heroDocument,
  minimalDocument,
  nestedDocument,
  wrapGridDocument,
} from "../../test/fixtures/basic-documents";
import { landing200 } from "../../test/fixtures/landing-generator";
import { responsiveSectionsDocument } from "../../test/fixtures/responsive-sections";
import { SiteDocumentSchema } from "./document";

// T1.8.1: AC DM-001–DM-004 untuk struktur top-level SiteDocument.
const fixtures = {
  minimal: minimalDocument,
  hero: heroDocument,
  nested: nestedDocument,
  freeform: freeformDocument,
  autolayout: autolayoutDocument,
  wrapGrid: wrapGridDocument,
  landing200,
  responsiveSections: () => responsiveSectionsDocument().document,
  fullTopLevel: fullTopLevelDocument,
};

describe("SiteDocument top-level (DM-002, DM-004)", () => {
  it.each(Object.entries(fixtures))("fixture %s valid & JSON round-trip identik", (_name, create) => {
    const doc = create();
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it.each(["schemaVersion", "meta", "settings", "theme", "assets", "componentDeps", "pageOrder", "nodes"])(
    "field wajib %s tidak ada → ditolak",
    (field) => {
      const doc: Record<string, unknown> = { ...minimalDocument() };
      delete doc[field];
      const result = SiteDocumentSchema.safeParse(doc);
      expect(result.success).toBe(false);
      expect(result.error?.issues.some((issue) => issue.path[0] === field)).toBe(true);
    },
  );

  it("key top-level tak dikenal ditolak (strict)", () => {
    const result = SiteDocumentSchema.safeParse({ ...minimalDocument(), customCss: "body{}" });
    expect(result.success).toBe(false);
  });

  it("dataSources & templateRef opsional; bentuknya tetap divalidasi", () => {
    expect(
      SiteDocumentSchema.safeParse({ ...minimalDocument(), dataSources: { collections: ["bukan-id"] } }).success,
    ).toBe(false);
    const doc = minimalDocument();
    expect(
      SiteDocumentSchema.safeParse({ ...doc, meta: { ...doc.meta, templateRef: { templateId: "tpl_x", version: 0 } } })
        .success,
    ).toBe(false);
  });

  it("nilai token wajib JSON murni: NaN/Infinity ditolak (DM-002)", () => {
    const doc = fullTopLevelDocument();
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const broken = { ...doc, theme: { ...doc.theme, tokens: { ...doc.theme.tokens, space: { "4": bad } } } };
      expect(SiteDocumentSchema.safeParse(broken).success).toBe(false);
    }
  });
});

describe("dokumen tenant-agnostic (DM-001)", () => {
  it("schema tidak punya field userId / ownerId / workspaceId / domain di mana pun", () => {
    const jsonSchema = JSON.stringify(z.toJSONSchema(SiteDocumentSchema, { unrepresentable: "any" }));
    // Tidak kosong: field yang sah memang terbaca (termasuk bersarang).
    for (const present of ["schemaVersion", "componentDeps", "templateRef", "parentId"]) {
      expect(jsonSchema).toContain(`"${present}"`);
    }
    for (const forbidden of ["userId", "ownerId", "workspaceId", "domain"]) {
      expect(jsonSchema).not.toContain(`"${forbidden}"`);
    }
  });
});
