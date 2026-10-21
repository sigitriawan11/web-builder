import {
  COMPONENT_YDOC_KEYS,
  ComponentNodeSchema,
  type NodeAccess,
  runCommand,
  setNodeAccess,
} from "@platform/document-model";
import { Checkbox, Label, NativeSelect } from "@platform/ui";
import { useCallback, useId, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { selectionStore } from "../../store/selection-store";

// CMP-024/DM-079: tab Access Mode Admin. Izin Simple mode per node (`nodeAccess`). Default (tak diatur) = "locked"
// kecuali node ber-`$prop`. Pratinjau "lihat sebagai user Simple mode" = follow-up.
const SIMPLE_ACCESS = ["locked", "content", "visibility", "style-basic"] as const;
type SimpleAccess = (typeof SIMPLE_ACCESS)[number];

const ctxOf = (runtime: CanvasRuntime) => ({
  doc: runtime.doc,
  origin: runtime.origin,
  nodeSchema: ComponentNodeSchema,
});

/** nodeAccess[nodeId] dari Y.Doc, reaktif. */
function useNodeAccess(doc: Y.Doc, nodeId: string | null): NodeAccess | undefined {
  const subscribe = useCallback(
    (cb: () => void) => {
      const map = doc.getMap<unknown>(COMPONENT_YDOC_KEYS.nodeAccess);
      map.observe(cb);
      return () => map.unobserve(cb);
    },
    [doc],
  );
  const getSnapshot = useCallback(
    () =>
      nodeId ? (doc.getMap<unknown>(COMPONENT_YDOC_KEYS.nodeAccess).get(nodeId) as NodeAccess | undefined) : undefined,
    [doc, nodeId],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function AccessTab({ runtime, canEdit }: { runtime: CanvasRuntime | null; canEdit: boolean }) {
  const t = useT();
  if (!runtime) return <p className="text-sm text-muted-foreground">{t("admin.panel.access.noDraft")}</p>;
  return <AccessEditor runtime={runtime} canEdit={canEdit} />;
}

function AccessEditor({ runtime, canEdit }: { runtime: CanvasRuntime; canEdit: boolean }) {
  const t = useT();
  const selectedIds = useStore(selectionStore, (s) => s.selectedIds);
  const id = selectedIds.length === 1 ? (selectedIds[0] ?? null) : null;
  const access = useNodeAccess(runtime.doc, id);
  const accessFieldId = useId();

  if (!id) return <p className="text-sm text-muted-foreground">{t("admin.panel.access.selectNode")}</p>;

  const simpleAccess: SimpleAccess = access?.simpleAccess ?? "locked";
  const hardLocked = access?.hardLocked ?? false;

  // Simpan hanya bila beda dari default; default (locked, tanpa hardLocked) → hapus entri.
  const update = (next: { simpleAccess: SimpleAccess; hardLocked: boolean }) => {
    const value: NodeAccess = {
      ...(next.simpleAccess !== "locked" ? { simpleAccess: next.simpleAccess } : {}),
      ...(next.hardLocked ? { hardLocked: true } : {}),
    };
    runCommand(ctxOf(runtime), setNodeAccess, { nodeId: id, access: Object.keys(value).length === 0 ? null : value });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="access-editor">
      <div className="flex flex-col gap-1">
        <Label htmlFor={accessFieldId}>{t("admin.panel.access.simpleAccess")}</Label>
        <NativeSelect
          id={accessFieldId}
          value={simpleAccess}
          disabled={!canEdit}
          onChange={(e) => update({ simpleAccess: e.target.value as SimpleAccess, hardLocked })}
        >
          {SIMPLE_ACCESS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          id="access-hardlocked"
          checked={hardLocked}
          disabled={!canEdit}
          onCheckedChange={(checked) => update({ simpleAccess, hardLocked: checked === true })}
        />
        <Label htmlFor="access-hardlocked">{t("admin.panel.access.hardLocked")}</Label>
      </div>
    </div>
  );
}
