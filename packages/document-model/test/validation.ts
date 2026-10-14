import { validateDocument } from "../src/validate/validate-document";

/** Error validasi mode publish (struktur + rujukan) sebagai `path: pesan` — helper test. */
export function publishIssues(doc: unknown): string[] {
  return validateDocument(doc, { mode: "publish" }).errors.map(
    (issue) => `${issue.path.join(".")}: ${issue.message.id}`,
  );
}
