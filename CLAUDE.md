# CLAUDE.md

Panduan kerja untuk AI coding agent (Claude Code) di repo ini. Baca file ini di awal setiap sesi.

## Apa project ini

Website builder **Figma + Wix + AI** untuk UMKM dan company di Indonesia. Pengguna membuat website lewat template, component library, canvas ala Figma, atau AI asisten, lalu mempublish-nya sebagai website live di subdomain atau custom domain. Nama produk belum final: pakai placeholder **"Platform"** dan scope package `@platform/*`.

Owner adalah **solo developer**. Kode harus mudah dibaca, konsisten, dan teruji, karena tidak ada reviewer lain.

## Sumber kebenaran (baca sebelum coding)

| Dokumen | Isi | Kapan dibaca |
|---|---|---|
| [docs/PRD.md](docs/PRD.md) | Apa yang dibangun, untuk siapa, **non-goals** | Saat ragu apakah sesuatu termasuk scope |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Struktur monorepo, aturan dependensi, data, alur, ADR | Sebelum membuat file/package/tabel baru |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fase M0–M9, task, checklist, kriteria selesai | **Setiap sesi**: ambil task berikutnya dari sini |
| [docs/specs/01-document-model.md](docs/specs/01-document-model.md) | Format data inti (JSON + Yjs) | Setiap menyentuh dokumen/node/style |
| [docs/specs/02-editor.md](docs/specs/02-editor.md) | Fitur editor ala Figma (`ED-*`) | Saat mengerjakan `apps/editor` |
| [docs/specs/03-components-templates.md](docs/specs/03-components-templates.md) | Component, template, mode admin (`CMP-*`) | Library, instance, versioning |
| [docs/specs/04-ai-agent.md](docs/specs/04-ai-agent.md) | AI agent, tools, skills (`AI-*`) | `packages/ai-tools`, `apps/worker/src/ai` |
| [docs/specs/05-dynamic-data.md](docs/specs/05-dynamic-data.md) | Collections, bindings, forms, member auth, workflows (`DATA-*`) | Fitur dinamis |
| [docs/specs/06-commerce-payments.md](docs/specs/06-commerce-payments.md) | E-commerce & payment gateway milik user (`COM-*`) | Commerce |
| [docs/specs/07-publishing-hosting.md](docs/specs/07-publishing-hosting.md) | Publish, renderer output, subdomain, domain (`PUB-*`) | Renderer statis, worker publish, site-host |
| [docs/specs/08-accounts-plans-admin.md](docs/specs/08-accounts-plans-admin.md) | Akun, paket, billing, admin, moderasi, i18n (`ACC-*`) | Auth, entitlements, admin |

Aturan:
- Jika task merujuk ID requirement (mis. `ED-031`), **baca requirement itu di spec** dan penuhi acceptance criteria-nya.
- Jika spec dan kode bertentangan, **spec yang benar**. Kalau spec terasa salah, berhenti dan tanyakan ke owner; jangan diam-diam menyimpang.
- Item bertanda `❓ OPEN` belum diputuskan. **Jangan memutuskan sendiri.** Pakai rekomendasi di spec jika ada, buat agar mudah diganti (config/env), dan sebutkan di ringkasan akhir.

## Alur kerja per sesi

1. Baca `docs/ROADMAP.md` dan cari task pertama yang belum dicentang di fase aktif (kecuali owner menyebut task lain).
2. Baca requirement yang dirujuk task di spec terkait.
3. **Rencanakan dulu** (plan mode untuk task yang menyentuh > 3 file): file apa yang dibuat/diubah, test apa yang ditulis.
4. Implementasikan dalam **perubahan kecil**. Satu task = satu tujuan.
5. Verifikasi: `pnpm typecheck`, `pnpm lint`, `pnpm test` (dan `pnpm test:e2e` jika menyentuh alur UI). Jangan menyatakan selesai sebelum ini hijau. Jika ada yang gagal, laporkan apa adanya.
6. Centang task di `docs/ROADMAP.md` dan tambahkan catatan singkat jika ada keputusan baru.
7. Ringkas ke owner: apa yang berubah, cara mencobanya, dan hal yang perlu diputuskan.
8. Commit hanya jika owner meminta. Format **Conventional Commits** (`feat(editor): ...`, `fix(api): ...`).

## Stack (final, jangan diganti tanpa izin)

