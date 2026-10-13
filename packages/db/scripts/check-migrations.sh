#!/bin/sh
# Migration check (ARCHITECTURE §16.1, dipakai CI T1.16.1): gagal bila schema Drizzle berubah tetapi migration
# belum di-generate, atau file migration tidak konsisten. Tidak butuh koneksi database.
set -eu
cd "$(dirname "$0")/.."

npx drizzle-kit check
before=$(ls migrations/*.sql | wc -l)
npx drizzle-kit generate --name=pending_schema_change >/dev/null
after=$(ls migrations/*.sql | wc -l)

if [ "$after" -ne "$before" ]; then
  echo "✗ Schema Drizzle berubah tanpa migration. Sudah dibuat file migration baru di packages/db/migrations —"
  echo "  periksa isinya, beri nama yang jelas (pnpm db:generate -- --name=<nama>), lalu commit."
  exit 1
fi
echo "✓ Migration sinkron dengan schema."
