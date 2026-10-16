import { normalizePagePath, runCommand, updatePage, validatePagePath } from "@platform/document-model";
import { cn, Input, Label } from "@platform/ui";
import { type KeyboardEvent, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { useNode } from "../../document/use-node";
import { InspectorSection } from "../properties/InspectorSection";
import { pagesWithPaths } from "./page-actions";
import { SNIPPET_DESCRIPTION_MAX, SNIPPET_TITLE_MAX, truncateSnippet } from "./snippet";

// ED-033: pengaturan page (tab Settings saat tidak ada seleksi / "Page settings" di Pages panel): judul, path
// (slug, unik, validasi sama dengan command), SEO title & description + pratinjau snippet Google. OG image,
// noindex & canonical = M4 (detail SEO spec 07).

type Field = "title" | "path" | "seoTitle" | "seoDescription";

export function PageSettings({
  runtime,
  pageId,
  readOnly,
}: {
  runtime: CanvasRuntime;
  pageId: string;
  readOnly: boolean;
}) {
  const t = useT();
  const node = useNode(pageId);
  const [drafts, setDrafts] = useState<Partial<Record<Field, string>>>({});
  const [pathError, setPathError] = useState<string | null>(null);
  if (node?.type !== "page") return null;
  const { props } = node;

  const value = (field: Field) =>
    drafts[field] ??
    (field === "title"
      ? props.title
      : field === "path"
        ? props.path
        : field === "seoTitle"
          ? (props.seo?.title ?? "")
          : (props.seo?.description ?? ""));
  const setDraft = (field: Field, text: string) => setDrafts((current) => ({ ...current, [field]: text }));
  const clearDraft = (field: Field) =>
    setDrafts((current) => {
      const { [field]: _removed, ...rest } = current;
      return rest;
    });
  const apply = (patch: Record<string, unknown>) => {
    runtime.undo.stopCapturing();
    return runCommand({ doc: runtime.doc, origin: runtime.origin }, updatePage, { id: pageId, patch }).ok;
  };

  const commit = (field: Field) => {
    const text = drafts[field];
    if (text === undefined) return;
    if (field === "title") {
      if (text.trim()) apply({ title: text.trim().slice(0, 80) });
    } else if (field === "path") {
      const path = props.isHome ? "/" : normalizePagePath(text);
      const pages = pagesWithPaths(runtime.doc);
      const error = validatePagePath(path, { id: pageId, isHome: props.isHome === true }, pages);
      if (error) {
        setPathError(t(`pageSettings.pathError.${error}`));
        return;
      }
      setPathError(null);
      apply({ path });
    } else {
      const seo = { ...props.seo, [field === "seoTitle" ? "title" : "description"]: text.trim() || undefined };
      // Field kosong dihapus (bukan string kosong): fallback ke judul/deskripsi situs (DM-005).
      const cleaned = Object.fromEntries(Object.entries(seo).filter(([, inner]) => inner !== undefined));
      apply({ seo: cleaned });
    }
    clearDraft(field);
  };
  const onKeyDown = (field: Field) => (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Enter" && field !== "seoDescription") {
      commit(field);
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      clearDraft(field);
      if (field === "path") setPathError(null);
      event.currentTarget.blur();
    }
  };

  const seoTitle = value("seoTitle") || value("title");
  const seoDescription = value("seoDescription");
  const host = typeof window === "undefined" ? "" : t("pageSettings.previewHost");

  return (
    <div data-testid="page-settings">
      <InspectorSection id="page-settings" title={t("pageSettings.title")}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="page-title" className="text-xs">
            {t("pageSettings.name")}
          </Label>
          <Input
            id="page-title"
            className="h-7 text-xs"
            maxLength={80}
            disabled={readOnly}
            value={value("title")}
            onChange={(event) => setDraft("title", event.target.value)}
            onBlur={() => commit("title")}
            onKeyDown={onKeyDown("title")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="page-path" className="text-xs">
            {t("pageSettings.path")}
          </Label>
          <Input
            id="page-path"
            className={cn("h-7 font-mono text-xs", pathError && "border-destructive")}
            disabled={readOnly || props.isHome === true}
            aria-invalid={pathError ? true : undefined}
            aria-describedby={pathError ? "page-path-error" : undefined}
            value={value("path")}
            onChange={(event) => setDraft("path", event.target.value)}
            onBlur={() => commit("path")}
            onKeyDown={onKeyDown("path")}
          />
          {pathError ? (
            <p id="page-path-error" role="alert" className="text-xs text-destructive">
              {pathError}
            </p>
          ) : props.isHome ? (
            <p className="text-xs text-muted-foreground">{t("pageSettings.homePath")}</p>
          ) : null}
        </div>
      </InspectorSection>
      <InspectorSection id="page-seo" title={t("pageSettings.seo")}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="page-seo-title" className="text-xs">
            {t("pageSettings.seoTitle")}
          </Label>
          <Input
            id="page-seo-title"
            className="h-7 text-xs"
            maxLength={120}
            placeholder={props.title}
            disabled={readOnly}
            value={value("seoTitle")}
            onChange={(event) => setDraft("seoTitle", event.target.value)}
            onBlur={() => commit("seoTitle")}
            onKeyDown={onKeyDown("seoTitle")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="page-seo-description" className="text-xs">
            {t("pageSettings.seoDescription")}
          </Label>
          <textarea
            id="page-seo-description"
            className="min-h-16 rounded-md border bg-transparent px-2 py-1 text-xs"
            maxLength={320}
            disabled={readOnly}
            value={value("seoDescription")}
            onChange={(event) => setDraft("seoDescription", event.target.value)}
            onBlur={() => commit("seoDescription")}
            onKeyDown={onKeyDown("seoDescription")}
          />
          <span className="self-end text-[10px] tabular-nums text-muted-foreground">
            {seoDescription.length} / {SNIPPET_DESCRIPTION_MAX}
          </span>
        </div>
        {/* AC ED-033: pratinjau snippet Google (judul ±60, deskripsi ±160, dipotong). */}
        <figure
          className="rounded-md border bg-background p-2"
          data-testid="seo-preview"
          aria-label={t("pageSettings.preview")}
        >
          <p className="truncate text-[11px] text-muted-foreground">
            {host}
            {props.path === "/" ? "" : props.path}
          </p>
          <p className="text-sm leading-snug text-blue-700 dark:text-blue-400" data-testid="seo-preview-title">
            {truncateSnippet(seoTitle, SNIPPET_TITLE_MAX)}
          </p>
          <p className="text-xs leading-snug text-muted-foreground" data-testid="seo-preview-description">
            {seoDescription
              ? truncateSnippet(seoDescription, SNIPPET_DESCRIPTION_MAX)
              : t("pageSettings.noDescription")}
          </p>
        </figure>
      </InspectorSection>
    </div>
  );
}
