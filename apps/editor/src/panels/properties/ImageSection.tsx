import {
  type AssetEntry,
  type AssetRef,
  type Node,
  registerAsset,
  runCommand,
  setImage,
  setNodeProps,
} from "@platform/document-model";
import { usePlatformApi, useSiteAssets } from "@platform/sdk/react";
import type { AssetSummary } from "@platform/shared/contracts";
import { Button, Checkbox, cn, Input, NativeSelect, Popover, PopoverContent, PopoverTrigger } from "@platform/ui";
import { AlertTriangleIcon, ImageOff } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { UploadError, uploadImage, validateImageUpload } from "../../services/upload/upload";
import { showToastText } from "../../store/toast-store";
import { InspectorSection } from "./InspectorSection";
import { needsAltWarning } from "./image-alt";

// ED-165/ED-210: node image terseleksi → inspector "Image": thumbnail, Ganti (pustaka/upload), fit, titik fokus,
// alt, dekoratif, loading. Ganti gambar mempertahankan ukuran node & fit (AC ED-165). URL/stock menyusul.

function contentUrl(siteId: string, assetId: string): string {
  return `/api/v1/sites/${encodeURIComponent(siteId)}/assets/${encodeURIComponent(assetId)}/content`;
}

const FIT_OPTIONS = [
  { value: "cover", label: "inspector.fitCover" },
  { value: "contain", label: "inspector.fitContain" },
  { value: "fill", label: "inspector.fitFill" },
] as const;
const LOADING_OPTIONS = [
  { value: "auto", label: "inspector.loadingAuto" },
  { value: "lazy", label: "inspector.loadingLazy" },
  { value: "eager", label: "inspector.loadingEager" },
] as const;

