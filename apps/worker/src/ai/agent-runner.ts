import { type RunBudget, type ToolContext, type ToolMode, ToolRegistry } from "@platform/ai-tools";
import type { ContentBlock, ModelClient, ModelMessage } from "./model";

// AI-040/041/042: loop agent (think → tool → observe). Model memanggil tool; runner mengeksekusi lewat registry +
// ToolContext (draft), mengembalikan hasil sbg `tool_result` ke model, ulangi sampai model berhenti (`end_turn`) atau
// budget habis (iterasi/waktu/commands). Loop SELALU berakhir. Setiap `tool_use` → tepat satu `tool_result`.

export type AgentRunStatus = "completed" | "budget_exhausted";

export interface AgentToolLogEntry {
  tool: string;
  status: "ok" | "error";
  errorCode?: string;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AgentToolCallRecord {
  seq: number;
  tool: string;
  status: "ok" | "error";
  errorCode?: string;
}

export interface AgentRunResult {
  status: AgentRunStatus;
  iterations: number;
  toolCalls: number;
  commands: number;
  finalText: string;
  toolLog: AgentToolLogEntry[];
  // AI-160: akumulasi token per run (Σ usage tiap panggilan model).
  usage: AgentUsage;
  // AI-107: urutan tool call (untuk ai_tool_calls).
  toolCallRecords: AgentToolCallRecord[];
}

export interface AgentEvent {
  type: "text" | "tool.started" | "tool.completed" | "tool.failed" | "run.completed";
  tool?: string;
  text?: string;
}

export interface RunAgentOptions {
  model: ModelClient;
  registry: ToolRegistry;
  ctx: ToolContext;
  mode: ToolMode;
  budget: RunBudget;
  system?: string;
  userText: string;
  entitlements?: ReadonlySet<string>;
  onEvent?: (event: AgentEvent) => void;
  now?: () => number;
}

export async function runAgent(opts: RunAgentOptions): Promise<AgentRunResult> {
  const { model, registry, ctx, mode, budget, userText, onEvent } = opts;
  const now = opts.now ?? Date.now;
  const start = now();
  const tools = ToolRegistry.toJsonSchemas(
    registry.toolsFor({ mode, ...(opts.entitlements ? { entitlements: opts.entitlements } : {}) }),
  );

  const messages: ModelMessage[] = [{ role: "user", content: [{ type: "text", text: userText }] }];
  let iterations = 0;
  let toolCalls = 0;
  let commands = 0;
  let finalText = "";
  let seq = 0;
  const toolLog: AgentToolLogEntry[] = [];
  const toolCallRecords: AgentToolCallRecord[] = [];
  const usage: AgentUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const record = (tool: string, status: "ok" | "error", errorCode?: string) => {
    toolLog.push({ tool, status, ...(errorCode ? { errorCode } : {}) });
    toolCallRecords.push({ seq: seq++, tool, status, ...(errorCode ? { errorCode } : {}) });
  };
  const finish = (status: AgentRunStatus): AgentRunResult => ({
    status,
    iterations,
    toolCalls,
    commands,
    finalText,
    toolLog,
    usage,
    toolCallRecords,
  });

  while (iterations < budget.maxIterations && now() - start < budget.maxTimeMs) {
    iterations++;
    const turn = await model.generate({
      ...(opts.system ? { system: opts.system } : {}),
      // Snapshot pesan saat ini (klien tak boleh melihat mutasi iterasi berikutnya).
      messages: [...messages],
      tools,
    });
    if (turn.usage) {
      usage.inputTokens += turn.usage.inputTokens;
      usage.outputTokens += turn.usage.outputTokens;
      usage.cacheReadTokens += turn.usage.cacheReadTokens ?? 0;
      usage.cacheWriteTokens += turn.usage.cacheWriteTokens ?? 0;
    }
    if (turn.text) {
      finalText = turn.text;
      onEvent?.({ type: "text", text: turn.text });
    }

    // Catat giliran assistant (teks + blok tool_use) ke riwayat.
    const assistantContent: ContentBlock[] = [];
    if (turn.text) assistantContent.push({ type: "text", text: turn.text });
    for (const tu of turn.toolUses)
      assistantContent.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input });
    messages.push({ role: "assistant", content: assistantContent });

    if (turn.toolUses.length === 0) {
      onEvent?.({ type: "run.completed" });
      return finish("completed");
    }

    // Jalankan setiap tool_use → tepat satu tool_result (termasuk error) sebelum panggilan model berikutnya (AI-041).
    const results: ContentBlock[] = [];
    for (const tu of turn.toolUses) {
      onEvent?.({ type: "tool.started", tool: tu.name });
      const tool = registry.get(tu.name);
      let resultBlock: ContentBlock;
      if (!tool) {
        record(tu.name, "error", "TOOL_NOT_AVAILABLE");
        onEvent?.({ type: "tool.failed", tool: tu.name });
        resultBlock = {
          type: "tool_result",
          tool_use_id: tu.id,
          is_error: true,
          content: JSON.stringify({ code: "TOOL_NOT_AVAILABLE", message: `Tool ${tu.name} is not registered.` }),
        };
      } else if (tool.mutating && commands >= budget.maxCommands) {
        record(tu.name, "error", "CHANGE_LIMIT_REACHED");
        onEvent?.({ type: "tool.failed", tool: tu.name });
        resultBlock = {
          type: "tool_result",
          tool_use_id: tu.id,
          is_error: true,
          content: JSON.stringify({
            code: "CHANGE_LIMIT_REACHED",
            message: "Change budget exhausted; finish with a partial summary.",
          }),
        };
      } else {
        const result = await tool.run(ctx, tu.input);
        toolCalls++;
        if (result.ok) {
          if (tool.mutating) commands++;
          record(tu.name, "ok");
          onEvent?.({ type: "tool.completed", tool: tu.name });
          resultBlock = { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result.output) };
        } else {
          record(tu.name, "error", result.error.code);
          onEvent?.({ type: "tool.failed", tool: tu.name });
          resultBlock = {
            type: "tool_result",
            tool_use_id: tu.id,
            is_error: true,
            content: JSON.stringify(result.error),
          };
        }
      }
      results.push(resultBlock);
    }
    messages.push({ role: "user", content: results });
  }

  // Budget habis (iterasi/waktu) tanpa `end_turn` — loop tetap berakhir (AI-041).
  onEvent?.({ type: "run.completed" });
  return finish("budget_exhausted");
}
