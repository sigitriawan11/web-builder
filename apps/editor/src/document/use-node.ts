import type { Node } from "@platform/document-model";
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { NodeStore } from "./node-store";

export const NodeStoreContext = createContext<NodeStore | null>(null);

function useNodeStore(): NodeStore {
  const store = useContext(NodeStoreContext);
  if (!store) throw new Error("useNode dipakai di luar NodeStoreContext.Provider");
  return store;
}

// ED-018: komponen hanya render ulang saat node `id` berubah.
export function useNode(id: string): Node | null {
  const store = useNodeStore();
  const subscribe = useCallback((listener: () => void) => store.subscribe(id, listener), [store, id]);
  const getSnapshot = useCallback(() => store.getNode(id), [store, id]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const NO_CHILDREN: readonly string[] = [];

/** ED-018: ID anak node `id` (urutan DOM); referensi stabil selama node tidak berubah. */
export function useChildren(id: string): readonly string[] {
  const node = useNode(id);
  return node && "children" in node ? node.children : NO_CHILDREN;
}

const NO_SUBSCRIPTION = () => () => {};
const NO_NODE = () => null;

/** Seperti `useNode`, untuk komponen di luar NodeStoreContext (mis. toolbar); store/id boleh belum ada. */
export function useNodeFromStore(store: NodeStore | null, id: string | null): Node | null {
  const subscribe = useCallback(
    (listener: () => void) => (store && id ? store.subscribe(id, listener) : NO_SUBSCRIPTION()),
    [store, id],
  );
  const getSnapshot = useCallback(() => (store && id ? store.getNode(id) : NO_NODE()), [store, id]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
