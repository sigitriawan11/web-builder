import { createNode, registerAsset, runCommand } from "@platform/document-model";
import type { PlatformApi } from "@platform/sdk";
import { type RefObject, useEffect } from "react";
import { UploadError, uploadImage } from "../../services/upload/upload";
import { selectionStore } from "../../store/selection-store";
import { showToastText } from "../../store/toast-store";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-160: drag-drop gambar ke canvas → upload (presign/PUT/complete) → daftarkan asset + buat node image di container
// di titik jatuh. Hanya aktif di editor situs (butuh siteId & API); playground tidak mengoper deps → no-op.

export interface ImageUploadContext {
  siteId: string;
  assets: PlatformApi["assets"];
  readOnly: boolean;
}

const DEFAULT_SIZE = { mode: "fixed" as const, value: 300, unit: "px" as const };
const DEFAULT_HEIGHT = { mode: "fixed" as const, value: 200, unit: "px" as const };

function dropParent(runtime: CanvasRuntime, clientX: number, clientY: number): string {
  const hit = runtime.hitTest(clientX, clientY);
  const node = hit ? runtime.nodeStore.getNode(hit.nodeId) : null;
  if (node && "children" in node) return node.id; // dijatuhkan di dalam frame → jadi anaknya
  if (node?.parentId) return node.parentId; // di atas elemen → sibling-nya
  return runtime.pageId;
}

export function useImageDrop(
  ref: RefObject<HTMLElement | null>,
  runtime: CanvasRuntime,
  upload: ImageUploadContext | undefined,
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || !upload) return;

    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault(); // izinkan drop
    };
    const onDrop = (event: DragEvent) => {
      const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      if (upload.readOnly) return;
      const parentId = dropParent(runtime, event.clientX, event.clientY);
      for (const file of files) void placeImage(runtime, upload, file, parentId);
    };

    element.addEventListener("dragover", onDragOver);
    element.addEventListener("drop", onDrop);
    return () => {
      element.removeEventListener("dragover", onDragOver);
      element.removeEventListener("drop", onDrop);
    };
  }, [ref, runtime, upload]);
}

async function placeImage(
  runtime: CanvasRuntime,
  upload: ImageUploadContext,
  file: File,
  parentId: string,
): Promise<void> {
  try {
    const { assetId, entry } = await uploadImage(file, { siteId: upload.siteId, assets: upload.assets });
    const ctx = { doc: runtime.doc, origin: runtime.origin };
    runtime.undo.stopCapturing();
    let newId: string | null = null;
    runtime.doc.transact(() => {
      runCommand(ctx, registerAsset, { id: assetId, entry });
      const result = runCommand(ctx, createNode, {
        parentId,
        type: "image",
        name: file.name,
        props: { image: { assetId }, fit: "cover" },
        style: { base: { size: { width: DEFAULT_SIZE, height: DEFAULT_HEIGHT } } },
      });
      if (result.ok) newId = result.value;
    }, runtime.origin);
    runtime.undo.stopCapturing();
    if (newId) selectionStore.getState().select([newId]);
  } catch (error) {
    if (error instanceof UploadError) showToastText({ id: "Gagal mengunggah gambar", en: "Image upload failed" });
    else throw error;
  }
}
