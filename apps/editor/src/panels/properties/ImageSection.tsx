import { type AssetRef, type Node, runCommand, setNodeProps } from "@platform/document-model";
import { Checkbox, cn, Input } from "@platform/ui";
import { AlertTriangleIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorSection } from "./InspectorSection";
import { needsAltWarning } from "./image-alt";

// ED-210: alt text & "Dekoratif" untuk node image. Alt per pemakaian (props.image.alt); dekoratif = alt="" sengaja
// (props.decorative). Node image lain (ganti gambar, fit, crop) menyusul bersama upload (Epic 2.12).
export function ImageSection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const decorativeId = useId();
  const node = nodes.length === 1 && nodes[0]?.type === "image" ? nodes[0] : null;
  const image = node?.type === "image" ? node.props.image : undefined;
  const decorative = node?.type === "image" ? node.props.decorative === true : false;

  const [alt, setAlt] = useState(image?.alt ?? "");
  // Sinkronkan input saat node/alt dokumen berubah (ganti seleksi, undo).
  // biome-ignore lint/correctness/useExhaustiveDependencies: nilai awal dari node yang sedang terpilih.
  useEffect(() => setAlt(image?.alt ?? ""), [node?.id, image?.alt]);

  if (!node || !image) return null;

  const commitAlt = () => {
    if (readOnly) return;
    const trimmed = alt.trim();
    if ((image.alt ?? "") === trimmed) return;
    const nextImage: AssetRef = { ...image };
    if (trimmed) nextImage.alt = trimmed;
    else delete nextImage.alt;
    runtime.undo.stopCapturing();
    runCommand({ doc: runtime.doc, origin: runtime.origin }, setNodeProps, {
      id: node.id,
      patch: { image: nextImage },
    });
    runtime.undo.stopCapturing();
  };
  const setDecorative = (on: boolean) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand({ doc: runtime.doc, origin: runtime.origin }, setNodeProps, {
      id: node.id,
      patch: { decorative: on ? true : null },
    });
    runtime.undo.stopCapturing();
  };

  const warn = needsAltWarning(image.alt, decorative);

  return (
    <InspectorSection id="image" title={t("inspector.image")}>
      <label className="flex flex-col gap-1 text-xs" htmlFor={`${decorativeId}-alt`}>
        <span className="text-muted-foreground">{t("inspector.altText")}</span>
        <Input
          id={`${decorativeId}-alt`}
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
          id={decorativeId}
          checked={decorative}
          disabled={readOnly}
          data-testid="image-decorative"
          onCheckedChange={(next) => setDecorative(next === true)}
        />
        <label htmlFor={decorativeId}>{t("inspector.decorative")}</label>
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
