import { z } from "zod";
import { ColorSchema, LengthSchema } from "./values";

// Patch breakpoint (DM-036): setiap field opsional, dan `null` berarti "hapus override, kembali mewarisi".
// `null` sengaja hanya ada di patch, tidak pernah di `base`.
type PatchShape<S extends z.ZodRawShape> = {
  [K in keyof S]: z.ZodOptional<z.ZodNullable<S[K]>>;
};

function patchShape<S extends z.ZodRawShape>(shape: S): PatchShape<S> {
  const patched: Record<string, z.ZodType> = {};
  for (const [key, schema] of Object.entries(shape)) {
    patched[key] = z.optional(z.nullable(schema));
  }
  return patched as PatchShape<S>;
}

// ── Layout (DM-026, subset M0: none | flex) ────────────────────────────────

const paddingShape = {
  top: LengthSchema,
  right: LengthSchema,
  bottom: LengthSchema,
  left: LengthSchema,
};

// Padding sebagian valid; sisi yang tidak diisi = 0 (DM-026).
export const PaddingSchema = z.strictObject(paddingShape).partial();
const PaddingPatchSchema = z.strictObject(patchShape(paddingShape));

const flexShape = {
  direction: z.enum(["row", "column"]),
  wrap: z.boolean(),
  gap: LengthSchema,
  crossGap: LengthSchema,
  padding: PaddingSchema,
  align: z.enum(["start", "center", "end", "stretch", "baseline"]),
  justify: z.enum(["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly"]),
};

export const LayoutSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("none") }),
  z
    .strictObject({ mode: z.literal("flex"), ...flexShape })
    .partial()
    .required({
      mode: true,
      direction: true,
    }),
]);

// Layout di-merge per field; `padding` ikut deep merge (DM-036 aturan 1).
const LayoutPatchSchema = z.strictObject({
  mode: z.enum(["none", "flex"]).optional(),
  ...patchShape({ ...flexShape, padding: PaddingPatchSchema }),
});

// ── Sizing (DM-027) ────────────────────────────────────────────────────────

export const DimensionSchema = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("fixed"),
    value: z.number().nonnegative(),
    unit: z.enum(["px", "%", "vw", "vh", "rem"]),
  }),
  z.strictObject({ mode: z.literal("hug") }),
  z.strictObject({ mode: z.literal("fill") }),
]);

const sizeShape = {
  width: DimensionSchema,
  height: DimensionSchema,
  minWidth: LengthSchema,
  maxWidth: LengthSchema,
  minHeight: LengthSchema,
  maxHeight: LengthSchema,
  aspectRatio: z.number().positive(),
};

export const SizeSchema = z.strictObject(sizeShape).partial();
const SizePatchSchema = z.strictObject(patchShape(sizeShape));

// ── Position (DM-028, subset M0: flow | absolute; fixed/sticky P1) ──────────

const ConstraintsSchema = z.strictObject({
  horizontal: z.enum(["left", "right", "leftRight", "center", "scale"]),
  vertical: z.enum(["top", "bottom", "topBottom", "center", "scale"]),
});

export const PositionSchema = z.discriminatedUnion("type", [
  // Default: ikut layout parent.
  z.strictObject({ type: z.literal("flow") }),
  // Parent layout none (freeform), atau "absolute di dalam auto-layout" seperti Figma. x/y = px relatif parent.
  z.strictObject({
    type: z.literal("absolute"),
    x: z.number(),
    y: z.number(),
    constraints: ConstraintsSchema.optional(),
  }),
]);

// Position di-merge per field selama `type` sama; type berbeda → diganti utuh (DM-036 aturan 4).
const PositionPatchSchema = z.strictObject({
  type: z.enum(["flow", "absolute"]).optional(),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  constraints: ConstraintsSchema.nullable().optional(),
});

// ── Fills (DM-029, subset M0: solid) ───────────────────────────────────────

export const FillSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("solid"),
    color: ColorSchema,
    opacity: z.number().min(0).max(1).optional(),
    visible: z.boolean().optional(),
  }),
]);

// Index 0 = layer paling bawah (urutan Figma).
export const FillsSchema = z.array(FillSchema).max(8);

// ── Radius (DM-030) ────────────────────────────────────────────────────────

export const RadiusSchema = z.union([
  LengthSchema,
  z
    .strictObject({
      topLeft: LengthSchema,
      topRight: LengthSchema,
      bottomRight: LengthSchema,
      bottomLeft: LengthSchema,
    })
    .partial(),
]);

// ── Style & responsive (DM-036) ────────────────────────────────────────────

const styleShape = {
  layout: LayoutSchema,
  size: SizeSchema,
  position: PositionSchema,
  fills: FillsSchema,
  radius: RadiusSchema,
};

export const StyleSchema = z.strictObject(styleShape).partial();

// Array & nilai atomik di-replace utuh; objek (layout, size) di-merge per key.
export const StylePatchSchema = z.strictObject(
  patchShape({ ...styleShape, layout: LayoutPatchSchema, size: SizePatchSchema, position: PositionPatchSchema }),
);

export const ResponsiveStyleSchema = z.strictObject({
  base: StyleSchema,
  tablet: StylePatchSchema.optional(),
  mobile: StylePatchSchema.optional(),
});

export type Padding = z.infer<typeof PaddingSchema>;
export type LayoutStyle = z.infer<typeof LayoutSchema>;
export type Dimension = z.infer<typeof DimensionSchema>;
export type SizeStyle = z.infer<typeof SizeSchema>;
export type PositionStyle = z.infer<typeof PositionSchema>;
export type Fill = z.infer<typeof FillSchema>;
export type RadiusValue = z.infer<typeof RadiusSchema>;
export type Style = z.infer<typeof StyleSchema>;
export type StylePatch = z.infer<typeof StylePatchSchema>;
export type ResponsiveStyle = z.infer<typeof ResponsiveStyleSchema>;
