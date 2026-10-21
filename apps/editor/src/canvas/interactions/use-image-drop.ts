import { type AssetEntry, createNode, registerAsset, runCommand } from "@platform/document-model";
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
  // Dipanggil setelah upload+daftar sukses — agar pustaka media (AssetsPanel) menyegarkan daftarnya.
  onUploaded?: () => void;
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
    insertImageNode(runtime, { assetId, entry, name: file.name, parentId });
    upload.onUploaded?.();
  } catch (error) {
    if (error instanceof UploadError) showToastText({ id: "Gagal mengunggah gambar", en: "Image upload failed" });
    else throw error;
  }
}

interface FixedDim {
  mode: "fixed";
  value: number;
  unit: "px";
}

/** Buat node image untuk asset yang SUDAH terdaftar/terupload — dipakai drop (setelah upload), pustaka media (ED-161)
 * & image tool (ED-045). Satu transaksi (registerAsset + createNode) = satu undo; node baru langsung terpilih.
 * `size`/`position` opsional (image tool memakai ukuran natural ter-clamp + posisi klik). */
export function insertImageNode(
  runtime: CanvasRuntime,
  input: {
    assetId: string;
    entry: AssetEntry;
    name: string;
    parentId: string;
    size?: { width: FixedDim; height: FixedDim };
    position?: { type: "absolute"; x: number; y: number };
  },
): string | null {
  const ctx = runtime.commandCtx;
  const size = input.size ?? { width: DEFAULT_SIZE, height: DEFAULT_HEIGHT };
  runtime.undo.stopCapturing();
  let newId: string | null = null;
  runtime.doc.transact(() => {
    runCommand(ctx, registerAsset, { id: input.assetId, entry: input.entry });
    const result = runCommand(ctx, createNode, {
      parentId: input.parentId,
      type: "image",
      name: input.name,
      props: { image: { assetId: input.assetId }, fit: "cover" },
      style: { base: { size, ...(input.position ? { position: input.position } : {}) } },
    });
    if (result.ok) newId = result.value;
  }, runtime.origin);
  runtime.undo.stopCapturing();
  if (newId) selectionStore.getState().select([newId]);
  return newId;
}
