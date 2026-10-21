import { validateComponentDefinition, yDocToComponentDef } from "@platform/document-model";
import { type LintViolation, lintComponent } from "@platform/library-seed/lint";
import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { selectionStore } from "../../store/selection-store";

// CMP-015/CMP-133: tab QA Mode Admin. Menjalankan linter desain statis (`@platform/library-seed/lint`) atas draft
// terkini & menampilkan pelanggaran; klik pelanggaran memilih node terkait. Aturan Playwright (R-RESPONSIVE/R-A11Y)
// & gate submit-review (blok in_review) = follow-up.

interface QaState {
  violations: LintViolation[];
  schemaIssues: number;
}

function computeQa(doc: Y.Doc): QaState {
  const result = validateComponentDefinition(yDocToComponentDef(doc));
  if (!result.ok || !result.definition) return { violations: [], schemaIssues: result.issues.length };
  return { violations: lintComponent(result.definition), schemaIssues: 0 };
}

export function QaTab({ runtime }: { runtime: CanvasRuntime | null }) {
  const t = useT();
  if (!runtime) return <p className="text-sm text-muted-foreground">{t("admin.panel.qa.noDraft")}</p>;
  return <QaReport runtime={runtime} />;
}

function QaReport({ runtime }: { runtime: CanvasRuntime }) {
  const t = useT();
  const { doc } = runtime;
  const [state, setState] = useState<QaState>(() => computeQa(doc));

  useEffect(() => {
    const recompute = () => setState(computeQa(doc));
    recompute();
    doc.on("update", recompute);
    return () => doc.off("update", recompute);
  }, [doc]);

  const select = useCallback((nodeId?: string) => {
    if (nodeId) selectionStore.getState().select([nodeId]);
  }, []);

  if (state.schemaIssues > 0)
    return (
      <p className="text-sm text-destructive">{t("admin.panel.qa.schemaInvalid", { count: state.schemaIssues })}</p>
    );
  if (state.violations.length === 0)
    return <p className="text-sm text-muted-foreground">{t("admin.panel.qa.clean")}</p>;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{t("admin.panel.qa.title")}</h3>
      <ul className="flex flex-col gap-1" data-testid="qa-list">
        {state.violations.map((v) => (
          <li key={`${v.rule}:${v.nodeId ?? ""}:${v.message}`}>
            <button
              type="button"
              className="flex w-full items-start gap-2 text-left text-sm hover:underline disabled:no-underline"
              disabled={!v.nodeId}
              onClick={() => select(v.nodeId)}
            >
              <span className="shrink-0 rounded bg-destructive/10 px-1 text-xs font-medium text-destructive">
                {v.rule}
              </span>
              <span>{v.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
