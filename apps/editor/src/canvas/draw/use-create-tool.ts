import { type RefObject, useEffect } from "react";
import { selectionStore } from "../../store/selection-store";
import type { ToolId } from "../../tools/tool-store";
import { toolStore } from "../../tools/tool-store";
import { cameraStore } from "../camera-store";
import type { CanvasRuntime } from "../canvas-runtime";
import { screenPoint, screenToWorld } from "../geometry/coordinates";
import { drawRectFrom } from "./draw-geometry";
import { type DrawRect, drawStore } from "./draw-store";
import { type CreateContext, createFrame, createSection, createShape } from "./node-creators";

// ED-037/039/040: tool pembuat node berbasis drag. Aktif hanya saat tool creator dipilih; select/pan/marquee sudah
// di-gate ke toolnya sendiri sehingga tidak bentrok. Klik (< threshold) → ukuran default; drag → ukuran drag.
// Setelah membuat: node baru terseleksi & tool kembali ke Move (kecuali tool lock, P1).

const CLICK_THRESHOLD_PX = 2;
const DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  frame: { width: 100, height: 100 },
  rectangle: { width: 100, height: 100 },
  ellipse: { width: 100, height: 100 },
  section: { width: 0, height: 0 }, // section = full-width, tinggi preset (tidak dari drag)
};

type Creator = (context: CreateContext) => string | null;
const CREATORS: Partial<Record<ToolId, Creator>> = {
  frame: createFrame,
  section: createSection,
  rectangle: createShape("rect"),
  ellipse: createShape("ellipse"),
};

export const isCreatorTool = (tool: ToolId): boolean => tool in CREATORS;

export function useCreateTool(viewportRef: RefObject<HTMLElement | null>, runtime: CanvasRuntime): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let drawing: { pointerId: number; tool: ToolId; originWorld: { x: number; y: number } } | null = null;

    const worldAt = (event: PointerEvent) => {
      const rect = viewport.getBoundingClientRect();
      const world = screenToWorld(screenPoint(event.clientX, event.clientY), cameraStore.getState(), {
        left: rect.left,
        top: rect.top,
      });
      return { x: world.x, y: world.y };
    };

    // Parent tujuan (ED-037): frame/page terdalam di bawah titik; di luar → page aktif.
    const targetParent = (event: PointerEvent): string => {
      const hit = runtime.hitTest(event.clientX, event.clientY);
      for (const id of hit?.path ?? []) {
        const node = runtime.nodeStore.getNode(id);
        if (node && (node.type === "frame" || node.type === "page")) return id;
      }
      return runtime.pageId;
    };

    const onPointerDown = (event: PointerEvent) => {
      const tool = toolStore.getState().active;
      if (event.button !== 0 || !isCreatorTool(tool)) return;
      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      drawing = { pointerId: event.pointerId, tool, originWorld: worldAt(event) };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drawing || drawing.pointerId !== event.pointerId || drawing.tool === "section") return;
      drawStore
        .getState()
        .set(drawRectFrom(drawing.originWorld, worldAt(event), { square: event.shiftKey, fromCenter: event.altKey }));
    };

    const finish = (event: PointerEvent, commit: boolean) => {
      if (!drawing || drawing.pointerId !== event.pointerId) return;
      const session = drawing;
      drawing = null;
      drawStore.getState().set(null);
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      if (!commit) return;

      // ED-040: section selalu masuk page root (bukan frame di bawah pointer).
      const parentId = session.tool === "section" ? runtime.pageId : targetParent(event);
      const parent = runtime.nodeStore.getNode(parentId);
      const parentIsFlow = parent ? "children" in parent && resolveFlow(runtime, parentId) : false;
      const parentRect = runtime.geometry.store.getRect(parentId);
      const rawRect = drawRectFrom(session.originWorld, worldAt(event), {
        square: event.shiftKey,
        fromCenter: event.altKey,
      });
      const moved = rawRect.width >= CLICK_THRESHOLD_PX || rawRect.height >= CLICK_THRESHOLD_PX;
      const def = DEFAULT_SIZE[session.tool] ?? { width: 100, height: 100 };
      const worldRect: DrawRect = moved
        ? rawRect
        : { x: session.originWorld.x, y: session.originWorld.y, width: def.width, height: def.height };
      // Local terhadap parent (world − origin parent); fallback origin 0 bila belum terukur.
      const localRect: DrawRect = {
        ...worldRect,
        x: worldRect.x - (parentRect?.x ?? 0),
        y: worldRect.y - (parentRect?.y ?? 0),
      };

      runtime.undo.stopCapturing();
      const creator = CREATORS[session.tool];
      const created = creator?.({
        runtime,
        parentId,
        parentIsFlow,
        index: insertIndex(runtime, parentId, worldRect.y),
        rect: localRect,
      });
      if (created) selectionStore.getState().select([created]);
      // ED-037: kembali ke Move.
      toolStore.getState().dispatch({ type: "selectTool", tool: "select" });
    };

    const onPointerUp = (event: PointerEvent) => finish(event, true);
    const onPointerCancel = (event: PointerEvent) => finish(event, false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drawing) {
        drawing = null;
        drawStore.getState().set(null);
      }
    };

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [viewportRef, runtime]);
}

// Parent auto-layout flow? (node absolute tidak ikut flow).
function resolveFlow(runtime: CanvasRuntime, parentId: string): boolean {
  const node = runtime.nodeStore.getNode(parentId);
  if (!node) return false;
  // resolveStyle tidak di sini; cek style.base.layout langsung cukup untuk mode (base).
  const layout = node.style.base?.layout;
  return layout?.mode === "flex";
}

// Index sisip di parent flow berdasarkan posisi Y world (section di page root): jumlah anak yang tengahnya di atas Y.
function insertIndex(runtime: CanvasRuntime, parentId: string, worldY: number): number {
  const parent = runtime.nodeStore.getNode(parentId);
  if (!parent || !("children" in parent)) return 0;
  let index = 0;
  for (const childId of parent.children) {
    const rect = runtime.geometry.store.getRect(childId);
    if (rect && rect.y + rect.height / 2 < worldY) index++;
  }
  return index;
}
