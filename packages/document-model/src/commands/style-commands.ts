import { z } from "zod";
import { jsonEqual } from "../query/normalize-overrides";
import { LayoutSchema, NodeIdSchema, SiteSettingsSchema, StylePatchSchema } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { YDOC_KEYS } from "../yjs/mapping";
import { defineCommand, fail } from "./command";
import { BreakpointSchema, planStyles, writePlannedStyles } from "./style-plan";
import { patchBreakpoint } from "./update-style";
import { nodesMap, styleOf } from "./y-access";

// DM-074 style & layout. Semua lewat `planStyles` (validasi + invariant style node + normalisasi DM-036).

const OverrideBreakpointSchema = z.enum(["tablet", "mobile"]);

export const setLayoutMode = defineCommand({
  name: "setLayoutMode",
  description: {
    id: "Ganti layout container secara utuh (none = bebas/absolute, flex = auto-layout) di satu breakpoint.",
    en: "Replace a container's layout entirely (none = freeform/absolute, flex = auto-layout) at one breakpoint.",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, layout: LayoutSchema, breakpoint: BreakpointSchema.default("base") }),
  run(ctx, input) {
    const planned = planStyles(ctx, [input.id], (style) => ({
      ...style,
      // Layout diganti utuh (bukan merge per field) agar field mode lama tidak terbawa (DM-026).
      [input.breakpoint]: { ...(style[input.breakpoint] ?? {}), layout: input.layout },
    }));
    if (!Array.isArray(planned)) return planned;
    writePlannedStyles(planned);
    return { ok: true, value: undefined, affected: [input.id] };
  },
});

export const setBreakpointOverride = defineCommand({
  name: "setBreakpointOverride",
  description: {
    id: "Atur override style tablet/mobile satu node (patch sparse; null = kembali mewarisi).",
    en: "Set a node's tablet/mobile style override (sparse patch; null = inherit again).",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, breakpoint: OverrideBreakpointSchema, patch: StylePatchSchema }),
  run(ctx, input) {
    const planned = planStyles(ctx, [input.id], (style) => patchBreakpoint(style, input.breakpoint, input.patch));
    if (!Array.isArray(planned)) return planned;
    writePlannedStyles(planned);
    return { ok: true, value: undefined, affected: [input.id] };
  },
});

// `layout` atau `layout.gap`: grup style, opsional satu key di dalamnya.
const FieldSchema = z.string().regex(/^[a-zA-Z]+(\.[a-zA-Z]+)?$/, "field = grup style atau grup.key");

export const clearBreakpointOverrides = defineCommand({
  name: "clearBreakpointOverrides",
  description: {
    id: "Hapus override tablet/mobile (semua node bila ids kosong; bisa dibatasi breakpoint & field).",
    en: "Clear tablet/mobile overrides (all nodes when ids is empty; optionally limited to a breakpoint & fields).",
  },
  aiExposed: true,
  input: z.strictObject({
    ids: z.array(NodeIdSchema).min(1).optional(),
    breakpoint: OverrideBreakpointSchema.optional(),
    fields: z.array(FieldSchema).min(1).optional(),
  }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const ids = input.ids ?? [...nodes.keys()];
    const breakpoints = input.breakpoint ? [input.breakpoint] : (["tablet", "mobile"] as const);
    const planned = planStyles(ctx, ids, (style) => {
      const next = { ...style };
      for (const bp of breakpoints) {
        const patch = next[bp];
        if (!patch) continue;
        if (!input.fields) {
          delete next[bp];
          continue;
        }
        const cleared: Record<string, unknown> = cloneJson(patch);
        for (const field of input.fields) {
          const [group = "", key] = field.split(".");
          const value = cleared[group];
          if (key === undefined) delete cleared[group];
          else if (value && typeof value === "object" && !Array.isArray(value)) {
            delete (value as Record<string, unknown>)[key];
            if (Object.keys(value).length === 0) delete cleared[group];
          }
        }
        next[bp] = cleared;
      }
      return next;
    });
    if (!Array.isArray(planned)) return planned;
    const changed = planned.filter(({ yNode, style }) => !jsonEqual(styleOf(yNode).toJSON(), style));
    writePlannedStyles(changed);
    return {
      ok: true,
      value: { cleared: changed.length },
      affected: changed.map(({ yNode }) => String(yNode.get("id"))),
    };
  },
});

export const setSettings = defineCommand({
  name: "setSettings",
  description: {
    id: "Ubah pengaturan situs (per key; objek seperti seo diganti utuh), divalidasi skema settings.",
    en: "Change site settings (per key; objects like seo are replaced whole), validated by the settings schema.",
  },
  aiExposed: true,
  input: z.strictObject({ patch: z.record(z.string(), z.unknown()) }),
  run(ctx, input) {
    const ySettings = ctx.doc.getMap<unknown>(YDOC_KEYS.settings);
    const current = ySettings.toJSON() as Record<string, unknown>;
    const parsed = SiteSettingsSchema.safeParse({ ...current, ...input.patch });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "INVALID_RESULT",
        { id: `Settings tidak valid: ${issue?.message}`, en: `Invalid settings: ${issue?.message}` },
        ["patch", ...(issue?.path.filter((key): key is string | number => typeof key !== "symbol") ?? [])],
      );
    }
    const next = parsed.data as Record<string, unknown>;
    // Atomik per key (DM-058): hanya key yang berubah yang ditulis.
    const changed = Object.keys(input.patch).filter((key) => !jsonEqual(current[key], next[key]));
    for (const key of changed) {
      if (next[key] === undefined) ySettings.delete(key);
      else ySettings.set(key, cloneJson(next[key]));
    }
    return { ok: true, value: { changed }, affected: [] };
  },
});
