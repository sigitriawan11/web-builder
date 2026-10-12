import { type RefObject, useEffect } from "react";
import { cameraStore } from "../camera-store";
import { isEditableTarget, panCamera, startsPan, wheelToPanDelta } from "./pan";

const MIDDLE_BUTTON = 1;

// ED-026: pan lewat wheel/trackpad, Space + drag kiri, dan drag tombol tengah.
// Status Space disimpan lokal di sini; model tool umum (hand tool, tool sementara) menyusul di T0.3.5.
export function usePanInteractions(viewportRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let spaceHeld = false;
    let drag: { pointerId: number; lastX: number; lastY: number } | null = null;

    // Kursor grab/grabbing lewat atribut, agar tidak memicu render React.
    const syncCursor = () => {
      if (drag) viewport.dataset.pan = "active";
      else if (spaceHeld) viewport.dataset.pan = "ready";
      else delete viewport.dataset.pan;
    };

    const onWheel = (event: WheelEvent) => {
      // Selalu cegah default: scroll halaman, back-swipe, dan zoom halaman browser (pinch = ctrl+wheel).
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) return; // zoom: use-zoom-interactions
      const { dx, dy } = wheelToPanDelta(event, viewport.clientHeight);
      const camera = cameraStore.getState();
      camera.setCamera(panCamera(camera, dx, dy));
    };

    const onPointerDown = (event: PointerEvent) => {
      if (drag || !startsPan(event.button, spaceHeld)) return;
      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      drag = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
      syncCursor();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      const camera = cameraStore.getState();
      // Drag menggeser konten searah pointer (kebalikan dari scroll).
      camera.setCamera(panCamera(camera, -dx, -dy));
    };

    const endDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      drag = null;
      syncCursor();
    };

    // Cegah autoscroll (Windows) dan paste (Linux) bawaan tombol tengah.
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === MIDDLE_BUTTON) event.preventDefault();
    };
    const onAuxClick = (event: MouseEvent) => {
      if (event.button === MIDDLE_BUTTON) event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isEditableTarget(event.target instanceof HTMLElement ? event.target : null)) return;
      event.preventDefault(); // cegah halaman ikut scroll
      if (!spaceHeld) {
        spaceHeld = true;
        syncCursor();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spaceHeld = false;
      syncCursor();
    };
    // Keyup bisa hilang saat jendela kehilangan fokus (Alt+Tab sambil menahan Space).
    const onBlur = () => {
      spaceHeld = false;
      syncCursor();
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("mousedown", onMouseDown);
    viewport.addEventListener("auxclick", onAuxClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endDrag);
      viewport.removeEventListener("pointercancel", endDrag);
      viewport.removeEventListener("mousedown", onMouseDown);
      viewport.removeEventListener("auxclick", onAuxClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [viewportRef]);
}
