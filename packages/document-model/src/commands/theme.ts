import * as Y from "yjs";
import { z } from "zod";
import { jsonEqual } from "../query/normalize-overrides";
import {
  applyAlpha,
  canonicalTokenPath,
  checkThemeTokens,
  listTokenPaths,
  tokenEntry,
  tokenGroupOf,
} from "../query/tokens";
import {
  FontDefSchema,
  NodeSchema,
  type Theme,
  ThemeSchema,
  TOKEN_PATH_PATTERN,
  TOKEN_VALUE_SCHEMAS,
  TokenRefSchema,
} from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { YDOC_KEYS, yNodeToJson } from "../yjs/mapping";
import { type CommandContext, type CommandFailure, defineCommand, fail } from "./command";
import { exceeds } from "./limits";
import { nodesMap, styleOf, type YNode } from "./y-access";

// DM-074/DM-042: command theme. Rujukan token ada di style & props node, atribut mark rich text (Y.XmlText), dan
// alias di theme — semuanya ditulis ulang bersama, setelah seluruh hasil divalidasi.

type JsonRecord = Record<string, unknown>;
type TokenRef = { $token: string; alpha?: number };
// Pengganti satu rujukan; `undefined` = biarkan.
type RefRewrite = (ref: TokenRef) => unknown;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Salin `value` dengan setiap `{ $token }` yang cocok diganti; kembalikan jumlah penggantian. */
function rewriteJson(value: unknown, rewrite: RefRewrite): { value: unknown; count: number } {
  let count = 0;
  const walk = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(walk);
    if (!isRecord(current)) return current;
    if (typeof current.$token === "string") {
      const next = rewrite(current as TokenRef);
      if (next !== undefined) {
        count++;
        return next;
      }
      return current;
    }
    return Object.fromEntries(Object.entries(current).map(([key, child]) => [key, walk(child)]));
  };
  const next = walk(value);
  return { value: next, count };
}

const readTheme = (doc: Y.Doc): Theme => cloneJson(doc.getMap<unknown>(YDOC_KEYS.theme).toJSON()) as Theme;

function issueKeys(theme: Theme): Set<string> {
  const keys = new Set<string>();
  checkThemeTokens(theme, (code, path) => keys.add(`${code}:${path.join(".")}`));
  return keys;
}

/**
 * Theme baru harus valid secara bentuk dan tidak menambah masalah rujukan (siklus, alias hilang, font tak terdaftar)
 * dibanding theme sekarang — masalah lama tidak memblokir perubahan lain.
 */
function checkNextTheme(current: Theme, next: Theme): CommandFailure | null {
  const parsed = ThemeSchema.safeParse(next);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(
      "INVALID_RESULT",
      { id: `Theme tidak valid: ${issue?.message}`, en: `Invalid theme: ${issue?.message}` },
      ["theme", ...(issue?.path.filter((key): key is string | number => typeof key !== "symbol") ?? [])],
    );
  }
  const before = issueKeys(current);
  const issues: { path: (string | number)[]; message: { id: string; en: string } }[] = [];
  checkThemeTokens(next, (code, path, message) => {
    if (!before.has(`${code}:${path.join(".")}`)) issues.push({ path, message });
  });
  const [first] = issues;
  if (first) return fail("INVALID_RESULT", first.message, first.path);
  const limit = exceeds("tokensTotal", listTokenPaths(next).length, ["theme", "tokens"]);
  return limit ?? null;
}

function writeTheme(doc: Y.Doc, current: Theme, next: Theme): void {
  const yTheme = doc.getMap<unknown>(YDOC_KEYS.theme);
  const yTokens = yTheme.get("tokens") as Y.Map<Y.Map<unknown>>;
  const nextTokens = next.tokens as Record<string, JsonRecord | undefined>;
  const currentTokens = current.tokens as Record<string, JsonRecord | undefined>;
  for (const [group, values] of Object.entries(nextTokens)) {
    if (!values) continue;
    let yGroup = yTokens.get(group);
    if (!yGroup) {
      yGroup = new Y.Map<unknown>();
      yTokens.set(group, yGroup);
    }
    const before = currentTokens[group] ?? {};
    for (const name of Object.keys(before)) if (!(name in values)) yGroup.delete(name);
    for (const [name, value] of Object.entries(values)) {
      if (!jsonEqual(before[name], value)) yGroup.set(name, cloneJson(value));
    }
  }
}

