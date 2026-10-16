import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// T2.1.6 / ARCHITECTURE §5.2: Zustand store = UI state saja — dokumen (Y.Doc) tidak pernah disimpan di store. Import
// runtime `yjs` / `@platform/document-model` dari store dilarang (type-only boleh). Document-model juga dijaga
// dependency-cruiser (`editor-store-ui-only`); `yjs` hanya di sini karena parser depcruise tidak mencatatnya.
const dir = new URL(".", import.meta.url).pathname;
const sources = readdirSync(dir).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));

const RUNTIME_IMPORT = /^\s*import\s+(?!type\b)[^;]*?from\s+["'](yjs|@platform\/document-model)["']/m;

describe("store editor hanya UI state", () => {
  it.each(sources)("%s tidak import runtime yjs/document-model", (file) => {
    expect(readFileSync(`${dir}${file}`, "utf8")).not.toMatch(RUNTIME_IMPORT);
  });

  it("pola mendeteksi import runtime, membiarkan type-only", () => {
    expect('import * as Y from "yjs";').toMatch(RUNTIME_IMPORT);
    expect('import { Doc } from "yjs";').toMatch(RUNTIME_IMPORT);
    expect('import { jsonToYDoc } from "@platform/document-model";').toMatch(RUNTIME_IMPORT);
    expect('import type * as Y from "yjs";').not.toMatch(RUNTIME_IMPORT);
    expect('import type { Breakpoint } from "@platform/document-model";').not.toMatch(RUNTIME_IMPORT);
  });
});
