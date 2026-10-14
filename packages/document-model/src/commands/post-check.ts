import * as Y from "yjs";
import { jsonEqual, normalizeOverrides } from "../query/normalize-overrides";
import { NodeSchema, type ResponsiveStyle } from "../schema";
import type { Issue } from "../validate/issues";
import { cloneJson } from "../yjs/clone-json";
import { yNodeToJson } from "../yjs/mapping";
import { childrenOf, nodesMap, nodeType, parentIdOf, styleOf, type YNode } from "./y-access";

const BREAKPOINTS = ["base", "tablet", "mobile"] as const;

/** Tulis style node ke Y.Doc hanya pada breakpoint/group yang berubah (update Yjs tetap granular). */
export function writeStyle(yNode: YNode, style: ResponsiveStyle): void {
  const yStyle = styleOf(yNode);
  for (const bp of BREAKPOINTS) {
    const desired: Record<string, unknown> | undefined = style[bp];
    let yBreakpoint = yStyle.get(bp);
    if (!desired && bp !== "base") {
      if (yBreakpoint) yStyle.delete(bp);
      continue;
    }
    if (!yBreakpoint) {
      yBreakpoint = new Y.Map<unknown>();
      yStyle.set(bp, yBreakpoint);
    }
    const current = yBreakpoint.toJSON() as Record<string, unknown>;
    for (const group of new Set([...Object.keys(current), ...Object.keys(desired ?? {})])) {
      const value = desired?.[group];
      if (jsonEqual(current[group], value)) continue;
      if (value === undefined) yBreakpoint.delete(group);
      else yBreakpoint.set(group, cloneJson(value));
    }
  }
}

/**
 * DM-036 (langkah "normalize" runCommand): override breakpoint yang redundan & patch kosong dibuang untuk node
 * terdampak — perubahan base bisa membuat override tablet/mobile sama dengan nilai warisan.
 */
export function normalizeAffectedStyles(doc: Y.Doc, affected: readonly string[]): void {
  const nodes = nodesMap(doc);
  for (const id of new Set(affected)) {
    const yNode = nodes.get(id);
    const yStyle = yNode?.get("style");
    if (!yNode || !(yStyle instanceof Y.Map)) continue;
    const style = yStyle.toJSON() as ResponsiveStyle;
    const normalized = normalizeOverrides(style);
    if (!jsonEqual(normalized, style)) writeStyle(yNode, normalized);
  }
}

/**
 * Pasca-cek ringan (DM-073) pada node terdampak — bentuk node valid & relasi parent/children konsisten. Validasi
 * penuh dokumen terlalu mahal untuk setiap command; cek penuh tetap di `validateDocument`.
 */
export function checkAffectedNodes(doc: Y.Doc, affected: readonly string[]): Issue[] {
  const nodes = nodesMap(doc);
  const issues: Issue[] = [];
  for (const id of new Set(affected)) {
    const yNode = nodes.get(id);
    if (!yNode) continue; // node terhapus
    const path = ["nodes", id];
    const parsed = NodeSchema.safeParse(yNodeToJson(yNode));
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "node tidak valid";
      issues.push({ code: "SCHEMA", path, nodeId: id, message: { id: message, en: message } });
      continue;
    }
    if (nodeType(yNode) !== "page") {
      const parentId = parentIdOf(yNode);
      const parent = parentId ? nodes.get(parentId) : undefined;
      if (!parent || !childrenOf(parent)?.toArray().includes(id)) {
        issues.push({
          code: "CHILD_MISMATCH",
          path,
          nodeId: id,
          message: {
            id: `Parent "${parentId}" tidak mencantumkan "${id}"`,
            en: `Parent "${parentId}" does not list "${id}"`,
          },
        });
      }
    }
    for (const childId of childrenOf(yNode)?.toArray() ?? []) {
      const child = nodes.get(childId);
      if (!child || parentIdOf(child) !== id) {
        issues.push({
          code: "CHILD_MISMATCH",
          path: [...path, "children"],
          nodeId: id,
          message: {
            id: `Child "${childId}" tidak menunjuk "${id}" sebagai parent`,
            en: `Child "${childId}" does not point to "${id}" as parent`,
          },
        });
      }
    }
  }
  return issues;
}
