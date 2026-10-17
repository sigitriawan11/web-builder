import {
  type CommandContext,
  duplicateNodes,
  moveNode,
  type PositionStyle,
  resolveStyle,
  runCommand,
  runCommands,
  type StylePatch,
  step,
  updateStyle,
} from "@platform/document-model";
import { useEffect } from "react";
import type { NodeStore } from "../../document/node-store";
import { interactionStore } from "../../store/interaction-store";
import { previewStore } from "../../store/preview-store";
import { selectionStore } from "../../store/selection-store";
import { uiPreferencesStore } from "../../store/ui-preferences";
import { nodeLookupFrom } from "../../tools/select/node-lookup";
import { resolveClickSelection } from "../../tools/select/selection-depth";
import { unionBounds } from "../align";
import { cameraStore } from "../camera-store";
import { type Constraints, propagateConstraints } from "../constraints";
import { screenDeltaToWorld, screenPoint, screenToWorld } from "../geometry/coordinates";
import type { GeometryStore, WorldRect } from "../geometry/geometry-store";
import type { InteractionState } from "../interactions/interaction-machine";
import { computeSnap, type Rect } from "../snapping/snap";
import { moveDelta, movedPosition } from "./move";
import { absoluteDropPosition, type ChildBox, insertionMarker, reorderIndex } from "./reorder";
import { resizePatch, resizeRect } from "./resize";
import { clearPreviewTranslate, setPreviewTranslate } from "./transform-preview";

export interface DragSessionDeps {
  // Konteks op dengan origin lokal: commit masuk UndoManager sebagai satu langkah.
  opContext: CommandContext;
  geometry: GeometryStore;
  nodeStore: NodeStore;
  // Untuk reorder (ED-063): node di bawah pointer & posisi viewport (konversi screen → world).
  hitTest(clientX: number, clientY: number): { nodeId: string; path: readonly string[] } | null;
  viewportOffset(): { left: number; top: number };
  // Batas langkah undo di sekitar commit (ED-197: aksi diskrit tidak digabung captureTimeout).
  undoBoundary(): void;
}

type ResizeState = Extract<InteractionState, { type: "dragResize" }>;
type MoveState = Extract<InteractionState, { type: "dragMove" }>;

interface MoveItem {
  id: string;
  start: { x: number; y: number };
  element: Element | null;
}

// Tujuan drop reorder: ke container auto-layout (indeks) atau ke parent freeform (absolute, keepVisualPosition).
type ReorderTarget =
  | { kind: "flex"; parentId: string; index: number }
  | { kind: "absolute"; parentId: string; local: { x: number; y: number } };

// ED-063: satu anak auto-layout yang di-drag untuk diubah urutan/parent-nya.
interface ReorderSession {
  id: string;
  start: WorldRect;
  element: Element | null;
  target: ReorderTarget | null;
}

/**
 * ED-024: selama drag hanya ada preview sementara (tanpa Yjs); saat dilepas, SATU transaksi dokumen
 * (= satu update Yjs & satu langkah undo); Esc/pointercancel membuang preview tanpa menyentuh dokumen.
 * Resize (8 handle, T0.6.3) memakai override style sementara; pindah memakai `translate` sementara (T0.6.2).
 */
