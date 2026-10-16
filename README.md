# Platform — website builder (Figma + Wix + AI)

Monorepo pnpm + Turborepo. Ringkasan produk ada di [docs/PRD.md](docs/PRD.md), arsitektur di [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), urutan pekerjaan di [docs/ROADMAP.md](docs/ROADMAP.md). Panduan untuk AI coding agent: [CLAUDE.md](CLAUDE.md).

## Prasyarat

- **Node.js 22** (lihat `.nvmrc`) dan **pnpm 9** lewat `corepack enable`.
- **Docker** dengan Compose v2 — Docker Desktop (backend WSL2) **atau** Docker Engine di dalam WSL2, jangan keduanya.
- Git. Browser Playwright untuk e2e: `pnpm --filter @platform/editor exec playwright install chromium firefox`.

## Pertama kali

```bash
pnpm install
cp .env.example .env          # sesuaikan bila perlu (lihat "Port bentrok")
pnpm infra:up                 # Postgres, Postgres test, Redis, MinIO, Mailpit — tunggu sampai healthy
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Lalu buka `http://app.localhost:3000` dan login sebagai `owner@platform.test`.

> **Status M1 (fondasi):** daftar akun baru (kode verifikasi di Mailpit http://localhost:8025) atau login dengan user seed → dashboard **Websites** → **Create website** → editor terbuka (`/editor/:siteId`) dengan dokumen tersimpan otomatis lewat realtime + IndexedDB. Sampai toolbar M2, node ditambah lewat **tombol dev** di atas canvas (frame/teks); seleksi, drag/resize, dan undo (Ctrl+Z) memakai interaksi canvas M0. Playground canvas M0 (fixture, dev saja): http://localhost:5173/editor/.

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | Semua app dalam mode dev (turbo) |
| `pnpm dev:api` / `pnpm dev:editor` / `pnpm dev:worker` | Satu app saja (API http://localhost:4000, worker http://localhost:4200/queues) |
| `pnpm build` | Build semua app |
| `pnpm typecheck` | `tsc -b` dengan project references |
| `pnpm lint` / `pnpm format` | Biome: cek (lint + format + urutan import) / perbaiki otomatis |
| `pnpm lint:deps` | Aturan dependensi antar paket (dependency-cruiser, ARCHITECTURE §4.3) |
| `pnpm test` / `pnpm test:coverage` | Vitest unit / dengan coverage |
| `pnpm test:integration` | Test dengan Postgres asli (container `postgres-test`, port 5433) |
| `pnpm test:e2e` | Playwright (web: stack e2e sendiri — boleh jalan bersamaan dengan `pnpm dev`) |
| `pnpm bench` / `pnpm bench:canvas` | Benchmark Vitest (document-model) / benchmark canvas Playwright |
| `pnpm infra:up` / `pnpm infra:down` | Nyalakan / matikan infrastruktur lokal (data tetap di volume) |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:reset` | Migration Drizzle, seed data dev, reset: drop + migrate + seed (lokal saja) |
| `pnpm db:check` | Gagal bila schema Drizzle berubah tetapi migration belum di-generate |

`.env` di root dimuat sekali oleh script root di atas dan diwarisi semua app. Untuk menjalankan **satu app** saja: `pnpm dev:api` / `pnpm dev:editor` / `pnpm dev:worker`, atau umum `pnpm exec dotenv -e .env -- turbo run <task> --filter=<paket>`. Jangan pakai `pnpm <script> --filter …` (pnpm mengambil alih `--filter` dan melewati `.env`) maupun `pnpm <script> -- --filter …` (argumen diteruskan ke semua app).

## URL lokal

| Layanan | URL |
|---|---|
| Marketing | http://localhost:3000 |
| Dashboard + admin | http://app.localhost:3000 |
| Editor | http://app.localhost:3000/editor/:siteId (playground M0 dev: http://localhost:5173/editor/) |
| API | http://api.localhost:4000 |
| Realtime | ws://realtime.localhost:4100 |
| Worker (health + Bull Board) | http://localhost:4200/queues |
| Situs user | http://&lt;subdomain&gt;.localhost:8787 |
| MinIO console | http://localhost:9001 (`minioadmin` / `minioadmin`) |
| Mailpit | http://localhost:8025 |

## WSL2 & troubleshooting

- **Simpan repo di filesystem Linux** (`~/projects/...`), bukan `/mnt/c/...`. Di `/mnt/c` file watcher Vite/Next/wrangler lambat dan sering tidak menangkap perubahan.
- **`*.localhost` dari browser Windows** bekerja lewat localhost forwarding WSL2. Bila tidak terbuka, aktifkan mirrored networking di `%UserProfile%\.wslconfig` lalu `wsl --shutdown`:

  ```ini
  [wsl2]
  networkingMode=mirrored
  ```

  Ketersediaan `networkingMode` bergantung versi Windows/WSL (`wsl --version`).
- **`curl` di dalam WSL** sering tidak me-resolve `foo.localhost`. Kirim header Host ke loopback:

  ```bash
  curl -H 'Host: tokobudi.localhost' http://127.0.0.1:8787/
  # atau
  curl --resolve tokobudi.localhost:8787:127.0.0.1 http://tokobudi.localhost:8787/
  ```

  Browser dan Chromium Playwright me-resolve `*.localhost` sendiri.
- **Bind server dev**: dengan localhost forwarding (default) atau mode mirrored, server yang bind ke `localhost` (default Vite/Next) sudah bisa dibuka dari browser Windows. Bila forwarding tidak aktif dan mirrored tidak tersedia, jalankan dengan host `0.0.0.0` lalu buka lewat IP WSL (`hostname -I`).
- **Cookie sesi & port**: cookie login di-set untuk host `app.localhost` (port tidak memisahkan cookie). Selalu buka dashboard **dan** editor lewat `http://app.localhost:3000` — editor di-rewrite Next ke Vite sehingga satu origin dengan `/api`. Membuka editor langsung di `localhost:5173` = tidak ada sesi (hanya playground). Login dari `localhost:3000` (tanpa `app.`) juga tidak berlaku untuk `app.localhost`.
- **Kode Node & `*.localhost`**: resolver Node/WSL belum tentu me-resolve `foo.localhost` → script/test Node memakai `127.0.0.1` + header Host (lihat `apps/web/e2e/support/localhost.ts`).
- **Next 16 mengunci `distDir`** per `next dev`: e2e web memakai `.next-e2e` (`NEXT_DIST_DIR`), jadi e2e bisa jalan saat `pnpm dev` aktif; untuk `pnpm build` lokal saat dev jalan, pakai `NEXT_DIST_DIR=.next-e2e pnpm build`.
- **Port bentrok** (mis. Postgres lain sudah memakai 5432): ubah port di `.env` (`POSTGRES_PORT=5434`, dll.) **dan** port di `DATABASE_URL`, lalu `pnpm infra:down && pnpm infra:up`. Container platform terpisah dari Postgres lain di mesin Anda, sehingga `pnpm db:reset` tidak menyentuh data project lain.
- **Memori**: Playwright dan `sharp` (worker) cukup berat. Batasi memori WSL2 bila Windows ikut melambat:

  ```ini
  [wsl2]
  memory=8GB
  ```
- **Docker**: pakai satu saja — Docker Desktop dengan WSL integration, atau Docker Engine di WSL2. Keduanya bersamaan menyebabkan socket/port membingungkan.
- **WebKit Playwright** butuh library sistem: `sudo pnpm --filter @platform/editor exec playwright install-deps webkit`.
