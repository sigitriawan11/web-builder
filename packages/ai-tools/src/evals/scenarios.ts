import { type EvalScenario, usedTool } from "./runner";

// AI-084: 5 skenario eval admin (produksi library). Rubric memeriksa pemakaian tool yang benar + dokumen valid.

export const ADMIN_EVAL_SCENARIOS: readonly EvalScenario[] = [
  {
    id: "create-hero",
    prompt: "Buat draft component hero centered dengan judul, subjudul, dan satu tombol CTA.",
    mode: "admin_library",
    entitlements: ["ai"],
    rubric: (outcome) => ({
      passed: usedTool(outcome, "admin_create_component_draft") && outcome.documentValid !== false,
      score: usedTool(outcome, "admin_create_component_draft") ? 1 : 0,
      notes: "membuat 1 draft component",
    }),
  },
  {
    id: "three-pricing-variations",
    prompt: "Buat 3 variasi pricing table: 2 kolom, 3 kolom, dan toggle bulanan/tahunan.",
    mode: "admin_library",
    entitlements: ["ai"],
    rubric: (outcome) => {
      const count = outcome.toolLog.filter(
        (e) => e.tool === "admin_create_component_draft" && e.status === "ok",
      ).length;
      return { passed: count >= 3, score: Math.min(count / 3, 1), notes: `${count}/3 draft dibuat` };
    },
  },
  {
    id: "add-variant",
    prompt: "Tambahkan variant axis tone (primary, secondary) ke component button.",
    mode: "admin_library",
    entitlements: ["ai"],
    rubric: (outcome) => ({
      passed: usedTool(outcome, "admin_add_variant"),
      score: usedTool(outcome, "admin_add_variant") ? 1 : 0,
      notes: "menambah variant axis",
    }),
  },
  {
    id: "self-check-render",
    prompt: "Buat section fitur 3 kolom lalu periksa hasilnya dengan preview sebelum selesai.",
    mode: "admin_library",
    entitlements: ["ai"],
    rubric: (outcome) => ({
      passed: usedTool(outcome, "render_preview"),
      score: usedTool(outcome, "render_preview") ? 1 : 0,
      notes: "render_preview sebelum finish (AI-186)",
    }),
  },
  {
    id: "search-before-create",
    prompt: "Buat navbar sederhana, pastikan tidak menduplikasi component yang sudah ada.",
    mode: "admin_library",
    entitlements: ["ai"],
    rubric: (outcome) => {
      const searchIdx = outcome.toolLog.findIndex((e) => e.tool === "search_components");
      const createIdx = outcome.toolLog.findIndex((e) => e.tool === "admin_create_component_draft");
      const ordered = searchIdx !== -1 && (createIdx === -1 || searchIdx < createIdx);
      return { passed: ordered, score: ordered ? 1 : 0, notes: "search sebelum create" };
    },
  },
];
