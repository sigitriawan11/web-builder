import type { ToolMode } from "../tool";

// AI-084: eval harness minimal. Tiap skenario = prompt + rubric yang menilai hasil run (validitas dokumen, pemakaian
// tool). Eksekusi run (AgentRunner worker) di-INJECT agar harness tetap di ai-tools (tak impor apps). Jalan dgn budget.

export interface EvalOutcome {
  status: "completed" | "budget_exhausted" | "failed";
  finalText: string;
  // Nama tool yang dipanggil + status (dari toolLog AgentRunner).
  toolLog: { tool: string; status: "ok" | "error" }[];
  iterations: number;
  tokens: number;
  // Dokumen valid setelah apply (opsional; rubric bisa memeriksanya).
  documentValid?: boolean;
}

export interface EvalScore {
  passed: boolean;
  score: number; // 0..1
  notes: string;
}

export interface EvalScenario {
  id: string;
  prompt: string;
  mode: ToolMode;
  entitlements?: string[];
  rubric: (outcome: EvalOutcome) => EvalScore;
}

export interface EvalResult {
  scenarioId: string;
  passed: boolean;
  score: number;
  notes: string;
  iterations: number;
  tokens: number;
}

export interface EvalSummary {
  total: number;
  passed: number;
  passRate: number;
  avgScore: number;
  results: EvalResult[];
}

export type EvalExecutor = (scenario: EvalScenario) => Promise<EvalOutcome>;

/** Jalankan semua skenario lewat `execute` (di-inject worker/test), nilai dgn rubric, agregasi. */
export async function runEvals(scenarios: readonly EvalScenario[], execute: EvalExecutor): Promise<EvalSummary> {
  const results: EvalResult[] = [];
  for (const scenario of scenarios) {
    let outcome: EvalOutcome;
    try {
      outcome = await execute(scenario);
    } catch (error) {
      results.push({
        scenarioId: scenario.id,
        passed: false,
        score: 0,
        notes: `gagal: ${(error as Error).message}`,
        iterations: 0,
        tokens: 0,
      });
      continue;
    }
    const score = scenario.rubric(outcome);
    results.push({
      scenarioId: scenario.id,
      passed: score.passed,
      score: score.score,
      notes: score.notes,
      iterations: outcome.iterations,
      tokens: outcome.tokens,
    });
  }
  const passed = results.filter((result) => result.passed).length;
  const avgScore = results.length > 0 ? results.reduce((sum, result) => sum + result.score, 0) / results.length : 0;
  return {
    total: results.length,
    passed,
    passRate: results.length > 0 ? passed / results.length : 0,
    avgScore,
    results,
  };
}

// Helper rubric: lulus bila tool `name` dipanggil sukses minimal `min` kali.
export function usedTool(outcome: EvalOutcome, name: string, min = 1): boolean {
  return outcome.toolLog.filter((entry) => entry.tool === name && entry.status === "ok").length >= min;
}
