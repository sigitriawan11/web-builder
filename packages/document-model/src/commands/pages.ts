import type * as Y from "yjs";
import { z } from "zod";
import { createId } from "../ids";
import { PageIdSchema, type PageNode, PageNodeSchema, PagePropsSchema } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { nodeToYMap, YDOC_KEYS, yNodeToJson } from "../yjs/mapping";
import { type CommandContext, type CommandFailure, defineCommand, fail } from "./command";
import { exceeds } from "./limits";
import { collectSubtree, nodesMap, type YNode } from "./y-access";

// DM-074 page: path unik, tepat satu home di "/" (DM-010), batas page per situs (DM-076).

const pageOrder = (ctx: CommandContext): Y.Array<string> => ctx.doc.getArray<string>(YDOC_KEYS.pageOrder);

function pageNode(ctx: CommandContext, id: string): YNode | CommandFailure {
  const yNode = nodesMap(ctx.doc).get(id);
  const missing = fail("NOT_FOUND", { id: `Page "${id}" tidak ditemukan`, en: `Page "${id}" not found` }, ["id"]);
  if (!yNode) return missing;
  return yNode.get("type") === "page" ? yNode : missing;
}

const isFailure = (value: unknown): value is CommandFailure =>
  typeof value === "object" && value !== null && "ok" in value && value.ok === false;

function pathOwner(ctx: CommandContext, path: string, except?: string): string | undefined {
  const nodes = nodesMap(ctx.doc);
  return pageOrder(ctx)
    .toArray()
    .find((id) => id !== except && (nodes.get(id)?.get("props") as Y.Map<unknown> | undefined)?.get("path") === path);
}

const pathTaken = (path: string, owner: string): CommandFailure =>
  fail(
    "INVALID_RESULT",
    { id: `Path "${path}" sudah dipakai page "${owner}"`, en: `Path "${path}" is already used by page "${owner}"` },
    ["path"],
  );

export const createPage = defineCommand({
  name: "createPage",
  description: {
    id: "Buat page kosong baru dengan judul & path unik (path tidak boleh '/').",
    en: "Create a new empty page with a title & unique path (path cannot be '/').",
  },
  aiExposed: true,
  input: z.strictObject({
    title: PagePropsSchema.shape.title,
    path: PagePropsSchema.shape.path,
    index: z.number().int().nonnegative().optional(),
  }),
  run(ctx, input) {
    if (input.path === "/") {
      return fail("INVALID_INPUT", { id: 'Path "/" khusus page home', en: 'Path "/" is reserved for the home page' }, [
        "path",
      ]);
    }
    const owner = pathOwner(ctx, input.path);
    if (owner) return pathTaken(input.path, owner);
    const order = pageOrder(ctx);
    const limit = exceeds("pagesPerSite", order.length + 1) ?? exceeds("nodesPerSite", nodesMap(ctx.doc).size + 1);
    if (limit) return limit;

    const nodes = nodesMap(ctx.doc);
    const idGen = ctx.idGen ?? createId;
    let id = idGen("pg");
    for (let attempt = 0; nodes.has(id) && attempt < 5; attempt++) id = idGen("pg");
    if (nodes.has(id))
      return fail("INVALID_RESULT", { id: "Gagal membuat ID unik", en: "Failed to create a unique ID" });

    const page: PageNode = PageNodeSchema.parse({
      id,
      type: "page",
      name: input.title.slice(0, 80),
      parentId: null,
      children: [],
      visible: true,
      locked: false,
      // DM-010: page = tumpukan section vertikal selebar layar.
      style: { base: { layout: { mode: "flex", direction: "column" }, size: { width: { mode: "fill" } } } },
      props: { path: input.path, title: input.title, isHome: false },
    });
    nodes.set(id, nodeToYMap(page));
    order.insert(Math.min(input.index ?? order.length, order.length), [id]);
    return { ok: true, value: id, affected: [id] };
  },
});

