// DM-068/DM-069: kode issue stabil agar editor & AI bisa memperbaiki berdasarkan kode, bukan teks pesan.

export const STRUCTURE_ISSUE_CODES = [
  // Bentuk field (Zod) — pesan dari schema.
  "SCHEMA",
  "DUPLICATE_ID",
  "PARENT_MISSING",
  "CHILD_MISMATCH",
  "CYCLE",
  "ROOT_NOT_PAGE",
  "CONTAINER_TYPE",
  "HOME_PAGE",
  "DEPTH",
  // DM-008: htmlId unik per page.
  "HTML_ID_DUPLICATE",
  // DM-010: layout page tetap flex kolom, lebar fill.
  "PAGE_LAYOUT",
  // DM-027: image tidak boleh hug.
  "SIZE_MODE",
] as const;

// Rujukan ke data lain di dokumen: warning saat edit, error saat publish/ai (DM-068).
export const REFERENCE_ISSUE_CODES = ["ASSET_REF", "ASSET_KIND", "TOKEN_REF", "FONT_REF", "BROKEN_LINK"] as const;

// Lint kualitas/a11y (DM-009): selalu warning.
export const LINT_ISSUE_CODES = ["MULTIPLE_H1", "HEADING_SKIP", "IMAGE_MISSING_ALT"] as const;

export const ISSUE_CODES = [...STRUCTURE_ISSUE_CODES, ...REFERENCE_ISSUE_CODES, ...LINT_ISSUE_CODES] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

export type IssueMessage = { id: string; en: string };

export interface Issue {
  code: IssueCode;
  path: (string | number)[];
  nodeId?: string;
  pageId?: string;
  message: IssueMessage;
}

export type IssueReporter = (code: IssueCode, path: (string | number)[], message: IssueMessage) => void;

/** nodeId dari path `["nodes", id, ...]`. */
export function nodeIdOfPath(path: readonly PropertyKey[]): string | undefined {
  return path[0] === "nodes" && typeof path[1] === "string" ? path[1] : undefined;
}
