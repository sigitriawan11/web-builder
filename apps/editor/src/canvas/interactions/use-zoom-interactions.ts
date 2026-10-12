import { type RefObject, useEffect } from "react";
import { cameraStore } from "../camera-store";
import { isEditableTarget } from "./pan";
import { nextZoomStep, wheelZoomFactor, zoomAtPoint, zoomKeyDirection } from "./zoom";

// Event gesture Safari (pinch trackpad); tidak ada di lib DOM TypeScript.
type SafariGestureEvent = Event & { scale: number; clientX: number; clientY: number };

// ED-027: Ctrl/⌘ + wheel & pinch trackpad (browser mengirim `wheel` + ctrlKey), gesture Safari,
// serta tombol `+`/`-` di tengah viewport.
export function useZoomInteractions(viewportRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const anchorFrom = (clientX: number, clientY: number) => {
      const rect = viewport.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const applyZoom = (anchor: { x: number; y: number }, nextZoom: number) => {
      const camera = cameraStore.getState();
      cameraStore.getState().setCamera(zoomAtPoint(camera, anchor, nextZoom));
    };

    // ED-027: wheel beruntun cepat → akumulasi faktor, terapkan sekali per frame.
    let pendingFactor = 1;
    let pendingAnchor = { x: 0, y: 0 };
    let frame = 0;
    const flushWheelZoom = () => {
      frame = 0;
      applyZoom(pendingAnchor, cameraStore.getState().zoom * pendingFactor);
      pendingFactor = 1;
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return; // pan: use-pan-interactions
      event.preventDefault();
      pendingFactor *= wheelZoomFactor(event.deltaY, event.deltaMode);
      pendingAnchor = anchorFrom(event.clientX, event.clientY);
      if (frame === 0) frame = requestAnimationFrame(flushWheelZoom);
    };

    // Safari mengirim pinch sebagai gesture event (scale relatif terhadap awal gesture).
    let gestureStartZoom = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStartZoom = cameraStore.getState().zoom;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as SafariGestureEvent;
      applyZoom(anchorFrom(gesture.clientX, gesture.clientY), gestureStartZoom * gesture.scale);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target instanceof HTMLElement ? event.target : null)) return;
      const direction = zoomKeyDirection(event);
      if (!direction) return;
      event.preventDefault(); // cegah zoom halaman bawaan browser (Ctrl + =/-)
      const center = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
      applyZoom(center, nextZoomStep(cameraStore.getState().zoom, direction));
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("gesturestart", onGestureStart);
    viewport.addEventListener("gesturechange", onGestureChange);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("gesturestart", onGestureStart);
      viewport.removeEventListener("gesturechange", onGestureChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [viewportRef]);
}
