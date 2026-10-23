import { usePlatformApi } from "@platform/sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../app/i18n";

// T3.13.9 (AI-006/AI-027): panel chat Mode Admin. Kirim prompt → buat run → stream event (SSE) → Terapkan/Batalkan.
// Event dari worker (AgentRunner) di-publish ke Redis; API meneruskan via SSE. Processor worker = follow-up; UI + alur
// apply/discard sudah lengkap & bisa di-e2e dengan event mock yang di-publish ke stream.

type Phase = "idle" | "running" | "done" | "decided";

export function ChatPanel() {
  const t = useT();
  const api = usePlatformApi();
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"applied" | "discarded" | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);
  useEffect(() => closeStream, [closeStream]);

  const send = async () => {
    const text = prompt.trim();
    if (!text || phase === "running") return;
    setOutput("");
    setDecision(null);
    setPhase("running");
    const { runId: id } = await api.ai.createRun({ kind: "admin", prompt: text });
    setRunId(id);
    // Stream event via SSE (same-origin; cookie terkirim). `text` → tambah teks; `run.completed` → aktifkan apply.
    const source = new EventSource(`/api/v1/ai/runs/${id}/events`);
    sourceRef.current = source;
    source.addEventListener("text", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { text?: string };
        if (data.text) setOutput((prev) => prev + data.text);
      } catch {
        /* abaikan */
      }
    });
    source.addEventListener("run.completed", () => {
      setPhase("done");
      closeStream();
    });
  };

  const decide = async (kind: "applied" | "discarded") => {
    if (!runId) return;
    if (kind === "applied") await api.ai.apply(runId);
    else await api.ai.discard(runId);
    setDecision(kind);
    setPhase("decided");
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-background" data-testid="ai-panel">
      <header className="border-b px-3 py-2 text-sm font-medium">{t("admin.ai.title")}</header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm" data-testid="ai-output" data-run-id={runId ?? ""}>
        {output ? (
          <p className="whitespace-pre-wrap">{output}</p>
        ) : phase === "running" ? (
          <p className="text-muted-foreground">{t("admin.ai.thinking")}</p>
        ) : (
          <p className="text-muted-foreground">{t("admin.ai.empty")}</p>
        )}
      </div>

      {phase === "done" ? (
        <div className="flex gap-2 border-t p-3">
          <button
            type="button"
            className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background"
            data-testid="ai-apply"
            onClick={() => void decide("applied")}
          >
            {t("admin.ai.apply")}
          </button>
          <button
            type="button"
            className="rounded border px-3 py-1 text-xs"
            data-testid="ai-discard"
            onClick={() => void decide("discarded")}
          >
            {t("admin.ai.discard")}
          </button>
        </div>
      ) : null}
      {decision ? (
        <p className="border-t px-3 py-2 text-xs text-emerald-600" data-testid="ai-decision">
          {decision === "applied" ? t("admin.ai.applied") : t("admin.ai.discarded")}
        </p>
      ) : null}

      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
          placeholder={t("admin.ai.placeholder")}
          value={prompt}
          data-testid="ai-prompt"
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
          data-testid="ai-send"
          disabled={phase === "running" || prompt.trim().length === 0}
        >
          {t("admin.ai.send")}
        </button>
      </form>
    </aside>
  );
}