/** Set token di salinan theme (path `grup.nama` atau `grup.sub.nama`); kembalikan error bila path bentrok. */
function setTokenIn(theme: Theme, path: string, value: unknown): CommandFailure | null {
  const canonical = canonicalTokenPath(path);
  const [group, name, child] = canonical.split(".") as [string, string, string | undefined];
  const tokens = theme.tokens as Record<string, JsonRecord | undefined>;
  const groupValues = tokens[group] ?? {};
  tokens[group] = groupValues;
  if (child === undefined) {
    if (isRecord(groupValues[name]) && tokenEntry(theme, canonical) === undefined && groupValues[name] !== undefined) {
      return fail(
        "INVALID_TARGET",
        {
          id: `"${canonical}" adalah grup bersarang, bukan token`,
          en: `"${canonical}" is a nested group, not a token`,
        },
        ["path"],
      );
    }
    groupValues[name] = value;
    return null;
  }
  const nested = groupValues[name];
  if (nested !== undefined && (!isRecord(nested) || tokenEntry(theme, `${group}.${name}`) !== undefined)) {
    return fail(
      "INVALID_TARGET",
      {
        id: `"${group}.${name}" adalah token, bukan grup bersarang`,
        en: `"${group}.${name}" is a token, not a nested group`,
      },
      ["path"],
    );
  }
  groupValues[name] = { ...(isRecord(nested) ? nested : {}), [child]: value };
  return null;
}

function deleteTokenIn(theme: Theme, path: string): void {
  const [group, name, child] = canonicalTokenPath(path).split(".") as [string, string, string | undefined];
  const groupValues = (theme.tokens as Record<string, JsonRecord | undefined>)[group];
  if (!groupValues) return;
  if (child === undefined) {
    delete groupValues[name];
    return;
  }
  const nested = groupValues[name];
  if (!isRecord(nested)) return;
  delete nested[child];
  if (Object.keys(nested).length === 0) delete groupValues[name];
}

/** Rencana penulisan ulang rujukan di semua node (sudah divalidasi); dijalankan hanya bila semuanya valid. */
function planNodeRewrites(
  ctx: CommandContext,
  rewrite: RefRewrite,
): { count: number; apply: () => string[] } | CommandFailure {
  const nodes = nodesMap(ctx.doc);
  const writes: (() => void)[] = [];
  const affected: string[] = [];
  let count = 0;
  for (const [id, yNode] of nodes.entries()) {
    const json = yNodeToJson(yNode);
    const style = rewriteJson(json.style, rewrite);
    const props = rewriteJson(json.props, rewrite);
    if (style.count + props.count === 0) continue;
    const parsed = NodeSchema.safeParse({ ...json, style: style.value, props: props.value });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "INVALID_RESULT",
        {
          id: `Pengganti token membuat node "${id}" tidak valid: ${issue?.message}`,
          en: `The token replacement makes node "${id}" invalid: ${issue?.message}`,
        },
        ["nodes", id, ...(issue?.path.filter((key): key is string | number => typeof key !== "symbol") ?? [])],
      );
    }
    count += style.count + props.count;
    affected.push(id);
    writes.push(() => applyNodeRewrite(yNode, rewrite));
  }
  return {
    count,
    apply: () => {
      for (const write of writes) write();
      return affected;
    },
  };
}

function applyNodeRewrite(yNode: YNode, rewrite: RefRewrite): void {
  const yStyle = styleOf(yNode);
  for (const yBreakpoint of yStyle.values()) {
    for (const [group, value] of yBreakpoint.entries()) {
      const next = rewriteJson(value, rewrite);
      if (next.count > 0) yBreakpoint.set(group, next.value);
    }
  }
  const yProps = yNode.get("props") as Y.Map<unknown>;
  for (const [key, value] of yProps.entries()) {
    if (value instanceof Y.XmlFragment) rewriteFragment(value, rewrite);
    else {
      const next = rewriteJson(value, rewrite);
      if (next.count > 0) yProps.set(key, next.value);
    }
  }
}

