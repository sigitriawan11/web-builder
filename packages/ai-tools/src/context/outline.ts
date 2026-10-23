// AI-043 / DM-077: `toOutline(doc, pageId)` — outline ringkas halaman untuk model (BUKAN JSON penuh). Tiap node satu
// baris berindentasi: `type "name" [componentId@v] — <≤60 char teks pertama>`. Target: 1.500 node ≤ 25.000 token
// (estimasi ~chars/4) dengan pemotongan teks 60 char/node.

const MAX_TEXT = 60;
const INDENT = "  ";

interface OutlineNode {
  id: string;
  type: string;
  name?: string;
  parentId?: string | null;
  children?: string[];
  props?: Record<string, unknown>;
}
interface OutlineDoc {
  nodes: Record<string, OutlineNode>;
  pageOrder?: string[];
}

/** Teks pertama dari richText (`{type:"doc",content:[...]}`) atau string, dipotong `MAX_TEXT`. */
function firstText(content: unknown): string | undefined {
  if (typeof content === "string") return content.slice(0, MAX_TEXT);
  if (!content || typeof content !== "object") return undefined;
  // Walk content tree mencari node teks pertama.
  const stack: unknown[] = [content];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node || typeof node !== "object") continue;
    const rec = node as { text?: unknown; content?: unknown };
    if (typeof rec.text === "string" && rec.text.trim()) return rec.text.slice(0, MAX_TEXT);
    if (Array.isArray(rec.content)) stack.push(...rec.content);
  }
  return undefined;
}

function nodeLine(node: OutlineNode, depth: number): string {
  const parts = [`${INDENT.repeat(depth)}${node.type}`];
  if (node.name) parts.push(`"${node.name}"`);
  const props = node.props ?? {};
  if (node.type === "instance" && typeof props.componentId === "string") {
    const version = typeof props.version === "number" ? `@${props.version}` : "";
    parts.push(`[${props.componentId}${version}]`);
  }
  const text = firstText(props.content);
  let line = parts.join(" ");
  if (text) line += ` — ${text}`;
  return line;
}

/** Outline teks halaman `pageId` (depth-first, urut children). Node hilang di-skip (defensif). */
export function toOutline(doc: OutlineDoc, pageId: string): string {
  const page = doc.nodes[pageId];
  if (!page) return "";
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const node = doc.nodes[id];
    if (!node) return;
    lines.push(nodeLine(node, depth));
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(pageId, 0);
  return lines.join("\n");
}

/** Estimasi kasar token LLM (~4 char/token). Dipakai gate budget konteks (AI-043). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
