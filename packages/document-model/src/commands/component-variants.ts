import type * as Y from "yjs";
import { z } from "zod";
import { CAMEL_KEY, VariantAxisSchema } from "../schema/component";
import { cloneJson } from "../yjs/clone-json";
import { COMPONENT_YDOC_KEYS } from "../yjs/component-mapping";
import { defineCommand, fail } from "./command";

// CMP-030/DM-048: command variant axis untuk draft ComponentDefinition (Mode Admin). Axis = property varian
// (name camelCase, options 1-6, default ∈ options). VariantRule (delta override per kombinasi) + matriks canvas =
// follow-up. Beroperasi pada Y.Array `variantAxes`/`variants`.

const MAX_AXES = 4;
const axesArray = (doc: Y.Doc): Y.Array<unknown> => doc.getArray<unknown>(COMPONENT_YDOC_KEYS.variantAxes);
const variantsArray = (doc: Y.Doc): Y.Array<unknown> => doc.getArray<unknown>(COMPONENT_YDOC_KEYS.variants);

function axisIndex(doc: Y.Doc, name: string): number {
  const array = axesArray(doc);
  for (let i = 0; i < array.length; i++) {
    const axis = array.get(i) as { name?: unknown } | undefined;
    if (axis?.name === name) return i;
  }
  return -1;
}

// DM-048: tambah variant axis (name unik, maks 4).
export const addVariantAxis = defineCommand({
  name: "addVariantAxis",
  description: { id: "Tambah variant axis.", en: "Add a variant axis." },
  aiExposed: false,
  input: VariantAxisSchema,
  run(ctx, axis) {
    const array = axesArray(ctx.doc);
    if (array.length >= MAX_AXES)
      return fail("LIMIT_EXCEEDED", { id: `Maks ${MAX_AXES} axis`, en: `At most ${MAX_AXES} axes` }, ["name"]);
    if (axisIndex(ctx.doc, axis.name) >= 0)
      return fail("INVALID_TARGET", { id: `Axis "${axis.name}" sudah ada`, en: `Axis "${axis.name}" already exists` }, [
        "name",
      ]);
    array.push([cloneJson(axis)]);
    return { ok: true, value: axis.name, affected: [] };
  },
});

// Ganti definisi axis (identifikasi lewat `name`; ganti name belum didukung).
export const updateVariantAxis = defineCommand({
  name: "updateVariantAxis",
  description: { id: "Ubah variant axis.", en: "Update a variant axis." },
  aiExposed: false,
  input: z.strictObject({ name: z.string().min(1).max(64).regex(CAMEL_KEY), axis: VariantAxisSchema }),
  run(ctx, input) {
    if (input.axis.name !== input.name)
      return fail(
        "INVALID_INPUT",
        { id: "Ganti nama axis belum didukung", en: "Renaming an axis is not supported yet" },
        ["axis", "name"],
      );
    const index = axisIndex(ctx.doc, input.name);
    if (index < 0)
      return fail("NOT_FOUND", { id: `Axis "${input.name}" tidak ada`, en: `Axis "${input.name}" not found` }, [
        "name",
      ]);
    const array = axesArray(ctx.doc);
    array.delete(index, 1);
    array.insert(index, [cloneJson(input.axis)]);
    return { ok: true, value: input.axis.name, affected: [] };
  },
});

// Hapus axis + buang variant rules yang merujuknya (agar `when` tetap valid terhadap variantAxes).
export const removeVariantAxis = defineCommand({
  name: "removeVariantAxis",
  description: { id: "Hapus variant axis.", en: "Remove a variant axis." },
  aiExposed: false,
  input: z.strictObject({ name: z.string().min(1).max(64) }),
  run(ctx, input) {
    const index = axisIndex(ctx.doc, input.name);
    if (index < 0)
      return fail("NOT_FOUND", { id: `Axis "${input.name}" tidak ada`, en: `Axis "${input.name}" not found` }, [
        "name",
      ]);
    axesArray(ctx.doc).delete(index, 1);
    const rules = variantsArray(ctx.doc);
    for (let i = rules.length - 1; i >= 0; i--) {
      const rule = rules.get(i) as { when?: Record<string, unknown> } | undefined;
      if (rule?.when && input.name in rule.when) rules.delete(i, 1);
    }
    return { ok: true, value: undefined, affected: [] };
  },
});
