import {
  COMMANDS,
  createBlankSiteDocument,
  createDocumentUndoManager,
  jsonToYDoc,
  userOrigin,
  yDocToJson,
} from "@platform/document-model";
import { describe, expect, it } from "vitest";
import { DraftSession } from "./draft-store";

// T3.13.3 (AI-120/122/061): draft store — fork per run, mutasi di draft (origin ai:<runId>), apply = 1 undo, discard.

const pageCount = (doc: ReturnType<typeof jsonToYDoc>): number =>
  (yDocToJson(doc) as { pageOrder: string[] }).pageOrder.length;

describe("DraftSession (AI-120/122)", () => {
  it("mutasi di draft TIDAK mengubah main sampai apply; apply = satu langkah undo", () => {
    const main = jsonToYDoc(createBlankSiteDocument({ title: "Test", language: "en" }));
    const userLocal = userOrigin("user-1");
    const undo = createDocumentUndoManager(main, [userLocal]);

    const session = new DraftSession(main, "run-1");
    const result = session.run(COMMANDS.createPage, { title: "About", path: "/about" });
    expect(result.ok).toBe(true);

    // Draft punya 2 page; main MASIH 1 (belum apply).
    expect(pageCount(session.draft)).toBe(2);
    expect(pageCount(main)).toBe(1);
    // Node baru tercatat di touched.
    expect(session.touchedNodeIds().length).toBeGreaterThan(0);

    // Apply → main jadi 2 page.
    session.apply(main, undo);
    expect(pageCount(main)).toBe(2);

    // SATU undo membatalkan seluruh perubahan AI.
    undo.undo();
    expect(pageCount(main)).toBe(1);
  });

  it("discard membuang draft tanpa menyentuh main", () => {
    const main = jsonToYDoc(createBlankSiteDocument({ title: "Test", language: "en" }));
    const session = new DraftSession(main, "run-2");
    session.run(COMMANDS.createPage, { title: "Blog", path: "/blog" });
    session.discard();
    expect(pageCount(main)).toBe(1);
  });
});
