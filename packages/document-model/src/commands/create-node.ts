import { z } from "zod";
import { createId } from "../ids";
import { plainText } from "../query/rich-text";
import { NodeIdSchema, NodeSchema, type Style, StylePatchSchema, StyleSchema } from "../schema";
import { nodeToYMap } from "../yjs/mapping";
import { defineCommand, fail } from "./command";
import { exceeds, locate, pageNodeCount } from "./limits";
import { childrenOf, nodesMap } from "./y-access";

const CreatableTypeSchema = z.enum(["frame", "text", "image"]);
type CreatableType = z.infer<typeof CreatableTypeSchema>;

const MAX_ID_ATTEMPTS = 5;

// DM-027 AC: default ukuran node baru.
const DEFAULT_BASE_STYLE: Record<CreatableType, Style> = {
  frame: { size: { width: { mode: "fill" }, height: { mode: "hug" } } },
  text: { size: { width: { mode: "fill" }, height: { mode: "hug" } } },
  image: { size: { width: { mode: "fill" }, height: { mode: "fixed", value: 240, unit: "px" } } },
};

// Image tidak punya default props karena asset wajib dipilih pemanggil.
const DEFAULT_PROPS: Record<CreatableType, Record<string, unknown>> = {
  frame: {},
  text: { content: { type: "doc", content: [{ type: "paragraph" }] } },
  image: {},
};

const DEFAULT_NAME: Record<CreatableType, string> = { frame: "Frame", text: "Text", image: "Image" };

export const createNode = defineCommand({
  name: "createNode",
  description: {
    id: "Buat node baru (frame, teks, atau gambar) di dalam container pada posisi tertentu.",
    en: "Create a new node (frame, text, or image) inside a container at a given position.",
  },
  aiExposed: true,
  input: z.strictObject({
    parentId: NodeIdSchema,
    index: z.number().int().nonnegative().optional(),
    type: CreatableTypeSchema,
    name: z.string().min(1).max(80).optional(),
    style: z
      .strictObject({
        base: StyleSchema.optional(),
        tablet: StylePatchSchema.optional(),
        mobile: StylePatchSchema.optional(),
      })
      .optional(),
    props: z.record(z.string(), z.unknown()).optional(),
  }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const parent = nodes.get(input.parentId);
    if (!parent)
      return fail(
        "NOT_FOUND",
        { id: `Parent "${input.parentId}" tidak ditemukan`, en: `Parent "${input.parentId}" not found` },
        ["parentId"],
      );
    const siblings = childrenOf(parent);
    if (!siblings)
      return fail(
        "INVALID_TARGET",
        { id: `Parent "${input.parentId}" bukan container`, en: `Parent "${input.parentId}" is not a container` },
        ["parentId"],
      );

    // DM-007: ID dibuat di client, tetapi tetap dicek agar tidak bertabrakan.
    const idGen = ctx.idGen ?? createId;
    let id = idGen("n");
    for (let attempt = 1; nodes.has(id) && attempt < MAX_ID_ATTEMPTS; attempt++) id = idGen("n");
    if (nodes.has(id))
      return fail("INVALID_RESULT", {
        id: `Gagal membuat ID unik setelah ${MAX_ID_ATTEMPTS} percobaan`,
        en: `Failed to create a unique ID after ${MAX_ID_ATTEMPTS} attempts`,
      });

    const { style, type } = input;
    const parsed = NodeSchema.safeParse({
      id,
      type,
      name: input.name ?? DEFAULT_NAME[type],
      parentId: input.parentId,
      visible: true,
      locked: false,
      ...(type === "frame" ? { children: [] } : {}),
      style: {
        base: { ...DEFAULT_BASE_STYLE[type], ...style?.base },
        ...(style?.tablet ? { tablet: style.tablet } : {}),
        ...(style?.mobile ? { mobile: style.mobile } : {}),
      },
      props: { ...DEFAULT_PROPS[type], ...input.props },
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "INVALID_RESULT",
        { id: `Node ${type} tidak valid: ${issue?.message}`, en: `Invalid ${type} node: ${issue?.message}` },
        issue?.path.map(String),
      );
    }

    // DM-076: batas dicek sebelum menulis (tidak ada penulisan parsial).
    const { pageId, depth } = locate(nodes, input.parentId);
    const limitError =
      exceeds("childrenPerContainer", siblings.length + 1, ["parentId"]) ??
      exceeds("nodesPerSite", nodes.size + 1) ??
      exceeds("treeDepth", depth + 1, ["parentId"]) ??
      (pageId ? exceeds("nodesPerPage", pageNodeCount(nodes, pageId) + 1, ["parentId"]) : null) ??
      (parsed.data.type === "text"
        ? exceeds("textCharsPerNode", plainText(parsed.data.props.content).length, ["props", "content"])
        : null);
    if (limitError) return limitError;

    const index = Math.min(input.index ?? siblings.length, siblings.length);
    nodes.set(id, nodeToYMap(parsed.data));
    siblings.insert(index, [id]);
    return { ok: true, value: id, affected: [id, input.parentId] };
  },
});
