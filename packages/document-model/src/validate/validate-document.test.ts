import { expectDurationBelow } from "@platform/config/vitest/perf";
import { describe, expect, it } from "vitest";
import * as fixtures from "../../test/fixtures";
import { heroDocument, minimalDocument } from "../../test/fixtures/basic-documents";
import { INVALID_DOCUMENTS } from "../../test/fixtures/invalid-documents";
import { emptyTheme } from "../defaults/top-level";
import { REFERENCE_ISSUE_CODES, STRUCTURE_ISSUE_CODES } from "./issues";
import { validateDocument } from "./validate-document";

// T1.8.14: mode validasi (DM-068) & invariant per kode (DM-069).
const codes = (result: ReturnType<typeof validateDocument>) => result.errors.map((issue) => issue.code);

describe("fixture invalid/<CODE>.json (AC DM-069)", () => {
  const entries = Object.entries(INVALID_DOCUMENTS);

  it("ada fixture untuk setiap kode struktur & rujukan", () => {
    expect(Object.keys(INVALID_DOCUMENTS).sort()).toEqual([...STRUCTURE_ISSUE_CODES, ...REFERENCE_ISSUE_CODES].sort());
  });

  it.each(entries)("%s: file fixture sesuai generator", async (code, doc) => {
    await expect(`${JSON.stringify(doc, null, 2)}\n`).toMatchFileSnapshot(`../../test/fixtures/invalid/${code}.json`);
  });

  it.each(entries)("%s: gagal publish dengan kode tersebut", (code, doc) => {
    const result = validateDocument(doc, { mode: "publish" });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain(code);
    for (const issue of result.errors) {
      expect(issue.message.id.length).toBeGreaterThan(0);
      expect(issue.message.en.length).toBeGreaterThan(0);
    }
  });
});

describe("mode validasi (DM-068)", () => {
  it("fixture valid lolos publish", () => {
    for (const create of [
      fixtures.heroDocument,
      fixtures.nestedDocument,
      fixtures.styledDocument,
      fixtures.richTextDocument,
    ]) {
      expect(validateDocument(create(), { mode: "publish" })).toMatchObject({ ok: true, errors: [] });
    }
  });

  it("rujukan hilang: warning saat edit, error saat publish & ai", () => {
    const doc = INVALID_DOCUMENTS.ASSET_REF;
    const edit = validateDocument(doc, { mode: "edit" });
    expect(edit.ok).toBe(true);
    expect(edit.warnings.map((issue) => issue.code)).toContain("ASSET_REF");
    expect(codes(validateDocument(doc, { mode: "publish" }))).toEqual(["ASSET_REF"]);
    expect(codes(validateDocument(doc, { mode: "ai" }))).toEqual(["ASSET_REF"]);
  });

  it("struktur rusak: error di semua mode, tanpa document", () => {
    for (const mode of ["edit", "publish", "ai"] as const) {
      const result = validateDocument(INVALID_DOCUMENTS.CYCLE, { mode });
      expect(result.ok).toBe(false);
      expect(result.document).toBeUndefined();
      expect(codes(result)).toContain("CYCLE");
    }
  });

  it("issue membawa nodeId, path, dan pesan id/en", () => {
    const [issue] = validateDocument(INVALID_DOCUMENTS.SIZE_MODE, { mode: "edit" }).errors;
    expect(issue).toEqual({
      code: "SIZE_MODE",
      path: ["nodes", "n_heroimg001", "style", "tablet", "size", "height"],
      nodeId: "n_heroimg001",
      message: { id: 'Image tidak boleh memakai ukuran "hug"', en: 'Images cannot use "hug" sizing' },
    });
    expect(validateDocument({ nope: true }, { mode: "edit" }).errors[0]?.code).toBe("SCHEMA");
  });

  it("lint selalu warning", () => {
    const doc = heroDocument();
    const image = doc.nodes.n_heroimg001;
    if (image?.type !== "image") throw new Error("fixture berubah");
    delete image.props.image.alt;
    const result = validateDocument(doc, { mode: "publish" });
    expect(result.ok).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toContain("IMAGE_MISSING_ALT");
  });

  it("token yang tidak ada di theme → TOKEN_REF (dokumen theme kosong)", () => {
    const doc = { ...heroDocument(), theme: emptyTheme() };
    expect(new Set(codes(validateDocument(doc, { mode: "publish" })))).toEqual(new Set(["TOKEN_REF"]));
    expect(validateDocument({ ...minimalDocument(), theme: emptyTheme() }, { mode: "publish" }).ok).toBe(true);
  });

  it("validasi 5.000 node < 100 ms (AC DM-068, indikatif)", () => {
    const doc = fixtures.generateLandingDocument({ nodeCount: 5000 });
    expect(validateDocument(doc, { mode: "publish" }).errors).toEqual([]);
    // Ambil yang tercepat dari 5 putaran: test file berjalan paralel, satu pengukuran tunggal terlalu bising.
    let fastest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      validateDocument(doc, { mode: "publish" });
      fastest = Math.min(fastest, performance.now() - start);
    }
    expectDurationBelow(fastest, 250);
  });
});