- **TypeScript strict** di semua tempat · ESM · monorepo **pnpm + Turborepo**
- `apps/web`: **Next.js** App Router (marketing, auth, dashboard, admin)
- `apps/editor`: **Vite + React** SPA (base `/editor/`), canvas **DOM-based** (bukan WebGL/canvas 2D)
- `apps/api`: **Express 5**
- `apps/worker`: **BullMQ + Redis** (publish, AI runs, workflow async, email, thumbnail, Playwright)
- `apps/realtime`: **Hocuspocus** (Yjs) — dipakai **sejak M1** untuk sinkronisasi & autosave (single-editor); multiplayer real-time menyusul (M9+)
- `apps/site-host`: **Cloudflare Worker** + R2 (lokal: MinIO)
- DB: **PostgreSQL** + **Drizzle ORM** (schema & migration **hanya** di `packages/db`) — **bukan** Sequelize/TypeORM/Prisma
- Validasi & tipe: **Zod** (+ drizzle-zod)
- Editor: **Yjs**, **Zustand**, **Tiptap**, **dnd-kit**, **react-arborist**, **shadcn/ui + Radix + Tailwind**, **Lucide**, tinykeys
- Auth platform: **Better Auth** · AI: **Claude API** (tool use) · Test: **Vitest** + **Playwright** · Lint/format: **Biome** + dependency-cruiser

Jangan menambah dependency baru tanpa menyebutkan alasannya ke owner. Utamakan library yang sudah ada di stack.

## Struktur & aturan dependensi

