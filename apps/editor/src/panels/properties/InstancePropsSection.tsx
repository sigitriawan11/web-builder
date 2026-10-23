import {
  type ComponentDefinition,
  detachInstance,
  type Node,
  type PropDef,
  resetAllOverrides,
  runCommand,
  setProp,
  setVariant,
  swapInstance,
  updateInstanceVersion,
  type VariantAxis,
} from "@platform/document-model";
import {
  useFetchLibraryComponentDefinition,
  useLibraryCapabilities,
  useLibraryComponentDefinition,
  useLibraryComponents,
  useStartComponentDraft,
} from "@platform/sdk/react";
import { Button, Checkbox, Input, NativeSelect } from "@platform/ui";
import { useState } from "react";
import { useLocale, useT } from "../../app/i18n";
import { libraryDraftUrl } from "../../app/router";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput } from "./inputs/NumberInput";

// T3.6.4/ED-153: form props instance dari propsSchema component. Ubah nilai → `setProp` → canvas re-resolve. Tipe yang
// didukung sekarang: text/number/boolean/enum (image/link/icon/color = kontrol kaya, follow-up). Hanya satu instance.
const EDITABLE = new Set(["text", "number", "boolean", "enum"]);

// CMP-025: urutan group standar; `advanced` tertutup default. Prop tanpa/unknown group → `content`.
const GROUP_ORDER = ["content", "media", "links", "appearance", "advanced"] as const;
type GroupKey = (typeof GROUP_ORDER)[number];
const groupKeyOf = (prop: PropDef): GroupKey => {
  const g = prop.group ?? "content";
  return (GROUP_ORDER as readonly string[]).includes(g) ? (g as GroupKey) : "content";
};

// CMP-033: nilai prop responsif = `{ base, tablet?, mobile? }`. Helper baca/tulis per breakpoint (back-compat flat).
type Breakpoint = "base" | "tablet" | "mobile";
const BREAKPOINTS: Breakpoint[] = ["base", "tablet", "mobile"];
const isResponsiveValue = (v: unknown): v is Partial<Record<Breakpoint, unknown>> =>
  typeof v === "object" && v !== null && "base" in v;
const valueAt = (v: unknown, bp: Breakpoint): unknown => (isResponsiveValue(v) ? v[bp] : bp === "base" ? v : undefined);
const setValueAt = (v: unknown, bp: Breakpoint, next: unknown): Record<string, unknown> => {
  const base = isResponsiveValue(v) ? { ...v } : { base: v };
  return { ...base, [bp]: next };
};

export function InstancePropsSection({
  runtime,
  node,
  readOnly,
}: {
  runtime: CanvasRuntime;
  node: Node;
  readOnly: boolean;
}) {
  if (node.type !== "instance") return null;
  return (
    <Form
      runtime={runtime}
      nodeId={node.id}
      componentId={node.props.componentId}
      version={node.props.version}
      propValues={node.props.propValues ?? {}}
      variant={node.props.variant ?? {}}
      overrideCount={Object.keys(node.props.overrides ?? {}).length}
      readOnly={readOnly}
    />
  );
}

