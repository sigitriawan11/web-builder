import type { ProcessorRegistry } from "./types";

// Registrasi processor per queue (ARCHITECTURE §5.4). Processor ditambah di task fiturnya: email (T1.13.2),
// cleanup (T1.13.4), publish (M4), thumbnails, ai-runs, … Dependensi (DB, provider) di-inject lewat argumen.
export function createProcessors(): ProcessorRegistry {
  return {};
}
