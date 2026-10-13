import { envField, parseEnv } from "@platform/shared/env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { z } from "zod";
import { createDb } from "../src/client";
import { seedDevData } from "./dev-data";

// `pnpm db:reset` (ARCHITECTURE §15.5): drop schema → migrate → seed. Hanya lokal: menolak bila APP_ENV ≠ local
// atau host DATABASE_URL bukan loopback — `.env` yang keliru menunjuk server lain tidak boleh ikut terhapus.
const env = parseEnv(
  "db:reset",
  { DATABASE_URL: envField.url(), APP_ENV: z.enum(["local", "staging", "production"]) },
  process.env,
);
const host = new URL(env.DATABASE_URL).hostname;
if (env.APP_ENV !== "local" || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`db:reset ditolak: hanya untuk lokal (APP_ENV=${env.APP_ENV}, host=${host}).`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();
try {
  // Schema `drizzle` menyimpan riwayat migration; ikut dihapus agar migrate mulai dari awal.
  await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
} finally {
  await client.end();
}

const { db, close } = createDb({ connectionString: env.DATABASE_URL, maxConnections: 2 });
try {
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  const summary = await seedDevData(db);
  console.log(
    `Reset selesai — migration diterapkan; user: ${summary.users.join(", ")}; situs: ${summary.sites.join(", ")}`,
  );
} finally {
  await close();
}
