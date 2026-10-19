import { z } from "zod";
import { AssetRefSchema } from "./asset-ref";
import { LinkValueSchema } from "./link";
import { RichTextDocSchema } from "./rich-text";
import { ResponsiveStyleSchema } from "./style";
import { ComponentIdSchema, JsonValueSchema, NodeIdSchema, PageIdSchema, TemplateIdSchema } from "./values";

const ChildIdSchema = z.string().regex(/^n_[0-9a-z]{6,24}$/);

// ── Props per tipe ─────────────────────────────────────────────────────────

// DM-010: "/" untuk home, atau satu+ segmen lowercase / dinamis `[slug]` — tanpa segmen kosong (`//`) atau "/" di akhir.
const PAGE_PATH_PATTERN = /^\/$|^(\/([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\]))+$/;

// DM-010. `access`/`dynamic` (M7) dan `drafts` (P1 · M4, DM-080) ditambah bersama fiturnya.
export const PagePropsSchema = z.strictObject({
  // Unik per situs; tepat satu home di "/" (invariant di document.ts).
  path: z.string().max(200).regex(PAGE_PATH_PATTERN),
  title: z.string().min(1).max(80),
  isHome: z.boolean().optional(),
  // Meng-override `settings.seo` untuk halaman ini (AC DM-005).
  seo: z
    .strictObject({
      title: z.string().max(120).optional(),
      description: z.string().max(320).optional(),
      ogImage: AssetRefSchema.optional(),
      noIndex: z.boolean().optional(),
      canonical: z
        .url({ protocol: /^https?$/ })
        .max(2048)
        .optional(),
    })
    .optional(),
  // Editor-only: lebar artboard desktop (default 1440, settings.breakpoints).
  canvas: z.strictObject({ width: z.number().int().min(240).max(10_000).optional() }).optional(),
});

export const FramePropsSchema = z.strictObject({
  role: z.enum(["section", "container", "card", "button", "list", "generic"]).optional(),
  clipContent: z.boolean().optional(),
  // DM-011: frame berlink dirender sebagai <a> (card/tombol yang bisa diklik).
  link: LinkValueSchema.optional(),
});

export const TextPropsSchema = z.strictObject({
  content: RichTextDocSchema,
  autoSize: z.enum(["width", "height", "none"]).optional(),
  truncate: z.strictObject({ lines: z.number().int().positive() }).optional(),
});

export const ImagePropsSchema = z.strictObject({
  image: AssetRefSchema,
  fit: z.enum(["cover", "contain", "fill"]),
  decorative: z.boolean().optional(),
  loading: z.enum(["lazy", "eager"]).optional(),
  link: LinkValueSchema.optional(),
});

// DM-016: shape (rect/ellipse/line). Rect/ellipse dirender div + CSS; line (P1) = inline SVG. Warna/isi dari
// `style.fills`/`strokes`/`radius`.
export const ShapePropsSchema = z.strictObject({
  shape: z.enum(["rect", "ellipse", "line"]),
  line: z
    .strictObject({
      cap: z.enum(["butt", "round", "square"]),
      arrowStart: z.boolean().optional(),
      arrowEnd: z.boolean().optional(),
    })
    .optional(),
  link: LinkValueSchema.optional(),
});

// DM-015: ikon Lucide. Warna = `style.color`, ukuran = `style.size` (square).
// DM-015: set `lucide` (ikon umum) atau `brand` (logo merek, mis. Simple Icons — ED-163). `name` = slug kebab-case
// (lucide: nama ikon; brand: slug merek, mis. "whatsapp"). `strokeWidth` hanya berlaku untuk lucide.
export const IconPropsSchema = z.strictObject({
  set: z.enum(["lucide", "brand"]),
  // Slug lucide selalu diawali huruf; slug brand (Simple Icons) boleh diawali digit (mis. "1password", "500px").
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "nama ikon kebab-case"),
  strokeWidth: z.number().positive().max(8).optional(),
  link: LinkValueSchema.optional(),
});

// ── Node (DM-008, DM-009) ──────────────────────────────────────────────────

// Anchor publik (`#tentang-kami`): slug diawali huruf, unik per page (invariant di document.ts).
export const HtmlIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/, "htmlId harus slug [a-z0-9-] diawali huruf");

export const A11ySchema = z.strictObject({
  label: z.string().min(1).max(200).optional(),
  role: z
    .string()
    .regex(/^[a-z]+$/)
    .max(30)
    .optional(),
  hiddenFromScreenReader: z.boolean().optional(),
});

