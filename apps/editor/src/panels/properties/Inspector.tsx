import type { Node } from "@platform/document-model";
import { cn } from "@platform/ui";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { useNode, useNodes } from "../../document/use-node";
import { selectionStore } from "../../store/selection-store";
import {
  clampInspectorWidth,
  RIGHT_SIDEBAR_MAX,
  RIGHT_SIDEBAR_MIN,
  RIGHT_TABS,
  uiPreferencesStore,
} from "../../store/ui-preferences";
import { ResizeHandle } from "../ResizeHandle";
import { AppearanceSection } from "./AppearanceSection";
import { AutoLayoutHint } from "./AutoLayoutHint";
import { AutoLayoutSection } from "./AutoLayoutSection";
import { EffectsSection } from "./EffectsSection";
import { FillSection } from "./FillSection";
import { ImageSection } from "./ImageSection";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { LinkSection } from "./LinkSection";
import { isMixed, mixedValue } from "./mixed";
import { OpacitySection } from "./OpacitySection";
import { PositionSizeSection } from "./PositionSizeSection";
import { RadiusSection } from "./RadiusSection";
import { StrokeSection } from "./StrokeSection";
import { TagSelect } from "./TagSelect";
import { TypographySection } from "./TypographySection";

// ED-008: sidebar kanan (default 280 px, 240–400) — tab Design & Settings. Tanpa seleksi: properti page aktif;
// multi-seleksi: hanya properti bersama, nilai berbeda = "Mixed". Kontrol properti lengkap (layout, fill, stroke,
// effects, typography) ditambahkan per epic M2; kerangka ini menyediakan section, tab, dan nilai campuran.

function Value({ value, format }: { value: unknown; format?: (value: never) => ReactNode }) {
  const t = useT();
  if (isMixed(value)) {
    return (
      <span className="italic text-muted-foreground" data-mixed="">
        {t("inspector.mixed")}
      </span>
    );
  }
  if (value === undefined || value === null || value === "") return <span className="text-muted-foreground">—</span>;
  return <>{format ? format(value as never) : String(value)}</>;
}

const DEFAULT_TAG: Record<Node["type"], string> = {
  page: "main",
  frame: "div",
  text: "p",
  image: "img",
  shape: "div",
  icon: "span",
};

function DesignTab({
  pageId,
  nodes,
  runtime,
  readOnly,
}: {
  pageId: string;
  nodes: readonly Node[];
  runtime: CanvasRuntime | null;
  readOnly: boolean;
}) {
  const t = useT();
  const page = useNode(pageId);
  if (nodes.length === 0) {
    return (
      <InspectorSection id="page" title={t("inspector.page")}>
        <InspectorRow label={t("inspector.title")}>
          <Value value={page?.type === "page" ? page.props.title : undefined} />
        </InspectorRow>
        <InspectorRow label={t("inspector.path")}>
          <Value value={page?.type === "page" ? page.props.path : undefined} />
        </InspectorRow>
      </InspectorSection>
    );
  }
  return (
    <>
      <InspectorSection
        id="layer"
        title={nodes.length > 1 ? t("inspector.layers", { count: nodes.length }) : t("inspector.layer")}
      >
        <InspectorRow label={t("inspector.type")}>
          <Value
            value={mixedValue(nodes.map((node) => node.type))}
            format={(type: Node["type"]) => t(`nodeType.${type}`)}
          />
        </InspectorRow>
        <InspectorRow label={t("inspector.name")}>
          <Value value={mixedValue(nodes.map((node) => node.name))} />
        </InspectorRow>
      </InspectorSection>
      {runtime ? <AutoLayoutHint runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <PositionSizeSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <AutoLayoutSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <TypographySection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <FillSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <StrokeSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <RadiusSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <EffectsSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <OpacitySection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <AppearanceSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <ImageSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
      {runtime ? <LinkSection runtime={runtime} nodes={nodes} readOnly={readOnly} /> : null}
    </>
  );
}

function SettingsTab({
  nodes,
  page,
  runtime,
  readOnly,
}: {
  nodes: readonly Node[];
  page: ReactNode;
  runtime: CanvasRuntime | null;
  readOnly: boolean;
}) {
  const t = useT();
  // ED-033: tanpa seleksi → pengaturan page aktif.
  if (nodes.length === 0) return <>{page}</>;
  // ED-218: satu node → tag bisa diganti (dropdown); multi-seleksi → tampilkan nilai (Mixed) read-only.
  const single = nodes.length === 1 ? nodes[0] : null;
  return (
    <InspectorSection id="html" title={t("inspector.html")}>
      <InspectorRow label={t("inspector.tag")}>
        {single && runtime ? (
          <TagSelect
            runtime={runtime}
            node={single}
            current={single.tag ?? DEFAULT_TAG[single.type]}
            readOnly={readOnly}
          />
        ) : (
          <Value value={mixedValue(nodes.map((node) => node.tag ?? DEFAULT_TAG[node.type]))} />
        )}
      </InspectorRow>
      <InspectorRow label={t("inspector.visible")}>
        <Value
          value={mixedValue(nodes.map((node) => node.visible))}
          format={(visible: boolean) => (visible ? t("inspector.yes") : t("inspector.no"))}
        />
      </InspectorRow>
    </InspectorSection>
  );
}

export function Inspector({
  pageId,
  pageSettings,
  runtime,
  readOnly = false,
}: {
  pageId: string;
  pageSettings: ReactNode;
  runtime?: CanvasRuntime | null;
  readOnly?: boolean;
}) {
  const t = useT();
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);
  const nodes = useNodes(selectedIds).filter((node): node is Node => node !== null);
  const { rightTab, rightWidth, update } = useStore(uiPreferencesStore);
  return (
    <aside
      className="relative flex shrink-0 flex-col border-l bg-background text-sm"
      style={{ width: rightWidth }}
      data-testid="inspector"
      aria-label={t("inspector.label")}
    >
      <ResizeHandle
        edge="start"
        width={rightWidth}
        min={RIGHT_SIDEBAR_MIN}
        max={RIGHT_SIDEBAR_MAX}
        label={t("inspector.resize")}
        onResize={(width) => update({ rightWidth: clampInspectorWidth(width) })}
        testId="inspector-resize"
      />
      <div
        role="tablist"
        aria-label={t("inspector.label")}
        className="flex h-9 shrink-0 items-center gap-1 border-b px-2"
      >
        {RIGHT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`right-tab-${tab}`}
            aria-selected={rightTab === tab}
            aria-controls={`right-panel-${tab}`}
            data-testid={`inspector-tab-${tab}`}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground",
              rightTab === tab && "bg-accent text-foreground",
            )}
            onClick={() => update({ rightTab: tab })}
          >
            {t(`inspector.tab.${tab}`)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`right-panel-${rightTab}`}
        aria-labelledby={`right-tab-${rightTab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {rightTab === "design" ? (
          <DesignTab pageId={pageId} nodes={nodes} runtime={runtime ?? null} readOnly={readOnly} />
        ) : (
          <SettingsTab nodes={nodes} page={pageSettings} runtime={runtime ?? null} readOnly={readOnly} />
        )}
      </div>
    </aside>
  );
}
