import type * as Y from "yjs";
import { checkLimit, type LimitName } from "../limits";
import { limitMessage } from "../validate/limits";
import { type CommandFailure, fail } from "./command";
import { childrenOf, collectSubtree, nodeType, parentIdOf, type YNode } from "./y-access";

// DM-076 AC: command yang melanggar batas hard → `LIMIT_EXCEEDED` + nama batas, diperiksa sebelum menulis apa pun.

/** Gagal bila `value` melewati batas hard; `null` bila aman (batas soft hanya peringatan editor). */
export function exceeds(limit: LimitName, value: number, path?: (string | number)[]): CommandFailure | null {
  const check = checkLimit(limit, value);
  if (check?.level !== "hard") return null;
  return fail("LIMIT_EXCEEDED", limitMessage(check), path, { limit, value, max: check.max });
}

/** Kedalaman node dari page-nya (page = 0) dan ID page tersebut. */
export function locate(nodes: Y.Map<YNode>, id: string): { pageId: string | undefined; depth: number } {
  let current: string | null = id;
  for (let depth = 0; current !== null && depth <= nodes.size; depth++) {
    const yNode = nodes.get(current);
    if (!yNode) break;
    if (nodeType(yNode) === "page") return { pageId: current, depth };
    current = parentIdOf(yNode);
  }
  return { pageId: undefined, depth: 0 };
}

/** Tinggi subtree (node tanpa anak = 0). */
export function subtreeHeight(nodes: Y.Map<YNode>, rootId: string): number {
  let height = 0;
  const stack: [string, number][] = [[rootId, 0]];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) continue;
    const [id, depth] = entry;
    height = Math.max(height, depth);
    const yNode = nodes.get(id);
    const children = yNode ? childrenOf(yNode) : undefined;
    if (children) for (const childId of children.toArray()) stack.push([childId, depth + 1]);
  }
  return height;
}

export function pageNodeCount(nodes: Y.Map<YNode>, pageId: string): number {
  return collectSubtree(nodes, pageId).size;
}