export function ImageSection({
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
  const fieldId = useId();
  const node = nodes.length === 1 && nodes[0]?.type === "image" ? nodes[0] : null;
  const image = node?.type === "image" ? node.props.image : undefined;
  const fit = node?.type === "image" ? node.props.fit : "cover";
  const loading = node?.type === "image" ? (node.props.loading ?? "auto") : "auto";
  const decorative = node?.type === "image" ? node.props.decorative === true : false;

  const [alt, setAlt] = useState(image?.alt ?? "");
  // Sinkronkan input saat node/alt dokumen berubah (ganti seleksi, undo).
  // biome-ignore lint/correctness/useExhaustiveDependencies: nilai awal dari node yang sedang terpilih.
  useEffect(() => setAlt(image?.alt ?? ""), [node?.id, image?.alt]);

  if (!node || !image) return null;
  const nodeId = node.id;

  const run = (fn: () => void) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    fn();
    runtime.undo.stopCapturing();
  };
  const ctx = () => ({ doc: runtime.doc, origin: runtime.origin });

  const commitAlt = () => {
    if (readOnly) return;
    const trimmed = alt.trim();
    if ((image.alt ?? "") === trimmed) return;
    const nextImage: AssetRef = { ...image };
    if (trimmed) nextImage.alt = trimmed;
    else delete nextImage.alt;
    run(() => runCommand(ctx(), setNodeProps, { id: nodeId, patch: { image: nextImage } }));
  };
  const setDecorative = (on: boolean) =>
    run(() => runCommand(ctx(), setNodeProps, { id: nodeId, patch: { decorative: on ? true : null } }));
  const setFit = (next: "cover" | "contain" | "fill") =>
    run(() => runCommand(ctx(), setNodeProps, { id: nodeId, patch: { fit: next } }));
  const setLoading = (next: "auto" | "lazy" | "eager") =>
    run(() => runCommand(ctx(), setNodeProps, { id: nodeId, patch: { loading: next === "auto" ? null : next } }));
  const setFocal = (axis: "x" | "y", value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    const prev = image.focalPoint ?? { x: 0.5, y: 0.5 };
    run(() =>
      runCommand(ctx(), setNodeProps, {
        id: nodeId,
        patch: { image: { ...image, focalPoint: { ...prev, [axis]: clamped } } },
      }),
    );
  };
  // AC ED-165: ganti gambar → hanya assetId berubah; ukuran node & fit dipertahankan (setImage tanpa `fit`).
  const replaceWith = (assetId: string, entry: AssetEntry) =>
    run(() => {
      runtime.doc.transact(() => {
        runCommand(ctx(), registerAsset, { id: assetId, entry });
        runCommand(ctx(), setImage, { id: nodeId, image: { ...image, assetId } });
      }, runtime.origin);
    });

  const warn = needsAltWarning(image.alt, decorative);
  const focal = image.focalPoint ?? { x: 0.5, y: 0.5 };

  return (
    <InspectorSection id="image" title={t("inspector.image")}>
      <div className="flex gap-2">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
          {siteId ? (
            <img src={contentUrl(siteId, image.assetId)} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff className="size-4 text-muted-foreground" />
          )}
        </div>
        {siteId ? <ReplaceControl siteId={siteId} readOnly={readOnly} onReplace={replaceWith} /> : null}
      </div>

      <label className="flex flex-col gap-1 text-xs" htmlFor={`${fieldId}-fit`}>
        <span className="text-muted-foreground">{t("inspector.fit")}</span>
        <NativeSelect
          id={`${fieldId}-fit`}
          value={fit}
          disabled={readOnly}
          data-testid="image-fit"
          onChange={(event) => setFit(event.target.value as "cover" | "contain" | "fill")}
          className="h-7 text-xs"
        >
          {FIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </NativeSelect>
      </label>

      <div className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t("inspector.focalPoint")}</span>
        <div className="flex gap-2">
          {(["x", "y"] as const).map((axis) => (
            <Input
              key={axis}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={focal[axis]}
              disabled={readOnly}
              aria-label={`${t("inspector.focalPoint")} ${axis.toUpperCase()}`}
              data-testid={`image-focal-${axis}`}
              onChange={(event) => setFocal(axis, Number.parseFloat(event.target.value))}
              className="h-7 text-xs"
            />
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs" htmlFor={`${fieldId}-loading`}>
        <span className="text-muted-foreground">{t("inspector.loading")}</span>
        <NativeSelect
          id={`${fieldId}-loading`}
          value={loading}
          disabled={readOnly}
          data-testid="image-loading"
          onChange={(event) => setLoading(event.target.value as "auto" | "lazy" | "eager")}
          className="h-7 text-xs"
        >
          {LOADING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </NativeSelect>
      </label>

      <label className="flex flex-col gap-1 text-xs" htmlFor={`${fieldId}-alt`}>
        <span className="text-muted-foreground">{t("inspector.altText")}</span>
        <Input
          id={`${fieldId}-alt`}
          value={alt}
          disabled={readOnly || decorative}
          onChange={(event) => setAlt(event.target.value)}
          onBlur={commitAlt}
          onKeyDown={(event) => event.key === "Enter" && commitAlt()}
          placeholder={t("inspector.altPlaceholder")}
          aria-invalid={warn || undefined}
          data-testid="image-alt"
          className={cn("h-7 text-xs", warn && "border-destructive")}
        />
      </label>
      <div className="flex items-center gap-2 text-xs">
        <Checkbox
          id={`${fieldId}-dec`}
          checked={decorative}
          disabled={readOnly}
          data-testid="image-decorative"
          onCheckedChange={(next) => setDecorative(next === true)}
        />
        <label htmlFor={`${fieldId}-dec`}>{t("inspector.decorative")}</label>
      </div>
      {warn ? (
        <p className="flex items-center gap-1 text-xs text-destructive" data-testid="image-alt-warning">
          <AlertTriangleIcon className="size-3.5 shrink-0" />
          {t("inspector.altWarning")}
        </p>
      ) : null}
    </InspectorSection>
  );
}

// Popover ganti gambar: upload file baru atau pilih dari pustaka media situs (ED-165).
function ReplaceControl({
  siteId,
  readOnly,
  onReplace,
}: {
  siteId: string;
  readOnly: boolean;
  onReplace: (assetId: string, entry: AssetEntry) => void;
}) {
  const t = useT();
  const api = usePlatformApi();
  const [open, setOpen] = useState(false);
  const assets = useSiteAssets(siteId, "");
  const fileRef = useRef<HTMLInputElement>(null);
  // Segarkan pustaka saat popover dibuka (upload terbaru mungkin belum tercermin di cache query).
  useEffect(() => {
    if (open) void assets.refetch();
  }, [open, assets.refetch]);

  const pick = (asset: AssetSummary) => {
    onReplace(asset.id, { kind: asset.kind === "svg" ? "svg" : "image", mime: asset.mime });
    setOpen(false);
  };
  const onFile = async (file: File) => {
    if (validateImageUpload(file)) {
      showToastText({ id: "File gambar tidak didukung", en: "Unsupported image file" });
      return;
    }
    try {
      const { assetId, entry } = await uploadImage(file, { siteId, assets: api.assets });
      onReplace(assetId, entry);
      setOpen(false);
    } catch (error) {
      if (error instanceof UploadError) showToastText({ id: "Gagal mengunggah gambar", en: "Image upload failed" });
      else throw error;
    }
  };

  const ready = assets.data?.filter((asset) => asset.status === "ready") ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={readOnly} data-testid="image-replace" className="h-7 text-xs">
          {t("inspector.imageReplace")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          data-testid="image-replace-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void onFile(file);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          className="mb-2 w-full text-xs"
          disabled={readOnly}
          onClick={() => fileRef.current?.click()}
        >
          {t("inspector.imageUploadNew")}
        </Button>
        <p className="mb-1 text-[10px] text-muted-foreground">{t("inspector.imageReplaceFromLibrary")}</p>
        <ul className="grid max-h-48 grid-cols-3 gap-1 overflow-y-auto">
          {ready.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => pick(asset)}
                title={asset.fileName ?? ""}
                data-testid={`image-replace-asset-${asset.id}`}
                className="aspect-square w-full overflow-hidden rounded border hover:border-ring"
              >
                <img src={contentUrl(siteId, asset.id)} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
