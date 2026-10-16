import { prepareTemplate } from "./test-db";

// Database untuk stack e2e (keputusan owner T1.14.4): dibuat ulang dari migration terbaru setiap run, di Postgres test
// (`DATABASE_URL_TEST`), terpisah dari DB dev owner. Dipanggil launcher e2e apps/web (`pnpm --filter @platform/db
// db:prepare-e2e`).
const name = process.argv[2] ?? "platform_e2e";
// Penjaga: skrip ini menghapus database — hanya nama e2e yang diizinkan.
if (!/^platform_e2e[a-z0-9_]*$/.test(name)) throw new Error(`nama database e2e tidak diizinkan: ${name}`);
await prepareTemplate(name);
console.log(`database ${name} siap (migration terbaru)`);
