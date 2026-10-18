import { type RefObject, useEffect } from "react";
import { cameraStore } from "../../canvas/camera-store";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { screenPoint, screenToWorld } from "../../canvas/geometry/coordinates";
import type { ImageUploadContext } from "../../canvas/interactions/use-image-drop";
import { insertImageNode } from "../../canvas/interactions/use-image-drop";
import { UploadError, uploadImage } from "../../services/upload/upload";
import { showToastText } from "../../store/toast-store";
import { toolStore } from "../tool-store";
import { imageStampStore, type PendingImage, readImageSize } from "./image-stamp-store";

// ED-045: image tool "stamp" — setelah file dipilih (toolbar), tiap klik di kanvas menaruh satu gambar (urut klik) di
// titik klik, ukuran natural ter-clamp ke lebar parent. Upload jalan di background; node muncul saat upload selesai.
// Aktif hanya saat tool = "image" & ada antrean; klik lain diteruskan ke tool biasa.

const MAX_WIDTH = 1200;
const FALLBACK = { width: 300, height: 200 };

function fixed(value: number) {
  return { mode: "fixed" as const, value, unit: "px" as const };
}

// Parent tujuan (ED-037): frame/page terdalam di bawah titik; di luar → page aktif.
function targetParent(runtime: CanvasRuntime, clientX: number, clientY: number): string {
  const hit = runtime.hitTest(clientX, clientY);
  for (const id of hit?.path ?? []) {
    const node = runtime.nodeStore.getNode(id);
    if (node && (node.type === "frame" || node.type === "page")) return id;
  }
  return runtime.pageId;
}

export function useImageTool(
  ref: RefObject<HTMLElement | null>,
  runtime: CanvasRuntime,
  upload: ImageUploadContext | undefined,
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || !upload) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (toolStore.getState().active !== "image") return;
      if (imageStampStore.getState().pending.length === 0) return;
      // Konsumsi klik ini (jangan sampai select tool ikut memproses).
      event.preventDefault();
      event.stopPropagation();
      if (upload.readOnly) return;
      const item = imageStampStore.getState().shift();
      if (!item) return;
      void place(runtime, upload, item, event.clientX, event.clientY);
      // Habis → kembali ke Move (ED-037).
      if (imageStampStore.getState().pending.length === 0) {
        toolStore.getState().dispatch({ type: "selectTool", tool: "select" });
      }
    };

    // Capture agar menang atas select tool (bubble) saat sedang menempel gambar.
    element.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      element.removeEventListener("pointerdown", onPointerDown, { capture: true });
      imageStampStore.getState().clear();
    };
  }, [ref, runtime, upload]);
}

async function place(
  runtime: CanvasRuntime,
  upload: ImageUploadContext,
  item: PendingImage,
  clientX: number,
  clientY: number,
): Promise<void> {
  const parentId = targetParent(runtime, clientX, clientY);
  const parent = runtime.nodeStore.getNode(parentId);
  const parentIsFlow = parent?.style.base?.layout?.mode === "flex";
  const parentRect = runtime.geometry.store.getRect(parentId);

  // Ukuran natural ter-clamp ke lebar parent (ED-045), aspect terjaga. Dibaca saat penempatan (timeout aman).
  const natural = await readImageSize(item.file);
  let width = natural.naturalWidth || FALLBACK.width;
  let height = natural.naturalHeight || FALLBACK.height;
  const maxWidth = Math.min(MAX_WIDTH, parentRect ? Math.round(parentRect.width) : MAX_WIDTH);
  if (width > maxWidth && width > 0) {
    height = Math.max(1, Math.round((height * maxWidth) / width));
    width = maxWidth;
  }
  const size = { width: fixed(width), height: fixed(height) };

  // Parent freeform → absolute di titik klik (bisa digeser); flow → child mengalir (tanpa posisi).
  let position: { type: "absolute"; x: number; y: number } | undefined;
  if (!parentIsFlow) {
    const rect = document.getElementById("editor-viewport")?.getBoundingClientRect();
    const world = screenToWorld(screenPoint(clientX, clientY), cameraStore.getState(), {
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
    });
    let x = Math.round(world.x - (parentRect?.x ?? 0) - width / 2);
    let y = Math.round(world.y - (parentRect?.y ?? 0) - height / 2);
    if (parentRect) {
      x = Math.max(0, Math.min(x, Math.round(parentRect.width) - width));
      y = Math.max(0, Math.min(y, Math.round(parentRect.height) - height));
    }
    position = { type: "absolute", x, y };
  }

  try {
    const { assetId, entry } = await uploadImage(item.file, { siteId: upload.siteId, assets: upload.assets });
    insertImageNode(runtime, {
      assetId,
      entry,
      name: item.file.name,
      parentId,
      size,
      ...(position ? { position } : {}),
    });
    upload.onUploaded?.();
  } catch (error) {
    if (error instanceof UploadError) showToastText({ id: "Gagal mengunggah gambar", en: "Image upload failed" });
    else throw error;
  }
}
