import {
  type LinkValue,
  type Node,
  runCommand,
  type SiteDocument,
  setNodeProps,
  yDocToJson,
} from "@platform/document-model";
import { Checkbox, cn, Input, Popover, PopoverContent, PopoverTrigger } from "@platform/ui";
import { LinkIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { nodeLinkStore } from "../../store/node-link-store";
import { InspectorSection } from "./InspectorSection";
import {
  buildNodeLink,
  formFromLink,
  LINK_KINDS,
  LINKABLE_TYPES,
  type LinkForm,
  type LinkKind,
  pageOf,
  summarizeLink,
} from "./link-section-logic";

// ED-181 / DM-055: tautan navigasi pada node (frame/image/shape/icon). Tipe page/anchor (= scroll ke bagian) +
// URL/email/telepon/WhatsApp. Teks utuh pakai mark tautan inline (ED-122), bukan section ini. Node berlink dirender
// `<a>` oleh renderer (DM-011); anchor = `#id` (scrollTo). Asset (unduh file) menyusul bersama upload Epic 2.12.

interface DocSnapshot {
  pages: { id: string; title: string }[];
  anchors: { id: string; name: string }[];
}
const EMPTY_SNAPSHOT: DocSnapshot = { pages: [], anchors: [] };

function readDoc(runtime: CanvasRuntime, selfId: string): DocSnapshot {
  const doc = yDocToJson(runtime.doc) as SiteDocument;
  const pages = doc.pageOrder.flatMap((id) => {
    const node = doc.nodes[id];
    return node?.type === "page" ? [{ id, title: node.props.title }] : [];
  });
  const pageId = pageOf(doc.nodes, selfId);
  // Target anchor = node lain di page yang sama (scrollTo menuju `#id`).
  const anchors = Object.values(doc.nodes).flatMap((node) =>
    node.id !== selfId && node.type !== "page" && pageOf(doc.nodes, node.id) === pageId
      ? [{ id: node.id, name: node.name }]
      : [],
  );
  return { pages, anchors };
}

export function LinkSection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const newTabId = useId();
  const requestId = useStore(nodeLinkStore, (state) => state.requestId);
  const [open, setOpen] = useState(false);

  const node = nodes.length === 1 && LINKABLE_TYPES.includes(nodes[0]?.type ?? "page") ? nodes[0] : null;
  const current = node && "link" in node.props ? (node.props.link as LinkValue | undefined) : undefined;

  const [kind, setKind] = useState<LinkKind>("url");
  const [form, setForm] = useState<LinkForm>({ value: "", pageId: "", anchorId: "", newTab: false });
  const [error, setError] = useState(false);
  const [snapshot, setSnapshot] = useState<DocSnapshot>(EMPTY_SNAPSHOT);
  const patch = (next: Partial<LinkForm>) => {
    setForm((prev) => ({ ...prev, ...next }));
    setError(false);
  };

  // Mod+K (ED-181) → buka popover untuk node yang sedang terseleksi. Hanya saat `requestId` naik (satu penekanan),
  // bukan saat node berganti — node/readOnly dibaca via ref agar ganti seleksi tidak membuka popover sendiri.
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  useEffect(() => {
    if (requestId > 0 && nodeRef.current && !readOnlyRef.current) setOpen(true);
  }, [requestId]);

  // Isi form dari link node saat popover dibuka (snapshot pages/anchors dibaca sekali). Hanya `open` yang di-watch:
  // form tidak boleh ter-reset saat mengetik; node & link-nya stabil selama satu sesi edit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset form sengaja hanya saat popover dibuka.
  useEffect(() => {
    if (!open || !node) return;
    setSnapshot(readDoc(runtime, node.id));
    const initial = formFromLink(current);
    setKind(initial.kind);
    setForm(initial.form);
    setError(false);
  }, [open]);

  if (!node) return null;

  const write = (link: LinkValue | null) => {
    runtime.undo.stopCapturing();
    const result = runCommand({ doc: runtime.doc, origin: runtime.origin }, setNodeProps, {
      id: node.id,
      patch: { link },
    });
    runtime.undo.stopCapturing();
    return result.ok;
  };
  const apply = () => {
    const link = buildNodeLink(kind, form);
    if (!link || !write(link)) {
      setError(true);
      return;
    }
    setOpen(false);
  };
  const remove = () => {
    write(null);
    setOpen(false);
  };

  const selectClass = cn(
    "h-7 w-full rounded border border-input bg-transparent px-1 text-xs",
    error && "border-destructive",
  );

  return (
    <InspectorSection id="link" title={t("inspector.link")}>
      <Popover open={open} onOpenChange={(next) => !readOnly && setOpen(next)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={readOnly}
            data-testid="node-link-trigger"
            className="flex items-center gap-2 rounded border border-input px-2 py-1 text-left text-xs hover:bg-accent disabled:opacity-50"
          >
            <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {current ? summarizeLink(current, snapshot.pages) : t("inspector.linkNone")}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2 p-2">
          <select
            aria-label={t("inspector.linkType")}
            data-testid="node-link-type"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as LinkKind);
              setError(false);
            }}
            className="h-7 w-full rounded border border-input bg-transparent px-1 text-xs"
          >
            {LINK_KINDS.map((option) => (
              <option key={option} value={option}>
                {t(`inspector.link_${option}`)}
              </option>
            ))}
          </select>

          {kind === "page" ? (
            <select
              aria-label={t("inspector.linkPage")}
              data-testid="node-link-page"
              value={form.pageId}
              onChange={(event) => patch({ pageId: event.target.value })}
              className={selectClass}
            >
              <option value="">—</option>
              {snapshot.pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
          ) : kind === "anchor" ? (
            <select
              aria-label={t("inspector.linkAnchor")}
              data-testid="node-link-anchor"
              value={form.anchorId}
              onChange={(event) => patch({ anchorId: event.target.value })}
              className={selectClass}
            >
              <option value="">—</option>
              {snapshot.anchors.map((anchor) => (
                <option key={anchor.id} value={anchor.id}>
                  {anchor.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              autoFocus
              value={form.value}
              onChange={(event) => patch({ value: event.target.value })}
              onKeyDown={(event) => event.key === "Enter" && apply()}
              aria-label={t("inspector.linkValue")}
              aria-invalid={error || undefined}
              data-testid="node-link-value"
              placeholder={t(`inspector.linkHint_${kind}`)}
              className={cn("h-7 text-xs", error && "border-destructive")}
            />
          )}

          {kind === "url" ? (
            <div className="flex items-center gap-2 text-xs">
              <Checkbox
                id={newTabId}
                checked={form.newTab}
                data-testid="node-link-newtab"
                onCheckedChange={(next) => patch({ newTab: next === true })}
              />
              <label htmlFor={newTabId}>{t("inspector.linkNewTab")}</label>
            </div>
          ) : null}

          <div className="flex justify-between">
            {current ? (
              <button
                type="button"
                onClick={remove}
                data-testid="node-link-remove"
                className="rounded px-2 py-1 text-xs text-destructive hover:bg-accent"
              >
                {t("inspector.linkRemove")}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={apply}
              data-testid="node-link-apply"
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            >
              {t("inspector.linkApply")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </InspectorSection>
  );
}
