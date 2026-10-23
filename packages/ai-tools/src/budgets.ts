// AI-042: budget per jenis run (maxIterations, waktu, maxCommands, maxRenders). Nilai dari spec 04; bisa di-override
// env di worker (model-router/config). Melampaui maxCommands → tool mutation balas CHANGE_LIMIT_REACHED (loop di-finish).

export type RunKind = "inline" | "chat" | "plan" | "onboarding" | "dynamic" | "commerce" | "admin";

export interface RunBudget {
  maxIterations: number;
  maxTimeMs: number;
  maxCommands: number;
  maxRenders: number;
}

export const RUN_BUDGETS: Record<RunKind, RunBudget> = {
  inline: { maxIterations: 6, maxTimeMs: 45_000, maxCommands: 80, maxRenders: 1 },
  chat: { maxIterations: 25, maxTimeMs: 300_000, maxCommands: 600, maxRenders: 4 },
  plan: { maxIterations: 12, maxTimeMs: 120_000, maxCommands: 0, maxRenders: 0 },
  onboarding: { maxIterations: 60, maxTimeMs: 600_000, maxCommands: 3_000, maxRenders: 8 },
  dynamic: { maxIterations: 50, maxTimeMs: 600_000, maxCommands: 2_000, maxRenders: 6 },
  commerce: { maxIterations: 50, maxTimeMs: 600_000, maxCommands: 2_000, maxRenders: 6 },
  admin: { maxIterations: 80, maxTimeMs: 1_200_000, maxCommands: 5_000, maxRenders: 15 },
};

// Batas lintas-jenis (AI-042): dipakai service/tool saat mencatat perubahan.
export const GLOBAL_RUN_LIMITS = {
  maxRecordsPerRun: 500,
  maxPagesCreatedPerRun: 15,
  maxDeletesPerRun: 200,
} as const;

export function budgetFor(kind: RunKind): RunBudget {
  return RUN_BUDGETS[kind];
}
