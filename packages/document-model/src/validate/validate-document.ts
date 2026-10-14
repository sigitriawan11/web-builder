import { type SiteDocument, SiteDocumentSchema } from "../schema";
import { checkReferences } from "./invariants";
import { ISSUE_CODES, type Issue, type IssueCode, type IssueMessage, nodeIdOfPath } from "./issues";
import { lintDocument } from "./lint";

/**
 * Mode validasi (DM-068):
 * - `edit`: struktur + invariant wajib; rujukan hilang (asset/token/font/link) = warning — dokumen tetap bisa diedit;
 * - `publish`: semua rujukan wajib valid (error);
 * - `ai`: seperti publish (DM-070, M6; aturan khusus AI — embed, bindings — ditambah bersama fiturnya).
 * Lint kualitas/a11y selalu warning.
 */
export type ValidationMode = "edit" | "publish" | "ai";

export type ValidationResult =
  | { ok: true; document: SiteDocument; errors: []; warnings: Issue[] }
  | { ok: false; document?: SiteDocument; errors: Issue[]; warnings: Issue[] };

const KNOWN_CODES = new Set<string>(ISSUE_CODES);

function makeIssue(code: IssueCode, path: (string | number)[], message: IssueMessage): Issue {
  const nodeId = nodeIdOfPath(path);
  return { code, path, ...(nodeId ? { nodeId } : {}), message };
}

export function validateDocument(input: unknown, options: { mode: ValidationMode }): ValidationResult {
  const parsed = SiteDocumentSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.filter((key): key is string | number => typeof key !== "symbol");
      const params =
        issue.code === "custom" ? (issue.params as { issueCode?: unknown; en?: unknown } | undefined) : undefined;
      if (typeof params?.issueCode === "string" && KNOWN_CODES.has(params.issueCode)) {
        const en = typeof params.en === "string" ? params.en : issue.message;
        return makeIssue(params.issueCode as IssueCode, path, { id: issue.message, en });
      }
      return makeIssue("SCHEMA", path, { id: issue.message, en: issue.message });
    });
    return { ok: false, errors, warnings: [] };
  }

  const document = parsed.data;
  const references: Issue[] = [];
  checkReferences(document, (code, path, message) => references.push(makeIssue(code, path, message)));
  const lint = lintDocument(document);

  if (options.mode === "edit") return { ok: true, document, errors: [], warnings: [...references, ...lint] };
  if (references.length === 0) return { ok: true, document, errors: [], warnings: lint };
  return { ok: false, document, errors: references, warnings: lint };
}
