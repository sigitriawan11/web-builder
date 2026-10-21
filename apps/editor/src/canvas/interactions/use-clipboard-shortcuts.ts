import {
  createNode,
  deleteNodes,
  duplicateNodes,
  insertSubtree,
  type Node,
  runCommand,
  type Subtree,
  SubtreeSchema,
} from "@platform/document-model";
import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { UploadError, uploadImage, validateImageUpload } from "../../services/upload/upload";
import { clipboardStore } from "../../store/clipboard-store";
import { selectionStore } from "../../store/selection-store";
import { showToastText } from "../../store/toast-store";
import { cameraStore } from "../camera-store";
import type { CanvasRuntime } from "../canvas-runtime";
import { screenPoint, screenToWorld } from "../geometry/coordinates";
import { type ImageUploadContext, insertImageNode } from "./use-image-drop";

// ED-190/191/193: copy/cut/paste/paste-in-place/duplicate. Payload = subtree JSON (string). Mekanisme utama =
// clipboard store in-memory (andal, lintas-tab via system clipboard best-effort). Node di-rekonstruksi dengan ID baru
// (insertSubtree). Paste gambar dari luar menyusul bersama upload (Epic 2.12).
const MARKER = "data-platform-clipboard";

function ancestorSelected(getNode: (id: string) => Node | null, id: string, selected: Set<string>): boolean {
  let parent = getNode(id)?.parentId ?? null;
  while (parent) {
    if (selected.has(parent)) return true;
    parent = getNode(parent)?.parentId ?? null;
  }
  return false;
}

// Akar seleksi (buang node yang ancestornya juga terpilih) dalam urutan dokumen.
function selectionRoots(runtime: CanvasRuntime, ids: readonly string[]): string[] {
  const set = new Set(ids);
  const get = runtime.nodeStore.getNode;
  return ids.filter((id) => get(id) && get(id)?.type !== "page" && !ancestorSelected(get, id, set));
}

function serializeSubtree(runtime: CanvasRuntime, rootIds: readonly string[]): Subtree {
  const nodes: Record<string, Record<string, unknown>> = {};
  const add = (id: string) => {
    const node = runtime.nodeStore.getNode(id);
    if (!node || id in nodes) return;
    nodes[id] = node as unknown as Record<string, unknown>;
    if ("children" in node) for (const child of node.children) add(child);
  };
  for (const id of rootIds) add(id);
  return { rootIds: [...rootIds], nodes };
}

export function copy(runtime: CanvasRuntime): Subtree | null {
  const roots = selectionRoots(runtime, selectionStore.getState().selectedIds);
  if (roots.length === 0) return null;
  const subtree = serializeSubtree(runtime, roots);
  const payload = JSON.stringify(subtree);
  const origin = runtime.geometry.store.peekRect(roots[0] as string);
  clipboardStore.getState().set({
    payload,
    // siteId dari URL editor (/editor/:siteId) — dipakai nanti untuk paste lintas-situs (aset/token, ED-196).
    sourceSiteId: window.location.pathname.split("/editor/")[1]?.split("/")[0] ?? "",
    origin: origin ? { x: origin.x, y: origin.y } : null,
    copiedAt: Date.now(),
  });
  // Lintas-tab best-effort: payload disembunyikan di atribut HTML; teks biasa = konten teks.
  void writeSystemClipboard(payload).catch(() => {});
  return subtree;
}

async function writeSystemClipboard(payload: string): Promise<void> {
  if (!navigator.clipboard?.write) return;
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  const html = `<div ${MARKER}="${encoded}"></div>`;
  await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }) })]);
}

async function readSystemPayload(): Promise<string | null> {
  try {
    if (!navigator.clipboard?.read) return null;
    for (const item of await navigator.clipboard.read()) {
      if (!item.types.includes("text/html")) continue;
      const html = await (await item.getType("text/html")).text();
      const match = html.match(new RegExp(`${MARKER}="([^"]*)"`));
      if (match?.[1]) return decodeURIComponent(escape(atob(match[1])));
    }
  } catch {
    // izin ditolak / kosong → fallback store
  }
  return null;
}

