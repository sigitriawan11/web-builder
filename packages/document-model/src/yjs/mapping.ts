import * as Y from "yjs";
import type { Node, SiteDocument } from "../schema";
import { cloneJson } from "./clone-json";
import { richTextToYXmlFragment, yXmlFragmentToRichText } from "./rich-text";

// DM-058: key props yang disimpan sebagai Y.XmlFragment (rich text), bukan JSON atomik.
const RICH_TEXT_PROP = "content";

// Nama root type di Y.Doc (DM-058). Prototipe M0: settings/theme/componentDeps menyusul di M1.
export const YDOC_KEYS = {
  meta: "meta",
  assets: "assets",
  pageOrder: "pageOrder",
  nodes: "nodes",
} as const;

export function nodeToYMap(node: Node): Y.Map<unknown> {
  const yNode = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined) continue;

    if (key === "children" && Array.isArray(value)) {
      yNode.set(key, Y.Array.from(value));
    } else if (key === "style") {
      // Y.Map per breakpoint → per style group, agar edit `fills` dan `layout` node yang sama tidak konflik.
      const yStyle = new Y.Map<Y.Map<unknown>>();
      for (const [breakpoint, style] of Object.entries(node.style)) {
        if (style === undefined) continue;
        const yGroups = new Y.Map<unknown>();
        for (const [group, groupValue] of Object.entries(style)) {
          if (groupValue !== undefined) yGroups.set(group, cloneJson(groupValue));
        }
        yStyle.set(breakpoint, yGroups);
      }
      yNode.set(key, yStyle);
    } else if (key === "props") {
      const yProps = new Y.Map<unknown>();
      for (const [propKey, propValue] of Object.entries(node.props)) {
        if (propValue === undefined) continue;
        if (node.type === "text" && propKey === RICH_TEXT_PROP)
          yProps.set(propKey, richTextToYXmlFragment(node.props.content));
        else yProps.set(propKey, cloneJson(propValue));
      }
      yNode.set(key, yProps);
    } else {
      yNode.set(key, cloneJson(value));
    }
  }
  return yNode;
}

// Menulis dokumen ke Y.Doc dalam satu transaksi. Input diasumsikan sudah lolos SiteDocumentSchema.
export function jsonToYDoc(doc: SiteDocument, target: Y.Doc = new Y.Doc(), origin?: unknown): Y.Doc {
  target.transact(() => {
    const yMeta = target.getMap<unknown>(YDOC_KEYS.meta);
    yMeta.set("schemaVersion", doc.schemaVersion);
    for (const [key, value] of Object.entries(doc.meta)) {
      if (value !== undefined) yMeta.set(key, cloneJson(value));
    }

    const yAssets = target.getMap<unknown>(YDOC_KEYS.assets);
    for (const [assetId, entry] of Object.entries(doc.assets)) {
      yAssets.set(assetId, cloneJson(entry));
    }

    target.getArray<string>(YDOC_KEYS.pageOrder).push(doc.pageOrder);

    const yNodes = target.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes);
    for (const [nodeId, node] of Object.entries(doc.nodes)) {
      yNodes.set(nodeId, nodeToYMap(node));
    }
  }, origin);
  return target;
}

// JSON mentah satu node (rich text dikonversi dari Y.XmlFragment). Validasi dengan NodeSchema sebelum dipakai.
export function yNodeToJson(yNode: Y.Map<unknown>): Record<string, unknown> {
  const json = yNode.toJSON() as Record<string, unknown>;
  const yProps = yNode.get("props");
  const content = yProps instanceof Y.Map ? yProps.get(RICH_TEXT_PROP) : undefined;
  if (content instanceof Y.XmlFragment) {
    json.props = { ...(json.props as Record<string, unknown>), [RICH_TEXT_PROP]: yXmlFragmentToRichText(content) };
  }
  return json;
}

// Hasilnya JSON mentah: Y.Doc bisa berisi update remote, jadi validasi dengan SiteDocumentSchema sebelum dipakai.
export function yDocToJson(ydoc: Y.Doc): unknown {
  const nodes: Record<string, unknown> = {};
  ydoc.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes).forEach((yNode, id) => {
    nodes[id] = yNodeToJson(yNode);
  });
  const { schemaVersion, ...meta } = ydoc.getMap<unknown>(YDOC_KEYS.meta).toJSON();
  return cloneJson({
    schemaVersion,
    meta,
    assets: ydoc.getMap<unknown>(YDOC_KEYS.assets).toJSON(),
    pageOrder: ydoc.getArray<string>(YDOC_KEYS.pageOrder).toJSON(),
    nodes,
  });
}
