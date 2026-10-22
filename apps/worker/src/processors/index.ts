import type { Db } from "@platform/db";
import type { ImageStorage } from "../lib/storage";
import type { RendererService } from "../renderer-service";
import { createCleanupProcessor } from "./cleanup/cleanup.processor";
import { createDeadLetterProcessor } from "./dead-letter/dead-letter.processor";
import { createEmailProcessor, type EmailProcessorDeps } from "./email/email.processor";
import { createImageProcessingProcessor } from "./image-processing/image-processing.processor";
import { createThumbnailsProcessor } from "./thumbnails/thumbnails.processor";
import type { ProcessorRegistry } from "./types";

// Registrasi processor per queue (ARCHITECTURE §5.4). Processor ditambah di task fiturnya: cleanup (T1.13.4),
// image-processing (T2.12.2), publish (M4), thumbnails, … Dependensi (DB, provider, storage) di-inject lewat argumen.
export function createProcessors(deps: {
  db: Db;
  email: EmailProcessorDeps;
  storage?: ImageStorage;
  renderer?: RendererService;
}): ProcessorRegistry {
  return {
    email: createEmailProcessor(deps.email),
    "dead-letter": createDeadLetterProcessor({ db: deps.db }),
    cleanup: createCleanupProcessor({ db: deps.db }),
    ...(deps.storage
      ? { "image-processing": createImageProcessingProcessor({ db: deps.db, storage: deps.storage }) }
      : {}),
    // thumbnails butuh storage (bucket assets) + renderer-service (Chromium).
    ...(deps.storage && deps.renderer
      ? { thumbnails: createThumbnailsProcessor({ db: deps.db, storage: deps.storage, renderer: deps.renderer }) }
      : {}),
  };
}
