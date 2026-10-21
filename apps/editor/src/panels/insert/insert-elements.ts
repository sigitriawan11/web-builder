import { createInstance, createNode, runCommand, runCommands, setTag, step } from "@platform/document-model";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { selectionStore } from "../../store/selection-store";
import { toolStore } from "../../tools/tool-store";

// ED-050: elemen web dasar (Insert panel "Basic"). Button = frame role=button + teks; Divider = shape line full-width.
// Video/Map embed = node `video`/`embed` (spec 01: P1·M4 / P2·M9) → ditunda. Semua lewat command (bisa di-undo).

/** Parent sisip: frame/page terpilih, atau page aktif. */
function insertParent(runtime: CanvasRuntime): string {
  const selected = selectionStore.getState().selectedIds[0];
  const node = selected ? runtime.nodeStore.getNode(selected) : null;
  return node && (node.type === "frame" || node.type === "page") ? node.id : runtime.pageId;
}

const ctxOf = (runtime: CanvasRuntime) => runtime.commandCtx;

function afterInsert(id: string | null): void {
  if (id) selectionStore.getState().select([id]);
  toolStore.getState().dispatch({ type: "selectTool", tool: "select" });
}

/** Button: frame role=button (auto-layout row, padding, fill primary) berisi teks. Mengembalikan ID frame. */
export function insertButton(runtime: CanvasRuntime, label: string): string | null {
  runtime.undo.stopCapturing();
  const parentId = insertParent(runtime);
  const result = runCommands(ctxOf(runtime), (results) => {
    if (results.length === 0) {
      return step(createNode, {
        parentId,
        type: "frame",
        name: "Button",
        props: { role: "button" },
        style: {
          base: {
            size: { width: { mode: "hug" }, height: { mode: "hug" } },
            layout: {
              mode: "flex",
              direction: "row",
              align: "center",
              justify: "center",
              gap: { $token: "space.2" },
              padding: {
                top: { $token: "space.3" },
                bottom: { $token: "space.3" },
                left: { $token: "space.6" },
                right: { $token: "space.6" },
              },
            },
            fills: [{ type: "solid", color: { $token: "color.primary" } }],
            radius: { $token: "radius.md" },
            color: { $token: "color.onPrimary" },
          },
        },
      });
    }
    if (results.length === 1) {
      return step(createNode, {
        parentId: results[0] as string,
        type: "text",
        props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: label }] }] } },
        style: {
          base: { size: { width: { mode: "hug" }, height: { mode: "hug" } }, typography: { $token: "type.button" } },
        },
      });
    }
    return null;
  });
  const id = result.ok ? (result.value[0] as string) : null;
  afterInsert(id);
  return id;
}

/** Divider: shape line full-width, tinggi 1 px, warna border. */
export function insertDivider(runtime: CanvasRuntime): string | null {
  runtime.undo.stopCapturing();
  const parentId = insertParent(runtime);
  const result = runCommand(ctxOf(runtime), createNode, {
    parentId,
    type: "shape",
    name: "Divider",
    props: { shape: "line" },
    style: {
      base: {
        size: { width: { mode: "fill" }, height: { mode: "fixed", value: 1, unit: "px" } },
        fills: [{ type: "solid", color: { $token: "color.border" } }],
      },
    },
  });
  const id = result.ok ? result.value : null;
  afterInsert(id);
  return id;
}

// T3.6.1 (ED-151): sisip instance component library published ke parent terpilih/page aktif. `version` = version_seq
// (pin, CMP-050). Resolusi definisi untuk render terjadi di `InstanceNodeView` (publishedDefinition).
export function insertComponentInstance(
  runtime: CanvasRuntime,
  component: { publicId: string; version: number },
): string | null {
  runtime.undo.stopCapturing();
  const parentId = insertParent(runtime);
  const result = runCommand(ctxOf(runtime), createInstance, {
    parentId,
    componentId: component.publicId,
    version: component.version,
    source: "library",
  });
  const id = result.ok ? result.value : null;
  afterInsert(id);
  return id;
}

// Button/divider tidak pakai setTag (frame tag enum tak punya "button"; role=button + link = <a>, DM-011). setTag
// diimpor untuk konsistensi command bila elemen lain butuh tag khusus nanti.
void setTag;
