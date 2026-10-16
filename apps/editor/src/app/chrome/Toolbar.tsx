import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@platform/ui";
import {
  ChevronDownIcon,
  CircleIcon,
  Columns3Icon,
  EyeIcon,
  FrameIcon,
  HandIcon,
  ImageIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  MenuIcon,
  MinusIcon,
  MonitorIcon,
  MousePointer2Icon,
  PaletteIcon,
  Redo2Icon,
  SmartphoneIcon,
  SmileIcon,
  SquareIcon,
  TabletIcon,
  TypeIcon,
  Undo2Icon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useStore } from "zustand";
import { zoomStep, zoomTo } from "../../canvas/camera-commands";
import { cameraStore } from "../../canvas/camera-store";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { useUndoState } from "../../document/use-undo-state";
import { BREAKPOINT_OPTIONS, breakpointStore } from "../../store/breakpoint-store";
import { uiPreferencesStore } from "../../store/ui-preferences";
import { TOOLS, toolDefinition } from "../../tools/tool-catalog";
import { type ToolId, toolStore } from "../../tools/tool-store";
import { useT } from "../i18n";
import { formatShortcut, type Shortcut } from "./shortcut";
import { ToolbarButton } from "./ToolbarButton";

// ED-006: toolbar atas 48px — menu ≡, nama situs/page, tools, undo/redo, status autosave, device switcher, zoom,
// mode/Preview/Publish (dinonaktifkan sampai fiturnya ada: mode M4, preview Epic 2.15, publish M4).

const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  select: MousePointer2Icon,
  frame: FrameIcon,
  section: LayoutTemplateIcon,
  rectangle: SquareIcon,
  ellipse: CircleIcon,
  line: MinusIcon,
  text: TypeIcon,
  image: ImageIcon,
  icon: SmileIcon,
  hand: HandIcon,
};
const BREAKPOINT_ICONS = { base: MonitorIcon, tablet: TabletIcon, mobile: SmartphoneIcon } as const;
const ZOOM_PRESETS = [0.5, 1, 2] as const;

const UNDO: Shortcut = { code: "KeyZ", mod: true };
const REDO: Shortcut = { code: "KeyZ", mod: true, shift: true };
const ZOOM_IN: Shortcut = { code: "Equal", mod: true };
const ZOOM_OUT: Shortcut = { code: "Minus", mod: true };
const ZOOM_100: Shortcut = { code: "Digit0", mod: true };

const shapeTools = TOOLS.filter((tool) => tool.group === "shape");

export interface ToolbarProps {
  siteName: string;
  pageTitle: string | null;
  runtime: CanvasRuntime | null;
  // Status autosave (ED-200) & menu bahasa disisipkan pemanggil.
  status: ReactNode;
  language: ReactNode;
}

