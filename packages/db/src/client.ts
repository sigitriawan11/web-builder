import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export interface CreateDbOptions {
  connectionString: string;
  // ARCHITECTURE §15.4 `DATABASE_POOL_MAX`.
  maxConnections?: number;
}

/**
 * Client Postgres (pool `pg`) + Drizzle dengan casing snake_case. Satu per proses; `close()` saat graceful shutdown.
 * Koneksi baru dibuka saat query pertama, bukan saat dibuat.
 */
export function createDb(options: CreateDbOptions): { db: Db; close: () => Promise<void> } {
  const pool = new pg.Pool({ connectionString: options.connectionString, max: options.maxConnections ?? 10 });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  return { db, close: () => pool.end() };
}
