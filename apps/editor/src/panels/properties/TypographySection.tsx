import {
  addFont,
  applyStylePatch,
  type CommandContext,
  type Node,
  resolveStyle,
  runCommand,
  setNodeProps,
  updateStyle,
} from "@platform/document-model";
import { cn, Input, Popover, PopoverContent, PopoverTrigger } from "@platform/ui";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  AlignVerticalJustifyStartIcon,
  ArrowLeftRightIcon,
  ArrowUpDownIcon,
  ChevronDownIcon,
  ItalicIcon,
  SquareIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { type CatalogFont, catalogFont, catalogFontDef, searchFonts } from "../../canvas/fonts/font-catalog";
import { loadSiteFont } from "../../canvas/fonts/site-fonts";
import { useDocTheme } from "../../document/use-doc-theme";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput } from "./inputs/NumberInput";
import { isMixed, mixedValue } from "./mixed";

// ED-117: weight umum yang ditawarkan (font tetap fallback bila weight spesifik tak termuat).
const WEIGHTS = [300, 400, 500, 600, 700, 800] as const;
const lengthValue = (value: unknown): number | undefined =>
  typeof value === "number"
    ? value
    : value && typeof value === "object" && "value" in value
      ? Number(value.value)
      : undefined;

// ED-116: picker font family. Font di-load dari Fontsource dengan nama family mentah (cocok dengan output renderer
// `fontStack`), bukan ber-namespace (itu khusus font dasar canvas). Preview weight 400 saja (lazy, saat terlihat).
const previewed = new Set<string>();
function loadPreview(family: string): void {
  if (previewed.has(family)) return;
  previewed.add(family);
  void loadSiteFont(document.fonts, family, [400], FontFace, family).catch(() => previewed.delete(family));
}

function familyOf(node: Node): string | undefined {
  const typography = resolveStyle(node.style, "base").typography;
  if (!typography || "$token" in typography) return undefined;
  return typeof typography.fontFamily === "string" ? typography.fontFamily : undefined;
}

