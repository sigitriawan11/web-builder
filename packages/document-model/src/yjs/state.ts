import * as Y from "yjs";
import { type SiteDocument, SiteDocumentSchema } from "../schema";
import { jsonToYDoc, yDocToJson } from "./mapping";

// State Yjs biner dokumen (update penuh) untuk snapshot awal & muat ulang tanpa konsumen memegang Y.Doc sendiri
// (api/worker tidak perlu bergantung langsung pada yjs).

export function siteDocumentToState(doc: SiteDocument): Uint8Array {
  return Y.encodeStateAsUpdate(jsonToYDoc(doc));
}

/** State → JSON tervalidasi strict (state dari DB tidak dipercaya begitu saja). */
export function siteDocumentFromState(state: Uint8Array): SiteDocument {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, state);
  return SiteDocumentSchema.parse(yDocToJson(ydoc));
}

/**
 * Gabungkan update Yjs (snapshot + update berurutan) menjadi satu update tanpa memuat Y.Doc (ARCHITECTURE §7.3).
 * Update yang sudah tercakup snapshot aman diulang (Yjs idempoten).
 */
export function mergeDocumentUpdates(updates: readonly Uint8Array[]): Uint8Array {
  if (updates.length === 0) return Y.encodeStateAsUpdate(new Y.Doc());
  return updates.length === 1 && updates[0] ? updates[0] : Y.mergeUpdates([...updates]);
}
