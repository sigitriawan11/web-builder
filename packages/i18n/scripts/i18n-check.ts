import { checkMessages, formatIssues } from "../src/check";
import { MESSAGES } from "../src/messages";

// `pnpm i18n:check` (ACC-290): gagal (exit 1) bila katalog id/en tidak lengkap atau placeholder berbeda.
const issues = checkMessages(MESSAGES);
if (issues.length > 0) {
  console.error(`i18n: ${issues.length} masalah\n${formatIssues(issues)}`);
  process.exit(1);
}
console.log("i18n: katalog id/en lengkap & konsisten");
