import type { NodeStore } from "../../document/node-store";
import type { NodeLookup } from "./selection-depth";

// Info node untuk aturan seleksi, dibaca dari snapshot NodeStore.
export function nodeLookupFrom(nodeStore: NodeStore): NodeLookup {
  return (id) => {
    const node = nodeStore.getNode(id);
    if (!node) return null;
    return {
      type: node.type,
      parentId: node.parentId,
      role: node.type === "frame" ? node.props.role : undefined,
      locked: node.locked,
    };
  };
}
