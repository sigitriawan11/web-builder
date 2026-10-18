import * as Y from "yjs";
import { z } from "zod";
import { plainText } from "../query/rich-text";
import {
  AssetEntrySchema,
  AssetIdSchema,
  AssetRefSchema,
  LinkValueSchema,
  NodeIdSchema,
  NodeSchema,
  normalizeLinkInput,
  type RichTextDoc,
  RichTextDocSchema,
} from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { YDOC_KEYS, yNodeToJson } from "../yjs/mapping";
import { richTextToYXmlFragment, yXmlFragmentToRichText } from "../yjs/rich-text";
import { type CommandContext, type CommandFailure, defineCommand, fail } from "./command";
import { exceeds, locate } from "./limits";
import { nodesMap, nodeType, type YNode } from "./y-access";

// DM-074 konten: teks, gambar, link, props per tipe. Semua divalidasi sebelum menulis.

const notFound = (id: string, path: (string | number)[] = ["id"]): CommandFailure =>
  fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, path);

function nodeOfType(ctx: CommandContext, id: string, types: readonly string[]): YNode | CommandFailure {
  const yNode = nodesMap(ctx.doc).get(id);
  if (!yNode) return notFound(id);
  if (!types.includes(nodeType(yNode))) {
    return fail(
      "INVALID_TARGET",
      {
        id: `Node "${id}" (${nodeType(yNode)}) bukan ${types.join("/")}`,
        en: `Node "${id}" (${nodeType(yNode)}) is not ${types.join("/")}`,
      },
      ["id"],
    );
  }
  return yNode;
}

const isFailure = (value: unknown): value is CommandFailure =>
  typeof value === "object" && value !== null && "ok" in value && value.ok === false;

/** String polos → satu paragraf; baris baru menjadi `hardBreak` (DM-074). */
export function plainToRichText(text: string): RichTextDoc {
  const lines = text.split(/\r?\n/);
  const content = lines.flatMap((line, index) => [
    ...(index > 0 ? [{ type: "hardBreak" as const }] : []),
    ...(line.length > 0 ? [{ type: "text" as const, text: line }] : []),
  ]);
  return { type: "doc", content: [{ type: "paragraph", ...(content.length > 0 ? { content } : {}) }] };
}

function contentFragment(yNode: YNode): Y.XmlFragment | undefined {
  const content = (yNode.get("props") as Y.Map<unknown> | undefined)?.get("content");
  return content instanceof Y.XmlFragment ? content : undefined;
}

export const setTextContent = defineCommand({
  name: "setTextContent",
  description: {
    id: "Ganti seluruh isi node teks (rich text JSON, atau string polos = satu paragraf).",
    en: "Replace a text node's whole content (rich text JSON, or plain string = one paragraph).",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, content: z.union([z.string().max(20_000), RichTextDocSchema]) }),
  run(ctx, input) {
    const yNode = nodeOfType(ctx, input.id, ["text"]);
    if (isFailure(yNode)) return yNode;
    const content = typeof input.content === "string" ? plainToRichText(input.content) : input.content;
    const limit = exceeds("textCharsPerNode", plainText(content).length, ["content"]);
    if (limit) return limit;
    const fragment = contentFragment(yNode);
    // Isi diganti DI TEMPAT: editor (y-tiptap) terikat pada instance Y.XmlFragment ini.
    if (fragment) {
      fragment.delete(0, fragment.length);
      richTextToYXmlFragment(content, fragment);
    } else {
      (yNode.get("props") as Y.Map<unknown>).set("content", richTextToYXmlFragment(content));
    }
    return { ok: true, value: undefined, affected: [input.id] };
  },
});

// Semua Y.XmlText di fragment (urutan dokumen).
function textRuns(fragment: Y.XmlFragment | Y.XmlElement, into: Y.XmlText[] = []): Y.XmlText[] {
  for (const child of fragment.toArray()) {
    if (child instanceof Y.XmlText) into.push(child);
    else if (child instanceof Y.XmlElement) textRuns(child, into);
  }
  return into;
}

