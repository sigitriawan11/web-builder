import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createBlankSiteDocument } from "../defaults/blank-site";
import { YDOC_KEYS } from "./mapping";
import { mergeDocumentUpdates, siteDocumentFromState, siteDocumentToState } from "./state";

describe("mergeDocumentUpdates", () => {
  it("snapshot + update berurutan = state terkini; update yang sudah tercakup aman diulang", () => {
    const snapshot = siteDocumentToState(createBlankSiteDocument({ title: "Lama" }));
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, snapshot);
    const updates: Uint8Array[] = [];
    ydoc.on("update", (update: Uint8Array) => updates.push(update));
    ydoc.getMap(YDOC_KEYS.meta).set("title", "Baru");
    ydoc.getMap(YDOC_KEYS.meta).set("createdWith", "template");

    const merged = mergeDocumentUpdates([snapshot, ...updates]);
    expect(siteDocumentFromState(merged).meta).toEqual({ title: "Baru", createdWith: "template" });
    // Update pertama diulang (sudah tercakup) → hasil sama.
    expect(siteDocumentFromState(mergeDocumentUpdates([snapshot, ...updates, ...updates])).meta.title).toBe("Baru");
  });

  it("tanpa update → state Y.Doc kosong; satu update dikembalikan apa adanya", () => {
    const state = siteDocumentToState(createBlankSiteDocument({ title: "X" }));
    expect(mergeDocumentUpdates([state])).toBe(state);
    expect(mergeDocumentUpdates([]).byteLength).toBeGreaterThan(0);
  });
});
