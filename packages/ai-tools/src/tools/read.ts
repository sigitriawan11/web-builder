import { z } from "zod";
import { toOutline } from "../context/outline";
import { ToolError } from "../errors";
import { defineTool } from "../tool";

// AI-061 (read): tool baca dokumen — tidak mengubah. Membaca snapshot JSON lewat `ctx.readDocument()` (tanpa Y.Doc).

interface ReadDoc {
  nodes: Record<
    string,
    {
      id: string;
      type: string;
      name?: string;
      parentId?: string | null;
      children?: string[];
      props?: Record<string, unknown>;
    }
  >;
}

const NodeId = z.string().regex(/^(n_|pg_)[0-9a-zA-Z_-]+$/, "nodeId (n_… / pg_…)");

export const getPageTree = defineTool({
  name: "get_page_tree",
  description: "Get a compact indented outline of a page's node tree (types, names, instance refs, first text).",
  input: z.object({ pageId: z.string() }),
  output: z.object({ outline: z.string() }),
  modes: ["user", "admin_library"],
  mutating: false,
  handler: (ctx, input) => {
    const doc = ctx.readDocument() as ReadDoc;
    if (!doc.nodes[input.pageId]) {
      throw new ToolError("NOT_FOUND", `page '${input.pageId}' not found`);
    }
    return { outline: toOutline(doc, input.pageId) };
  },
});

export const getNode = defineTool({
  name: "get_node",
  description: "Get a single node's compact data (type, name, props) by id.",
  input: z.object({ nodeId: NodeId }),
  output: z.object({ node: z.record(z.string(), z.unknown()) }),
  modes: ["user", "admin_library"],
  mutating: false,
  handler: (ctx, input) => {
    const doc = ctx.readDocument() as ReadDoc;
    const node = doc.nodes[input.nodeId];
    if (!node) throw new ToolError("NOT_FOUND", `node '${input.nodeId}' not found`);
    // Ringkas: struktur + props, tanpa style penuh (hemat token).
    return {
      node: {
        id: node.id,
        type: node.type,
        ...(node.name ? { name: node.name } : {}),
        ...(node.parentId ? { parentId: node.parentId } : {}),
        ...(node.children ? { childCount: node.children.length } : {}),
        ...(node.props ? { props: node.props } : {}),
      },
    };
  },
});
