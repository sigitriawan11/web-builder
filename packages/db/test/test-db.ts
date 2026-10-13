import { randomBytes } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { createDb, type Db } from "../src/client";

// Database untuk integration test (ARCHITECTURE §14): migration sekali ke template, lalu setiap file test
// mendapat database salinan sendiri (`CREATE DATABASE … TEMPLATE`) — cepat dan terisolasi walau berjalan paralel.

export const TEMPLATE_DB = "platform_test_template";
const TEST_DB_PREFIX = "platform_test_f";
const MIGRATIONS_FOLDER = new URL("../migrations", import.meta.url).pathname;

function adminUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST kosong — jalankan lewat `pnpm test:integration` (memuat .env root).");
  return url;
}

function urlForDatabase(database: string): string {
  const url = new URL(adminUrl());
  url.pathname = `/${database}`;
  return url.toString();
}

async function withAdmin<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: adminUrl() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Postgres test tidak bisa dihubungi (${new URL(adminUrl()).host}). Jalankan \`pnpm infra:up\` dulu.`,
      { cause: error },
    );
  }
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

/** Global setup: buat ulang template dari migration terbaru (dijalankan sekali per `pnpm test:integration`). */
export async function prepareTemplate(): Promise<void> {
  await withAdmin(async (admin) => {
    // Sisa database test dari run yang terhenti.
    const leftovers = await admin.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = $1 OR datname LIKE $2",
      [TEMPLATE_DB, `${TEST_DB_PREFIX}%`],
    );
    for (const { datname } of leftovers.rows)
      await admin.query(`DROP DATABASE IF EXISTS ${quote(datname)} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${quote(TEMPLATE_DB)}`);
  });
  const { db, close } = createDb({ connectionString: urlForDatabase(TEMPLATE_DB), maxConnections: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    // Template tidak boleh punya koneksi aktif saat disalin.
    await close();
  }
}

export interface TestDb {
  db: Db;
  name: string;
  drop: () => Promise<void>;
}

/** Database baru untuk satu file test (panggil di `beforeAll`, `drop()` di `afterAll`). */
export async function createTestDb(): Promise<TestDb> {
  const name = `${TEST_DB_PREFIX}${process.env.VITEST_POOL_ID ?? "0"}_${randomBytes(4).toString("hex")}`;
  await withAdmin(async (admin) => {
    // Postgres menolak penyalinan template yang sedang disalin worker lain → coba ulang singkat.
    for (let attempt = 1; ; attempt++) {
      try {
        await admin.query(`CREATE DATABASE ${quote(name)} TEMPLATE ${quote(TEMPLATE_DB)}`);
        return;
      } catch (error) {
        const busy = error instanceof Error && /being accessed by other users/.test(error.message);
        if (!busy || attempt >= 20) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      }
    }
  });
  const { db, close } = createDb({ connectionString: urlForDatabase(name), maxConnections: 4 });
  return {
    db,
    name,
    drop: async () => {
      await close();
      await withAdmin((admin) => admin.query(`DROP DATABASE IF EXISTS ${quote(name)} WITH (FORCE)`));
    },
  };
}
