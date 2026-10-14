import { envField, parseEnv } from "@platform/shared/env";
import { z } from "zod";
import { createDb } from "../src/client";
import { seedDevData } from "./dev-data";
import { seedLibrary } from "./library";

// `pnpm db:seed` (root, memuat .env): data dev lokal. `pnpm db:seed --library [--dry-run]`: library platform dari
// `@platform/library-seed` (CMP-142).
const args = new Set(process.argv.slice(2));

if (args.has("--library")) {
  process.exit(seedLibrary({ dryRun: args.has("--dry-run") }));
}

const env = parseEnv(
  "db:seed",
  { DATABASE_URL: envField.url(), APP_ENV: z.enum(["local", "staging", "production"]) },
  process.env,
);
if (env.APP_ENV !== "local") {
  console.error(`db:seed data dev ditolak: APP_ENV=${env.APP_ENV} (hanya \`local\`).`);
  process.exit(1);
}

const { db, close } = createDb({ connectionString: env.DATABASE_URL, maxConnections: 2 });
try {
  const summary = await seedDevData(db);
  console.log(`Seed selesai — user: ${summary.users.join(", ")}; situs: ${summary.sites.join(", ")}`);
} finally {
  await close();
}
