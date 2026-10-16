import { createNode, runCommand, runCommands, setTag, step } from "@platform/document-model";
import type { CanvasRuntime } from "../canvas-runtime";
import type { DrawRect } from "./draw-store";

// ED-039/040/041/042: pembuat node untuk tiap tool. `rect` = bounding box local terhadap parent (world − origin
// parent). Semua lewat command (origin tab → bisa di-undo). Mengembalikan ID node baru (atau null).

export interface CreateContext {
  runtime: CanvasRuntime;
  parentId: string;
  // true bila parent memakai auto-layout (flow) → node flow pada `index`; selain itu absolute pada `rect`.
  parentIsFlow: boolean;
  index: number;
  rect: DrawRect;
}

const ctxOf = (runtime: CanvasRuntime) => ({ doc: runtime.doc, origin: runtime.origin });

// Posisi/ukuran dari rect: flow → size fixed; freeform → absolute + size fixed.
function boxStyle(context: CreateContext, extra: Record<string, unknown> = {}) {
  const size = {
    width: { mode: "fixed" as const, value: Math.round(context.rect.width), unit: "px" as const },
    height: { mode: "fixed" as const, value: Math.round(context.rect.height), unit: "px" as const },
  };
  return context.parentIsFlow
    ? { base: { size, ...extra } }
    : {
        base: {
          size,
          position: { type: "absolute" as const, x: Math.round(context.rect.x), y: Math.round(context.rect.y) },
          ...extra,
        },
      };
}

/** ED-039: frame container (div). Fill transparan di dalam page, putih bila top-level (disederhanakan: selalu set). */
export function createFrame(context: CreateContext): string | null {
  const result = runCommand(ctxOf(context.runtime), createNode, {
    parentId: context.parentId,
    index: context.index,
    type: "frame",
    style: boxStyle(context, { fills: [{ type: "solid", color: "#FFFFFF" }] }),
  });
  return result.ok ? result.value : null;
}

/**
 * ED-044: text node. Klik (moved=false) → auto width (hug); drag → fixed width selebar drag, tinggi hug. Konten
 * awal kosong (langsung diedit; dihapus bila tetap kosong).
 */
export function createText(context: CreateContext, moved: boolean): string | null {
  const size = moved
    ? {
        width: { mode: "fixed" as const, value: Math.max(24, Math.round(context.rect.width)), unit: "px" as const },
        height: { mode: "hug" as const },
      }
    : { width: { mode: "hug" as const }, height: { mode: "hug" as const } };
  const base = context.parentIsFlow
    ? { size, typography: { $token: "type.body" } }
    : {
        size,
        position: { type: "absolute" as const, x: Math.round(context.rect.x), y: Math.round(context.rect.y) },
        typography: { $token: "type.body" },
      };
  const result = runCommand(ctxOf(context.runtime), createNode, {
    parentId: context.parentId,
    index: context.index,
    type: "text",
    props: { content: { type: "doc", content: [{ type: "paragraph" }] }, autoSize: moved ? "height" : "width" },
    style: { base },
  });
  return result.ok ? result.value : null;
}

/** ED-046: icon node (Lucide) dengan ukuran square dari drag/klik. */
export function createIcon(name: string): (context: CreateContext) => string | null {
  return (context) => {
    const side = Math.max(16, Math.round(Math.max(context.rect.width, context.rect.height)) || 24);
    const size = {
      width: { mode: "fixed" as const, value: side, unit: "px" as const },
      height: { mode: "fixed" as const, value: side, unit: "px" as const },
    };
    const base = context.parentIsFlow
      ? { size }
      : { size, position: { type: "absolute" as const, x: Math.round(context.rect.x), y: Math.round(context.rect.y) } };
    const result = runCommand(ctxOf(context.runtime), createNode, {
      parentId: context.parentId,
      index: context.index,
      type: "icon",
      props: { set: "lucide", name },
      style: { base },
    });
    return result.ok ? result.value : null;
  };
}

/** ED-041/042: shape (rect/ellipse) = node `shape`; fill default abu-abu. */
export function createShape(shape: "rect" | "ellipse"): (context: CreateContext) => string | null {
  return (context) => {
    const result = runCommand(ctxOf(context.runtime), createNode, {
      parentId: context.parentId,
      index: context.index,
      type: "shape",
      props: { shape },
      style: boxStyle(context, { fills: [{ type: "solid", color: "#D9D9D9" }] }),
    });
    return result.ok ? result.value : null;
  };
}

/**
 * ED-040: section full-width di page root + inner container (struktur `section > div.container`), auto-layout
 * vertikal. Satu transaksi (createNode section → createNode container). Mengembalikan ID section.
 */
export function createSection(context: CreateContext): string | null {
  const result = runCommands(ctxOf(context.runtime), (results) => {
    if (results.length === 0) {
      return step(createNode, {
        parentId: context.parentId,
        index: context.index,
        type: "frame",
        props: { role: "section" },
        style: {
          base: {
            size: { width: { mode: "fill" }, height: { mode: "fixed", value: 480, unit: "px" } },
            layout: {
              mode: "flex",
              direction: "column",
              align: "center",
              padding: {
                top: { $token: "space.16" },
                bottom: { $token: "space.16" },
                left: { $token: "space.6" },
                right: { $token: "space.6" },
              },
            },
          },
        },
      });
    }
    if (results.length === 1) {
      // Tag <section> pada node yang baru dibuat.
      return step(setTag, { id: results[0] as string, tag: "section" });
    }
    if (results.length === 2) {
      return step(createNode, {
        parentId: results[0] as string,
        type: "frame",
        props: { role: "container" },
        style: {
          base: {
            size: { width: { mode: "fill" }, maxWidth: { value: 1200, unit: "px" }, height: { mode: "hug" } },
            layout: { mode: "flex", direction: "column", gap: { $token: "space.6" } },
          },
        },
      });
    }
    return null;
  });
  return result.ok ? (result.value[0] as string) : null;
}
