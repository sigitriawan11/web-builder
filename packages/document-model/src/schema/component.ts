import { z } from "zod";
import { AssetRefSchema } from "./asset-ref";
import { LinkValueSchema } from "./link";
import { RichTextDocSchema } from "./rich-text";
import { StatesSchema, StylePatchSchema } from "./style";
import { ColorSchema, ComponentIdSchema, JsonValueSchema, NodeIdSchema } from "./values";

// Sistem component (DM-045–DM-049, Epic 3.1): props (DM-046), variants (DM-048), patch node (DM-049), nilai prop
// instance, dan envelope `ComponentDefinition` (DM-045). Validasi bentuk tiap node di dalam definisi (boleh `$prop`)
// + integritas (`$prop` ⊆ propsSchema, tanpa self-instance, rootId) ada di `validate/component.ts`.

// Label dwibahasa (ID default, EN) — dipakai label prop & option enum.
const LabelSchema = z.strictObject({ id: z.string().min(1).max(120), en: z.string().min(1).max(120) });

// Kunci prop / nama axis variant: camelCase.
export const CAMEL_KEY = /^[a-z][a-zA-Z0-9]*$/;

// ── Props schema (DM-046) ────────────────────────────────────────────────────

// Field bersama semua PropDef. `semanticRole`/`hiddenInSimple`/`order` = DM-079 (Simple mode M4).
const propBase = {
  key: z.string().min(1).max(64).regex(CAMEL_KEY, "key prop camelCase"),
  label: LabelSchema,
  description: z.string().max(400).optional(),
  required: z.boolean().optional(),
  group: z.string().max(64).optional(),
  semanticRole: z.string().max(64).optional(),
  hiddenInSimple: z.boolean().optional(),
  order: z.number().int().optional(),
  // CMP-016/DM-079: `default` = konten ID; `defaultI18n.en` = terjemahan EN (dipilih saat insert sesuai site.locale, M4).
  defaultI18n: z.strictObject({ en: JsonValueSchema }).optional(),
};

// NodeType yang boleh mengisi slot (DM-019); dipakai juga `PropDef.type==="slot"`.
export const SLOT_ALLOWED_TYPES = ["frame", "text", "image", "shape", "icon", "group", "instance"] as const;

// DM-046: tipe prop. `collectionBinding` (M7) ditambah bersama data dinamis. `list.itemSchema` rekursif → z.lazy.
export const PropDefSchema: z.ZodType = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      ...propBase,
      type: z.literal("text"),
      default: z.string(),
      maxLength: z.number().int().positive().optional(),
      multiline: z.boolean().optional(),
    }),
    z.strictObject({ ...propBase, type: z.literal("richText"), default: RichTextDocSchema }),
    z.strictObject({
      ...propBase,
      type: z.literal("number"),
      default: z.number(),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().positive().optional(),
    }),
    z.strictObject({ ...propBase, type: z.literal("boolean"), default: z.boolean() }),
    z.strictObject({
      ...propBase,
      type: z.literal("enum"),
      default: z.string(),
      options: z
        .array(z.strictObject({ value: z.string().min(1).max(64), label: LabelSchema }))
        .min(1)
        .max(24),
    }),
    z.strictObject({ ...propBase, type: z.literal("image"), default: AssetRefSchema.optional() }),
    z.strictObject({ ...propBase, type: z.literal("link"), default: LinkValueSchema.optional() }),
    z.strictObject({ ...propBase, type: z.literal("color"), default: ColorSchema }),
    z.strictObject({
      ...propBase,
      type: z.literal("icon"),
      default: z.strictObject({ set: z.enum(["lucide", "brand"]), name: z.string().min(1).max(64) }),
    }),
    z.strictObject({
      ...propBase,
      type: z.literal("slot"),
      allowedTypes: z.array(z.enum(SLOT_ALLOWED_TYPES)).optional(),
    }),
    z.strictObject({
      ...propBase,
      type: z.literal("list"),
      itemSchema: z.array(PropDefSchema).min(1),
      default: z.array(z.record(z.string(), JsonValueSchema)),
      minItems: z.number().int().nonnegative().optional(),
      maxItems: z.number().int().positive().optional(),
    }),
  ]),
) as z.ZodType<PropDef>;

type PropDefCommon = {
  key: string;
  label: { id: string; en: string };
  description?: string;
  required?: boolean;
  group?: string;
  semanticRole?: string;
  hiddenInSimple?: boolean;
  order?: number;
  defaultI18n?: { en: unknown };
};
export type PropDef = PropDefCommon &
  (
    | { type: "text"; default: string; maxLength?: number; multiline?: boolean }
    | { type: "richText"; default: z.infer<typeof RichTextDocSchema> }
    | { type: "number"; default: number; min?: number; max?: number; step?: number }
    | { type: "boolean"; default: boolean }
    | { type: "enum"; default: string; options: { value: string; label: { id: string; en: string } }[] }
    | { type: "image"; default?: z.infer<typeof AssetRefSchema> }
    | { type: "link"; default?: z.infer<typeof LinkValueSchema> }
    | { type: "color"; default: z.infer<typeof ColorSchema> }
    | { type: "icon"; default: { set: "lucide" | "brand"; name: string } }
    | { type: "slot"; allowedTypes?: (typeof SLOT_ALLOWED_TYPES)[number][] }
    | { type: "list"; itemSchema: PropDef[]; default: Record<string, unknown>[]; minItems?: number; maxItems?: number }
  );

// ── Alamat override & patch node (DM-049) ────────────────────────────────────