export const updatePage = defineCommand({
  name: "updatePage",
  description: {
    id: "Ubah props page (judul, path, SEO). isHome: true = jadikan beranda (path bertukar dengan home lama).",
    en: "Change page props (title, path, SEO). isHome: true = make it home (paths swap with the old home).",
  },
  aiExposed: true,
  input: z.strictObject({ id: PageIdSchema, patch: PagePropsSchema.partial() }),
  run(ctx, input) {
    const yPage = pageNode(ctx, input.id);
    if (isFailure(yPage)) return yPage;
    const current = yNodeToJson(yPage).props as z.infer<typeof PagePropsSchema>;
    // exactOptionalPropertyTypes: field patch yang ada tidak pernah `undefined`.
    const next = { ...current, ...input.patch } as z.infer<typeof PagePropsSchema>;
    const affected = [input.id];

    if (input.patch.isHome === false && current.isHome) {
      return fail(
        "INVALID_INPUT",
        {
          id: "Pilih page lain sebagai home (isHome: true di page itu)",
          en: "Make another page home instead (isHome: true on it)",
        },
        ["patch", "isHome"],
      );
    }
    let previousHome: { yNode: YNode; props: Record<string, unknown> } | undefined;
    if (input.patch.isHome === true && !current.isHome) {
      // Tepat satu home di "/" (DM-010): page ini mengambil "/", home lama mengambil path lama page ini.
      const nodes = nodesMap(ctx.doc);
      const homeId = pageOrder(ctx)
        .toArray()
        .find((id) => (nodes.get(id)?.get("props") as Y.Map<unknown> | undefined)?.get("isHome") === true);
      const yHome = homeId ? nodes.get(homeId) : undefined;
      if (yHome && homeId) {
        previousHome = {
          yNode: yHome,
          props: { ...(yNodeToJson(yHome).props as Record<string, unknown>), isHome: false, path: current.path },
        };
        affected.push(homeId);
      }
      next.path = "/";
    } else if (next.isHome && next.path !== "/") {
      return fail("INVALID_INPUT", { id: 'Path home wajib "/"', en: 'The home path must be "/"' }, ["patch", "path"]);
    } else if (!next.isHome && next.path === "/") {
      return fail("INVALID_INPUT", { id: 'Path "/" khusus page home', en: 'Path "/" is reserved for the home page' }, [
        "patch",
        "path",
      ]);
    }

    if (!previousHome) {
      const owner = pathOwner(ctx, next.path, input.id);
      if (owner) return pathTaken(next.path, owner);
    }
    const parsed = PagePropsSchema.safeParse(next);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "INVALID_RESULT",
        { id: `Props page tidak valid: ${issue?.message}`, en: `Invalid page props: ${issue?.message}` },
        ["patch", ...(issue?.path.filter((key): key is string | number => typeof key !== "symbol") ?? [])],
      );
    }

    const writeProps = (yNode: YNode, props: Record<string, unknown>) => {
      const yProps = yNode.get("props") as Y.Map<unknown>;
      for (const key of [...yProps.keys()]) if (props[key] === undefined) yProps.delete(key);
      for (const [key, value] of Object.entries(props)) if (value !== undefined) yProps.set(key, cloneJson(value));
    };
    if (previousHome) writeProps(previousHome.yNode, previousHome.props);
    writeProps(yPage, parsed.data);
    return { ok: true, value: undefined, affected };
  },
});

export const reorderPages = defineCommand({
  name: "reorderPages",
  description: {
    id: "Ubah urutan page (harus memuat semua page tepat sekali).",
    en: "Reorder pages (must contain every page exactly once).",
  },
  aiExposed: true,
  input: z.strictObject({ order: z.array(PageIdSchema).min(1) }),
  run(ctx, input) {
    const order = pageOrder(ctx);
    const current = order.toArray();
    const sameSet =
      input.order.length === current.length &&
      new Set(input.order).size === current.length &&
      input.order.every((id) => current.includes(id));
    if (!sameSet) {
      return fail(
        "INVALID_INPUT",
        { id: "Urutan harus memuat semua page tepat sekali", en: "The order must contain every page exactly once" },
        ["order"],
      );
    }
    if (input.order.every((id, index) => current[index] === id)) return { ok: true, value: undefined, affected: [] };
    order.delete(0, order.length);
    order.insert(0, input.order);
    return { ok: true, value: undefined, affected: [] };
  },
});

export const deletePage = defineCommand({
  name: "deletePage",
  description: {
    id: "Hapus page beserta seluruh isinya (page home tidak bisa dihapus).",
    en: "Delete a page with all its content (the home page cannot be deleted).",
  },
  aiExposed: true,
  input: z.strictObject({ id: PageIdSchema }),
  run(ctx, input) {
    const yPage = pageNode(ctx, input.id);
    if (isFailure(yPage)) return yPage;
    if ((yPage.get("props") as Y.Map<unknown>).get("isHome") === true) {
      return fail(
        "INVALID_TARGET",
        {
          id: "Page home tidak bisa dihapus; jadikan page lain home dulu",
          en: "The home page cannot be deleted; make another page home first",
        },
        ["id"],
      );
    }
    const nodes = nodesMap(ctx.doc);
    const removed = [...collectSubtree(nodes, input.id)];
    const order = pageOrder(ctx);
    order.delete(order.toArray().indexOf(input.id), 1);
    for (const id of removed) nodes.delete(id);
    // Link ke page ini dari page lain kini rusak → lint BROKEN_LINK (warning edit, error publish).
    return { ok: true, value: { removedIds: removed }, affected: removed };
  },
});
