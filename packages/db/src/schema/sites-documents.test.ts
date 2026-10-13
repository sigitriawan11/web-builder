import { DocumentKindSchema, SiteStatusSchema } from "@platform/shared/contracts";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { documentKindEnum, documents, documentUpdates } from "./documents";
import { siteStatusEnum, sites } from "./sites";

describe("schema sites & documents (DM-078, ARCHITECTURE §6.3, §7)", () => {
  it("enum DB = schema contracts (status situs, jenis dokumen)", () => {
    expect(siteStatusEnum.enumValues).toEqual(SiteStatusSchema.options);
    expect(documentKindEnum.enumValues).toEqual(DocumentKindSchema.options);
  });

  it("isi situs tidak diduplikasi di tabel sites (bahasa, SEO, tema ada di dokumen)", () => {
    const columns = Object.keys(getTableColumns(sites));
    for (const duplicated of ["settings", "defaultLocale", "themeId", "liveDeploymentId", "isDynamic"]) {
      expect(columns).not.toContain(duplicated);
    }
  });

  it("document_updates append-only: PK identity, update bytea wajib, seq wajib", () => {
    const columns = getTableColumns(documentUpdates);
    expect(columns.id.getSQLType()).toBe("bigint");
    expect(columns.update.getSQLType()).toBe("bytea");
    expect(columns.seq.notNull).toBe(true);
    expect(getTableColumns(documents).lastSeq.default).toBe(0);
  });

  it("bytea: Uint8Array ↔ Buffer tanpa salinan bergeser (offset subarray dihormati)", () => {
    const column = getTableColumns(documentUpdates).update;
    const source = new Uint8Array([9, 8, 7, 6, 5]).subarray(1, 4);
    const driver = column.mapToDriverValue(source) as Buffer;
    expect(Buffer.isBuffer(driver)).toBe(true);
    expect(Array.from(driver)).toEqual([8, 7, 6]);
    const back = column.mapFromDriverValue(Buffer.from([1, 2, 3])) as Uint8Array;
    expect(Array.from(back)).toEqual([1, 2, 3]);
  });
});
