import { DOCUMENT_LIMITS } from "@platform/document-model";
import { XIcon } from "lucide-react";
import { useState } from "react";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { usePageId } from "../../canvas/canvas-runtime";
import { usePageNodeCount } from "../../document/use-page-node-count";
import { useT } from "../i18n";

// ED-223/DM-076: banner non-blocking saat page melewati soft limit node (saran: pecah page / pakai component). Hard
// limit ditolak di level command (atomik). Dapat ditutup; muncul lagi bila page lain juga melewati batas.
export function DocumentLimitBanner({ runtime }: { runtime: CanvasRuntime }) {
  const t = useT();
  const pageId = usePageId(runtime);
  const count = usePageNodeCount(runtime.doc, runtime.nodeStore, pageId);
  const { soft } = DOCUMENT_LIMITS.nodesPerPage;
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (count <= soft || dismissed === pageId) return null;
  return (
    <div
      className="flex items-center gap-2 border-b bg-amber-100 px-3 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      data-testid="document-limit-banner"
    >
      <span className="flex-1">{t("bottomBar.limitBanner", { count, soft })}</span>
      <button
        type="button"
        onClick={() => setDismissed(pageId)}
        aria-label={t("session.dismiss")}
        className="flex size-5 items-center justify-center rounded hover:bg-amber-200 dark:hover:bg-amber-900"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}
