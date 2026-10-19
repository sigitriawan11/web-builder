import { envField, parseEnv } from "@platform/shared/env";
import { z } from "zod";
import { createDb } from "../src/client";
import { seedDevData } from "./dev-data";
import { importLibraryToDb, seedLibrary } from "./library";

// `pnpm db:seed` (root, memuat .env): data dev lokal. `pnpm db:seed --library [--dry-run]`: library platform dari
// `@platform/library-seed` (CMP-142).
const args = new Set(process.argv.slice(2));

if (args.has("--library") && args.has("--dry-run")) {
  process.exit(seedLibrary({ dryRun: true }).code);
}

const env = parseEnv(
  "db:seed",
  { DATABASE_URL: envField.url(), APP_ENV: z.enum(["local", "staging", "production"]) },
  process.env,
);

if (args.has("--library")) {
  // Tulis library platform ke DB (CMP-142). Hanya lokal (sama dengan seed dev).
  if (env.APP_ENV !== "local") {
    console.error(`db:seed --library ditolak: APP_ENV=${env.APP_ENV} (hanya \`local\`).`);
    process.exit(1);
  }
  const { db, close } = createDb({ connectionString: env.DATABASE_URL, maxConnections: 2 });
  try {
    const counts = await importLibraryToDb(db);
    console.log(
      `Library ter-import — kategori: ${counts.categories}, component: ${counts.components}, versi baru: ${counts.versions}`,
    );
  } finally {
    await close();
  }
  process.exit(0);
}
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