export function useDragSessions(deps: DragSessionDeps): void {
  useEffect(() => {
    // Rect awal node diukur sekali saat drag dimulai, bukan di setiap pointermove (AC ED-019).
    let resizing: { nodeId: string; start: WorldRect; position: PositionStyle | undefined } | null = null;

    // ED-065: patch style hasil resize; dipakai sama persis untuk preview & commit.
    const resizePatchFor = (state: ResizeState) => {
      if (!resizing || resizing.nodeId !== state.nodeId) {
        const start = deps.geometry.getRect(state.nodeId);
        const node = deps.nodeStore.getNode(state.nodeId);
        resizing =
          start && node ? { nodeId: state.nodeId, start, position: resolveStyle(node.style, "base").position } : null;
      }
      if (!resizing) return null;
      const delta = screenDeltaToWorld(
        state.current.x - state.origin.x,
        state.current.y - state.origin.y,
        cameraStore.getState().zoom,
      );
      // ED-066: Shift = aspect ratio, Alt = resize simetris dari pusat.
      const next = resizeRect(resizing.start, state.handle, delta, {
        aspect: state.shiftKey,
        fromCenter: state.altKey,
      });
      return resizePatch(resizing.start, next, state.handle, resizing.position);
    };

    // ED-062 + ED-038: drag pada node terseleksi memindahkan seluruh seleksi; drag pada node lain memilihnya
    // dulu (aturan kedalaman ED-051) lalu memindahkannya. Hanya node absolute & tidak terkunci yang bergerak;
    // anak auto-layout memakai reorder (T0.6.5).
    const lookup = nodeLookupFrom(deps.nodeStore);
    let moving: MoveItem[] | null = null;
    // ED-071: Alt ditahan saat mulai drag → lepas = duplikat di posisi tujuan (bukan memindah asli).
    let moveAlt = false;

    let reordering: ReorderSession | null = null;

    const flexLayoutOf = (id: string) => {
      const node = deps.nodeStore.getNode(id);
      if (!node || !("children" in node)) return null;
      const layout = resolveStyle(node.style, "base").layout;
      return layout?.mode === "flex" ? { node, direction: layout.direction, wrap: layout.wrap === true } : null;
    };

    // Node yang di-drag: seluruh seleksi bila yang ditekan ada di dalamnya, atau node hasil aturan kedalaman.
    const draggedIds = (state: MoveState): readonly string[] => {
      const { selectedIds, select } = selectionStore.getState();
      if (state.path.some((id) => selectedIds.includes(id))) return selectedIds;
      const target = resolveClickSelection(state.path, selectedIds, lookup);
      const ids = target ? [target] : [];
      select(ids);
      return ids;
    };

    // ED-063: satu anak non-absolute di parent auto-layout → reorder (multi-seleksi reorder: P1).
    const beginReorder = (ids: readonly string[]): ReorderSession | null => {
      const [id] = ids;
      const node = id && ids.length === 1 ? deps.nodeStore.getNode(id) : null;
      if (!id || !node?.parentId || node.locked) return null;
      if (resolveStyle(node.style, "base").position?.type === "absolute" || !flexLayoutOf(node.parentId)) return null;
      const start = deps.geometry.getRect(id);
      if (!start) return null;
      const element = deps.geometry.getElement(id);
      // Node asli tetap di tempat, redup 40% (ED-063); dipulihkan di endReorder.
      if (element instanceof HTMLElement) element.style.opacity = "0.4";
      return { id, start, element, target: null };
    };

    // Container terdalam di bawah pointer yang bukan node yang di-drag atau turunannya: flex → reorder,
    // freeform (page / frame non-flex) → absolute (keepVisualPosition). Section (role DM-011) hanya bisa
    // berada di page: section selebar page selalu "di dalam" section lain, sehingga tanpa aturan ini
    // section tidak pernah bisa diurutkan ulang (edge case ED-063).
    const dropContainer = (session: ReorderSession, state: MoveState) => {
      const hit = deps.hitTest(state.current.x, state.current.y);
      if (!hit) return null;
      const dragged = deps.nodeStore.getNode(session.id);
      const isSection = dragged?.type === "frame" && dragged.props.role === "section";
      const draggedIndex = hit.path.indexOf(session.id);
      const below = draggedIndex >= 0 ? hit.path.slice(draggedIndex + 1) : hit.path;
      const candidates = isSection ? below.filter((id) => deps.nodeStore.getNode(id)?.type === "page") : below;
      // Utamakan container auto-layout terdalam (reorder). Node non-flex transparan agar reorder ke parent
      // flex-nya tetap jalan (mis. drag di atas box kosong anak wrap).
      for (const containerId of candidates) {
        const flex = flexLayoutOf(containerId);
        if (flex) return { kind: "flex" as const, containerId, ...flex };
      }
      // Tidak ada parent auto-layout di jalur → keluar ke container freeform terdalam (page / frame non-flex)
      // sebagai absolute (keepVisualPosition).
      for (const containerId of candidates) {
        const node = deps.nodeStore.getNode(containerId);
        if (node && "children" in node) return { kind: "absolute" as const, containerId };
      }
      return null;
    };

    const updateReorder = (session: ReorderSession, state: MoveState) => {
      const delta = deltaFor(state);
      const ghost = { ...session.start, x: session.start.x + delta.dx, y: session.start.y + delta.dy };
      const previewGhostOnly = () => {
        session.target = null;
        previewStore.getState().setReorder({ ghost, marker: null });
      };
      const target = dropContainer(session, state);
      const containerRect = target ? deps.geometry.peekRect(target.containerId) : null;
      if (!target || !containerRect) return previewGhostOnly();

      // Keluar auto-layout ke parent freeform → absolute di posisi visual, tanpa marker.
      if (target.kind === "absolute") {
        session.target = {
          kind: "absolute",
          parentId: target.containerId,
          local: absoluteDropPosition(ghost, containerRect),
        };
        previewStore.getState().setReorder({ ghost, marker: null });
        return;
      }

      const siblings: ChildBox[] = target.node.children
        .filter((childId) => childId !== session.id)
        .flatMap((childId) => {
          const rect = deps.geometry.peekRect(childId);
          return rect ? [{ id: childId, rect }] : [];
        });
      const pointer = screenToWorld(
        screenPoint(state.current.x, state.current.y),
        cameraStore.getState(),
        deps.viewportOffset(),
      );
      const index = reorderIndex(siblings, pointer, target.direction, target.wrap);
      session.target = { kind: "flex", parentId: target.containerId, index };
      previewStore.getState().setReorder({
        ghost,
        marker: insertionMarker(siblings, index, target.direction, target.wrap, containerRect),
      });
    };

    // Commit drop reorder dalam SATU langkah undo (ED-024). Flex → moveNode ke indeks; absolute (keluar ke
    // freeform) → moveNode + updateStyle posisi absolute (keepVisualPosition) sebagai satu batch atomik.
    const commitReorder = (id: string, target: ReorderTarget) => {
      if (target.kind === "flex") {
        const node = deps.nodeStore.getNode(id);
        const parent = node?.parentId ? deps.nodeStore.getNode(node.parentId) : null;
        // Indeks akhir moveNode = indeks semula bila parent sama → drop di tempat asal tidak membuat
        // update Yjs maupun langkah undo kosong.
        const unchanged =
          target.parentId === node?.parentId &&
          parent &&
          "children" in parent &&
          parent.children.indexOf(id) === target.index;
        if (unchanged) return;
        deps.undoBoundary();
        runCommand(deps.opContext, moveNode, { id, newParentId: target.parentId, index: target.index });
        deps.undoBoundary();
        return;
      }
      const newParent = deps.nodeStore.getNode(target.parentId);
      const index = newParent && "children" in newParent ? newParent.children.length : 0;
      deps.undoBoundary();
      runCommands(deps.opContext, [
        step(moveNode, { id, newParentId: target.parentId, index }),
        step(updateStyle, {
          ids: [id],
          patch: { position: { type: "absolute", x: target.local.x, y: target.local.y } },
        }),
      ]);
      deps.undoBoundary();
    };

    const endReorder = () => {
      if (reordering?.element instanceof HTMLElement) reordering.element.style.removeProperty("opacity");
      reordering = null;
      previewStore.getState().setReorder(null);
    };

    const beginMove = (ids: readonly string[]): MoveItem[] => {
      return ids.flatMap((id) => {
        const node = deps.nodeStore.getNode(id);
        const position = node && !node.locked ? resolveStyle(node.style, "base").position : undefined;
        return position?.type === "absolute"
          ? [{ id, start: { x: position.x, y: position.y }, element: deps.geometry.getElement(id) }]
          : [];
      });
    };

    const deltaFor = (state: MoveState) =>
      moveDelta(state.origin, state.current, cameraStore.getState().zoom, state.shiftKey);

    // ED-073: kandidat snap = sibling (parent sama) + parent box, rect world dari geometry.
    const snapCandidates = (movingIds: readonly string[]): Rect[] => {
      const parentId = deps.nodeStore.getNode(movingIds[0] ?? "")?.parentId;
      if (!parentId) return [];
      const parent = deps.nodeStore.getNode(parentId);
      const rects: Rect[] = [];
      if (parent && "children" in parent) {
        for (const childId of parent.children) {
          if (movingIds.includes(childId)) continue;
          const rect = deps.geometry.peekRect(childId);
          if (rect) rects.push(rect);
        }
      }
      const parentRect = deps.geometry.peekRect(parentId);
      if (parentRect) rects.push(parentRect);
      return rects;
    };

    // ED-073: delta move + snap smart-guide. Snap dinonaktifkan sementara saat Alt (duplikat tetap snap) —
    // Mod-disable (ED-073) menyusul. Mengembalikan delta ter-snap & garis guide untuk overlay.
    const snappedMove = (
      state: MoveState,
    ): { dx: number; dy: number; guides: ReturnType<typeof computeSnap>["guides"] } => {
      const raw = deltaFor(state);
      const items = moving ?? [];
      const rects = items.flatMap((item) => {
        const rect = deps.geometry.peekRect(item.id);
        return rect ? [rect] : [];
      });
      const union = unionBounds(rects);
      if (!union) return { ...raw, guides: [] };
      const movingAt: Rect = { x: union.x + raw.dx, y: union.y + raw.dy, width: union.width, height: union.height };
      const snap = computeSnap(movingAt, snapCandidates(items.map((item) => item.id)), 5 / cameraStore.getState().zoom);
      return { dx: raw.dx + snap.dx, dy: raw.dy + snap.dy, guides: snap.guides };
    };

    const endMove = () => {
      for (const item of moving ?? []) if (item.element) clearPreviewTranslate(item.element);
      moving = null;
      previewStore.getState().setOffset(null);
      previewStore.getState().setGuides([]);
    };

    // ED-098: setelah frame freeform di-resize, reposisi/skalakan child absolute sesuai constraints masing-masing.
    const propagateConstraintsToChildren = (frameId: string, startRect: WorldRect, patch: StylePatch) => {
      const frame = deps.nodeStore.getNode(frameId);
      if (!frame || !("children" in frame)) return;
      // Auto-layout reflow sendiri; hanya frame freeform yang perlu propagasi.
      if (resolveStyle(frame.style, "base").layout?.mode === "flex") return;
      const dimValue = (dim: unknown): number | undefined =>
        dim && typeof dim === "object" && "value" in dim && typeof dim.value === "number" ? dim.value : undefined;
      const from = { width: startRect.width, height: startRect.height };
      const to = {
        width: dimValue(patch.size?.width) ?? startRect.width,
        height: dimValue(patch.size?.height) ?? startRect.height,
      };
      if (from.width === to.width && from.height === to.height) return;

      for (const childId of frame.children) {
        const child = deps.nodeStore.getNode(childId);
        const position = child ? resolveStyle(child.style, "base").position : undefined;
        if (position?.type !== "absolute") continue;
        const rect = deps.geometry.peekRect(childId);
        const box = { x: position.x, y: position.y, width: rect?.width ?? 0, height: rect?.height ?? 0 };
        const next = propagateConstraints(box, position.constraints as Constraints | undefined, from, to);
        const childPatch: StylePatch = { position: { x: next.x, y: next.y } };
        const size: NonNullable<StylePatch["size"]> = {};
        if (next.width !== box.width) size.width = { mode: "fixed", value: next.width, unit: "px" };
        if (next.height !== box.height) size.height = { mode: "fixed", value: next.height, unit: "px" };
        if (size.width || size.height) childPatch.size = size;
        runCommand(deps.opContext, updateStyle, { ids: [childId], patch: childPatch });
      }
    };

    const unsubscribeState = interactionStore.subscribe(({ state }) => {
      if (state.type === "dragResize") {
        const patch = resizePatchFor(state);
        if (patch) previewStore.getState().setStyle(state.nodeId, patch);
      } else if (state.type === "dragMove") {
        if (!moving && !reordering) {
          const ids = draggedIds(state);
          reordering = beginReorder(ids);
          moving = reordering ? [] : beginMove(ids);
          moveAlt = !reordering && state.altKey;
        }
        if (reordering) {
          updateReorder(reordering, state);
          return;
        }
        if (!moving || moving.length === 0) return;
        const { dx, dy, guides } = snappedMove(state);
        for (const item of moving) if (item.element) setPreviewTranslate(item.element, dx, dy);
        previewStore.getState().setOffset({ ids: moving.map((item) => item.id), dx, dy });
        previewStore.getState().setGuides(guides);
      }
    });

    const unsubscribeEffects = interactionStore.getState().onEffect((effect) => {
      if (effect.type === "click") return;
      const { drag } = effect;

      if (drag.type === "dragMove" && reordering) {
        const { id, target } = reordering;
        if (effect.type === "commit" && target) commitReorder(id, target);
        endReorder();
        moving = null;
        return;
      }

      if (drag.type === "dragMove") {
        const items = moving ?? [];
        const alt = moveAlt;
        if (effect.type === "commit" && items.length > 0) {
          const snap = snappedMove(drag);
          const delta = { dx: snap.dx, dy: snap.dy };
          deps.undoBoundary();
          if (alt) {
            // ED-071: Alt+drag → duplikat node (asli tetap) digeser ke posisi tujuan; satu command = satu undo.
            const result = runCommand(deps.opContext, duplicateNodes, {
              ids: items.map((item) => item.id),
              offset: { x: Math.round(delta.dx), y: Math.round(delta.dy) },
            });
            if (result.ok) {
              const idMap = (result.value as { idMap: Record<string, string> }).idMap;
              selectionStore.getState().select(items.map((item) => idMap[item.id] ?? item.id));
            }
          } else {
            // ED-074: snap pixel (default) → posisi bulat; nonaktif → subpixel dipertahankan.
            const snapToPixel = uiPreferencesStore.getState().snapToPixelGrid;
            // Semua node dalam SATU transaksi (= satu update Yjs & satu langkah undo, ED-024).
            deps.opContext.doc.transact(() => {
              for (const item of items) {
                runCommand(deps.opContext, updateStyle, {
                  ids: [item.id],
                  patch: { position: movedPosition(item.start, delta, snapToPixel) },
                });
              }
            }, deps.opContext.origin);
          }
          deps.undoBoundary();
        }
        endMove();
        moveAlt = false;
        return;
      }

      if (drag.type !== "dragResize") return;
      const startRect = resizing?.nodeId === drag.nodeId ? resizing.start : null;
      const patch = effect.type === "commit" ? resizePatchFor(drag) : null;
      resizing = null;
      // Commit dulu, baru buang preview: keduanya di-batch React, jadi tidak ada kedipan ukuran lama.
      if (patch) {
        deps.undoBoundary();
        deps.opContext.doc.transact(() => {
          runCommand(deps.opContext, updateStyle, { ids: [drag.nodeId], patch });
          // ED-098: parent di-resize → reposisi child absolute sesuai constraints (frame freeform).
          if (startRect) propagateConstraintsToChildren(drag.nodeId, startRect, patch);
        }, deps.opContext.origin);
        deps.undoBoundary();
      }
      previewStore.getState().clear([drag.nodeId]);
    });

    return () => {
      unsubscribeState();
      unsubscribeEffects();
      endMove();
      endReorder();
    };
  }, [deps]);
}