// Mark rich text = atribut format Y.XmlText; diganti per rentang tanpa menyentuh teksnya.
function rewriteFragment(fragment: Y.XmlFragment | Y.XmlElement, rewrite: RefRewrite): void {
  for (const child of fragment.toArray()) {
    if (child instanceof Y.XmlElement) {
      rewriteFragment(child, rewrite);
      continue;
    }
    if (!(child instanceof Y.XmlText)) continue;
    let offset = 0;
    for (const op of child.toDelta() as { insert: unknown; attributes?: JsonRecord }[]) {
      const length = typeof op.insert === "string" ? op.insert.length : 1;
      if (op.attributes) {
        const next = rewriteJson(op.attributes, rewrite);
        if (next.count > 0) child.format(offset, length, next.value as JsonRecord);
      }
      offset += length;
    }
  }
}

const TokenPathSchema = z.string().regex(TOKEN_PATH_PATTERN, "path token `grup.nama` (DM-041)");

export const setToken = defineCommand({
  name: "setToken",
  description: {
    id: "Buat/ubah token theme (literal sesuai grup, alias { $token }, atau responsif { value, tablet, mobile }).",
    en: "Create/update a theme token (group literal, { $token } alias, or responsive { value, tablet, mobile }).",
  },
  aiExposed: true,
  input: z.strictObject({ path: TokenPathSchema, value: z.unknown() }),
  run(ctx, input) {
    const group = tokenGroupOf(input.path);
    if (!group) {
      return fail(
        "INVALID_INPUT",
        { id: `Grup token "${input.path}" tidak dikenal`, en: `Unknown token group in "${input.path}"` },
        ["path"],
      );
    }
    const parsed = TOKEN_VALUE_SCHEMAS[group].safeParse(input.value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "INVALID_INPUT",
        {
          id: `Nilai token ${group} tidak valid: ${issue?.message}`,
          en: `Invalid ${group} token value: ${issue?.message}`,
        },
        ["value"],
      );
    }
    const current = readTheme(ctx.doc);
    const next = cloneJson(current);
    const conflict = setTokenIn(next, input.path, parsed.data);
    if (conflict) return conflict;
    const invalid = checkNextTheme(current, next);
    if (invalid) return invalid;
    writeTheme(ctx.doc, current, next);
    return { ok: true, value: undefined, affected: [] };
  },
});

export const renameToken = defineCommand({
  name: "renameToken",
  description: {
    id: "Ganti nama token dalam grup yang sama dan perbarui semua rujukannya (node, rich text, alias).",
    en: "Rename a token within its group and update every reference (nodes, rich text, aliases).",
  },
  aiExposed: true,
  input: z.strictObject({ from: TokenPathSchema, to: TokenPathSchema }),
  run(ctx, input) {
    const from = canonicalTokenPath(input.from);
    const to = canonicalTokenPath(input.to);
    const current = readTheme(ctx.doc);
    const value = tokenEntry(current, from);
    if (value === undefined)
      return fail("NOT_FOUND", { id: `Token "${from}" tidak ada`, en: `Token "${from}" does not exist` }, ["from"]);
    if (tokenGroupOf(from) !== tokenGroupOf(to)) {
      return fail(
        "INVALID_INPUT",
        { id: "Rename hanya dalam grup yang sama", en: "Rename only within the same group" },
        ["to"],
      );
    }
    if (tokenEntry(current, to) !== undefined || from === to) {
      return fail("INVALID_INPUT", { id: `Token "${to}" sudah ada`, en: `Token "${to}" already exists` }, ["to"]);
    }
    const rewrite: RefRewrite = (ref) => (canonicalTokenPath(ref.$token) === from ? { ...ref, $token: to } : undefined);

    const next = cloneJson(current);
    deleteTokenIn(next, from);
    const conflict = setTokenIn(next, to, value);
    if (conflict) return conflict;
    const themeRefs = rewriteJson(next.tokens, rewrite);
    next.tokens = themeRefs.value as Theme["tokens"];
    const invalid = checkNextTheme(current, next);
    if (invalid) return invalid;
    const nodePlan = planNodeRewrites(ctx, rewrite);
    if ("ok" in nodePlan) return nodePlan;

    writeTheme(ctx.doc, current, next);
    const affected = nodePlan.apply();
    return { ok: true, value: { updatedRefs: themeRefs.count + nodePlan.count }, affected };
  },
});

