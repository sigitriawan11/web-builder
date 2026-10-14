import { formatImportPlan, formatSeedIssues, planLibraryImport } from "@platform/library-seed";

// CMP-142: import library seed. M1 = dry-run saja — tabel library (`library_categories`, `components`,
// `component_versions`, …) dibuat di M3; tulis ke DB ditambahkan bersama tabelnya. Mengembalikan exit code.
export function seedLibrary(options: { dryRun: boolean }): number {
  const plan = planLibraryImport();
  if (plan.issues.length > 0) {
    console.error(`Library seed tidak valid (${plan.issues.length} masalah):\n${formatSeedIssues(plan.issues)}`);
    return 1;
  }
  console.log(`Rencana import library (dry-run):\n${formatImportPlan(plan)}`);
  if (!options.dryRun) {
    console.error("Import library ke DB belum tersedia: tabel library dibuat di M3. Jalankan dengan --dry-run.");
    return 1;
  }
  return 0;
}
