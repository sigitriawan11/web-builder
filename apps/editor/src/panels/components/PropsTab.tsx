import {
  addComponentProp,
  bindProp,
  COMPONENT_YDOC_KEYS,
  ComponentNodeSchema,
  type Node,
  type PropDef,
  removeComponentProp,
  runCommand,
  setRepeatProp,
  unbindProp,
} from "@platform/document-model";
import { Button, Input, Label, NativeSelect } from "@platform/ui";
import { useCallback, useId, useRef, useState, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { selectionStore } from "../../store/selection-store";

// CMP-020/021: tab Props Mode Admin. Membaca propsSchema dari Y.Doc draft & menjalankan command lewat runtime yang
// sama dengan canvas. Tipe prop di form sengaja subset skalar (text/number/boolean/color); richText/enum/image/link/
// icon/slot/list menyusul (editor tipe-khusus). Binding: hanya target yang bentuknya pasti (content teks, visible).

// Tipe prop yang form add-nya dukung sekarang (default skalar + list dgn itemSchema starter + slot deklarasi).
const ADDABLE_TYPES = ["text", "number", "boolean", "color", "list", "slot"] as const;
type AddableType = (typeof ADDABLE_TYPES)[number];
// Tipe yang tidak butuh input "default" di form.
const NO_DEFAULT_INPUT = new Set<AddableType>(["color", "list", "slot"]);

const ctxOf = (runtime: CanvasRuntime) => ({
  doc: runtime.doc,
  origin: runtime.origin,
  nodeSchema: ComponentNodeSchema,
});

function buildProp(
  type: AddableType,
  key: string,
  label: { id: string; en: string },
  defaultText: string,
  defaultEn: string,
): PropDef {
  switch (type) {
    case "text":
      // CMP-016: `default` = konten ID; `defaultI18n.en` = terjemahan EN (opsional).
      return {
        key,
        label,
        type: "text",
        default: defaultText,
        ...(defaultEn.trim() ? { defaultI18n: { en: defaultEn.trim() } } : {}),
      };
    case "number":
      return { key, label, type: "number", default: Number(defaultText) || 0 };
    case "boolean":
      return { key, label, type: "boolean", default: defaultText.trim().toLowerCase() === "true" };
    case "color":
      return { key, label, type: "color", default: { $token: "color.primary" } };
    case "list":
      // itemSchema starter (satu sub-field teks); editor itemSchema penuh = follow-up.
      return {
        key,
        label,
        type: "list",
        itemSchema: [{ key: "label", label: { id: "Label", en: "Label" }, type: "text", default: "" }],
        default: [],
      };
    case "slot":
      // CMP-017: deklarasi slot (area isi). Node slot + konten default di canvas = follow-up (butuh Inspector).
      return { key, label, type: "slot" };
  }
}

/** propsSchema dari Y.Doc (observasi granular; snapshot di-cache agar stabil utk useSyncExternalStore). */
function useComponentProps(doc: Y.Doc): PropDef[] {
  const cache = useRef<{ json: string; value: PropDef[] }>({ json: "", value: [] });
  const subscribe = useCallback(
    (cb: () => void) => {
      const array = doc.getArray<unknown>(COMPONENT_YDOC_KEYS.propsSchema);
      array.observe(cb);
      return () => array.unobserve(cb);
    },
    [doc],
  );
  const getSnapshot = useCallback(() => {
    const raw = doc.getArray<unknown>(COMPONENT_YDOC_KEYS.propsSchema).toJSON();
    const json = JSON.stringify(raw);
    if (json !== cache.current.json) cache.current = { json, value: raw as PropDef[] };
    return cache.current.value;
  }, [doc]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Node yang sedang dipilih (satu) di canvas, reaktif terhadap perubahan dokumen. */
function useSelectedNode(runtime: CanvasRuntime): Node | null {
  const selectedIds = useStore(selectionStore, (s) => s.selectedIds);
  const id = selectedIds.length === 1 ? selectedIds[0] : null;
  const subscribe = useCallback(
    (cb: () => void) => (id ? runtime.nodeStore.subscribe(id, cb) : () => {}),
    [id, runtime],
  );
  const getSnapshot = useCallback(() => (id ? runtime.nodeStore.getNode(id) : null), [id, runtime]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

const propString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const propRefKey = (value: unknown): string | null =>
  typeof value === "object" &&
  value !== null &&
  "$prop" in value &&
  typeof (value as { $prop: unknown }).$prop === "string"
    ? (value as { $prop: string }).$prop
    : null;

export function PropsTab({
  runtime,
  canEdit,
  locale,
}: {
  runtime: CanvasRuntime | null;
  canEdit: boolean;
  locale: "id" | "en";
}) {
  const t = useT();
  if (!runtime) return <p className="text-sm text-muted-foreground">{t("admin.panel.props.noDraft")}</p>;
  return <PropsEditor runtime={runtime} canEdit={canEdit} locale={locale} />;
}

function PropsEditor({ runtime, canEdit, locale }: { runtime: CanvasRuntime; canEdit: boolean; locale: "id" | "en" }) {
  const t = useT();
  const props = useComponentProps(runtime.doc);
  const [error, setError] = useState<string | null>(null);

  const [key, setKey] = useState("");
  const [labelId, setLabelId] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [type, setType] = useState<AddableType>("text");
  const [defaultText, setDefaultText] = useState("");
  const [defaultEn, setDefaultEn] = useState("");
  const keyFieldId = useId();

  function run<T>(result: { ok: true; value: T } | { ok: false; error: { code: string } }): boolean {
    if (result.ok) {
      setError(null);
      return true;
    }
    setError(t("admin.panel.props.failed", { error: result.error.code }));
    return false;
  }

  function addProp() {
    const label = { id: labelId.trim() || key.trim(), en: labelEn.trim() || key.trim() };
    const prop = buildProp(type, key.trim(), label, defaultText, defaultEn);
    if (run(runCommand(ctxOf(runtime), addComponentProp, { prop }))) {
      setKey("");
      setLabelId("");
      setLabelEn("");
      setDefaultText("");
      setDefaultEn("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1" data-testid="prop-list">
        {props.length === 0 ? <li className="text-sm text-muted-foreground">{t("admin.panel.props.empty")}</li> : null}
        {props.map((prop) => (
          <li key={prop.key} className="flex items-center gap-2 text-sm">
            <span className="font-medium">{prop.label[locale] || prop.key}</span>
            <code className="text-xs text-muted-foreground">{prop.key}</code>
            <span className="rounded bg-muted px-1 text-xs">{prop.type}</span>
            {canEdit ? (
              <button
                type="button"
                className="ml-auto text-xs text-destructive hover:underline"
                onClick={() => run(runCommand(ctxOf(runtime), removeComponentProp, { key: prop.key }))}
              >
                {t("admin.panel.props.remove")}
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
            addProp();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={keyFieldId}>{t("admin.panel.props.key")}</Label>
            <Input id={keyFieldId} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("admin.panel.props.labelId")}
              value={labelId}
              onChange={(e) => setLabelId(e.target.value)}
            />
            <Input
              placeholder={t("admin.panel.props.labelEn")}
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <NativeSelect value={type} onChange={(e) => setType(e.target.value as AddableType)}>
              {ADDABLE_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </NativeSelect>
            {!NO_DEFAULT_INPUT.has(type) ? (
              <Input
                placeholder={t("admin.panel.props.defaultValue")}
                value={defaultText}
                onChange={(e) => setDefaultText(e.target.value)}
              />
            ) : null}
          </div>
          {/* CMP-016: default EN (terjemahan) — hanya tipe teks. */}
          {type === "text" ? (
            <Input
              placeholder={t("admin.panel.props.defaultEn")}
              value={defaultEn}
              onChange={(e) => setDefaultEn(e.target.value)}
            />
          ) : null}
          <Button type="submit" disabled={key.trim().length === 0}>
            {t("admin.panel.props.add")}
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <BindingSection runtime={runtime} props={props} canEdit={canEdit} onResult={run} />
    </div>
  );
}

// Binding untuk node terpilih (CMP-021): hanya target yang bentuknya pasti — konten teks (props.content) & visible.
function BindingSection({
  runtime,
  props,
  canEdit,
  onResult,
}: {
  runtime: CanvasRuntime;
  props: PropDef[];
  canEdit: boolean;
  onResult: (r: { ok: true; value: unknown } | { ok: false; error: { code: string } }) => boolean;
}) {
  const t = useT();
  const node = useSelectedNode(runtime);

  return (
    <section className="flex flex-col gap-2 border-t pt-3">
      <h3 className="text-xs font-medium text-muted-foreground">{t("admin.panel.props.bindingTitle")}</h3>
      {!node ? (
        <p className="text-sm text-muted-foreground">{t("admin.panel.props.bindingNone")}</p>
      ) : (
        <>
          {node.type === "text" ? (
            <BindTarget
              label={t("admin.panel.props.bindContent")}
              current={propRefKey((node.props as { content?: unknown } | undefined)?.content)}
              options={props.filter((p) => p.type === "text" || p.type === "richText")}
              disabled={!canEdit}
              onBind={(propKey) =>
                onResult(
                  runCommand(ctxOf(runtime), bindProp, {
                    nodeId: node.id,
                    path: { field: "prop", key: "content" },
                    propKey,
                  }),
                )
              }
              onUnbind={() =>
                onResult(
                  runCommand(ctxOf(runtime), unbindProp, {
                    nodeId: node.id,
                    path: { field: "prop", key: "content" },
                    value: { type: "doc", content: [] },
                  }),
                )
              }
            />
          ) : null}
          <BindTarget
            label={t("admin.panel.props.bindVisible")}
            current={propRefKey((node as { visible?: unknown }).visible)}
            options={props.filter((p) => p.type === "boolean")}
            disabled={!canEdit}
            onBind={(propKey) =>
              onResult(runCommand(ctxOf(runtime), bindProp, { nodeId: node.id, path: { field: "visible" }, propKey }))
            }
            onUnbind={() =>
              onResult(runCommand(ctxOf(runtime), unbindProp, { nodeId: node.id, path: { field: "visible" } }))
            }
          />
          {node.type === "frame" || node.type === "group" ? (
            <RepeatControl
              current={propString((node.props as { repeatProp?: unknown } | undefined)?.repeatProp)}
              lists={props.filter((p) => p.type === "list")}
              disabled={!canEdit}
              onSet={(listKey) => onResult(runCommand(ctxOf(runtime), setRepeatProp, { nodeId: node.id, listKey }))}
              onClear={() => onResult(runCommand(ctxOf(runtime), setRepeatProp, { nodeId: node.id, listKey: null }))}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

// CMP-022: tandai frame terpilih sebagai repeater (props.repeatProp → prop list). Isi item = Simple mode (M4).
function RepeatControl({
  current,
  lists,
  disabled,
  onSet,
  onClear,
}: {
  current: string | null;
  lists: PropDef[];
  disabled: boolean;
  onSet: (listKey: string) => void;
  onClear: () => void;
}) {
  const t = useT();
  const [pick, setPick] = useState("");
  return (
    <div className="flex items-center gap-2 text-sm" data-testid="repeat-control">
      <span className="w-20 shrink-0 text-muted-foreground">{t("admin.panel.props.repeat")}</span>
      {current ? (
        <>
          <code className="text-xs">{current}</code>
          {!disabled ? (
            <button type="button" className="ml-auto text-xs text-destructive hover:underline" onClick={onClear}>
              {t("admin.panel.props.repeatClear")}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <NativeSelect
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={disabled || lists.length === 0}
          >
            <option value="">{t("admin.panel.props.bindSelect")}</option>
            {lists.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key}
              </option>
            ))}
          </NativeSelect>
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:opacity-50"
            disabled={disabled || pick === ""}
            onClick={() => {
              onSet(pick);
              setPick("");
            }}
          >
            {t("admin.panel.props.repeatSet")}
          </button>
        </>
      )}
    </div>
  );
}

function BindTarget({
  label,
  current,
  options,
  disabled,
  onBind,
  onUnbind,
}: {
  label: string;
  current: string | null;
  options: PropDef[];
  disabled: boolean;
  onBind: (propKey: string) => void;
  onUnbind: () => void;
}) {
  const t = useT();
  const [pick, setPick] = useState("");
  return (
    <div className="flex items-center gap-2 text-sm" data-testid={`bind-${label}`}>
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      {current ? (
        <>
          <code className="text-xs">{current}</code>
          {!disabled ? (
            <button type="button" className="ml-auto text-xs text-destructive hover:underline" onClick={onUnbind}>
              {t("admin.panel.props.unbind")}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <NativeSelect
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={disabled || options.length === 0}
          >
            <option value="">{t("admin.panel.props.bindSelect")}</option>
            {options.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key}
              </option>
            ))}
          </NativeSelect>
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:opacity-50"
            disabled={disabled || pick === ""}
            onClick={() => {
              onBind(pick);
              setPick("");
            }}
          >
            {t("admin.panel.props.bind")}
          </button>
        </>
      )}
    </div>
  );
}
