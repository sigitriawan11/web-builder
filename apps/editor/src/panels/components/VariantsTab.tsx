import {
  addVariantAxis,
  COMPONENT_YDOC_KEYS,
  ComponentNodeSchema,
  removeVariantAxis,
  runCommand,
  type VariantAxis,
} from "@platform/document-model";
import { Button, Input, Label } from "@platform/ui";
import { useCallback, useId, useRef, useState, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";

// CMP-030/DM-048: tab Variants Mode Admin. Definisi variant axis (name + options + default). VariantRule (delta
// override per kombinasi) + matriks canvas = follow-up. Default axis = option pertama (pilih default = follow-up).

const ctxOf = (runtime: CanvasRuntime) => ({
  doc: runtime.doc,
  origin: runtime.origin,
  nodeSchema: ComponentNodeSchema,
});

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

/** variantAxes dari Y.Doc (snapshot di-cache agar stabil utk useSyncExternalStore). */
function useVariantAxes(doc: Y.Doc): VariantAxis[] {
  const cache = useRef<{ json: string; value: VariantAxis[] }>({ json: "", value: [] });
  const subscribe = useCallback(
    (cb: () => void) => {
      const array = doc.getArray<unknown>(COMPONENT_YDOC_KEYS.variantAxes);
      array.observe(cb);
      return () => array.unobserve(cb);
    },
    [doc],
  );
  const getSnapshot = useCallback(() => {
    const raw = doc.getArray<unknown>(COMPONENT_YDOC_KEYS.variantAxes).toJSON();
    const json = JSON.stringify(raw);
    if (json !== cache.current.json) cache.current = { json, value: raw as VariantAxis[] };
    return cache.current.value;
  }, [doc]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function VariantsTab({ runtime, canEdit }: { runtime: CanvasRuntime | null; canEdit: boolean }) {
  const t = useT();
  if (!runtime) return <p className="text-sm text-muted-foreground">{t("admin.panel.variants.noDraft")}</p>;
  return <VariantsEditor runtime={runtime} canEdit={canEdit} />;
}

function VariantsEditor({ runtime, canEdit }: { runtime: CanvasRuntime; canEdit: boolean }) {
  const t = useT();
  const axes = useVariantAxes(runtime.doc);
  const [name, setName] = useState("");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameFieldId = useId();

  function addAxis() {
    const opts = splitCsv(options);
    const first = opts[0];
    if (!first) return;
    // default = option pertama (pemilihan default manual = follow-up).
    const axis: VariantAxis = { name: name.trim(), options: opts, default: first };
    const result = runCommand(ctxOf(runtime), addVariantAxis, axis);
    if (result.ok) {
      setName("");
      setOptions("");
      setError(null);
    } else {
      setError(t("admin.panel.variants.failed", { error: result.error.code }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1" data-testid="variant-list">
        {axes.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("admin.panel.variants.empty")}</li>
        ) : null}
        {axes.map((axis) => (
          <li key={axis.name} className="flex items-center gap-2 text-sm">
            <span className="font-medium">{axis.name}</span>
            <span className="text-xs text-muted-foreground">{axis.options.join(" · ")}</span>
            {canEdit ? (
              <button
                type="button"
                className="ml-auto text-xs text-destructive hover:underline"
                onClick={() => {
                  const result = runCommand(ctxOf(runtime), removeVariantAxis, { name: axis.name });
                  if (!result.ok) setError(t("admin.panel.variants.failed", { error: result.error.code }));
                }}
              >
                {t("admin.panel.variants.remove")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canEdit ? (
        <form
          className="flex flex-col gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            addAxis();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={nameFieldId}>{t("admin.panel.variants.name")}</Label>
            <Input id={nameFieldId} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </div>
          <Input
            placeholder={t("admin.panel.variants.options")}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
          />
          <Button type="submit" disabled={name.trim().length === 0 || splitCsv(options).length === 0}>
            {t("admin.panel.variants.add")}
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
