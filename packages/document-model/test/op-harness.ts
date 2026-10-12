import * as Y from "yjs";
import { type OpContext, type SiteDocument, SiteDocumentSchema, YDOC_KEYS, jsonToYDoc, yDocToJson } from "../src";

// Y.Doc dari fixture + UndoManager yang hanya melacak origin lokal (DM-060).
export function setupDoc(fixture: SiteDocument) {
  const origin = { kind: "user", sessionId: "test" };
  const doc = jsonToYDoc(fixture);
  const undoManager = new Y.UndoManager(
    [YDOC_KEYS.meta, YDOC_KEYS.assets, YDOC_KEYS.pageOrder, YDOC_KEYS.nodes].map((key) =>
      key === YDOC_KEYS.pageOrder ? doc.getArray(key) : doc.getMap(key),
    ),
    { trackedOrigins: new Set([origin]), captureTimeout: 0 },
  );
  const ctx: OpContext = { doc, origin };

  // Selalu divalidasi penuh: setiap op harus meninggalkan dokumen yang tetap valid.
  const read = (): SiteDocument => SiteDocumentSchema.parse(yDocToJson(doc));

  return { doc, ctx, undoManager, read };
}
