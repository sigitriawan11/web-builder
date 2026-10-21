import { COMMANDS, runCommand, YDOC_KEYS, yDocToJson } from "@platform/document-model";
import { useEffect } from "react";
import type { Camera } from "../canvas/camera-store";
import { cameraStore } from "../canvas/camera-store";
import type { CanvasRuntime } from "../canvas/canvas-runtime";
import type { WorldRect } from "../canvas/geometry/geometry-store";
import { selectionStore } from "../store/selection-store";
import type { DocumentSession } from "./document-session";

/**
 * ED-242: test API editor — DEV ONLY (`import.meta.env.DEV`, tidak pernah ada di build production). Perubahan dokumen
 * lewat registry command document-model (`runCommand(nama, args)`) dengan origin lokal tab ini — jalur yang sama
 * dengan aksi user & AI, jadi assertion e2e berlaku untuk keduanya.
 */
export interface EditorTestApi {
  /** JSON dokumen saat ini (`yDocToJson`). */
  getDoc: () => unknown;
  select: (ids: string[]) => void;
  getSelection: () => readonly string[];
  getCamera: () => Camera;
  setCamera: (camera: Partial<Camera>) => void;
  /** Rect world node di frame aktif (null bila tidak ter-mount). */
  getGeometry: (id: string) => WorldRect | null;
  /** Jalankan command document-model by name; hasil `CommandResult` (ok/value atau error). */
  runCommand: (name: string, args: unknown) => unknown;
  // Status sesi (T1.15.7/T1.15.11).
  status: () => string;
  unsaved: () => boolean;
  // Seam test: dokumen dari editor lebih baru (ED-230; `meta` tidak punya command) & kesalahan render (ED-231).
  setSchemaVersion: (version: number) => void;
  crash: () => void;
}

declare global {
  interface Window {
    __editorTestApi?: EditorTestApi;
  }
}

export function useEditorTestHook(session: DocumentSession, runtime: CanvasRuntime, crash: () => void): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const ctx = runtime.commandCtx;
    window.__editorTestApi = {
      getDoc: () => yDocToJson(runtime.doc),
      select: (ids) => selectionStore.getState().select(ids),
      getSelection: () => selectionStore.getState().selectedIds,
      getCamera: () => {
        const { x, y, zoom } = cameraStore.getState();
        return { x, y, zoom };
      },
      setCamera: (camera) => cameraStore.getState().setCamera(camera),
      getGeometry: (id) => runtime.geometry.store.getRect(id),
      runCommand: (name, args) => {
        const command = (COMMANDS as Record<string, Parameters<typeof runCommand>[1]>)[name];
        if (!command) return { ok: false, error: { code: "UNKNOWN_COMMAND", name } };
        // Sama dengan UI: sesi read-only (lock/akses) tidak mengubah dokumen.
        if (runtime.isReadOnly()) return { ok: false, error: { code: "READ_ONLY" } };
        // Aksi diskrit (seperti commit drag): tidak digabung captureTimeout dengan aksi sebelumnya.
        runtime.undo.stopCapturing();
        return runCommand(ctx, command, args);
      },
      status: () => session.status(),
      unsaved: () => session.save.hasUnsaved(),
      setSchemaVersion: (version) => {
        runtime.doc.transact(() => runtime.doc.getMap(YDOC_KEYS.meta).set("schemaVersion", version), runtime.origin);
      },
      crash,
    };
    return () => {
      delete window.__editorTestApi;
    };
  }, [session, runtime, crash]);
}