Lihat [ARCHITECTURE.md §4](docs/ARCHITECTURE.md#4-struktur-monorepo). Yang paling penting:

- `packages/*` **tidak boleh** import `apps/*`. App tidak boleh import app lain.
- `@platform/document-model` hanya boleh bergantung pada `zod`, `yjs`, `nanoid`.
- `@platform/renderer` tidak boleh import `db`, `ui`, `ai-tools`, atau API khusus editor. Output harus deterministik.
- `editor`, `web`, `site-host` **tidak boleh** import `@platform/db` atau `@platform/shared/node`.
- `workflow-blocks` dan `ai-tools` tidak mengakses DB/network langsung; efek samping lewat **ports** yang di-inject.
- Dicek oleh `pnpm lint:deps`. Jangan mematikan rule untuk "membuat lolos".

### Struktur modul API (Express)

```
apps/api/src/modules/<fitur>/
  <fitur>.routes.ts       # hanya routing + middleware
  <fitur>.controller.ts   # baca request, panggil service, kirim response
  <fitur>.service.ts      # business logic, transaksi
  <fitur>.repository.ts   # SATU-SATUNYA tempat import tabel Drizzle
  <fitur>.schema.ts       # Zod request/response (atau di @platform/shared/contracts)
```

## Aturan wajib (jangan dilanggar)

### Document model
- **Semua perubahan dokumen lewat ops/command API** di `@platform/document-model` (lihat spec 01). Jangan memanipulasi Y.Doc atau JSON dokumen secara langsung dari editor, AI tools, atau worker.
- Referensi token memakai format `{ "$token": "..." }`, referensi prop `{ "$prop": "..." }`, sesuai spec 01. Jangan membuat format alternatif.
- Style responsif disimpan sebagai `{ base, tablet?, mobile? }` sesuai spec 01.
- Perubahan schema dokumen **wajib**: naikkan `schemaVersion`, tulis fungsi migrasi, dan tambahkan fixture test.
  - **Pengecualian M1 (keputusan owner 2026-10-14):** selama M1 `schemaVersion: 1` masih draft — Epic 1.8/1.9 boleh mengubah schema v1 langsung (perbarui fixture, seed, factory; DB dev di-`pnpm db:reset` bila perlu). v1 **dibekukan sebelum deploy pertama**; sejak itu aturan di atas berlaku penuh.

### Multi-tenant & keamanan
- **Setiap query data tenant wajib di-scope** dengan `site_id`/`workspace_id` lewat `TenantContext` di repository. Tidak ada query tenant tanpa scope.
- `siteId`/`workspaceId` berasal dari **session/token server**, tidak pernah dari input model AI atau body request yang tidak diverifikasi.
- Validasi semua input di boundary dengan Zod (request API, payload job, output tool AI, webhook).
- Kredensial payment user dan secret lain: **enkripsi envelope** (`@platform/shared/node`), tidak pernah dikirim ke client, ke AI, atau ke log.
- Konten user dirender dengan escaping. Tidak ada `dangerouslySetInnerHTML` kecuali lewat sanitizer yang sudah ditentukan.
- Tidak ada `eval`, `new Function`, atau eksekusi kode dari data user/AI. Ekspresi workflow/binding memakai parser sendiri (spec 05).
- HTTP keluar dari data user/AI wajib lewat SSRF guard.

### AI
- AI **hanya** bertindak lewat tools di `@platform/ai-tools`. Jangan membuat jalur di mana model menghasilkan kode yang dijalankan.
- Setiap tool punya schema Zod, pesan error yang bisa dipahami model, dan pengecekan entitlement.
- Model ID diambil dari config/env (`AI_MODEL_CONFIG`), tidak di-hardcode.
- Perubahan AI masuk **draft** (fork Y.Doc per run, origin `ai:<runId>`) dan baru masuk dokumen site saat user klik **Terapkan** — satu transaksi, satu undo (spec 04 §7, ARCHITECTURE §10.4).

### Database
- Migration lewat `pnpm db:generate` (drizzle-kit), file SQL di-commit. **Jangan** `drizzle-kit push` ke database selain lokal.
- Kolom `snake_case`; PK UUIDv7 (kecuali tabel append-only bervolume tinggi: bigint identity); `created_at`, `updated_at`, `deleted_at` (soft delete) untuk tabel tenant.
- Uang disimpan sebagai **integer IDR** (`bigint`), tidak pernah float.

### Kode
- **Tanpa `any`.** Pakai `unknown` + Zod. Tipe diturunkan dengan `z.infer`, jangan menulis interface duplikat.
- Error yang diharapkan: `throw new AppError(code, status, details)`. Jangan menelan error tanpa log.
- Enqueue job **setelah** transaksi commit.
- Penamaan: file `kebab-case.ts`, komponen `PascalCase.tsx`, fungsi/variabel `camelCase`, konstanta `UPPER_SNAKE`, kolom DB `snake_case`.
- Kelompokkan kode per fitur, bukan per jenis file.
- Ikuti pola file tetangga. Sebelum membuat helper baru, cari dulu apakah sudah ada (terutama di `@platform/shared` dan `@platform/document-model`).
- Komentar seperlunya: jelaskan **kenapa**, bukan apa.
- String UI tidak di-hardcode: lewat `@platform/i18n` (ID default, EN).

### Scope
- **Jangan** mengerjakan hal di luar task aktif. Temuan lain dicatat di ringkasan, bukan langsung dikerjakan.
- **Jangan** menambah fitur yang ada di daftar **non-goals** PRD (§10): export kode, import Figma, kode backend bebas, platform memegang dana, editor mobile, dan seterusnya.
- **Jangan** mengerjakan fitur P1/P2 saat fase aktif masih punya P0 yang belum selesai.

## Testing

- `packages/document-model`, `packages/renderer`, `packages/workflow-blocks`: **wajib** unit test untuk setiap ops/fungsi publik.
- Renderer: snapshot test HTML/CSS per jenis node + visual regression untuk component library.
- API: integration test dengan Postgres asli (docker, port 5433), termasuk **test isolasi tenant** (user A tidak bisa membaca data B) untuk setiap endpoint data.
- Editor: unit test untuk geometri/snapping/hit-test; Playwright untuk alur interaksi utama.
- Bug fix: tulis test yang mereproduksi bug **sebelum** memperbaikinya.

## Perintah

```bash
pnpm install
pnpm infra:up            # Postgres, Redis, MinIO, Mailpit (docker)
pnpm db:migrate && pnpm db:seed
pnpm dev                 # semua app (turbo)
pnpm typecheck && pnpm lint && pnpm lint:deps && pnpm test
pnpm test:integration    # api + Postgres
pnpm test:e2e            # Playwright
pnpm db:generate         # buat migration dari perubahan schema Drizzle
pnpm db:reset            # lokal saja
```

## URL lokal

| Layanan | URL |
|---|---|
| Marketing | http://localhost:3000 |
| Dashboard + admin | http://app.localhost:3000 |
| Editor | http://app.localhost:3000/editor/:siteId |
| API | http://api.localhost:4000 (browser memanggil lewat `app.localhost:3000/api/*`) |
| Realtime | ws://realtime.localhost:4100 |
| Situs user | http://&lt;subdomain&gt;.localhost:8787 (production: `<sub>.platformmu.site`, dari env `SITES_ROOT_DOMAIN`) |
| MinIO console | http://localhost:9001 |
| Mailpit | http://localhost:8025 |

User dev dari seed: `owner@platform.test` (user biasa), `admin@platform.test` (staff `super_admin`). Password login keduanya: **`platform-dev-123`** (override via env `SEED_DEV_PASSWORD` saat `pnpm db:seed`; hanya dev, bukan produksi). Lingkungan owner: **WSL2**; buka URL di browser Windows.

Detail lengkap: [ARCHITECTURE.md §15](docs/ARCHITECTURE.md#15-development-environment).

## Saat ragu

- Cek spec terkait, lalu ARCHITECTURE.
- Masih ragu? **Tanya owner** dengan opsi + rekomendasi, jangan menebak untuk keputusan yang sulit dibalik (schema data, format dokumen, API publik, keamanan).
