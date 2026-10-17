import { useProfile } from "@platform/sdk/react";
import { cn } from "@platform/ui";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useStore } from "zustand";
import { useT } from "../app/i18n";
import { PanelErrorBoundary } from "../app/PanelErrorBoundary";
import { isEditableEvent } from "../commands/is-editable-target";
import {
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  LEFT_TABS,
  type LeftTab,
  uiPreferencesStore,
} from "../store/ui-preferences";
import { ResizeHandle } from "./ResizeHandle";

// ED-007: sidebar kiri — tab Layers (Pages di atas, bisa diciutkan, + Layers) / Assets / Insert. Lebar 200–480 px
// (default 260) lewat drag pegangan atau panah keyboard; `Mod+\\` menciutkan; `Alt+1` Layers, `Alt+2` Assets,
// `Alt+3` Insert, `Alt+4` Pages. Tab, lebar, dan status disimpan per user (localStorage).

interface LeftSidebarProps {
  pages: ReactNode;
  layers?: ReactNode;
  insert?: ReactNode;
}

export function useLeftSidebarShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isEditableEvent(event)) return;
      const { update, leftCollapsed } = uiPreferencesStore.getState();
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === "Backslash") {
        event.preventDefault();
        update({ leftCollapsed: !leftCollapsed });
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target: Record<string, Partial<{ leftTab: LeftTab; pagesOpen: boolean }>> = {
        Digit1: { leftTab: "layers" },
        Digit2: { leftTab: "assets" },
        Digit3: { leftTab: "insert" },
        Digit4: { leftTab: "layers", pagesOpen: true },
      };
      const patch = target[event.code];
      if (!patch) return;
      event.preventDefault();
      update({ ...patch, leftCollapsed: false });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function LeftSidebar({ pages, layers, insert }: LeftSidebarProps) {
  const t = useT();
  const profile = useProfile();
  const userId = profile.data?.id ?? null;
  useEffect(() => uiPreferencesStore.getState().loadFor(userId), [userId]);
  useLeftSidebarShortcuts();
  const { leftTab, leftWidth, leftCollapsed, pagesOpen, update } = useStore(uiPreferencesStore);

  if (leftCollapsed) return null;

  return (
    <aside
      className="relative flex shrink-0 flex-col border-r bg-background text-sm"
      style={{ width: leftWidth }}
      data-testid="left-sidebar"
      aria-label={t("sidebar.label")}
    >
      <div
        role="tablist"
        aria-label={t("sidebar.label")}
        className="flex h-9 shrink-0 items-center gap-1 border-b px-2"
      >
        {LEFT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`left-tab-${tab}`}
            aria-selected={leftTab === tab}
            aria-controls={`left-panel-${tab}`}
            data-testid={`left-tab-${tab}`}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground",
              leftTab === tab && "bg-accent text-foreground",
            )}
            onClick={() => update({ leftTab: tab })}
          >
            {t(`sidebar.tab.${tab}`)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`left-panel-${leftTab}`}
        aria-labelledby={`left-tab-${leftTab}`}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {leftTab === "layers" ? (
          <>
            <section className="border-b" data-testid="pages-section">
              <button
                type="button"
                className="flex w-full items-center gap-1 px-2 py-1.5 text-xs font-semibold"
                aria-expanded={pagesOpen}
                onClick={() => update({ pagesOpen: !pagesOpen })}
              >
                {pagesOpen ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
                {t("sidebar.pages")}
              </button>
              {pagesOpen ? (
                <div className="px-2 pb-2">
                  <PanelErrorBoundary name="pages">{pages}</PanelErrorBoundary>
                </div>
              ) : null}
            </section>
            <section className="flex min-h-0 flex-1 flex-col p-2" data-testid="layers-section">
              <h2 className="mb-1 shrink-0 text-xs font-semibold">{t("sidebar.tab.layers")}</h2>
              <PanelErrorBoundary name="layers">
                {layers ?? <p className="text-xs text-muted-foreground">{t("sidebar.comingSoon")}</p>}
              </PanelErrorBoundary>
            </section>
          </>
        ) : leftTab === "insert" && insert ? (
          <PanelErrorBoundary name="insert">{insert}</PanelErrorBoundary>
        ) : (
          <p className="p-3 text-xs text-muted-foreground" data-testid={`left-placeholder-${leftTab}`}>
            {t("sidebar.comingSoon")}
          </p>
        )}
      </div>
      <ResizeHandle
        edge="end"
        width={leftWidth}
        min={LEFT_SIDEBAR_MIN}
        max={LEFT_SIDEBAR_MAX}
        label={t("sidebar.resize")}
        onResize={(width) => update({ leftWidth: width })}
        testId="left-sidebar-resize"
      />
    </aside>
  );
}