export const deleteToken = defineCommand({
  name: "deleteToken",
  description: {
    id: "Hapus token; setiap rujukannya diganti `replaceWith` (token lain atau nilai literal).",
    en: "Delete a token; every reference is replaced with `replaceWith` (another token or a literal value).",
  },
  aiExposed: true,
  input: z.strictObject({ path: TokenPathSchema, replaceWith: z.unknown() }),
  run(ctx, input) {
    const path = canonicalTokenPath(input.path);
    const current = readTheme(ctx.doc);
    if (tokenEntry(current, path) === undefined) {
      return fail("NOT_FOUND", { id: `Token "${path}" tidak ada`, en: `Token "${path}" does not exist` }, ["path"]);
    }
    if (input.replaceWith === undefined || input.replaceWith === null) {
      return fail("INVALID_INPUT", { id: "replaceWith wajib diisi", en: "replaceWith is required" }, ["replaceWith"]);
    }
    const replacementRef = TokenRefSchema.safeParse(input.replaceWith);
    if (replacementRef.success && canonicalTokenPath(replacementRef.data.$token) === path) {
      return fail(
        "INVALID_INPUT",
        { id: "Pengganti tidak boleh token yang dihapus", en: "The replacement cannot be the deleted token" },
        ["replaceWith"],
      );
    }
    const rewrite: RefRewrite = (ref) => {
      if (canonicalTokenPath(ref.$token) !== path) return undefined;
      if (replacementRef.success)
        return ref.alpha === undefined ? replacementRef.data : { ...replacementRef.data, alpha: ref.alpha };
      // Literal: `{ $token, alpha }` → warna hex dengan opasitas diterapkan.
      return ref.alpha === undefined ? cloneJson(input.replaceWith) : applyAlpha(input.replaceWith, ref.alpha);
    };

    const next = cloneJson(current);
    deleteTokenIn(next, path);
    const themeRefs = rewriteJson(next.tokens, rewrite);
    next.tokens = themeRefs.value as Theme["tokens"];
    const invalid = checkNextTheme(current, next);
    if (invalid) return invalid;
    const nodePlan = planNodeRewrites(ctx, rewrite);
    if ("ok" in nodePlan) return nodePlan;

    writeTheme(ctx.doc, current, next);
    const affected = nodePlan.apply();
    return { ok: true, value: { updatedRefs: themeRefs.count + nodePlan.count }, affected };
  },
});

export const addFont = defineCommand({
  name: "addFont",
  description: {
    id: "Daftarkan font ke theme (Google/Fontsource, atau upload dengan asset terdaftar).",
    en: "Register a font in the theme (Google/Fontsource, or upload with a registered asset).",
  },
  aiExposed: true,
  input: FontDefSchema,
  run(ctx, input) {
    const yFonts = ctx.doc.getMap<unknown>(YDOC_KEYS.theme).get("fonts") as Y.Array<{ family: string }>;
    if (yFonts.toArray().some((font) => font.family.toLowerCase() === input.family.toLowerCase())) {
      return fail(
        "INVALID_INPUT",
        { id: `Font "${input.family}" sudah terdaftar`, en: `Font "${input.family}" is already registered` },
        ["family"],
      );
    }
    if (input.source === "upload") {
      if (!input.assetId) {
        return fail(
          "INVALID_INPUT",
          { id: "Font upload wajib punya assetId", en: "Uploaded fonts require an assetId" },
          ["assetId"],
        );
      }
      if (!ctx.doc.getMap(YDOC_KEYS.assets).has(input.assetId)) {
        return fail(
          "NOT_FOUND",
          { id: `Asset "${input.assetId}" belum terdaftar`, en: `Asset "${input.assetId}" is not registered` },
          ["assetId"],
        );
      }
    }
    yFonts.push([cloneJson(input)]);
    return { ok: true, value: undefined, affected: [] };
  },
});