// NodePath: ID node di definisi, atau rantai `a/b/c` untuk node di dalam instance bersarang.
export const NodePathSchema = z.string().regex(/^n_[0-9a-z]{6,24}(\/n_[0-9a-z]{6,24})*$/, "NodePath (n_… atau a/b/c)");

// NodePatch: perubahan yang boleh diterapkan variant/override. Struktur (type/tag/children) & `name` tidak bisa
// di-override (DM-049). `props` = subset key per tipe (text.content, image.image, frame.link, icon.name, …) yang
// dicek saat resolusi; interaction/link instance HANYA via prop `link` (OPEN-DM-7, usulan spec).
export const NodePatchSchema = z.strictObject({
  style: z
    .strictObject({
      base: StylePatchSchema.optional(),
      tablet: StylePatchSchema.optional(),
      mobile: StylePatchSchema.optional(),
    })
    .optional(),
  states: StatesSchema.optional(),
  props: z.record(z.string(), JsonValueSchema).optional(),
  visible: z.boolean().optional(),
});
export type NodePatch = z.infer<typeof NodePatchSchema>;

// ── Variants (DM-048) ────────────────────────────────────────────────────────

export const VariantAxisSchema = z
  .strictObject({
    name: z.string().min(1).max(64).regex(CAMEL_KEY, "nama axis camelCase"),
    options: z.array(z.string().min(1).max(64)).min(1).max(6),
    default: z.string(),
  })
  .refine((axis) => axis.options.includes(axis.default), {
    message: "default harus salah satu option",
    path: ["default"],
  });
export type VariantAxis = z.infer<typeof VariantAxisSchema>;

export const VariantRuleSchema = z.strictObject({
  // Subset kombinasi axis; `{}` tidak boleh (harus mengikat minimal satu axis).
  when: z
    .record(z.string(), z.string())
    .refine((when) => Object.keys(when).length > 0, { message: "when tidak boleh kosong" }),
  overrides: z.record(NodePathSchema, NodePatchSchema),
});
export type VariantRule = z.infer<typeof VariantRuleSchema>;

// ── Nilai prop instance (site) ───────────────────────────────────────────────

// Nilai literal (boleh token lewat ColorSchema); `$prop` TIDAK diizinkan di site (hanya di ComponentDefinition).
// Validasi dalam terhadap `propsSchema` versi yang dirujuk dilakukan saat resolusi (DM-046), bukan di sini.
export const PropValueSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    RichTextDocSchema,
    AssetRefSchema,
    LinkValueSchema,
    ColorSchema,
    z.strictObject({ set: z.enum(["lucide", "brand"]), name: z.string().min(1).max(64) }),
    z.array(z.record(z.string(), PropValueSchema)),
  ]),
);

// ── ComponentDefinition (DM-045) ─────────────────────────────────────────────

// Versi format ComponentDefinition (DM-071), TERPISAH dari schemaVersion dokumen site (yang kini 8). Naikkan +
// tulis migrasi component bila bentuk ComponentDefinition berubah.
export const CURRENT_COMPONENT_SCHEMA_VERSION = 1;

export const ComponentCategorySchema = z.enum([
  "navbar",
  "hero",
  "section",
  "card",
  "button",
  "form",
  "footer",
  "pricing",
  "testimonial",
  "gallery",
  "table",
  "dashboard",
  "sidebar",
  "icon",
  "other",
]);
export type ComponentCategory = z.infer<typeof ComponentCategorySchema>;

// DM-079/CMP-024: izin node di Simple mode. `hardLocked` = tak bisa di-override bahkan di Design mode.
export const NodeAccessSchema = z.strictObject({
  simpleAccess: z.enum(["locked", "content", "visibility", "style-basic"]).optional(),
  hardLocked: z.boolean().optional(),
});
export type NodeAccess = z.infer<typeof NodeAccessSchema>;

// Envelope ComponentDefinition. `nodes` divalidasi STRUKTUR di sini (record<NodeId, JSON>), tetapi bentuk tiap node
// (boleh `$prop`/slot) + integritas (`$prop` ⊆ propsSchema, tanpa self-instance, rootId, slotName unik) dicek oleh
// `validateComponentDefinition()` — mirror SiteDocumentSchema (struktur) + validateDocument (invariant).
export const ComponentDefinitionSchema = z.strictObject({
  // Versi format ComponentDefinition sendiri (DM-071), terpisah dari schemaVersion dokumen site.
  schemaVersion: z.number().int().positive(),
  id: ComponentIdSchema,
  version: z.number().int().positive(),
  name: z.string().min(1).max(120),
  category: ComponentCategorySchema,
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  aiHints: z.strictObject({ whenToUse: z.string().min(1).max(500), doNot: z.string().max(500).optional() }).optional(),
  propsSchema: z.array(PropDefSchema).max(50),
  variantAxes: z.array(VariantAxisSchema).max(4).optional(),
  variants: z.array(VariantRuleSchema).max(32).optional(),
  rootId: NodeIdSchema,
  nodes: z.record(NodeIdSchema, JsonValueSchema),
  // DM-079/CMP-024: izin Simple mode per node. Default (node tak terdaftar) = "locked" kecuali node ber-`$prop`.
  nodeAccess: z.record(NodeIdSchema, NodeAccessSchema).optional(),
  thumbnail: AssetRefSchema.optional(),
  // Gating paket (DM-045): komponen yang butuh fitur dinamis/commerce (03 O-1).
  requires: z.strictObject({ dynamic: z.boolean().optional(), commerce: z.boolean().optional() }).optional(),
});
export type ComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;
