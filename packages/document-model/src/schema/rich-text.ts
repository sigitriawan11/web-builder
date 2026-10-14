import { z } from "zod";
import { LinkValueSchema } from "./link";
import { ColorSchema, LengthSchema, tv } from "./values";

// Rich text node `text` (DM-013): JSON ProseMirror/Tiptap dengan schema terbatas — tanpa HTML mentah.
// `RICH_TEXT_SPEC` = satu sumber nama node/mark/atribut: editor membangun extension Tiptap darinya (document-model
// tidak boleh bergantung pada Tiptap). `hardBreak` hanya inline (di ProseMirror bukan blok tingkat dokumen).

export const RICH_TEXT_SPEC = {
  blocks: ["paragraph", "heading", "bulletList", "orderedList", "listItem"],
  inlines: ["text", "hardBreak"],
  marks: ["bold", "italic", "underline", "strike", "link", "textStyle"],
  textStyleAttrs: ["color", "fontWeight", "fontSize", "fontFamily"],
} as const;

const TextAlignSchema = z.enum(["left", "center", "right", "justify"]);

// `textStyle`: maksimal 4 atribut DM-013, minimal satu diisi.
const TextStyleAttrsSchema = z
  .strictObject({
    color: ColorSchema.optional(),
    fontWeight: z.number().int().min(100).max(900).multipleOf(100).optional(),
    fontSize: LengthSchema.optional(),
    fontFamily: tv(z.string().min(1).max(100)).optional(),
  })
  .refine((attrs) => Object.keys(attrs).length > 0, "textStyle tanpa atribut");

export const MarkSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("bold") }),
  z.strictObject({ type: z.literal("italic") }),
  z.strictObject({ type: z.literal("underline") }),
  z.strictObject({ type: z.literal("strike") }),
  z.strictObject({ type: z.literal("link"), attrs: z.strictObject({ link: LinkValueSchema }) }),
  z.strictObject({ type: z.literal("textStyle"), attrs: TextStyleAttrsSchema }),
]);

export const InlineSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("text"),
    text: z.string().min(1),
    marks: z
      .array(MarkSchema)
      .max(RICH_TEXT_SPEC.marks.length)
      .refine((marks) => new Set(marks.map((mark) => mark.type)).size === marks.length, "mark bertipe sama ganda")
      .optional(),
  }),
  z.strictObject({ type: z.literal("hardBreak") }),
]);

export type Mark = z.infer<typeof MarkSchema>;
export type Inline = z.infer<typeof InlineSchema>;

type TextAlign = z.infer<typeof TextAlignSchema>;
export type Block =
  | { type: "paragraph"; attrs?: { align?: TextAlign | undefined } | undefined; content?: Inline[] | undefined }
  | {
      type: "heading";
      attrs: { level: 1 | 2 | 3 | 4 | 5 | 6; align?: TextAlign | undefined };
      content?: Inline[] | undefined;
    }
  | { type: "bulletList"; content: ListItem[] }
  | { type: "orderedList"; attrs?: { start?: number | undefined } | undefined; content: ListItem[] };
export type ListItem = { type: "listItem"; content: Block[] };

const ListItemSchema: z.ZodType<ListItem> = z.lazy(() =>
  z.strictObject({ type: z.literal("listItem"), content: z.array(BlockSchema).min(1) }),
);

export const BlockSchema: z.ZodType<Block> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("paragraph"),
      attrs: z.strictObject({ align: TextAlignSchema.optional() }).optional(),
      content: z.array(InlineSchema).optional(),
    }),
    z.strictObject({
      type: z.literal("heading"),
      attrs: z.strictObject({ level: z.literal([1, 2, 3, 4, 5, 6]), align: TextAlignSchema.optional() }),
      content: z.array(InlineSchema).optional(),
    }),
    z.strictObject({ type: z.literal("bulletList"), content: z.array(ListItemSchema).min(1) }),
    z.strictObject({
      type: z.literal("orderedList"),
      // Tiptap selalu menulis `start` (default 1).
      attrs: z.strictObject({ start: z.number().int().min(0).max(100_000).optional() }).optional(),
      content: z.array(ListItemSchema).min(1),
    }),
  ]),
);

export const RichTextDocSchema = z.strictObject({
  type: z.literal("doc"),
  content: z.array(BlockSchema),
});

export type RichTextDoc = z.infer<typeof RichTextDocSchema>;
