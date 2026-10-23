import { describe, expect, it } from "vitest";
import { type EvalExecutor, type EvalOutcome, runEvals } from "./runner";
import { ADMIN_EVAL_SCENARIOS } from "./scenarios";

// T3.13.14 (AI-084): runner eval jalan atas 5 skenario admin dengan budget, menilai dgn rubric.

const base: Omit<EvalOutcome, "toolLog"> = {
  status: "completed",
  finalText: "done",
  iterations: 3,
  tokens: 1200,
  documentValid: true,
};

// Eksekutor mock: hasil "ideal" per skenario (seolah agent memakai tool yang benar).
const idealExecutor: EvalExecutor = (scenario) => {
  const logs: Record<string, EvalOutcome["toolLog"]> = {
    "create-hero": [{ tool: "admin_create_component_draft", status: "ok" }],
    "three-pricing-variations": [
      { tool: "admin_create_component_draft", status: "ok" },
      { tool: "admin_create_component_draft", status: "ok" },
      { tool: "admin_create_component_draft", status: "ok" },
    ],
    "add-variant": [{ tool: "admin_add_variant", status: "ok" }],
    "self-check-render": [
      { tool: "admin_create_component_draft", status: "ok" },
      { tool: "render_preview", status: "ok" },
    ],
    "search-before-create": [
      { tool: "search_components", status: "ok" },
      { tool: "admin_create_component_draft", status: "ok" },
    ],
  };
  return Promise.resolve({ ...base, toolLog: logs[scenario.id] ?? [] });
};

describe("runEvals (AI-084)", () => {
  it("5 skenario admin ada + semua lulus dgn eksekutor ideal", async () => {
    expect(ADMIN_EVAL_SCENARIOS).toHaveLength(5);
    const summary = await runEvals(ADMIN_EVAL_SCENARIOS, idealExecutor);
    expect(summary.total).toBe(5);
    expect(summary.passed).toBe(5);
    expect(summary.passRate).toBe(1);
    expect(summary.avgScore).toBe(1);
  });

  it("eksekutor yang tak memakai tool → skenario gagal (rubric menilai)", async () => {
    const summary = await runEvals(ADMIN_EVAL_SCENARIOS, () => Promise.resolve({ ...base, toolLog: [] }));
    expect(summary.passed).toBe(0);
  });

  it("eksekutor yang throw → skenario dicatat gagal, runner tetap selesai (budget)", async () => {
    const summary = await runEvals(ADMIN_EVAL_SCENARIOS.slice(0, 1), () => Promise.reject(new Error("timeout")));
    expect(summary.total).toBe(1);
    expect(summary.passed).toBe(0);
    expect(summary.results[0]?.notes).toContain("gagal");
  });
});