// Editor/AI-only, di-strip saat publish (DM-008). `ext` = namespace eksperimen: tidak divalidasi ketat (DM-004),
// tetapi tetap JSON murni (DM-002) agar aman di Yjs.
export const NodeMetadataSchema = z.strictObject({
  createdBy: z.enum(["user", "ai", "system", "template"]).optional(),
  aiNote: z.string().max(200).optional(),
  fromTemplate: z
    .strictObject({ templateId: TemplateIdSchema, version: z.number().int().positive(), nodeId: NodeIdSchema })
    .optional(),
  detachedFrom: z.strictObject({ componentId: ComponentIdSchema, version: z.number().int().positive() }).optional(),
  editor: z.strictObject({ collapsed: z.boolean().optional(), colorLabel: z.string().max(20).optional() }).optional(),
  ext: z.record(z.string(), JsonValueSchema).optional(),
});

// `states` (DM-040, P0 · M2), `interactions` (§12), `bindings`/`visibleWhen` (M7) ditambah bersama fiturnya.
const baseShape = {
  name: z.string().min(1).max(80),
  visible: z.boolean(),
  locked: z.boolean(),
  style: ResponsiveStyleSchema,
  htmlId: HtmlIdSchema.optional(),
  a11y: A11ySchema.optional(),
  metadata: NodeMetadataSchema.optional(),
};

// Batas jumlah anak (DM-076) diperiksa invariant `LIMITS` (pesan informatif + nama batas).
const childrenShape = { children: z.array(ChildIdSchema) };

// Hanya page yang boleh `parentId: null`; node lain selalu punya parent (DM-006).
export const PageNodeSchema = z.strictObject({
  ...baseShape,
  ...childrenShape,
  id: PageIdSchema,
  type: z.literal("page"),
  parentId: z.null(),
  tag: z.enum(["main"]).optional(),
  props: PagePropsSchema,
});

export const FrameNodeSchema = z.strictObject({
  ...baseShape,
  ...childrenShape,
  id: ChildIdSchema,
  type: z.literal("frame"),
  parentId: NodeIdSchema,
  tag: z
    .enum(["div", "section", "header", "footer", "nav", "article", "aside", "main", "ul", "ol", "li", "figure"])
    .optional(),
  props: FramePropsSchema,
});

export const TextNodeSchema = z.strictObject({
  ...baseShape,
  id: ChildIdSchema,
  type: z.literal("text"),
  parentId: NodeIdSchema,
  tag: z.enum(["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "blockquote", "li", "label", "figcaption"]).optional(),
  props: TextPropsSchema,
});

export const ImageNodeSchema = z.strictObject({
  ...baseShape,
  id: ChildIdSchema,
  type: z.literal("image"),
  parentId: NodeIdSchema,
  tag: z.enum(["img"]).optional(),
  props: ImagePropsSchema,
});

export const ShapeNodeSchema = z.strictObject({
  ...baseShape,
  id: ChildIdSchema,
  type: z.literal("shape"),
  parentId: NodeIdSchema,
  // Shape = elemen non-semantik; tag tetap div (line dirender svg oleh renderer, tanpa pilihan tag).
  tag: z.enum(["div"]).optional(),
  props: ShapePropsSchema,
});

export const IconNodeSchema = z.strictObject({
  ...baseShape,
  id: ChildIdSchema,
  type: z.literal("icon"),
  parentId: NodeIdSchema,
  tag: z.enum(["span"]).optional(),
  props: IconPropsSchema,
});

// DM-012: group — pembungkus tanpa style visual (fills/strokes/layout/padding ditolak invariant). Props kosong;
// anak selalu absolute relatif ke group. Container (punya children) seperti frame, tetapi non-semantik (tag div).
export const GroupNodeSchema = z.strictObject({
  ...baseShape,
  ...childrenShape,
  id: ChildIdSchema,
  type: z.literal("group"),
  parentId: NodeIdSchema,
  tag: z.enum(["div"]).optional(),
  props: z.strictObject({}),
});

export const NodeSchema = z.discriminatedUnion("type", [
  PageNodeSchema,
  FrameNodeSchema,
  TextNodeSchema,
  ImageNodeSchema,
  ShapeNodeSchema,
  IconNodeSchema,
  GroupNodeSchema,
]);

export type PageNode = z.infer<typeof PageNodeSchema>;
export type FrameNode = z.infer<typeof FrameNodeSchema>;
export type ShapeNode = z.infer<typeof ShapeNodeSchema>;
export type IconNode = z.infer<typeof IconNodeSchema>;
export type GroupNode = z.infer<typeof GroupNodeSchema>;
export type TextNode = z.infer<typeof TextNodeSchema>;
export type ImageNode = z.infer<typeof ImageNodeSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type NodeMetadata = z.infer<typeof NodeMetadataSchema>;
export type A11y = z.infer<typeof A11ySchema>;
export type NodeType = Node["type"];
export type ContainerNode = Extract<Node, { children: unknown }>;