export const replaceText = defineCommand({
  name: "replaceText",
  description: {
    id: "Cari & ganti teks di node teks dengan mempertahankan format (mark) teks yang diganti.",
    en: "Find & replace text in a text node, keeping the formatting (marks) of the replaced text.",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, find: z.string().min(1).max(1000), replace: z.string().max(5000) }),
  run(ctx, input) {
    const yNode = nodeOfType(ctx, input.id, ["text"]);
    if (isFailure(yNode)) return yNode;
    const fragment = contentFragment(yNode);
    if (!fragment) return { ok: true, value: { replaced: 0 }, affected: [] };

    // Rencanakan dulu (untuk cek batas), baru tulis dari belakang agar indeks tetap benar.
    const plans: { text: Y.XmlText; matches: number[] }[] = [];
    let replaced = 0;
    for (const text of textRuns(fragment)) {
      // `toString()` menyertakan tag format (`<bold>…`); indeks harus dari teks polos delta (embed = 1 karakter).
      const value = (text.toDelta() as { insert: unknown }[])
        .map((op) => (typeof op.insert === "string" ? op.insert : "\uFFFC"))
        .join("");
      const matches: number[] = [];
      for (let at = value.indexOf(input.find); at >= 0; at = value.indexOf(input.find, at + input.find.length)) {
        matches.push(at);
      }
      if (matches.length > 0) plans.push({ text, matches });
      replaced += matches.length;
    }
    if (replaced === 0) return { ok: true, value: { replaced: 0 }, affected: [] };
    const currentLength = plainText(yXmlFragmentToRichText(fragment) as RichTextDoc).length;
    const limit = exceeds("textCharsPerNode", currentLength + replaced * (input.replace.length - input.find.length), [
      "replace",
    ]);
    if (limit) return limit;

    for (const { text, matches } of plans) {
      const delta = text.toDelta() as { insert: unknown; attributes?: Record<string, unknown> }[];
      const attributesAt = (index: number) => {
        let offset = 0;
        for (const op of delta) {
          const length = typeof op.insert === "string" ? op.insert.length : 1;
          if (index < offset + length) return op.attributes ?? {};
          offset += length;
        }
        return {};
      };
      for (const at of [...matches].reverse()) {
        const attributes = attributesAt(at);
        text.delete(at, input.find.length);
        if (input.replace.length > 0) text.insert(at, input.replace, attributes);
      }
    }
    return { ok: true, value: { replaced }, affected: [input.id] };
  },
});

export const setImage = defineCommand({
  name: "setImage",
  description: {
    id: "Ganti gambar node image (asset harus sudah terdaftar di dokumen).",
    en: "Replace an image node's picture (the asset must already be registered in the document).",
  },
  aiExposed: true,
  input: z.strictObject({
    id: NodeIdSchema,
    image: AssetRefSchema,
    fit: z.enum(["cover", "contain", "fill"]).optional(),
  }),
  run(ctx, input) {
    const yNode = nodeOfType(ctx, input.id, ["image"]);
    if (isFailure(yNode)) return yNode;
    const asset = ctx.doc.getMap<{ kind?: string }>(YDOC_KEYS.assets).get(input.image.assetId);
    if (!asset) {
      return fail(
        "NOT_FOUND",
        {
          id: `Asset "${input.image.assetId}" belum terdaftar (unggah dulu)`,
          en: `Asset "${input.image.assetId}" is not registered (upload it first)`,
        },
        ["image", "assetId"],
      );
    }
    if (asset.kind !== "image" && asset.kind !== "svg") {
      return fail(
        "INVALID_TARGET",
        { id: `Asset "${input.image.assetId}" bukan gambar`, en: `Asset "${input.image.assetId}" is not an image` },
        ["image", "assetId"],
      );
    }
    const yProps = yNode.get("props") as Y.Map<unknown>;
    yProps.set("image", cloneJson(input.image));
    if (input.fit) yProps.set("fit", input.fit);
    return { ok: true, value: undefined, affected: [input.id] };
  },
});

/** Rujukan link wajib ada saat ditulis (berbeda dengan dokumen yang boleh punya link rusak setelah page dihapus). */
function checkLinkTarget(
  ctx: CommandContext,
  link: z.infer<typeof LinkValueSchema>,
  nodeId: string,
): CommandFailure | null {
  const nodes = nodesMap(ctx.doc);
  const pages = ctx.doc.getArray<string>(YDOC_KEYS.pageOrder).toArray();
  const missing = (id: string, en: string) => fail("NOT_FOUND", { id, en }, ["link"]);
  if (link.type === "page") {
    if (!pages.includes(link.pageId))
      return missing(`Page "${link.pageId}" tidak ada`, `Page "${link.pageId}" does not exist`);
    if (link.anchorNodeId && locate(nodes, link.anchorNodeId).pageId !== link.pageId) {
      return missing(
        `Anchor "${link.anchorNodeId}" tidak ada di page tujuan`,
        `Anchor "${link.anchorNodeId}" is not on the target page`,
      );
    }
  }
  if (
    link.type === "anchor" &&
    (link.nodeId === locate(nodes, nodeId).pageId || locate(nodes, link.nodeId).pageId !== locate(nodes, nodeId).pageId)
  ) {
    return missing(
      `Anchor "${link.nodeId}" tidak ada di page yang sama`,
      `Anchor "${link.nodeId}" is not on the same page`,
    );
  }
  if (link.type === "asset" && !ctx.doc.getMap(YDOC_KEYS.assets).has(link.assetId)) {
    return missing(`Asset "${link.assetId}" belum terdaftar`, `Asset "${link.assetId}" is not registered`);
  }
  return null;
}