function Form({
  runtime,
  nodeId,
  componentId,
  version,
  propValues,
  variant,
  overrideCount,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodeId: string;
  componentId: string;
  version: number;
  propValues: Record<string, unknown>;
  variant: Record<string, string>;
  overrideCount: number;
  readOnly: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const def = useLibraryComponentDefinition(componentId, version);
  // T3.6.9: versi published terbaru (cari di daftar) → tawarkan update bila lebih baru dari yang di-pin.
  const list = useLibraryComponents();
  const current = list.data?.find((c) => c.publicId === componentId);
  const latest = current?.version;
  // T3.6.6/CMP-074: kandidat swap = component published kategori sama (selain diri sendiri).
  const candidates = (list.data ?? []).filter(
    (c) => c.publicId !== componentId && c.categorySlug === current?.categorySlug,
  );
  const fetchDef = useFetchLibraryComponentDefinition();
  const [dropped, setDropped] = useState<number | null>(null);
  // CMP-073: "Edit main component" hanya untuk staf yang boleh edit draft library; non-staf → kapabilitas 404 → sembunyi.
  const capabilities = useLibraryCapabilities();
  const canEditMain = capabilities.data?.canEditDraft ?? false;
  const startDraft = useStartComponentDraft();
  const editMain = async () => {
    const result = await startDraft.mutateAsync(componentId);
    // Draft dibuka di tab baru (CMP-073); situs user tak berubah sampai admin publish & update.
    window.open(libraryDraftUrl(result.id), "_blank", "noopener");
  };
  // ED-157 Go to main component: untuk library instance → panel info (nama, versi) + "Kembali ke instance". Admin
  // dapat tautan "Buka di Admin mode". (Local component = kamera pindah; menyusul bersama localComponents.)
  const [showMain, setShowMain] = useState(false);
  // CMP-025: group `advanced` tertutup default. CMP-033: breakpoint terpilih per responsiveProp.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bpByProp, setBpByProp] = useState<Record<string, Breakpoint>>({});

  const updateVersion = () => {
    if (readOnly || latest === undefined) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, updateInstanceVersion, { id: nodeId, version: latest });
    runtime.undo.stopCapturing();
  };

  const swap = async (sourceDef: ComponentDefinition, targetId: string, targetVersion: number) => {
    if (readOnly) return;
    const target = (await fetchDef(targetId, targetVersion)) as ComponentDefinition;
    runtime.undo.stopCapturing();
    const result = runCommand(
      {
        ...runtime.commandCtx,
        getComponent: (cid, v) =>
          cid === componentId && v === version
            ? sourceDef
            : cid === targetId && v === targetVersion
              ? target
              : undefined,
      },
      swapInstance,
      { id: nodeId, toComponentId: targetId, toVersion: targetVersion },
    );
    runtime.undo.stopCapturing();
    if (result.ok) setDropped((result.value as { droppedKeys: string[] }).droppedKeys.length);
  };

  const set = (key: string, value: unknown) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, setProp, { id: nodeId, key, value });
    runtime.undo.stopCapturing();
  };
  const setVar = (axis: string, option: string) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, setVariant, { id: nodeId, axis, option });
    runtime.undo.stopCapturing();
  };
  // ED-155: reset satu prop (hapus propValue → jatuh ke default) / semua override.
  const resetAll = () => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, resetAllOverrides, { id: nodeId });
    runtime.undo.stopCapturing();
    setDropped(null);
  };
  // T3.6.8/CMP-057: detach butuh registry (`getComponent`) — pakai definisi yang sudah di-fetch panel ini.
  const detach = (componentDef: ComponentDefinition) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand(
      {
        ...runtime.commandCtx,
        getComponent: (cid, v) => (cid === componentId && v === version ? componentDef : undefined),
      },
      detachInstance,
      { id: nodeId },
    );
    runtime.undo.stopCapturing();
  };

  if (def.isPending)
    return (
      <InspectorSection id="instance-props" title={t("inspector.instance.title")}>
        <p className="px-3 text-xs text-muted-foreground">{t("inspector.instance.loading")}</p>
      </InspectorSection>
    );

  const data = def.data as ({ propsSchema?: PropDef[]; variantAxes?: VariantAxis[] } & ComponentDefinition) | undefined;
  const editable = (data?.propsSchema ?? []).filter((prop) => EDITABLE.has(prop.type));
  // CMP-031/CMP-032: axis `state` jadi pseudo-class (bukan picker manual) → tak ditampilkan di sini.
  const axes = (data?.variantAxes ?? []).filter((axis) => axis.name !== "state");
  // ED-155: override = nilai berbeda dari default main component. Prop override = key ada di propValues;
  // axis override = nilai dipilih ≠ default axis. `overrideCount` = override per-node (dibuat lewat edit child, M4).
  const isAxisOverridden = (axis: VariantAxis) =>
    variant[axis.name] !== undefined && variant[axis.name] !== axis.default;
  const hasOverrides = Object.keys(propValues).length > 0 || overrideCount > 0 || axes.some(isAxisOverridden);

  // CMP-025: urut per `order`, kelompokkan per `group`, render per GROUP_ORDER (hanya group yang ada isinya).
  const ordered = [...editable].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const groups = GROUP_ORDER.map((group) => ({
    group,
    props: ordered.filter((prop) => groupKeyOf(prop) === group),
  })).filter((entry) => entry.props.length > 0);

  return (
    <InspectorSection id="instance-props" title={t("inspector.instance.title")}>
      {axes.length === 0 && editable.length === 0 ? (
        <p className="px-3 text-xs text-muted-foreground">{t("inspector.instance.none")}</p>
      ) : null}
      {axes.map((axis) => (
        <InspectorRow key={`v:${axis.name}`} label={axis.name}>
          <div className="flex items-center gap-1">
            {!readOnly && isAxisOverridden(axis) ? (
              <OverrideDot
                title={t("inspector.instance.overridden")}
                testId={`instance-override-axis-${axis.name}`}
                onReset={() => setVar(axis.name, axis.default)}
              />
            ) : null}
            <NativeSelect
              value={variant[axis.name] ?? axis.default}
              disabled={readOnly}
              data-testid={`instance-variant-${axis.name}`}
              onChange={(e) => setVar(axis.name, e.target.value)}
            >
              {axis.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSelect>
          </div>
        </InspectorRow>
      ))}
      {/* CMP-025: props dikelompokkan (group) & diurutkan (order); `advanced` tertutup default. */}
      {groups.map(({ group, props }) => {
        const collapsed = group === "advanced" && !advancedOpen;
        return (
          <div key={group} data-testid={`instance-group-${group}`}>
            {group === "advanced" ? (
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                data-testid="instance-group-advanced-toggle"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((open) => !open)}
              >
                {t("inspector.instance.groups.advanced")}
                <span>{advancedOpen ? "−" : "+"}</span>
              </button>
            ) : (
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`inspector.instance.groups.${group}` as never)}
              </div>
            )}
            {collapsed
              ? null
              : props.map((prop) => {
                  const bp = bpByProp[prop.key] ?? "base";
                  const stored = propValues[prop.key];
                  const shown = prop.responsiveProp ? valueAt(stored, bp) : stored;
                  return (
                    <InspectorRow key={prop.key} label={prop.label[locale] || prop.key}>
                      <div className="flex items-center gap-1">
                        {!readOnly && prop.key in propValues ? (
                          <OverrideDot
                            title={t("inspector.instance.overridden")}
                            testId={`instance-override-${prop.key}`}
                            onReset={() => set(prop.key, undefined)}
                          />
                        ) : null}
                        {prop.responsiveProp ? (
                          <BreakpointToggle
                            propKey={prop.key}
                            value={bp}
                            onChange={(next) => setBpByProp((prev) => ({ ...prev, [prop.key]: next }))}
                          />
                        ) : null}
                        <PropControl
                          prop={prop}
                          value={shown}
                          readOnly={readOnly}
                          onChange={(v) => set(prop.key, prop.responsiveProp ? setValueAt(stored, bp, v) : v)}
                        />
                      </div>
                    </InspectorRow>
                  );
                })}
          </div>
        );
      })}
      {!readOnly && data && candidates.length > 0 ? (
        <InspectorRow label={t("inspector.instance.swap")}>
          <NativeSelect
            value=""
            data-testid="instance-swap"
            onChange={(e) => {
              const target = candidates.find((c) => c.publicId === e.target.value);
              if (target) void swap(data, target.publicId, target.version);
            }}
          >
            <option value="">{t("inspector.instance.swapPlaceholder")}</option>
            {candidates.map((c) => (
              <option key={c.publicId} value={c.publicId}>
                {c.displayName[locale] || c.name}
              </option>
            ))}
          </NativeSelect>
        </InspectorRow>
      ) : null}
      {dropped !== null && dropped > 0 ? (
        <p className="px-3 pt-1 text-xs text-amber-600" data-testid="instance-swap-dropped">
          {t("inspector.instance.dropped", { count: dropped })}
        </p>
      ) : null}
      {!readOnly && data ? (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {latest !== undefined && latest > version ? (
            <Button variant="outline" size="sm" data-testid="instance-update-version" onClick={updateVersion}>
              {t("inspector.instance.update", { version: latest })}
            </Button>
          ) : null}
          {hasOverrides ? (
            <Button variant="outline" size="sm" data-testid="instance-reset-all" onClick={resetAll}>
              {t("inspector.instance.resetAll")}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" data-testid="instance-detach" onClick={() => detach(data)}>
            {t("inspector.instance.detach")}
          </Button>
        </div>
      ) : null}
      {/* CMP-073: edit komponen utama (admin library) — membuka draft dari versi published di tab baru. */}
      {canEditMain ? (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="instance-edit-main"
            disabled={startDraft.isPending}
            onClick={() => void editMain()}
          >
            {t("inspector.instance.editMain")}
          </Button>
        </div>
      ) : null}
      {/* ED-157: Go to main component — panel info library untuk semua user + "Kembali ke instance". */}
      {data ? (
        showMain ? (
          <div className="mx-3 mt-2 rounded border bg-muted/40 p-3 text-xs" data-testid="instance-main-info">
            <div className="font-medium text-muted-foreground">{t("inspector.instance.mainTitle")}</div>
            <div className="mt-1 text-sm">{current?.displayName[locale] || current?.name || componentId}</div>
            <div className="text-muted-foreground">{t("inspector.instance.mainVersion", { version })}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {canEditMain ? (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="instance-open-admin"
                  disabled={startDraft.isPending}
                  onClick={() => void editMain()}
                >
                  {t("inspector.instance.openAdmin")}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                data-testid="instance-back-to-instance"
                onClick={() => setShowMain(false)}
              >
                {t("inspector.instance.backToInstance")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-3 pt-2">
            <Button variant="outline" size="sm" data-testid="instance-go-to-main" onClick={() => setShowMain(true)}>
              {t("inspector.instance.goToMain")}
            </Button>
          </div>
        )
      ) : null}
    </InspectorSection>
  );
}

// CMP-033: pemilih breakpoint (ikon device) untuk prop responsif — base/tablet/mobile.
const BP_ICON: Record<Breakpoint, string> = { base: "🖥", tablet: "▭", mobile: "▯" };
function BreakpointToggle({
  propKey,
  value,
  onChange,
}: {
  propKey: string;
  value: Breakpoint;
  onChange: (bp: Breakpoint) => void;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded border" data-testid={`instance-prop-bp-${propKey}`}>
      {BREAKPOINTS.map((bp) => (
        <button
          key={bp}
          type="button"
          aria-label={bp}
          aria-pressed={value === bp}
          data-testid={`instance-prop-bp-${propKey}-${bp}`}
          onClick={() => onChange(bp)}
          className={`px-1 text-[10px] leading-4 ${value === bp ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          {BP_ICON[bp]}
        </button>
      ))}
    </div>
  );
}

// ED-155: titik ungu ● penanda properti ber-override; klik → reset ke default.
function OverrideDot({ title, testId, onReset }: { title: string; testId: string; onReset: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      data-testid={testId}
      onClick={onReset}
      className="shrink-0 text-primary text-xs leading-none hover:text-primary/70"
    >
      ●
    </button>
  );
}

function PropControl({
  prop,
  value,
  readOnly,
  onChange,
}: {
  prop: PropDef;
  value: unknown;
  readOnly: boolean;
  onChange: (value: unknown) => void;
}) {
  const current = value ?? ("default" in prop ? prop.default : undefined);
  if (prop.type === "boolean")
    return <Checkbox checked={current === true} disabled={readOnly} onCheckedChange={(c) => onChange(c === true)} />;
  if (prop.type === "number")
    return (
      <NumberInput
        label={prop.key}
        value={typeof current === "number" ? current : undefined}
        testId={`instance-prop-${prop.key}`}
        onCommit={(update) => onChange(update(typeof current === "number" ? current : 0))}
      />
    );
  if (prop.type === "enum")
    return (
      <NativeSelect
        value={typeof current === "string" ? current : ""}
        disabled={readOnly}
        data-testid={`instance-prop-${prop.key}`}
        onChange={(e) => onChange(e.target.value)}
      >
        {prop.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value}
          </option>
        ))}
      </NativeSelect>
    );
  // text (CMP-023): maxLength = batas keras (blok via atribut), softMaxLength = peringatan kuning (tidak memblok).
  const text = typeof current === "string" ? current : "";
  const hard = prop.type === "text" ? prop.maxLength : undefined;
  const soft = prop.type === "text" ? prop.softMaxLength : undefined;
  const overSoft = soft !== undefined && text.length > soft;
  return (
    <div className="flex flex-col gap-0.5">
      <Input
        value={text}
        disabled={readOnly}
        maxLength={hard}
        data-testid={`instance-prop-${prop.key}`}
        onChange={(e) => onChange(e.target.value)}
      />
      {soft !== undefined || hard !== undefined ? (
        <span
          className={`text-[10px] ${overSoft ? "font-medium text-amber-600" : "text-muted-foreground"}`}
          data-testid={`instance-prop-counter-${prop.key}`}
        >
          {text.length}
          {soft !== undefined ? `/${soft}` : hard !== undefined ? `/${hard}` : ""}
        </span>
      ) : null}
    </div>
  );
}
