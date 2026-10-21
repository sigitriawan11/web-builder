import * as Y from "yjs";
import { defaultTheme } from "../defaults/theme";
import type { ComponentDefinition } from "../schema/component";
import { cloneJson } from "./clone-json";
import { nodeRecordToYMap, yNodeToJson } from "./mapping";

// DM-058 untuk Mode Admin (Approach A): draft ComponentDefinition disimpan sebagai Y.Doc `kind='component'` agar
// bisa diedit kolaboratif di editor yang sama. Bentuk node identik dengan node site (reuse `nodeRecordToYMap` /
// `yNodeToJson`); yang beda hanya envelope ComponentDefinition (propsSchema/variants/rootId, tanpa pages/settings/theme).

// Root type Y.Doc component. `meta` memuat field skalar + rootId; propsSchema/variantAxes/variants = Y.Array
// (edit elemen berbeda tidak konflik); `nodes` = Y.Map<Y.Map> (reuse NodeStore editor).
export const COMPONENT_YDOC_KEYS = {
  meta: "meta",
  propsSchema: "propsSchema",
  variantAxes: "variantAxes",
  variants: "variants",
  nodes: "nodes",
  // DM-079: izin Simple mode per node (Y.Map<nodeId, NodeAccess>).
  nodeAccess: "nodeAccess",
} as const;

// Field ComponentDefinition yang disimpan di `meta` (skalar/objek kecil). propsSchema/variantAxes/variants/nodes
// punya root-type sendiri dan tidak masuk sini.
const META_FIELDS = [
  "schemaVersion",
  "id",
  "version",
  "name",
  "category",
  "description",
  "tags",
  "aiHints",
  "rootId",
  "thumbnail",
  "requires",
] as const;

/** Y.Doc kosong untuk satu draft component (guid = documentId agar identik dengan konvensi realtime). */
export function createComponentYDoc(guid: string): Y.Doc {
  return new Y.Doc({ guid });
}

/** Tulis ComponentDefinition ke Y.Doc dalam satu transaksi. Input diasumsikan sudah lolos ComponentDefinitionSchema. */
export function componentDefToYDoc(def: ComponentDefinition, target: Y.Doc = new Y.Doc(), origin?: unknown): Y.Doc {
  const record = def as unknown as Record<string, unknown>;
  target.transact(() => {
    const yMeta = target.getMap<unknown>(COMPONENT_YDOC_KEYS.meta);
    for (const key of META_FIELDS) {
      const value = record[key];
      if (value !== undefined) yMeta.set(key, cloneJson(value));
    }
    target.getArray<unknown>(COMPONENT_YDOC_KEYS.propsSchema).push(def.propsSchema.map((prop) => cloneJson(prop)));
    if (def.variantAxes) {
      target.getArray<unknown>(COMPONENT_YDOC_KEYS.variantAxes).push(def.variantAxes.map((axis) => cloneJson(axis)));
    }
    if (def.variants) {
      target.getArray<unknown>(COMPONENT_YDOC_KEYS.variants).push(def.variants.map((rule) => cloneJson(rule)));
    }
    const yNodes = target.getMap<Y.Map<unknown>>(COMPONENT_YDOC_KEYS.nodes);
    for (const [nodeId, node] of Object.entries(def.nodes)) {
      yNodes.set(nodeId, nodeRecordToYMap(node as Record<string, unknown>));
    }
    if (def.nodeAccess) {
      const yAccess = target.getMap<unknown>(COMPONENT_YDOC_KEYS.nodeAccess);
      for (const [nodeId, access] of Object.entries(def.nodeAccess)) yAccess.set(nodeId, cloneJson(access));
    }

    // Theme PRATINJAU untuk canvas editor Mode Admin (token component di-resolve ke nilai nyata). BUKAN bagian
    // ComponentDefinition (`yDocToComponentDef` mengabaikan key `theme`) → publish tetap bersih. Statis (tak diedit
    // kolaboratif) → disimpan sebagai nilai biasa.
    const theme = defaultTheme();
    const yTheme = target.getMap<unknown>("theme");
    yTheme.set("tokens", cloneJson(theme.tokens));
    yTheme.set("fonts", cloneJson(theme.fonts));
    if (theme.modes) yTheme.set("modes", cloneJson(theme.modes));
  }, origin);
  return target;
}

/** JSON mentah ComponentDefinition dari Y.Doc. Validasi dengan `validateComponentDefinition` sebelum dipakai. */
export function yDocToComponentDef(ydoc: Y.Doc): unknown {
  const nodes: Record<string, unknown> = {};
  ydoc.getMap<Y.Map<unknown>>(COMPONENT_YDOC_KEYS.nodes).forEach((yNode, id) => {
    nodes[id] = yNodeToJson(yNode);
  });
  const variantAxes = ydoc.getArray<unknown>(COMPONENT_YDOC_KEYS.variantAxes);
  const variants = ydoc.getArray<unknown>(COMPONENT_YDOC_KEYS.variants);
  const nodeAccess = ydoc.getMap<unknown>(COMPONENT_YDOC_KEYS.nodeAccess).toJSON();
  // `nodes` sudah salinan (yNodeToJson, termasuk konversi rich text); sisanya disalin di sini.
  const rest = cloneJson({
    ...ydoc.getMap<unknown>(COMPONENT_YDOC_KEYS.meta).toJSON(),
    propsSchema: ydoc.getArray<unknown>(COMPONENT_YDOC_KEYS.propsSchema).toJSON(),
    ...(variantAxes.length > 0 ? { variantAxes: variantAxes.toJSON() } : {}),
    ...(variants.length > 0 ? { variants: variants.toJSON() } : {}),
    ...(Object.keys(nodeAccess).length > 0 ? { nodeAccess } : {}),
  }) as Record<string, unknown>;
  return { ...rest, nodes };
}