export function Toolbar({ siteName, pageTitle, runtime, status, language }: ToolbarProps) {
  const t = useT();
  const undo = useUndoState(runtime?.undo ?? null);
  const activeTool = useStore(toolStore, (state) => state.active);
  const breakpoint = useStore(breakpointStore, (state) => state.active);
  const zoom = useStore(cameraStore, (state) => state.zoom);
  const bottomBarHidden = useStore(uiPreferencesStore, (state) => state.bottomBarHidden);
  const showAllFrames = useStore(uiPreferencesStore, (state) => state.showAllFrames);
  // Sub-tool shape terakhir dipakai tampil di tombol grup (seperti Figma).
  const [shape, setShape] = useState<ToolId>("rectangle");
  const selectTool = (tool: ToolId) => toolStore.getState().dispatch({ type: "selectTool", tool });
  const toolLabel = (tool: ToolId) => t(`toolbar.tool.${tool}`);
  const firstShortcut = (tool: ToolId) => toolDefinition(tool).shortcuts[0];
  const ShapeIcon = TOOL_ICONS[shape];
  const percent = Math.round(zoom * 100);

  const toolButton = (tool: ToolId) => {
    const Icon = TOOL_ICONS[tool];
    return (
      <ToolbarButton
        key={tool}
        label={toolLabel(tool)}
        shortcut={firstShortcut(tool)}
        pressed={activeTool === tool}
        icon={<Icon />}
        data-testid={`tool-${tool}`}
        onClick={() => selectTool(tool)}
      />
    );
  };

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-1 border-b bg-background px-2"
      data-testid="editor-header"
      role="toolbar"
      aria-label={t("toolbar.tools")}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarButton label={t("toolbar.menu")} icon={<MenuIcon />} data-testid="toolbar-menu" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem asChild>
            <a href="/sites">{t("toolbar.backToDashboard")}</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("toolbar.edit")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem disabled={!undo.canUndo} onSelect={() => runtime?.undo.undo()}>
                {t("toolbar.undo")}
                <DropdownMenuShortcut>{formatShortcut(UNDO)}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!undo.canRedo} onSelect={() => runtime?.undo.redo()}>
                {t("toolbar.redo")}
                <DropdownMenuShortcut>{formatShortcut(REDO)}</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("toolbar.view")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => zoomStep("in")}>
                {t("toolbar.zoomIn")}
                <DropdownMenuShortcut>{formatShortcut(ZOOM_IN)}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => zoomStep("out")}>
                {t("toolbar.zoomOut")}
                <DropdownMenuShortcut>{formatShortcut(ZOOM_OUT)}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={!bottomBarHidden}
                onCheckedChange={(checked) => uiPreferencesStore.getState().update({ bottomBarHidden: !checked })}
                data-testid="toggle-bottom-bar"
              >
                {t("bottomBar.show")}
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("toolbar.help")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {/* Shortcut sheet (Mod+Shift+/) = Epic 2.16. */}
              <DropdownMenuItem disabled>
                {t("toolbar.shortcutSheet")}
                <DropdownMenuShortcut>{formatShortcut({ code: "Slash", mod: true, shift: true })}</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Kembali langsung (juga ada di menu ≡). */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="sm" className="max-w-56 gap-1 px-2" aria-label={t("app.back")}>
            <a href="/sites" data-tooltip={t("app.back")}>
              <span className="truncate text-sm font-semibold" data-testid="editor-site-name">
                {siteName}
              </span>
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("app.back")}</TooltipContent>
      </Tooltip>
      {pageTitle ? (
        <span className="truncate text-sm text-muted-foreground" data-testid="editor-page-name">
          / {pageTitle}
        </span>
      ) : null}

      <div className="mx-2 h-6 w-px bg-border" />
      <div className="flex items-center gap-0.5" data-testid="toolbar-tools">
        {toolButton("select")}
        {toolButton("frame")}
        {toolButton("section")}
        <div className="flex items-center">
          <ToolbarButton
            label={toolLabel(shape)}
            shortcut={firstShortcut(shape)}
            pressed={activeTool === shape}
            icon={<ShapeIcon />}
            data-testid="tool-shape"
            onClick={() => selectTool(shape)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton
                label={t("toolbar.shape")}
                icon={<ChevronDownIcon />}
                className="w-4"
                data-testid="tool-shape-menu"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {shapeTools.map(({ id }) => {
                const Icon = TOOL_ICONS[id];
                return (
                  <DropdownMenuItem
                    key={id}
                    onSelect={() => {
                      setShape(id);
                      selectTool(id);
                    }}
                  >
                    <Icon />
                    {toolLabel(id)}
                    <DropdownMenuShortcut>
                      {formatShortcut(toolDefinition(id).shortcuts[0] ?? { code: "" })}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {toolButton("text")}
        {toolButton("image")}
        {toolButton("icon")}
        {toolButton("hand")}
      </div>

      <div className="mx-2 h-6 w-px bg-border" />
      <ToolbarButton
        label={t("toolbar.undo")}
        shortcut={UNDO}
        icon={<Undo2Icon />}
        disabled={!undo.canUndo}
        data-testid="toolbar-undo"
        onClick={() => runtime?.undo.undo()}
      />
      <ToolbarButton
        label={t("toolbar.redo")}
        shortcut={REDO}
        icon={<Redo2Icon />}
        disabled={!undo.canRedo}
        data-testid="toolbar-redo"
        onClick={() => runtime?.undo.redo()}
      />

      <div className="ml-auto flex items-center gap-1">
        {status}
        <div className="mx-1 h-6 w-px bg-border" />
        {/* biome-ignore lint/a11y/useSemanticElements: grup tombol toggle toolbar, bukan fieldset form. */}
        <div className="flex items-center gap-0.5" role="group" aria-label={t("toolbar.device")}>
          {BREAKPOINT_OPTIONS.map((option) => {
            const Icon = BREAKPOINT_ICONS[option];
            return (
              <ToolbarButton
                key={option}
                label={t(`breakpoints.${option}`)}
                pressed={breakpoint === option}
                icon={<Icon />}
                data-testid={`breakpoint-${option}`}
                onClick={() => breakpointStore.getState().setActive(option)}
              />
            );
          })}
          <ToolbarButton
            label={t("toolbar.showAllDevices")}
            pressed={showAllFrames}
            icon={<Columns3Icon />}
            data-testid="toggle-all-devices"
            onClick={() => uiPreferencesStore.getState().update({ showAllFrames: !showAllFrames })}
          />
        </div>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-16 tabular-nums"
                  aria-label={t("toolbar.zoom", { percent })}
                  data-tooltip={t("toolbar.zoom", { percent })}
                  data-testid="toolbar-zoom"
                >
                  {percent}%
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("toolbar.zoom", { percent })}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => zoomStep("in")}>
              {t("toolbar.zoomIn")}
              <DropdownMenuShortcut>{formatShortcut(ZOOM_IN)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomStep("out")}>
              {t("toolbar.zoomOut")}
              <DropdownMenuShortcut>{formatShortcut(ZOOM_OUT)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={String(zoom)} onValueChange={(value) => zoomTo(Number(value))}>
              {ZOOM_PRESETS.map((preset) => (
                <DropdownMenuRadioItem key={preset} value={String(preset)}>
                  {t("toolbar.zoomPreset", { percent: preset * 100 })}
                  {preset === 1 ? <DropdownMenuShortcut>{formatShortcut(ZOOM_100)}</DropdownMenuShortcut> : null}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {language}
        <div className="mx-1 h-6 w-px bg-border" />
        <ToolbarButton label={t("toolbar.mode")} icon={<PaletteIcon />} disabled data-testid="toolbar-mode" />
        <ToolbarButton label={t("toolbar.preview")} icon={<EyeIcon />} disabled data-testid="toolbar-preview" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                size="sm"
                disabled
                aria-label={t("toolbar.publish")}
                data-tooltip={t("toolbar.comingSoon")}
                data-testid="toolbar-publish"
              >
                {t("toolbar.publish")}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("toolbar.comingSoon")}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
