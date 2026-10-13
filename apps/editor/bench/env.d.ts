// Benchmark berjalan di Node (Playwright), tetapi tsconfig editor sengaja tanpa `@types/node` agar tipe
// timer DOM di `src` tidak tertimpa. Cukup `process.env` untuk opsi benchmark.
declare const process: { env: Record<string, string | undefined> };
