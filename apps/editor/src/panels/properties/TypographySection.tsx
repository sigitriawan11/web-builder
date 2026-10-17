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
import { isMixed, mixedValue } from "./mixed";

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

  const selectFamily = (font: CatalogFont) => {
    if (readOnly) return;
    // Muat untuk canvas (nama mentah + semua weight yang dipakai) agar langsung terlihat.
    loadPreview(font.family);
    void loadSiteFont(document.fonts, font.family, font.weights, FontFace, font.family).catch(() => {});
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      const ctx = { doc: runtime.doc, origin: runtime.origin };
      if (!registered.has(font.family.toLowerCase())) runCommand(ctx, addFont, catalogFontDef(font));
      for (const node of texts) {
        // Bila typography node berupa token komposit (mis. `type.body`), ekspansi dulu lewat theme agar ukuran/
        // weight tidak hilang (mergeStyle tanpa theme mengganti token utuh — DM-032). applyStylePatch meng-expand.
        const base = resolveStyle(node.style, "base");
        const ctxTheme = theme ? { theme } : {};
        const typography = applyStylePatch(base, { typography: { fontFamily: font.family } }, ctxTheme).typography ?? {
          fontFamily: font.family,
        };
        runCommand(ctx, updateStyle, { ids: [node.id], patch: { typography } });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  return (
    <InspectorSection id="typography" title={t("inspector.typography")}>
      <InspectorRow label={t("inspector.font")}>
        <FontFamilyPicker value={current} mixed={mixed} readOnly={readOnly} onSelect={selectFamily} />
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
