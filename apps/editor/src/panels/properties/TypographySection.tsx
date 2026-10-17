import { addFont, applyStylePatch, type Node, resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import { cn, Input, Popover, PopoverContent, PopoverTrigger } from "@platform/ui";
import { ChevronDownIcon } from "lucide-react";
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
  const commitTypography = (
    make: (node: Node) => Record<string, unknown>,
    before?: (ctx: { doc: typeof runtime.doc; origin: typeof runtime.origin }) => void,
  ) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      const ctx = { doc: runtime.doc, origin: runtime.origin };
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
    </InspectorSection>
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
