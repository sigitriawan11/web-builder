// Store UI editor (ARCHITECTURE §5.2, T2.1.6): satu slice per concern, semuanya UI state — dokumen hanya di Y.Doc
// (dijaga `store-ui-only.test.ts` & dependency-cruiser). Viewport/kamera = `canvas/camera-store`, tool =
// `tools/tool-store` (dekat logika masing-masing).
export { cameraStore } from "../canvas/camera-store";
export { toolStore } from "../tools/tool-store";
export { BREAKPOINT_OPTIONS, breakpointStore } from "./breakpoint-store";
export { type ClipboardEntry, clipboardStore } from "./clipboard-store";
export { hoverStore } from "./hover-store";
export { interactionStore } from "./interaction-store";
export { previewStore } from "./preview-store";
export { selectionStore } from "./selection-store";
export { textEditingStore } from "./text-editing-store";
export { uiPreferencesStore } from "./ui-preferences";