export function TypographySection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const theme = useDocTheme(runtime.doc);
  const texts = nodes.filter((node) => node.type === "text");
  if (texts.length === 0) return null;

  const value = mixedValue(texts.map((node) => familyOf(node) ?? ""));
  const mixed = isMixed(value);
  const current = mixed ? null : (value as string) || null;
  const registered = new Set((theme?.fonts ?? []).map((font) => font.family.toLowerCase()));

  // Typography efektif node (token komposit di-expand lewat theme → objek literal), untuk menampilkan nilai saat ini.
  const effective = (node: Node): Record<string, unknown> | undefined => {
    const typography = applyStylePatch(
      resolveStyle(node.style, "base"),
      { typography: {} },
      theme ? { theme } : {},
    ).typography;
    return typography && !("$token" in typography) ? (typography as Record<string, unknown>) : undefined;
  };
  const fieldOf = (node: Node, key: string) => lengthValue(effective(node)?.[key]);
  const fieldValue = (key: string) => mixedValue(texts.map((node) => fieldOf(node, key)));

  // Terapkan patch typography ke semua text node (satu transaksi = satu undo). Token di-expand dulu (DM-032) agar
  // field lain tidak hilang. `before` dipakai untuk aksi tambahan (mis. addFont) di transaksi yang sama.
  const commitTypography = (make: (node: Node) => Record<string, unknown>, before?: (ctx: CommandContext) => void) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      const ctx = runtime.commandCtx;
      before?.(ctx);
      const ctxTheme = theme ? { theme } : {};
      for (const node of texts) {
        const partial = make(node);
        const typography =
          applyStylePatch(resolveStyle(node.style, "base"), { typography: partial }, ctxTheme).typography ?? partial;
        runCommand(ctx, updateStyle, { ids: [node.id], patch: { typography } });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  const selectFamily = (font: CatalogFont) => {
    // Muat untuk canvas (nama mentah + semua weight yang dipakai) agar langsung terlihat.
    loadPreview(font.family);
    void loadSiteFont(document.fonts, font.family, font.weights, FontFace, font.family).catch(() => {});
    commitTypography(
      () => ({ fontFamily: font.family }),
      (ctx) => {
        if (!registered.has(font.family.toLowerCase())) runCommand(ctx, addFont, catalogFontDef(font));
      },
    );
  };

  const weightMixed = fieldValue("fontWeight");

  // ED-120: decoration/case/italic — semua field typography yang sudah ada.
  const decoration = mixedValue(texts.map((node) => effective(node)?.textDecoration as string | undefined));
  const fontStyle = mixedValue(texts.map((node) => effective(node)?.fontStyle as string | undefined));
  const textCase = mixedValue(texts.map((node) => effective(node)?.textTransform as string | undefined));
  const italicOn = !isMixed(fontStyle) && fontStyle === "italic";
  const underlineOn = !isMixed(decoration) && decoration === "underline";
  const strikeOn = !isMixed(decoration) && decoration === "lineThrough";

  // ED-123: auto-resize teks (auto width / auto height / fixed) = mode size + prop autoSize.
  const autoSize = mixedValue(
    texts.map((node) => (node.type === "text" ? (node.props.autoSize ?? "none") : undefined)),
  );
  const setAutoSize = (mode: "width" | "height" | "none") => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      const ctx = runtime.commandCtx;
      for (const node of texts) {
        const rect = runtime.geometry.store.peekRect(node.id);
        const w = Math.round(rect?.width ?? 120);
        const h = Math.round(rect?.height ?? 40);
        const size =
          mode === "width"
            ? { width: { mode: "hug" as const }, height: { mode: "hug" as const } }
            : mode === "height"
              ? { width: { mode: "fixed" as const, value: w, unit: "px" as const }, height: { mode: "hug" as const } }
              : {
                  width: { mode: "fixed" as const, value: w, unit: "px" as const },
                  height: { mode: "fixed" as const, value: h, unit: "px" as const },
                };
        runCommand(ctx, updateStyle, { ids: [node.id], patch: { size } });
        runCommand(ctx, setNodeProps, { id: node.id, patch: { autoSize: mode } });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  // ED-119: horizontal = typography.textAlign; vertical = style.textAlignVertical (updateStyle langsung).
  const textAlign = mixedValue(texts.map((node) => effective(node)?.textAlign as string | undefined));
  const vAlign = mixedValue(texts.map((node) => resolveStyle(node.style, "base").textAlignVertical));
  const setVertical = (value: "top" | "middle" | "bottom") => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const node of texts) {
        runCommand(runtime.commandCtx, updateStyle, {
          ids: [node.id],
          patch: { textAlignVertical: value },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  return (
    <InspectorSection id="typography" title={t("inspector.typography")}>
      <InspectorRow label={t("inspector.font")}>
        <FontFamilyPicker value={current} mixed={mixed} readOnly={readOnly} onSelect={selectFamily} />
      </InspectorRow>
      <InspectorRow label={t("inspector.fontWeight")}>
        <select
          aria-label={t("inspector.fontWeight")}
          data-testid="font-weight"
          disabled={readOnly}
          value={isMixed(weightMixed) ? "" : String(weightMixed ?? "")}
          onChange={(event) => commitTypography(() => ({ fontWeight: Number(event.target.value) }))}
          className="h-7 w-full rounded border border-transparent bg-muted/50 px-1 text-xs hover:border-border focus:border-ring"
        >
          {isMixed(weightMixed) || weightMixed === undefined ? <option value="" disabled /> : null}
          {WEIGHTS.map((weight) => (
            <option key={weight} value={weight}>
              {weight}
            </option>
          ))}
        </select>
      </InspectorRow>
      <InspectorRow label={t("inspector.fontSizeLineHeight")}>
        <div className="grid grid-cols-2 gap-1">
          <NumberInput
            label={t("inspector.fontSize")}
            scrubLabel="S"
            value={fieldValue("fontSize")}
            min={1}
            testId="font-size"
            onCommit={(update) =>
              commitTypography((node) => ({
                fontSize: { value: Math.max(1, update(fieldOf(node, "fontSize") ?? 16)), unit: "px" as const },
              }))
            }
          />
          <NumberInput
            label={t("inspector.lineHeight")}
            scrubLabel="LH"
            value={fieldValue("lineHeight")}
            min={0}
            precision={2}
            testId="line-height"
            onCommit={(update) =>
              commitTypography((node) => ({ lineHeight: Math.max(0, update(fieldOf(node, "lineHeight") ?? 1.5)) }))
            }
          />
        </div>
      </InspectorRow>
      <InspectorRow label={t("inspector.letterSpacing")}>
        <NumberInput
          label={t("inspector.letterSpacing")}
          scrubLabel="LS"
          value={fieldValue("letterSpacing")}
          precision={1}
          testId="letter-spacing"
          onCommit={(update) =>
            commitTypography((node) => ({
              letterSpacing: { value: update(fieldOf(node, "letterSpacing") ?? 0), unit: "px" as const },
            }))
          }
        />
      </InspectorRow>
      <InspectorRow label={t("inspector.textAlign")}>
        <div className="flex gap-1">
          <ToggleButtons
            label={t("inspector.textAlign")}
            value={isMixed(textAlign) ? null : ((textAlign as string | undefined) ?? null)}
            readOnly={readOnly}
            onChange={(value) => commitTypography(() => ({ textAlign: value }))}
            options={[
              { id: "left", icon: <AlignLeftIcon className="size-3.5" />, title: t("inspector.textAlign_left") },
              { id: "center", icon: <AlignCenterIcon className="size-3.5" />, title: t("inspector.textAlign_center") },
              { id: "right", icon: <AlignRightIcon className="size-3.5" />, title: t("inspector.textAlign_right") },
              {
                id: "justify",
                icon: <AlignJustifyIcon className="size-3.5" />,
                title: t("inspector.textAlign_justify"),
              },
            ]}
          />
          <ToggleButtons
            label={t("inspector.textAlignVertical")}
            value={isMixed(vAlign) ? null : ((vAlign as string | undefined) ?? null)}
            readOnly={readOnly}
            onChange={(value) => setVertical(value as "top" | "middle" | "bottom")}
            options={[
              {
                id: "top",
                icon: <AlignVerticalJustifyStartIcon className="size-3.5" />,
                title: t("inspector.valign_top"),
              },
              {
                id: "middle",
                icon: <AlignVerticalJustifyCenterIcon className="size-3.5" />,
                title: t("inspector.valign_middle"),
              },
              {
                id: "bottom",
                icon: <AlignVerticalJustifyEndIcon className="size-3.5" />,
                title: t("inspector.valign_bottom"),
              },
            ]}
          />
        </div>
      </InspectorRow>
      <InspectorRow label={t("inspector.textSizing")}>
        <ToggleButtons
          label={t("inspector.textSizing")}
          name="tsize"
          value={isMixed(autoSize) ? null : ((autoSize as string | undefined) ?? "none")}
          readOnly={readOnly}
          onChange={(value) => setAutoSize(value as "width" | "height" | "none")}
          options={[
            { id: "width", icon: <ArrowLeftRightIcon className="size-3.5" />, title: t("inspector.sizing_width") },
            { id: "height", icon: <ArrowUpDownIcon className="size-3.5" />, title: t("inspector.sizing_height") },
            { id: "none", icon: <SquareIcon className="size-3.5" />, title: t("inspector.sizing_fixed") },
          ]}
        />
      </InspectorRow>
      <InspectorRow label={t("inspector.textDecoration")}>
        <div className="flex items-center gap-1">
          <IconToggle
            active={italicOn}
            icon={<ItalicIcon className="size-3.5" />}
            title={t("inspector.italic")}
            testId="italic"
            readOnly={readOnly}
            onClick={() => commitTypography(() => ({ fontStyle: italicOn ? "normal" : "italic" }))}
          />
          <IconToggle
            active={underlineOn}
            icon={<UnderlineIcon className="size-3.5" />}
            title={t("inspector.underline")}
            testId="underline"
            readOnly={readOnly}
            onClick={() => commitTypography(() => ({ textDecoration: underlineOn ? "none" : "underline" }))}
          />
          <IconToggle
            active={strikeOn}
            icon={<StrikethroughIcon className="size-3.5" />}
            title={t("inspector.strikethrough")}
            testId="strikethrough"
            readOnly={readOnly}
            onClick={() => commitTypography(() => ({ textDecoration: strikeOn ? "none" : "lineThrough" }))}
          />
          <select
            aria-label={t("inspector.textCase")}
            data-testid="text-case"
            disabled={readOnly}
            value={isMixed(textCase) ? "" : String(textCase ?? "none")}
            onChange={(event) => commitTypography(() => ({ textTransform: event.target.value }))}
            className="h-7 flex-1 rounded border border-transparent bg-muted/50 px-1 text-xs hover:border-border focus:border-ring"
          >
            {isMixed(textCase) ? <option value="" disabled /> : null}
            {(["none", "uppercase", "lowercase", "capitalize"] as const).map((option) => (
              <option key={option} value={option}>
                {t(`inspector.case_${option}`)}
              </option>
            ))}
          </select>
        </div>
      </InspectorRow>
    </InspectorSection>
  );
}

// Toggle boolean mandiri (italic/underline/strike).
function IconToggle({
  active,
  icon,
  title,
  testId,
  readOnly,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  testId: string;
  readOnly: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={readOnly}
      aria-pressed={active}
      aria-label={title}
      title={title}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      {icon}
    </button>
  );
}

// Grup tombol toggle (perataan teks). role=toolbar agar lolos useSemanticElements (bukan role=group).
function ToggleButtons({
  label,
  value,
  options,
  readOnly,
  onChange,
  name = "talign",
}: {
  label: string;
  value: string | null;
  options: readonly { id: string; icon: ReactNode; title: string }[];
  readOnly: boolean;
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <div role="toolbar" aria-label={label} className="flex gap-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={readOnly}
          aria-pressed={value === option.id}
          aria-label={option.title}
          title={option.title}
          data-testid={`${name}-${option.id}`}
          onClick={() => onChange(option.id)}
          className={cn(
            "flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
            value === option.id && "bg-accent text-foreground",
          )}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function FontFamilyPicker({
  value,
  mixed,
  readOnly,
  onSelect,
}: {
  value: string | null;
  mixed: boolean;
  readOnly: boolean;
  onSelect: (font: CatalogFont) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = searchFonts(query);
  const label = mixed ? t("inspector.mixed") : (value ?? t("inspector.fontDefault"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={readOnly}
          data-testid="font-family"
          className="flex h-7 w-full items-center justify-between gap-1 rounded border border-transparent bg-muted/50 px-1.5 text-xs hover:border-border focus:border-ring disabled:opacity-40"
        >
          <span className={cn("truncate", mixed && "italic text-muted-foreground")} style={font(value)}>
            {label}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("inspector.fontSearch")}
          aria-label={t("inspector.fontSearch")}
          data-testid="font-search"
          className="mb-1 h-7"
        />
        <div className="max-h-64 overflow-y-auto" role="listbox" aria-label={t("inspector.font")}>
          {results.map((item) => (
            <FontOption
              key={item.family}
              font={item}
              selected={item.family === value}
              onSelect={() => onSelect(item)}
            />
          ))}
          {results.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">{t("inspector.fontEmpty")}</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Preview di-load saat baris terlihat (lazy, ED-116/ED-224).
function FontOption({
  font: item,
  selected,
  onSelect,
}: {
  font: CatalogFont;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadPreview(item.family);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [item.family]);
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      data-testid={`font-option-${item.family}`}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center rounded px-2 py-1 text-left text-sm hover:bg-accent",
        selected && "bg-accent",
      )}
      style={{ fontFamily: `"${item.family}", ${item.fallback}` }}
    >
      {item.family}
    </button>
  );
}

function font(family: string | null): { fontFamily?: string } {
  const entry = family ? catalogFont(family) : undefined;
  return family ? { fontFamily: `"${family}", ${entry?.fallback ?? "sans-serif"}` } : {};
}
