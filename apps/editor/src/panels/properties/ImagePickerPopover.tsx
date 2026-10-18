import type { AssetEntry } from "@platform/document-model";
import { usePlatformApi, useSiteAssets } from "@platform/sdk/react";
import type { AssetSummary } from "@platform/shared/contracts";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@platform/ui";
import { useEffect, useRef, useState } from "react";
import { useT } from "../../app/i18n";
import { UploadError, uploadImage, validateImageUpload } from "../../services/upload/upload";
import { showToastText } from "../../store/toast-store";

// Popover pilih gambar: upload file baru atau pilih dari pustaka media situs (ED-165 ganti gambar, ED-104 image fill).
// Mengembalikan assetId + AssetEntry lewat `onPick` (pemanggil yang mendaftarkan asset & memakainya).

export function assetContentUrl(siteId: string, assetId: string): string {
  return `/api/v1/sites/${encodeURIComponent(siteId)}/assets/${encodeURIComponent(assetId)}/content`;
}

export function ImagePickerPopover({
  siteId,
  readOnly,
  label,
  testIdPrefix,
  onPick,
}: {
  siteId: string;
  readOnly: boolean;
  label: string;
  testIdPrefix: string;
  onPick: (assetId: string, entry: AssetEntry) => void;
}) {
  const t = useT();
  const api = usePlatformApi();
  const [open, setOpen] = useState(false);
  const assets = useSiteAssets(siteId, "");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) void assets.refetch();
  }, [open, assets.refetch]);

  const pick = (asset: AssetSummary) => {
    onPick(asset.id, { kind: asset.kind === "svg" ? "svg" : "image", mime: asset.mime });
    setOpen(false);
  };
  const onFile = async (file: File) => {
    if (validateImageUpload(file)) {
      showToastText({ id: "File gambar tidak didukung", en: "Unsupported image file" });
      return;
    }
    try {
      const { assetId, entry } = await uploadImage(file, { siteId, assets: api.assets });
      onPick(assetId, entry);
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
        <Button size="sm" variant="outline" disabled={readOnly} data-testid={testIdPrefix} className="h-7 text-xs">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          data-testid={`${testIdPrefix}-file`}
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
                data-testid={`${testIdPrefix}-asset-${asset.id}`}
                className="aspect-square w-full overflow-hidden rounded border hover:border-ring"
              >
                <img src={assetContentUrl(siteId, asset.id)} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
