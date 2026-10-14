import {
  type CommandContext,
  createDocumentUndoManager,
  jsonToYDoc,
  type SiteDocument,
  SiteDocumentSchema,
  userOrigin,
  yDocToJson,
} from "../src";

// Y.Doc dari fixture + UndoManager yang hanya melacak origin lokal (DM-060).
export function setupDoc(fixture: SiteDocument) {
  const origin = userOrigin("test");
  const doc = jsonToYDoc(fixture);
  const undoManager = createDocumentUndoManager(doc, [origin], { captureTimeout: 0 });
  const ctx: CommandContext = { doc, origin };

  // Selalu divalidasi penuh: setiap command harus meninggalkan dokumen yang tetap valid.
  const read = (): SiteDocument => SiteDocumentSchema.parse(yDocToJson(doc));

  return { doc, ctx, undoManager, read };
}
