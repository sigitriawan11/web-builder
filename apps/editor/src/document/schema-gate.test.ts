import { CURRENT_SCHEMA_VERSION, jsonToYDoc, YDOC_KEYS } from "@platform/document-model";
import { heroDocument } from "@platform/document-model/fixtures";
import { describe, expect, it, vi } from "vitest";
import { documentSchemaVersion, isNewerThanEditor, type ReloadStorage, reloadOnceForSchema } from "./schema-gate";

function memoryStorage(): ReloadStorage {
  let value: string | null = null;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
}

describe("schema gate (ED-230)", () => {
  it("membaca schemaVersion dari meta Y.Doc; lebih baru dari editor terdeteksi", () => {
    const doc = jsonToYDoc(heroDocument());
    expect(documentSchemaVersion(doc)).toBe(CURRENT_SCHEMA_VERSION);
    expect(isNewerThanEditor(CURRENT_SCHEMA_VERSION)).toBe(false);
    doc.getMap(YDOC_KEYS.meta).set("schemaVersion", CURRENT_SCHEMA_VERSION + 1);
    expect(isNewerThanEditor(documentSchemaVersion(doc))).toBe(true);
    expect(isNewerThanEditor(null)).toBe(false);
  });

  it("reload otomatis tepat sekali per versi (tanpa loop)", () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(reloadOnceForSchema(2, reload, storage)).toBe(true);
    expect(reloadOnceForSchema(2, reload, storage)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnceForSchema(3, reload, storage)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("storage tidak bisa ditulis → tidak reload otomatis", () => {
    const reload = vi.fn();
    expect(reloadOnceForSchema(2, reload, { get: () => null, set: () => {} })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
