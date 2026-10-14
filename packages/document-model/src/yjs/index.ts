export { applyDraft, type DocumentFork, draftUpdate, forkDocument } from "./draft";
export { createSiteYDoc, jsonToYDoc, YDOC_KEYS, yDocToJson, yNodeToJson } from "./mapping";
export {
  aiOrigin,
  createDocumentUndoManager,
  describeOrigin,
  type OriginDescription,
  REMOTE_ORIGIN,
  releaseAiOrigin,
  type SystemReason,
  systemOrigin,
  type TxOrigin,
  TxOriginSchema,
  UNDO_CAPTURE_TIMEOUT_MS,
  undoScope,
  userOrigin,
} from "./origin";
export { richTextToYXmlFragment, yXmlFragmentToRichText } from "./rich-text";
export { mergeDocumentUpdates, siteDocumentFromState, siteDocumentToState } from "./state";
export {
  compactState,
  createJsonSnapshot,
  documentFromJsonSnapshot,
  type JsonSnapshot,
  loadDocument,
  restoreDocument,
  stateSizeAfterUpdate,
} from "./storage";
