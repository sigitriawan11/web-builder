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
  // DM-076: batas hard dokumen (`details.limit` = nama batas).
  "LIMITS",
] as const;

// Rujukan ke data lain di dokumen: warning saat edit, error saat publish/ai (DM-068).
// `INSTANCE_DEP` (DM-069): instance merujuk versi yang tercatat di `componentDeps`. Keberadaan versi di registry
// library dicek async saat publish (worker), bukan di sini.
export const REFERENCE_ISSUE_CODES = [
  "ASSET_REF",
  "ASSET_KIND",
  "TOKEN_REF",
  "FONT_REF",
  "BROKEN_LINK",
  "INSTANCE_DEP",
] as const;

// Lint kualitas/a11y (DM-009): selalu warning.
// `LIMIT_WARNING`: mendekati batas DM-076 (melewati batas soft).
// `NESTED_LINK`: link di dalam frame berlink (DM-009) — renderer melepas link dalam.
export const LINT_ISSUE_CODES = [
  "MULTIPLE_H1",
  "HEADING_SKIP",
  "IMAGE_MISSING_ALT",
  "LIMIT_WARNING",
  "NESTED_LINK",
  // ED-219/DM-009: nesting tag.
  "LI_OUTSIDE_LIST",
  "MULTIPLE_MAIN",
] as const;

// DM-045–DM-049: validasi ComponentDefinition (Mode Admin / library seed).
export const COMPONENT_ISSUE_CODES = [
  // Envelope definisi (Zod) / envelope node di dalam definisi.
  "COMPONENT_SCHEMA",
  "COMPONENT_NODE",
  // rootId tidak ada / bukan root (parentId ≠ null).
  "COMPONENT_ROOT",
  // `$prop` merujuk key yang tidak ada di propsSchema.
  "PROP_REF_UNKNOWN",
  // Key prop duplikat di propsSchema.
  "PROP_KEY_DUPLICATE",
  // Instance di dalam definisi merujuk component dirinya sendiri (langsung).
  "SELF_INSTANCE",
  // slotName duplikat dalam satu component.
  "SLOT_NAME_DUPLICATE",
  // Variant `when` merujuk axis/option yang tidak ada.
  "VARIANT_AXIS_UNKNOWN",
] as const;

export const ISSUE_CODES = [
  ...STRUCTURE_ISSUE_CODES,
  ...REFERENCE_ISSUE_CODES,
  ...LINT_ISSUE_CODES,
  ...COMPONENT_ISSUE_CODES,
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

export type IssueMessage = { id: string; en: string };

export interface Issue {
  code: IssueCode;
  path: (string | number)[];
  nodeId?: string;
  pageId?: string;
  message: IssueMessage;
  details?: IssueDetails;
}

export type IssueDetails = Record<string, string | number>;

export type IssueReporter = (
  code: IssueCode,
  path: (string | number)[],
  message: IssueMessage,
  details?: IssueDetails,
) => void;

/** nodeId dari path `["nodes", id, ...]`. */
export function nodeIdOfPath(path: readonly PropertyKey[]): string | undefined {
  return path[0] === "nodes" && typeof path[1] === "string" ? path[1] : undefined;
}
