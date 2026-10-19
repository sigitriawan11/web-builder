export {
  COMPONENT_YDOC_KEYS,
  componentDefToYDoc,
  createComponentYDoc,
  yDocToComponentDef,
} from "./component-mapping";
export { applyDraft, type DocumentFork, draftUpdate, forkDocument } from "./draft";
export { createSiteYDoc, jsonToYDoc, nodeRecordToYMap, YDOC_KEYS, yDocToJson, yNodeToJson } from "./mapping";
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
export {
  componentDefFromState,
  componentDefToState,
  mergeDocumentUpdates,
  siteDocumentFromState,
  siteDocumentToState,
} from "./state";
export {
  compactState,
  createJsonSnapshot,
  documentFromJsonSnapshot,
  type JsonSnapshot,
  loadDocument,
  restoreDocument,
  stateSizeAfterUpdate,
} from "./storage";
