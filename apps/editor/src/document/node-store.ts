import { type Node, NodeSchema, YDOC_KEYS, yNodeToJson } from "@platform/document-model";
import * as Y from "yjs";

type Listener = () => void;

/**
 * Snapshot node per ID dari Y.Doc untuk rendering inkremental (ED-018, DM-077).
 *
 * Satu `observeDeep` di map `nodes` memetakan setiap event Yjs ke ID node yang berubah
 * (`event.path[0]`, atau key map `nodes` saat node ditambah/dihapus). Hanya cache node itu
 * yang dibuang, dan listener-nya dipanggil sekali per transaksi. Granularitasnya sama dengan
 * observer per node, tanpa memasang ribuan observer.
 */
export class NodeStore {
  private readonly nodes: Y.Map<Y.Map<unknown>>;
  private readonly cache = new Map<string, Node | null>();
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(doc: Y.Doc) {
    this.nodes = doc.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes);
    this.nodes.observeDeep(this.handleChanges);
  }

  destroy(): void {
    this.nodes.unobserveDeep(this.handleChanges);
    this.listeners.clear();
    this.cache.clear();
  }

  // Referensi snapshot stabil sampai node berubah (syarat useSyncExternalStore & React.memo).
  getNode = (id: string): Node | null => {
    if (!this.cache.has(id)) this.cache.set(id, this.read(id));
    return this.cache.get(id) ?? null;
  };

  // DM-058: isi rich text node text sebagai Y.XmlFragment, untuk binding editor teks (Tiptap ↔ Yjs).
  getRichTextFragment = (id: string): Y.XmlFragment | null => {
    const props = this.nodes.get(id)?.get("props");
    const content = props instanceof Y.Map ? props.get("content") : null;
    return content instanceof Y.XmlFragment ? content : null;
  };

  subscribe = (id: string, listener: Listener): (() => void) => {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(id);
    };
  };

  private read(id: string): Node | null {
    const yNode = this.nodes.get(id);
    if (!yNode) return null;
    // Y.Doc bisa berisi update remote, jadi divalidasi di boundary ini (CLAUDE.md: Zod di setiap boundary).
    const parsed = NodeSchema.safeParse(yNodeToJson(yNode));
    if (!parsed.success) {
      console.error(`Node "${id}" di Y.Doc tidak valid; tidak dirender.`, parsed.error.issues);
      return null;
    }
    return parsed.data;
  }

  private readonly handleChanges = (events: Y.YEvent<Y.AbstractType<unknown>>[]): void => {
    const changed = new Set<string>();
    for (const event of events) {
      const [nodeId] = event.path;
      if (typeof nodeId === "string") changed.add(nodeId);
      else for (const key of event.changes.keys.keys()) changed.add(key);
    }
    for (const id of changed) this.cache.delete(id);
    for (const id of changed) {
      for (const listener of this.listeners.get(id) ?? []) listener();
    }
  };
}