export const setLink = defineCommand({
  name: "setLink",
  description: {
    id: "Pasang/hapus link pada frame atau gambar (nomor telepon/WA dinormalisasi ke 62…).",
    en: "Set/remove a link on a frame or image (phone/WhatsApp numbers normalized to 62…).",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, link: z.preprocess(normalizeLinkInput, LinkValueSchema).nullable() }),
  run(ctx, input) {
    const yNode = nodeOfType(ctx, input.id, ["frame", "image"]);
    if (isFailure(yNode)) return yNode;
    const yProps = yNode.get("props") as Y.Map<unknown>;
    if (input.link === null) {
      yProps.delete("link");
      return { ok: true, value: undefined, affected: [input.id] };
    }
    const targetError = checkLinkTarget(ctx, input.link, input.id);
    if (targetError) return targetError;
    yProps.set("link", cloneJson(input.link));
    return { ok: true, value: undefined, affected: [input.id] };
  },
});

export const registerAsset = defineCommand({
  name: "registerAsset",
  description: {
    id: "Daftarkan asset (AssetEntry) ke dokumen agar bisa dirujuk node image/link/font (DM-057).",
    en: "Register an asset (AssetEntry) in the document so image/link/font nodes can reference it (DM-057).",
  },
  // Upload = aksi user; AI image-gen (M6) memakai jalur sendiri.
  aiExposed: false,
  input: z.strictObject({ id: AssetIdSchema, entry: AssetEntrySchema }),
  run(ctx, input) {
    ctx.doc.getMap<unknown>(YDOC_KEYS.assets).set(input.id, cloneJson(input.entry));
    return { ok: true, value: undefined, affected: [] };
  },
});

export const setNodeProps = defineCommand({
  name: "setNodeProps",
  description: {
    id: "Ubah props spesifik tipe node per key (null = hapus); isi teks lewat setTextContent.",
    en: "Change type-specific node props per key (null = remove); text content via setTextContent.",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, patch: z.record(z.string(), z.unknown()) }),
  run(ctx, input) {
    const yNode = nodesMap(ctx.doc).get(input.id);
    if (!yNode) return notFound(input.id);
    if (nodeType(yNode) === "text" && "content" in input.patch) {
      return fail(
        "INVALID_INPUT",
        { id: "Isi teks diubah lewat setTextContent", en: "Text content is changed via setTextContent" },
        ["patch", "content"],
      );
    }
    if (nodeType(yNode) === "page") {
      return fail(
        "INVALID_TARGET",
        { id: "Props page diubah lewat updatePage", en: "Page props are changed via updatePage" },
        ["id"],
      );
    }
    const json = yNodeToJson(yNode);
    const props = { ...(json.props as Record<string, unknown>) };
    for (const [key, value] of Object.entries(input.patch)) {
      if (value === null) delete props[key];
      else props[key] = value;
    }
    const parsed = NodeSchema.safeParse({ ...json, props });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "INVALID_RESULT",
        { id: `Props tidak valid: ${issue?.message}`, en: `Invalid props: ${issue?.message}` },
        ["patch", ...(issue?.path.slice(1).filter((key): key is string | number => typeof key !== "symbol") ?? [])],
      );
    }
    if (typeof props.link === "object" && props.link !== null && input.patch.link !== undefined) {
      const targetError = checkLinkTarget(ctx, props.link as z.infer<typeof LinkValueSchema>, input.id);
      if (targetError) return targetError;
    }
    const yProps = yNode.get("props") as Y.Map<unknown>;
    for (const [key, value] of Object.entries(input.patch)) {
      if (value === null) yProps.delete(key);
      else yProps.set(key, cloneJson(value));
    }
    return { ok: true, value: undefined, affected: [input.id] };
  },
});
