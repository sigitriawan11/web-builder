import { z } from "zod";
import { ResponsiveStyleSchema } from "./style";
import { AssetIdSchema, NodeIdSchema, PageIdSchema } from "./values";

const ChildIdSchema = z.string().regex(/^n_[0-9a-z]{6,24}$/);

// ── Rich text (DM-013, subset M0: paragraph, heading, hardBreak, mark dasar) ─

const TextAlignSchema = z.enum(["left", "center", "right", "justify"]);

export const MarkSchema = z.strictObject({
  type: z.enum(["bold", "italic", "underline", "strike"]),
});

export const InlineSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("text"),
    text: z.string().min(1),
    marks: z.array(MarkSchema).optional(),
  }),
  z.strictObject({ type: z.literal("hardBreak") }),
]);

export const BlockSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("paragraph"),
    attrs: z.strictObject({ align: TextAlignSchema.optional() }).optional(),
    content: z.array(InlineSchema).optional(),
  }),
  z.strictObject({
    type: z.literal("heading"),
    attrs: z.strictObject({
      level: z.literal([1, 2, 3, 4, 5, 6]),
      align: TextAlignSchema.optional(),
    }),
    content: z.array(InlineSchema).optional(),
  }),
]);

export const RichTextDocSchema = z.strictObject({
  type: z.literal("doc"),
  content: z.array(BlockSchema),
});

// ── Asset reference (DM-057) ───────────────────────────────────────────────

export const AssetRefSchema = z.strictObject({
  assetId: AssetIdSchema,
  alt: z.string().optional(),
  focalPoint: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

// ── Props per tipe ─────────────────────────────────────────────────────────

// DM-010: "/" untuk home, segmen lowercase atau segmen dinamis `[slug]`.
const PAGE_PATH_PATTERN =
  /^\/([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\])*(\/([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\]))*$|^\/$/;

export const PagePropsSchema = z.strictObject({
  path: z.string().regex(PAGE_PATH_PATTERN),
  title: z.string().min(1),
  isHome: z.boolean().optional(),
  seo: z
    .strictObject({
      title: z.string().optional(),
      description: z.string().optional(),
      noIndex: z.boolean().optional(),
    })
    .optional(),
});

export const FramePropsSchema = z.strictObject({
  role: z.enum(["section", "container", "card", "button", "list", "generic"]).optional(),
  clipContent: z.boolean().optional(),
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
});

// ── Node (DM-008, DM-009) ──────────────────────────────────────────────────

const baseShape = {
  name: z.string().min(1).max(80),
  visible: z.boolean(),
  locked: z.boolean(),
  style: ResponsiveStyleSchema,
};

const childrenShape = { children: z.array(ChildIdSchema).max(500) };

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
  tag: z
    .enum(["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "blockquote", "li", "label", "figcaption"])
    .optional(),
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

export const NodeSchema = z.discriminatedUnion("type", [
  PageNodeSchema,
  FrameNodeSchema,
  TextNodeSchema,
  ImageNodeSchema,
]);

export type RichTextDoc = z.infer<typeof RichTextDocSchema>;
export type AssetRef = z.infer<typeof AssetRefSchema>;
export type PageNode = z.infer<typeof PageNodeSchema>;
export type FrameNode = z.infer<typeof FrameNodeSchema>;
export type TextNode = z.infer<typeof TextNodeSchema>;
export type ImageNode = z.infer<typeof ImageNodeSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type NodeType = Node["type"];
export type ContainerNode = Extract<Node, { children: unknown }>;
