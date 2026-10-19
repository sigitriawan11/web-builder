import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type * as Y from "yjs";
import { z } from "zod";
import {
  heroDocument,
  minimalDocument,
  nestedDocument,
  richTextDocument,
  styledDocument,
} from "../../test/fixtures/basic-documents";
import { CURRENT_SCHEMA_VERSION, SiteDocumentSchema } from "../schema";
import { validateDocument } from "../validate/validate-document";
import { jsonToYDoc, YDOC_KEYS, yDocToJson } from "../yjs/mapping";
import { createDocumentUndoManager, systemOrigin, userOrigin } from "../yjs/origin";
import { MigrationError, migrateDocument, migrateYDoc } from "./index";

// T1.9.9: schemaVersion & migrasi berurutan (DM-071) + fixture per versi (DM-072).
const FIXTURES = new URL("../../fixtures/", import.meta.url);

function fixturesOf(version: number): [string, Record<string, unknown>][] {
  const dir = new URL(`v${version}/`, FIXTURES);
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => [file, JSON.parse(readFileSync(new URL(file, dir), "utf8")) as Record<string, unknown>]);
}

describe("fixture setiap versi lama → migrate → valid terkini (AC DM-072)", () => {
  for (let version = 0; version < CURRENT_SCHEMA_VERSION; version++) {
    it.each(fixturesOf(version))(`v${version}/%s`, (_, fixture) => {
      const result = migrateDocument(fixture);
      expect(result).toMatchObject({ fromVersion: version, toVersion: CURRENT_SCHEMA_VERSION });
      expect(result.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      const validation = validateDocument(result.document, { mode: "edit" });
      expect(validation.errors).toEqual([]);
      // Migrasi tidak menghapus data user: node, aset, urutan page tetap.
      expect(result.document.nodes).toEqual(fixture.nodes);
      expect(result.document.assets).toEqual(fixture.assets);
      expect(result.document.pageOrder).toEqual(fixture.pageOrder);
    });
  }

  it("v0 → v1 menambah settings (bahasa id, judul dari meta), defaultTheme, componentDeps", () => {
    const [, hero] = fixturesOf(0).find(([file]) => file === "hero.json") ?? [];
    const { document } = migrateDocument(hero);
    expect(document).toMatchObject({
      settings: { language: "id", seo: { titleTemplate: expect.stringContaining("Toko Kue Budi") } },
      theme: { tokens: { color: { primary: expect.any(String) } } },
      componentDeps: {},
    });
  });
});

describe("migrateDocument", () => {
  it.each([
    ["minimal", minimalDocument],
    ["hero", heroDocument],
    ["styled", styledDocument],
  ])("idempoten untuk dokumen terkini (%s)", (_, create) => {
    const doc = create();
    const result = migrateDocument(doc);
    expect(result.applied).toEqual([]);
    expect(result.document).toEqual(doc);
    expect(result.document).not.toBe(doc);
  });

  it("versi masa depan, bentuk tidak valid, migrasi hilang → MigrationError bertipe", () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof MigrationError ? error.code : "other";
      }
      return "none";
    };
    expect(code(() => migrateDocument({ ...minimalDocument(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 }))).toBe(
      "FUTURE_VERSION",
    );
    for (const input of [null, [], { schemaVersion: "1" }, { schemaVersion: -1 }, { schemaVersion: 1.5 }]) {
      expect(
        code(() => migrateDocument(input)),
        JSON.stringify(input),
      ).toBe("INVALID_DOCUMENT");
    }
    expect(code(() => migrateDocument({ schemaVersion: 0 }, {}))).toBe("MISSING_MIGRATION");
  });
});

describe("migrateYDoc (alur load server)", () => {
  function v0YDoc() {
    const doc = jsonToYDoc(heroDocument());
    doc.transact(() => {
      doc.getMap(YDOC_KEYS.meta).set("schemaVersion", 0);
      for (const key of [YDOC_KEYS.settings, YDOC_KEYS.theme, YDOC_KEYS.componentDeps]) {
        const map = doc.getMap(key);
        for (const name of [...map.keys()]) map.delete(name);
      }
    }, systemOrigin("import"));
    return doc;
  }

  it("menerapkan migrasi sebagai satu transaksi system/migration yang tidak bisa di-undo user", () => {
    const doc = v0YDoc();
    const undo = createDocumentUndoManager(doc, [userOrigin("s")]);
    const origins: unknown[] = [];
    doc.on("afterTransaction", (transaction: Y.Transaction) => origins.push(transaction.origin));

    expect(migrateYDoc(doc)).toEqual({
      fromVersion: 0,
      toVersion: CURRENT_SCHEMA_VERSION,
      applied: [0, 1, 2, 3, 4, 5],
    });
    expect(origins).toEqual([systemOrigin("migration")]);
    expect(undo.canUndo()).toBe(false);
    const migrated = SiteDocumentSchema.parse(yDocToJson(doc));
    expect(migrated.nodes).toEqual(heroDocument().nodes);
    // Sudah terkini → tanpa transaksi.
    expect(migrateYDoc(doc).applied).toEqual([]);
    expect(origins).toHaveLength(1);
  });
});

describe("fixture versi terkini & schema.lock.json (DM-071/DM-072)", () => {
  // v1 masih draft selama M1 (keputusan owner 2026-10-14): fixture & lock diperbarui dengan `test -u` sampai dibekukan.
  it.each([
    ["blank", minimalDocument],
    ["hero", heroDocument],
    ["nested", nestedDocument],
    ["rich-text", richTextDocument],
    ["styled", styledDocument],
  ])(`v${CURRENT_SCHEMA_VERSION}/%s.json sesuai & valid`, async (name, create) => {
    expect(SiteDocumentSchema.safeParse(create()).success).toBe(true);
    await expect(`${JSON.stringify(create(), null, 2)}\n`).toMatchFileSnapshot(
      `../../fixtures/v${CURRENT_SCHEMA_VERSION}/${name}.json`,
    );
  });

  it("hash bentuk SiteDocumentSchema tercatat; perubahan bentuk wajib bump versi + migrasi atau disetujui sebagai aditif", async () => {
    // Refinement (invariant) tidak masuk JSON Schema — lock hanya menjaga BENTUK data.
    const shape = JSON.stringify(z.toJSONSchema(SiteDocumentSchema, { unrepresentable: "any" }));
    const hash = createHash("sha256").update(shape).digest("hex");
    await expect(
      `${JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, sha256: hash }, null, 2)}\n`,
    ).toMatchFileSnapshot("../../schema.lock.json");
  });
});
