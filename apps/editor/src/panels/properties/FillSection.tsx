import {
  type AssetEntry,
  type Fill,
  isTokenRef,
  listTokenPaths,
  type Node,
  registerAsset,
  resolveStyle,
  resolveToken,
  runCommand,
  updateStyle,
} from "@platform/document-model";
import { NativeSelect } from "@platform/ui";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { useDocTheme } from "../../document/use-doc-theme";
import { ColorInput } from "./color/ColorInput";
import { assetContentUrl, ImagePickerPopover } from "./ImagePickerPopover";
import { InspectorSection } from "./InspectorSection";

// ED-102/DM-029: fill solid; ED-104/DM-029: fill gambar (cover/contain/tile). Hanya untuk node fillable.
const FILLABLE = new Set<Node["type"]>(["frame", "shape", "page"]);

// Mode fill gambar (spec ED-104): cover=Fill, contain=Fit, tile=Tile.
const IMAGE_FIT_OPTIONS = [
  { value: "cover", label: "inspector.fillModeFill" },
  { value: "contain", label: "inspector.fillModeFit" },
  { value: "tile", label: "inspector.fillModeTile" },
] as const;

export function FillSection({
  runtime,
  nodes,
  siteId,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  siteId: string | undefined;
  readOnly: boolean;
}) {
  const t = useT();
  const theme = useDocTheme(runtime.doc);
  // ED-129: token warna tema untuk dipilih di picker (path + warna ter-resolve untuk preview).
  const colorTokens = useMemo(() => {
    if (!theme) return [];
    return listTokenPaths(theme)
      .filter((path) => path.startsWith("color."))
      .flatMap((path) => {
        try {
          const resolved = resolveToken(theme, path);
          return typeof resolved === "string" ? [{ path, color: resolved }] : [];
        } catch {
          return [];
        }
      });
  }, [theme]);
  const colorHex = (color: unknown): string => {
    if (typeof color === "string") return color;
    if (isTokenRef(color) && theme) {
      try {
        const resolved = resolveToken(theme, color.$token);
        if (typeof resolved === "string") return resolved;
      } catch {
        // fallback di bawah
      }
    }
    return "#000000";
  };

  const node = nodes[0];
  if (!node || !nodes.every((n) => FILLABLE.has(n.type))) return null;
  const fills = resolveStyle(node.style, "base").fills ?? [];

  const setFills = (next: readonly Fill[]) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const target of nodes) {
        runCommand({ doc: runtime.doc, origin: runtime.origin }, updateStyle, {
          ids: [target.id],
          patch: { fills: next as Fill[] },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  const update = (index: number, patch: Partial<Extract<Fill, { type: "solid" }>>) =>
    setFills(fills.map((fill, i) => (i === index && fill.type === "solid" ? { ...fill, ...patch } : fill)));
  const toggleVisible = (index: number) =>
    setFills(fills.map((fill, i) => (i === index ? { ...fill, visible: fill.visible === false } : fill)));
  const updateImageFit = (index: number, fit: "cover" | "contain" | "tile") =>
    setFills(fills.map((fill, i) => (i === index && fill.type === "image" ? { ...fill, fit } : fill)));

  // ED-104: tambah fill gambar — daftarkan asset + append fill (satu undo). Diterapkan ke semua node terseleksi.
  const addImageFill = (assetId: string, entry: AssetEntry) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      const ctx = { doc: runtime.doc, origin: runtime.origin };
      runCommand(ctx, registerAsset, { id: assetId, entry });
      for (const target of nodes) {
        const current = resolveStyle(target.style, "base").fills ?? [];
        runCommand(ctx, updateStyle, {
          ids: [target.id],
          patch: { fills: [...current, { type: "image", image: { assetId }, fit: "cover" }] as Fill[] },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  return (
    <InspectorSection id="fills" title={t("inspector.fill")}>
      <div className="flex flex-col gap-1">
        {fills.map((fill, index) => (
          // Fills adalah list terurut tanpa id stabil; index = identitas posisinya.
          // biome-ignore lint/suspicious/noArrayIndexKey: fill tidak punya id; posisi = identitas.
          <div key={index} className="flex items-center gap-2 text-xs">
            {fill.type === "solid" ? (
              <>
                <ColorInput
                  value={colorHex(fill.color)}
                  readOnly={readOnly}
                  testId={`fill-color-${index}`}
                  tokens={colorTokens}
                  onChange={(hex) => update(index, { color: hex })}
                  onPickToken={(path) => update(index, { color: { $token: path } })}
                />
                <span className="flex-1 truncate tabular-nums text-muted-foreground">
                  {isTokenRef(fill.color) ? fill.color.$token : fill.color}
                </span>
              </>
            ) : (
              <>
                {siteId ? (
                  <img
                    src={assetContentUrl(siteId, fill.image.assetId)}
                    alt=""
                    className="size-5 shrink-0 rounded border object-cover"
                  />
                ) : null}
                <NativeSelect
                  value={fill.fit}
                  disabled={readOnly}
                  data-testid={`fill-image-fit-${index}`}
                  aria-label={t("inspector.addImageFill")}
                  onChange={(event) => updateImageFit(index, event.target.value as "cover" | "contain" | "tile")}
                  className="h-7 flex-1 text-xs"
                >
                  {IMAGE_FIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
                </NativeSelect>
              </>
            )}
            <button
              type="button"
              disabled={readOnly}
              aria-label={t("inspector.fillVisible")}
              data-testid={`fill-visible-${index}`}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={() => toggleVisible(index)}
            >
              {fill.visible === false ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button
              type="button"
              disabled={readOnly}
              aria-label={t("inspector.removeFill")}
              data-testid={`fill-remove-${index}`}
              className="text-muted-foreground hover:text-destructive disabled:opacity-40"
              onClick={() => setFills(fills.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={readOnly}
            data-testid="fill-add"
            className="flex items-center gap-1 self-start rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            onClick={() => setFills([...fills, { type: "solid", color: "#000000" }])}
          >
            <Plus className="size-3.5" />
            {t("inspector.addFill")}
          </button>
          {siteId ? (
            <ImagePickerPopover
              siteId={siteId}
              readOnly={readOnly}
              label={t("inspector.addImageFill")}
              testIdPrefix="fill-image-add"
              onPick={addImageFill}
            />
          ) : null}
        </div>
      </div>
    </InspectorSection>
  );
}
