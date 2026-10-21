import {
  type AssetEntry,
  type AssetRef,
  type Node,
  registerAsset,
  runCommand,
  setImage,
  setNodeProps,
} from "@platform/document-model";
import { Checkbox, cn, Input, NativeSelect } from "@platform/ui";
import { AlertTriangleIcon, ImageOff } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { assetContentUrl, ImagePickerPopover } from "./ImagePickerPopover";
import { InspectorSection } from "./InspectorSection";
import { needsAltWarning } from "./image-alt";

// ED-165/ED-210: node image terseleksi → inspector "Image": thumbnail, Ganti (pustaka/upload), fit, titik fokus,
// alt, dekoratif, loading. Ganti gambar mempertahankan ukuran node & fit (AC ED-165). URL/stock menyusul.

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
  const ctx = () => runtime.commandCtx;

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
            <img src={assetContentUrl(siteId, image.assetId)} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff className="size-4 text-muted-foreground" />
          )}
        </div>
        {siteId ? (
          <ImagePickerPopover
            siteId={siteId}
            readOnly={readOnly}
            label={t("inspector.imageReplace")}
            testIdPrefix="image-replace"
            onPick={replaceWith}
          />
        ) : null}
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
