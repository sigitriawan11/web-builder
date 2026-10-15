import type { Db } from "@platform/db";
import { createDeadLetterProcessor } from "./dead-letter/dead-letter.processor";
import { createEmailProcessor, type EmailProcessorDeps } from "./email/email.processor";
import type { ProcessorRegistry } from "./types";

// Registrasi processor per queue (ARCHITECTURE §5.4). Processor ditambah di task fiturnya: cleanup (T1.13.4),
// publish (M4), thumbnails, ai-runs, … Dependensi (DB, provider) di-inject lewat argumen.
export function createProcessors(deps: { db: Db; email: EmailProcessorDeps }): ProcessorRegistry {
  return {
    email: createEmailProcessor(deps.email),
    "dead-letter": createDeadLetterProcessor({ db: deps.db }),
  };
}
