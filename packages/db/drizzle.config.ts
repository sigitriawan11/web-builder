import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` (root, memuat .env) → SQL di migrations/ (di-commit & di-review, ARCHITECTURE §6.1).
// `generate` tidak butuh koneksi DB; `migrate` memakai DATABASE_URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