function offsetRoots(subtree: Subtree, dx: number, dy: number): void {
  for (const rootId of subtree.rootIds) {
    const position = (
      subtree.nodes[rootId] as { style?: { base?: { position?: { type?: string; x?: number; y?: number } } } }
    )?.style?.base?.position;
    if (position?.type === "absolute") {
      position.x = (position.x ?? 0) + dx;
      position.y = (position.y ?? 0) + dy;
    }
  }
}

// Tujuan paste (ED-190): frame terpilih (bukan node yang dicopy) → ke dalamnya; node lain → sibling (parent sama);
// tanpa seleksi → page.
function pasteParent(runtime: CanvasRuntime, roots: Set<string>): string {
  const first = selectionStore.getState().selectedIds[0];
  const node = first ? runtime.nodeStore.getNode(first) : null;
  if (node?.type === "frame" && !roots.has(node.id)) return node.id;
  if (node?.parentId) return node.parentId;
  return runtime.pageId;
}

export async function paste(runtime: CanvasRuntime, inPlace: boolean, upload?: ImageUploadContext): Promise<void> {
  if (runtime.isReadOnly()) return;
  const raw = (await readSystemPayload()) ?? clipboardStore.getState().entry?.payload ?? null;
  // ED-190/T2.14.4: tanpa payload Platform → paste dari luar (gambar → upload+node image; teks → node text).
  if (!raw) {
    await pasteExternal(runtime, upload);
    return;
  }
  const parsed = SubtreeSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    await pasteExternal(runtime, upload);
    return;
  }
  const subtree = parsed.data;
  if (!inPlace) {
    const step = (clipboardStore.getState().pasteCount + 1) * 10;
    offsetRoots(subtree, step, step);
  }
  runtime.undo.stopCapturing();
  const result = runCommand(runtime.commandCtx, insertSubtree, {
    parentId: pasteParent(runtime, new Set(subtree.rootIds)),
    subtree,
  });
  runtime.undo.stopCapturing();
  if (result.ok) {
    clipboardStore.getState().notePaste();
    // Pilih hanya akar baru.
    selectionStore
      .getState()
      .select(subtree.rootIds.map((id) => result.value.idMap[id]).filter((v): v is string => !!v));
  } else {
    // ED-228: paste ditolak (mis. melewati batas node, DM-076) → toast error, dokumen tidak berubah (atomik).
    showToastText(result.error.message);
  }
}

// ED-190/T2.14.4: paste dari sumber luar. Gambar di clipboard → upload + node image; selain itu teks → node text.
async function pasteExternal(runtime: CanvasRuntime, upload: ImageUploadContext | undefined): Promise<void> {
  const file = upload ? await readClipboardImage() : null;
  if (file && upload) {
    if (validateImageUpload(file)) {
      showToastText({ id: "File gambar tidak didukung", en: "Unsupported image file" });
      return;
    }
    try {
      const { assetId, entry } = await uploadImage(file, { siteId: upload.siteId, assets: upload.assets });
      insertImageNode(runtime, { assetId, entry, name: file.name, parentId: pasteParent(runtime, new Set()) });
      upload.onUploaded?.();
    } catch (error) {
      if (error instanceof UploadError) showToastText({ id: "Gagal mengunggah gambar", en: "Image upload failed" });
      else throw error;
    }
    return;
  }
  const text = await readClipboardText();
  if (text.trim()) insertTextNode(runtime, text);
}

async function readClipboardImage(): Promise<File | null> {
  try {
    if (!navigator.clipboard?.read) return null;
    for (const item of await navigator.clipboard.read()) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (imageType) return new File([await item.getType(imageType)], "pasted-image", { type: imageType });
    }
  } catch {
    // izin ditolak / tak ada gambar → coba teks
  }
  return null;
}

