import { useRemoveAsset, useSiteAssets } from "@platform/sdk/react";
import type { AssetSummary } from "@platform/shared/contracts";
import { cn } from "@platform/ui";
import { ImageOff, Loader2, SearchIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { insertImageNode } from "../../canvas/interactions/use-image-drop";
import { showToastText } from "../../store/toast-store";

// ED-161: pustaka media per situs — grid aset, pencarian nama, hapus, info (dimensi/ukuran), pakai ulang (klik =
// sisipkan ke halaman aktif). Thumbnail dari endpoint content (redirect presigned varian webp).

const SEARCH_DEBOUNCE_MS = 250;

function contentUrl(siteId: string, assetId: string): string {
  return `/api/v1/sites/${encodeURIComponent(siteId)}/assets/${encodeURIComponent(assetId)}/content`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetsPanel({
  runtime,
  siteId,
  readOnly,
}: {
  runtime: CanvasRuntime;
  siteId: string;
  readOnly: boolean;
}) {
  const t = useT();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setSearch(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [input]);

  const assets = useSiteAssets(siteId, search);
  const removeAsset = useRemoveAsset();

  const onInsert = (asset: AssetSummary) => {
    if (readOnly || asset.status !== "ready") return;
    insertImageNode(runtime, {
      assetId: asset.id,
      entry: { kind: asset.kind === "svg" ? "svg" : "image", mime: asset.mime },
      name: asset.fileName ?? "image",
      parentId: runtime.pageId,
    });
  };

  const onDelete = (asset: AssetSummary) => {
    if (readOnly || !window.confirm(t("assets.deleteConfirm"))) return;
    removeAsset.mutate(
      { siteId, assetId: asset.id },
      { onError: () => showToastText({ id: "Gagal menghapus aset", en: "Failed to delete asset" }) },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col p-2" data-testid="assets-panel">
      <div className="relative mb-2 shrink-0">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("assets.search")}
          aria-label={t("assets.search")}
          data-testid="assets-search"
          className="h-7 w-full rounded border bg-background pr-2 pl-7 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {assets.isError ? (
        <div className="flex flex-col items-start gap-1 p-2 text-xs text-muted-foreground">
          <span>{t("assets.loadError")}</span>
          <button type="button" className="underline" onClick={() => assets.refetch()}>
            {t("assets.retry")}
          </button>
        </div>
      ) : assets.isPending ? (
        <p className="p-2 text-xs text-muted-foreground" aria-busy>
          {t("assets.processing")}
        </p>
      ) : assets.data.length === 0 ? (
        <p className="p-2 text-xs text-muted-foreground" data-testid="assets-empty">
          {t(search ? "assets.emptySearch" : "assets.empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2" data-testid="assets-grid">
          {assets.data.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              siteId={siteId}
              readOnly={readOnly}
              onInsert={() => onInsert(asset)}
              onDelete={() => onDelete(asset)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AssetTile({
  asset,
  siteId,
  readOnly,
  onInsert,
  onDelete,
}: {
  asset: AssetSummary;
  siteId: string;
  readOnly: boolean;
  onInsert: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const ready = asset.status === "ready";
  const dims = asset.width && asset.height ? `${asset.width}×${asset.height}` : "";
  const title = [asset.fileName, dims, formatBytes(asset.sizeBytes)].filter(Boolean).join(" · ");

  return (
    <li className="group relative" data-testid="asset-tile" data-asset-id={asset.id} data-status={asset.status}>
      <button
        type="button"
        onClick={onInsert}
        disabled={!ready || readOnly}
        title={title}
        className={cn(
          "flex aspect-square w-full items-center justify-center overflow-hidden rounded border bg-muted",
          ready && !readOnly ? "cursor-pointer hover:border-ring" : "cursor-default",
        )}
      >
        {ready ? (
          <img
            src={contentUrl(siteId, asset.id)}
            alt={asset.fileName ?? ""}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : asset.status === "rejected" ? (
          <span className="flex flex-col items-center gap-1 text-[10px] text-destructive">
            <ImageOff className="size-4" />
            {t("assets.failed")}
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground" aria-busy>
            <Loader2 className="size-4 animate-spin" />
            {t("assets.processing")}
          </span>
        )}
      </button>
      {!readOnly ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("assets.delete")}
          title={t("assets.delete")}
          data-testid="asset-delete"
          className="absolute top-1 right-1 rounded bg-background/80 p-1 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={asset.fileName ?? ""}>
        {asset.fileName ?? asset.id}
      </p>
    </li>
  );
}
