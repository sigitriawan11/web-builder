import type { ComponentDefinition } from "@platform/document-model";

// CMP-015 (library-lint): aturan desain statis untuk ComponentDefinition. Fungsi murni (browser & Node) → dipakai
// editor (panel QA) & seed. Aturan yang butuh render (R-RESPONSIVE, R-A11Y kontras, R-SEMANTIC penuh) = Playwright,
// follow-up. Di sini: R-NAMING, R-SIZE, R-AUTOLAYOUT, R-TOKEN (warna literal).

export const LINT_RULES = ["R-NAMING", "R-SIZE", "R-AUTOLAYOUT", "R-TOKEN"] as const;
export type LintRule = (typeof LINT_RULES)[number];
export interface LintViolation {
  rule: LintRule;
  nodeId?: string;
  message: string;
}

// Nama layer generik dilarang (R-NAMING): "Frame 12", "Group 3", "Rectangle 1".
const GENERIC_NAME = /^(Frame|Group|Rectangle) \d+$/;
// Warna literal hex (R-TOKEN) — token (`{$token}`) & keyword (transparent/currentColor) tidak match.
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const MAX_NODES = 300;
const MAX_BYTES = 200 * 1024;
const CONTAINER_TYPES = new Set(["frame", "group"]);

/** Mode layout `style.base.layout.mode` (navigasi aman pada bentuk `unknown`). */
function layoutMode(style: unknown): string | undefined {
  const base = (style as { base?: unknown } | undefined)?.base;
  const layout = (base as { layout?: unknown } | undefined)?.layout;
  const mode = (layout as { mode?: unknown } | undefined)?.mode;
  return typeof mode === "string" ? mode : undefined;
}

/** Kunjungi semua string di nilai JSON; lewati objek token (`{$token}`) karena nilainya sah. */
function walkStrings(value: unknown, visit: (s: string) => void): void {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) for (const item of value) walkStrings(item, visit);
  else if (value && typeof value === "object") {
    if ("$token" in value) return;
    for (const item of Object.values(value)) walkStrings(item, visit);
  }
}

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

/** Lint statis ComponentDefinition → daftar pelanggaran (rule + nodeId + pesan). Kosong = lolos aturan statis. */
export function lintComponent(def: ComponentDefinition): LintViolation[] {
  const violations: LintViolation[] = [];
  const nodes = def.nodes as Record<string, Record<string, unknown>>;
  const ids = Object.keys(nodes);

  // R-SIZE: batas node & ukuran JSON.
  if (ids.length > MAX_NODES)
    violations.push({ rule: "R-SIZE", message: `Jumlah node ${ids.length} melebihi ${MAX_NODES}` });
  const bytes = byteLength(JSON.stringify(def));
  if (bytes > MAX_BYTES) violations.push({ rule: "R-SIZE", message: `Definisi ${bytes} byte melebihi ${MAX_BYTES}` });

  for (const [id, node] of Object.entries(nodes)) {
    const type = node.type;
    // R-NAMING: nama generik.
    if (typeof node.name === "string" && GENERIC_NAME.test(node.name))
      violations.push({ rule: "R-NAMING", nodeId: id, message: `Nama layer generik "${node.name}"` });

    // R-AUTOLAYOUT: container ber-anak wajib auto-layout (flex/grid), kecuali ditandai dekoratif.
    const children = node.children;
    if (
      typeof type === "string" &&
      CONTAINER_TYPES.has(type) &&
      Array.isArray(children) &&
      children.length > 0 &&
      node.decorative !== true
    ) {
      const mode = layoutMode(node.style);
      if (mode !== "flex" && mode !== "grid")
        violations.push({ rule: "R-AUTOLAYOUT", nodeId: id, message: `Container "${id}" tanpa auto-layout` });
    }

    // R-TOKEN: warna literal di style (pakai token theme).
    walkStrings(node.style, (s) => {
      if (HEX_COLOR.test(s))
        violations.push({ rule: "R-TOKEN", nodeId: id, message: `Warna literal "${s}" — pakai token theme` });
    });
  }
  return violations;
}