async function readClipboardText(): Promise<string> {
  try {
    return (await navigator.clipboard?.readText?.()) ?? "";
  } catch {
    return "";
  }
}

// World point di tengah viewport (lokal terhadap parent) untuk menaruh node baru dari paste luar.
function viewportCenterLocal(runtime: CanvasRuntime, parentId: string): { x: number; y: number } {
  const rect = document.getElementById("editor-viewport")?.getBoundingClientRect();
  const center = screenPoint((rect?.left ?? 0) + (rect?.width ?? 0) / 2, (rect?.top ?? 0) + (rect?.height ?? 0) / 2);
  const world = screenToWorld(center, cameraStore.getState(), { left: rect?.left ?? 0, top: rect?.top ?? 0 });
  const parentRect = runtime.geometry.store.getRect(parentId);
  return { x: Math.round(world.x - (parentRect?.x ?? 0)), y: Math.round(world.y - (parentRect?.y ?? 0)) };
}

function insertTextNode(runtime: CanvasRuntime, text: string): void {
  const parentId = pasteParent(runtime, new Set());
  const parent = runtime.nodeStore.getNode(parentId);
  const parentIsFlow = parent?.style.base?.layout?.mode === "flex";
  // Tiap baris → satu paragraf; baris kosong = paragraf tanpa isi (schema: inline text wajib min 1 char).
  const content = {
    type: "doc" as const,
    content: text
      .split(/\r?\n/)
      .map((line) =>
        line.length > 0
          ? { type: "paragraph" as const, content: [{ type: "text" as const, text: line }] }
          : { type: "paragraph" as const },
      ),
  };
  const size = { width: { mode: "hug" as const }, height: { mode: "hug" as const } };
  const base = parentIsFlow
    ? { size, typography: { $token: "type.body" } }
    : {
        size,
        typography: { $token: "type.body" },
        position: { type: "absolute" as const, ...viewportCenterLocal(runtime, parentId) },
      };
  runtime.undo.stopCapturing();
  const result = runCommand(runtime.commandCtx, createNode, {
    parentId,
    type: "text",
    props: { content, autoSize: "width" },
    style: { base },
  });
  runtime.undo.stopCapturing();
  if (result.ok) selectionStore.getState().select([result.value]);
  else showToastText(result.error.message);
}

export function duplicate(runtime: CanvasRuntime): void {
  if (runtime.isReadOnly()) return;
  const roots = selectionRoots(runtime, selectionStore.getState().selectedIds);
  if (roots.length === 0) return;
  runtime.undo.stopCapturing();
  const result = runCommand(runtime.commandCtx, duplicateNodes, {
    ids: roots,
    offset: { x: 10, y: 10 },
  });
  runtime.undo.stopCapturing();
  if (result.ok) {
    selectionStore.getState().select(roots.map((id) => result.value.idMap[id]).filter((v): v is string => !!v));
  } else {
    showToastText(result.error.message);
  }
}

export function cut(runtime: CanvasRuntime): void {
  if (runtime.isReadOnly()) return;
  if (!copy(runtime)) return;
  const roots = selectionRoots(runtime, selectionStore.getState().selectedIds);
  runtime.undo.stopCapturing();
  const result = runCommand(runtime.commandCtx, deleteNodes, { ids: roots });
  runtime.undo.stopCapturing();
  if (result.ok) selectionStore.getState().clear();
  else showToastText(result.error.message);
}

export function useClipboardShortcuts(runtime: CanvasRuntime, upload?: ImageUploadContext): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event)) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.code === "KeyC" && !event.shiftKey) {
        copy(runtime);
      } else if (event.code === "KeyX" && !event.shiftKey) {
        cut(runtime);
      } else if (event.code === "KeyV") {
        event.preventDefault();
        void paste(runtime, event.shiftKey, upload); // Shift = paste in place (ED-191); upload = paste gambar luar
      } else if (event.code === "KeyD" && !event.shiftKey) {
        event.preventDefault();
        duplicate(runtime);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime, upload]);
}
