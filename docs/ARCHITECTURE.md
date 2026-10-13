# Architecture

> **Status:** Draft v1 · **Pemilik:** owner (solo developer) · **Pembaca:** owner + AI coding agent (Claude Code)
> **Nama produk:** belum ditentukan — dokumen ini memakai placeholder **"Platform"**, domain contoh `platformmu.com`, scope package `@platform/*`.
>
> Dokumen ini menjelaskan **bagaimana sistem dibangun**: komponen, batas tanggung jawab, data, alur, keamanan, operasional, dan keputusan arsitektur (ADR). Detail fitur ada di spesifikasi:
>
> | Spec | Isi |
> |---|---|
> | [01 Document Model](./specs/01-document-model.md) | Skema node, style + breakpoints, ID, Yjs mapping, migrasi skema |
> | [02 Editor](./specs/02-editor.md) | Fitur canvas ala Figma |
> | [03 Components & Templates](./specs/03-components-templates.md) | Library, versi, instance, mode admin |
> | [04 AI Agent](./specs/04-ai-agent.md) | Agent loop, tools, skills, kredit, evals |
> | [05 Dynamic Data](./specs/05-dynamic-data.md) | Collections, bindings, forms, end-user auth, workflows |
> | [06 Commerce & Payments](./specs/06-commerce-payments.md) | Produk, checkout, BYO payment gateway |
> | [07 Publishing & Hosting](./specs/07-publishing-hosting.md) | Publish, output renderer, domain, SEO |
> | [08 Accounts, Plans & Admin](./specs/08-accounts-plans-admin.md) | Akun, paket, billing, admin, moderasi, i18n |
>
> Dokumen terkait: [PRD](./PRD.md) · [ROADMAP](./ROADMAP.md) · [CLAUDE.md](../CLAUDE.md) (konvensi coding detail).
>
> **Aturan prioritas:** jika dokumen ini bertentangan dengan spec untuk hal *fitur* (mis. bentuk node, aturan paket), **spec yang menang**. Untuk hal *struktur sistem* (package, boundary, infra, keamanan), **dokumen ini yang menang**.

## Daftar isi

1. [Ringkasan & prinsip arsitektur](#1-ringkasan--prinsip-arsitektur)
2. [Diagram sistem](#2-diagram-sistem)
3. [Domain, host & routing](#3-domain-host--routing)
4. [Struktur monorepo](#4-struktur-monorepo)
5. [Aplikasi (apps/*)](#5-aplikasi-apps)
6. [Data architecture](#6-data-architecture)
7. [Penyimpanan dokumen editor](#7-penyimpanan-dokumen-editor)
8. [Alur kunci (sequence diagrams)](#8-alur-kunci-sequence-diagrams)
9. [Auth & security](#9-auth--security)
10. [AI architecture](#10-ai-architecture)
11. [Workflow engine](#11-workflow-engine)
12. [Runtime API vs Platform API](#12-runtime-api-vs-platform-api)
13. [Observability](#13-observability)
14. [Testing strategy](#14-testing-strategy)
15. [Development environment](#15-development-environment)
16. [CI/CD & deployment](#16-cicd--deployment)
17. [Scalability path](#17-scalability-path)
18. [Coding conventions (ringkas)](#18-coding-conventions-ringkas)
19. [Daftar keputusan terbuka](#19-daftar-keputusan-terbuka)
20. [Architecture Decision Records](#20-architecture-decision-records)

---

## 1. Ringkasan & prinsip arsitektur

### 1.1 Ringkasan

Platform adalah website builder (Figma + Wix + AI) yang terdiri dari:

- **Control plane** — tempat pengguna *membuat* website: dashboard (Next.js), editor canvas (React SPA), Platform API (Express), worker (BullMQ), realtime (Hocuspocus), PostgreSQL, Redis.
- **Data plane** — tempat pengunjung *memakai* website: Cloudflare Worker `site-host` yang menyajikan file statis dari R2, plus **Runtime API** untuk bagian dinamis (form, member login, CRUD, checkout).

Keduanya dipisah sejak awal secara *logis* (router, auth, rate limit, domain berbeda), walau di fase awal Runtime API berjalan di proses Express yang sama dengan Platform API (lihat [§12](#12-runtime-api-vs-platform-api)).

### 1.2 Prinsip

| # | Prinsip | Implikasi konkret |
|---|---|---|
| P1 | **Document model adalah pusat sistem.** | Semua cara membuat website (template, component, canvas, AI) hanya memanipulasi satu dokumen yang divalidasi `@platform/document-model`. Tidak ada "format kedua" untuk template, AI, atau publish. |
| P2 | **Satu renderer untuk editor dan publish (WYSIWYG).** | `@platform/renderer` dipakai editor (React live) dan publish (`renderToStaticMarkup` + CSS). Editor hanya menambah *overlay* di atasnya; tidak pernah me-render node dengan kode berbeda. |
| P3 | **Static-first publish.** | Situs dipublish sebagai HTML + CSS statis di R2/CDN. JavaScript hanya untuk *islands* (komponen interaktif/data-bound). Biaya per situs Free ≈ biaya storage. |
| P4 | **AI hanya via tools.** | AI tidak menulis kode atau JSON bebas ke database. Setiap aksi AI = pemanggilan tool berskema Zod, divalidasi, dijalankan sebagai transaksi dokumen ber-origin `ai` yang bisa di-undo sekaligus. |
| P5 | **Tenant isolation di setiap layer.** | Setiap query tenant wajib melalui repository ber-`TenantContext`; setiap tabel tenant punya `site_id`/`workspace_id`; situs user di domain terpisah; Runtime API hanya menerima `site_id` dari token tertanda site-host. |
| P6 | **Bangun nanti, rancang sekarang.** | Yjs (multiplayer) dipakai sejak M1; style disimpan `{ base, tablet, mobile }` sejak M1; component berversi immutable sejak M3; Runtime API dipisah router sejak M7. Hal-hal ini mahal untuk di-*retrofit*. |
| P7 | **Sederhana untuk solo developer.** | Sedikit service, satu bahasa (TypeScript), satu DB (Postgres), satu queue (Redis/BullMQ). Pemisahan proses dilakukan ketika metrik menuntut, bukan lebih awal. |
| P8 | **Zod di setiap boundary.** | HTTP request/response, job payload, tool AI, workflow step, env var, dan dokumen tervalidasi Zod. Tipe TS diturunkan dari Zod (`z.infer`), bukan ditulis dua kali. |
| P9 | **Idempotent & dapat diulang.** | Publish, webhook, workflow, dan job worker aman dijalankan ulang (idempotency key, upsert, Yjs update yang idempotent). |

---

## 2. Diagram sistem

### 2.1 Komponen

```
                               ┌──────────────────────────── Browser ─────────────────────────────┐
                               │                                                                  │
   Pengguna (pemilik situs)    │  apps/web (Next.js)          apps/editor (Vite React SPA)        │
   ─────────────────────────►  │  app.platformmu.com          app.platformmu.com/editor/:siteId   │
                               │   dashboard/admin/billing     canvas + panels + AI chat          │
                               │        │  same-origin /api/*        │ /api/*   │ wss     │ SSE    │
                               └────────┼────────────────────────────┼──────────┼─────────┼────────┘
                                        ▼                            ▼          │         │
                          ┌──────────────────────────────┐           │          │         │
                          │ Next.js server (rewrites)    │◄──────────┘          │         │
                          │  /api/*    → apps/api        │                      │         │
                          │  /editor/* → editor static   │                      │         │
                          └──────────────┬───────────────┘                      │         │
                                         ▼                                      ▼         ▼
 ┌───────────────────┐   HTTP   ┌──────────────────────────────┐  internal ┌──────────────────────┐
 │ Payment gateways  │─webhook─►│ apps/api (Express 5)         │◄─────────►│ apps/realtime        │
 │ (platform billing │          │  /v1/*        Platform API   │   HTTP    │ (Hocuspocus, Yjs)    │
 │  + gateway milik  │◄─────────│  /auth/*      Better Auth    │           │ realtime.platformmu  │
 │  user: Midtrans/  │  API     │  /runtime/v1/* Runtime API   │           └─────────┬────────────┘
 │  Xendit)          │          │  /webhooks/*  inbound hooks  │                     │
 └───────────────────┘          │  /internal/*  service-only   │                     │
                                └───┬───────────┬──────────┬───┘                     │
                                    │ SQL       │ enqueue  │ pub/sub                 │ SQL
                                    ▼           ▼          ▼                         ▼
                          ┌──────────────┐  ┌────────────────┐              ┌──────────────┐
                          │ PostgreSQL   │  │ Redis          │              │ PostgreSQL   │
                          │ (Drizzle)    │◄─┤ BullMQ, rate   │              │ (sama)       │
                          └──────▲───────┘  │ limit, pub/sub │              └──────────────┘
                                 │          └───────┬────────┘
                                 │ SQL              │ consume
                          ┌──────┴──────────────────▼──────────────────────────────┐
                          │ apps/worker (Node, BullMQ)                             │
                          │  publish · thumbnails · ai-runs · workflow-exec ·      │
                          │  email · whatsapp · image-processing · domains ·       │
                          │  cleanup  +  Playwright renderer pool (Chromium)       │
                          └──┬───────────┬──────────────┬────────────┬─────────────┘
                             │ S3 API    │ HTTPS        │ HTTPS      │ HTTPS
                             ▼           ▼              ▼            ▼
                      ┌────────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐
                      │ Cloudflare │ │ Claude   │ │ Email /   │ │ Cloudflare API   │
                      │ R2 (MinIO  │ │ API      │ │ WhatsApp  │ │ (KV write,       │
                      │ di lokal)  │ │          │ │ provider  │ │ custom hostnames)│
                      └─────▲──────┘ └──────────┘ └───────────┘ └────────┬─────────┘
                            │ R2 binding                                 │
                      ┌─────┴──────────────────────────────────┐         │
   Pengunjung situs   │ apps/site-host (Cloudflare Worker)     │◄────────┘ KV: host → deployment
   ─────────────────► │  *.platformmu.site + custom domains    │
                      │  static files dari R2 + edge cache     │── /_api/* ──► apps/api /runtime/v1/*
                      └────────────────────────────────────────┘    (signed site token)
```

### 2.2 Tanggung jawab singkat

| Komponen | Runtime | Tanggung jawab | Stateful? |
|---|---|---|---|
| `apps/web` | Node (Next.js) | Marketing, auth UI, dashboard, billing UI, admin panel, proxy `/api` & `/editor` | Tidak |
| `apps/editor` | Browser (static) | Canvas, panels, tools, AI chat UI, Yjs client | IndexedDB lokal |
| `apps/api` | Node (Express 5) | Platform API, Better Auth, Runtime API, webhooks, internal endpoints, SSE AI | Tidak |
| `apps/worker` | Node (BullMQ) | Job asinkron, AI orchestrator, Playwright renderer, workflow async | Tidak |
| `apps/realtime` | Node (Hocuspocus) | Sinkronisasi Yjs via WebSocket, persistence dokumen | Dokumen in-memory (cache) |
| `apps/site-host` | Cloudflare Worker | Menyajikan situs publish, routing host, proxy `/_api` | Tidak (KV/R2) |
| PostgreSQL | — | Source of truth semua data | Ya |
| Redis | — | Queue, rate limit, pub/sub, lock, cache pendek | Ya (boleh hilang kecuali queue) |
| R2 | — | Aset user, file deployment, backup | Ya |

---

## 3. Domain, host & routing

### 3.1 Production

| Host | Dilayani oleh | Isi |
|---|---|---|
| `platformmu.com`, `www.` | `apps/web` | Marketing, pricing, blog/docs (route group `(marketing)`) |
| `app.platformmu.com` | `apps/web` | Auth UI, dashboard, billing, admin; **rewrite** `/api/*` → api, `/editor/*` → editor static |
| `api.platformmu.com` | `apps/api` | Webhook inbound (payment gateway), Runtime API origin (dipanggil site-host), endpoint SSE AI dengan stream token, public API (P2, token-based). **Tidak** menerima cookie session platform. |
| `realtime.platformmu.com` | `apps/realtime` | WebSocket Yjs (`wss://`), auth dengan token pendek |
| `*.platformmu.site` | `apps/site-host` | Situs pengguna: `x7k2p9mq.platformmu.site` (Free, acak), `tokobudi.platformmu.site` (Starter+) |
| `cname.platformmu.site` | `apps/site-host` | Target CNAME untuk custom domain (Cloudflare for SaaS fallback origin) |
| `assets.platformmu.site` | R2 custom domain / site-host | Aset upload pengguna (gambar, font, file) — domain tanpa cookie |
| custom domain (`www.tokobudi.id`) | `apps/site-host` | Situs Pro+ via Cloudflare Custom Hostnames |

**Keputusan:** situs pengguna dan aset upload berada di **domain terpisah** (`platformmu.site`) dari domain platform (`platformmu.com`). Alasan (lihat [ADR-009](#adr-009-domain-terpisah-untuk-situs-pengguna)):

1. **Cookie isolation** — JavaScript di situs pengguna (islands, embed P2) tidak pernah berada di *site* yang sama dengan `app.platformmu.com`, sehingga tidak bisa membaca/menulis cookie platform atau memicu request same-site yang lolos `SameSite=Lax`.
2. **Reputasi domain** — jika ada situs phishing/spam, yang terdampak blocklist (Google Safe Browsing, filter email) adalah `platformmu.site`, bukan domain dashboard dan email transaksional platform.
3. **Public Suffix List** — `platformmu.site` didaftarkan ke PSL agar setiap subdomain dianggap *site* terpisah oleh browser (cookie antar-situs pengguna juga terisolasi).

> ❓ OPEN: nama domain final (produk & domain situs). Default yang dipakai semua dokumen: situs pengguna di `*.platformmu.site`; kode **selalu** membaca root domain situs dari env `SITES_ROOT_DOMAIN` (lokal: `<sub>.localhost:8787`), tidak pernah hardcode.

### 3.2 Strategi cookie & koneksi lintas host

- Cookie session platform (Better Auth) **host-only** di `app.platformmu.com` (`Secure; HttpOnly; SameSite=Lax`, tanpa atribut `Domain`).
- Browser **selalu** memanggil Platform API melalui **same-origin** `app.platformmu.com/api/*` (Next.js rewrite → `apps/api`). Tidak ada CORS dengan credentials.
- Koneksi yang tidak cocok lewat proxy (WebSocket realtime, SSE AI yang panjang) memakai **token pendek bertanda tangan** yang diambil via same-origin API:
  - `POST /api/v1/realtime/token` → JWT 5 menit → `wss://realtime.platformmu.com?token=…`
  - `POST /api/v1/sites/:siteId/ai/runs` → `{ runId, streamToken }` → `GET https://api.platformmu.com/v1/ai/runs/:runId/events?token=…` (endpoint lengkap: [spec 04 AI-051](./specs/04-ai-agent.md#ai-051-endpoint-api-ai))
- Cookie end-user situs (member login) **host-only** di domain situs, di-set oleh Runtime API lewat proxy `/_api` site-host (atribut `Domain` dibuang).

### 3.3 Lokal (development)

**Keputusan:** pakai `*.localhost` + port — tidak perlu edit `/etc/hosts`, karena browser modern me-resolve `*.localhost` ke loopback.

| URL lokal | Ke | Catatan |
|---|---|---|
| `http://localhost:3000` | `apps/web` (marketing) | Host tanpa subdomain → route group `(marketing)` |
| `http://app.localhost:3000` | `apps/web` (dashboard/admin) | Cookie session host-only di `app.localhost` |
| `http://app.localhost:3000/editor/:siteId` | rewrite → Vite `localhost:5173` | HMR WebSocket langsung ke `localhost:5173` (`server.hmr.clientPort`) |
| `http://app.localhost:3000/api/*` | rewrite → `http://localhost:4000/*` | Jalur utama browser → API |
| `http://api.localhost:4000` | `apps/api` langsung | Webhook test, SSE, Runtime API |
| `ws://realtime.localhost:4100` | `apps/realtime` | |
| `http://<sub>.localhost:8787` | `apps/site-host` (`wrangler dev`) | Mis. `x7k2p9mq.localhost:8787`, `tokobudi.localhost:8787`. Semua host di port 8787 dianggap situs. |
| `http://localhost:9000/assets/...` | MinIO | Pengganti `assets.platformmu.site` |

Pemetaan production ↔ lokal dikonfigurasi lewat env (`PUBLIC_APP_URL`, `PUBLIC_API_URL`, `PUBLIC_REALTIME_URL`, `SITES_ROOT_DOMAIN` (+ `SITES_PORT`, `SITES_PROTOCOL`), `PUBLIC_ASSETS_URL`). **Kode tidak boleh meng-hardcode domain.**

> Opsional (bukan default): mode `platform.test` dengan Caddy + mkcert (`app.platform.test`, `*.sites.platform.test` via dnsmasq) untuk menguji HTTPS, cookie `Secure`, dan alur custom domain yang mendekati production. Placeholder `platform.test` di dokumen lain merujuk mode ini.

### 3.4 Routing di dalam `app.<domain>`

Urutan (Next.js `middleware.ts` + `rewrites()` `beforeFiles`):

1. `/api/:path*` → `${API_INTERNAL_URL}/:path*` (header `x-forwarded-host`, `x-request-id` diteruskan).
2. `/editor/:path*` → `${EDITOR_ORIGIN}/editor/:path*`; jika file tidak ada → `index.html` (SPA fallback). Middleware memeriksa *keberadaan* cookie session sebelum rewrite; tanpa cookie → redirect `/login?next=…`. Validasi session sesungguhnya dilakukan editor via `GET /api/v1/me`.
3. Selain itu → App Router (`(auth)`, `(dashboard)`, `(admin)`).
4. Host tanpa `app.` → `(marketing)`.

---

## 4. Struktur monorepo

### 4.1 Tree

```
web-builder/
├── apps/
│   ├── web/                         # Next.js App Router
│   │   ├── src/app/
│   │   │   ├── (marketing)/         # /, /pricing, /templates, /blog
│   │   │   ├── (auth)/              # /login, /register, /verify, /reset-password
│   │   │   ├── (dashboard)/         # /sites, /sites/[siteId]/{settings,domains,data,orders,members}, /billing, /account
│   │   │   ├── (admin)/admin/       # /admin/{users,sites,library,moderation,plans,queues,ai}
│   │   │   ├── layout.tsx
│   │   │   └── not-found.tsx
│   │   ├── src/components/          # komponen khusus web (pakai @platform/ui)
│   │   ├── src/lib/                 # api client (server & client), session helper, i18n setup
│   │   ├── src/middleware.ts        # host routing, auth gate, locale
│   │   └── next.config.ts           # rewrites /api, /editor
│   ├── editor/                      # Vite + React SPA (base: /editor/)
│   │   ├── src/
│   │   │   ├── app/                 # bootstrap, router (/editor/:siteId[/page/:pageId]), providers
│   │   │   ├── canvas/              # viewport, render-root, overlay/, interactions/, hit-test/, snapping/, guides/
│   │   │   ├── panels/              # layers/, properties/, pages/, assets/, components/, theme/, data/, ai/
│   │   │   ├── tools/               # select, frame, rect, text, image, pen(P1), hand, zoom, comment(P2)
│   │   │   ├── store/               # Zustand slices: selection, viewport, tool, ui, breakpoint, clipboard
│   │   │   ├── commands/            # command registry, keybindings (tinykeys), command palette
│   │   │   ├── document/            # Y.Doc lifecycle, typed accessors, ops wrapper, UndoManager
│   │   │   ├── collaboration/       # Hocuspocus provider, y-indexeddb, awareness, connection status
│   │   │   ├── ai/                  # chat UI, run client (SSE), apply AI updates, run review
│   │   │   ├── services/            # @platform/sdk instance, upload client
│   │   │   ├── i18n/
│   │   │   └── styles/
│   │   └── vite.config.ts
│   ├── api/                         # Express 5
│   │   ├── src/
│   │   │   ├── main.ts              # bootstrap HTTP server, graceful shutdown
│   │   │   ├── app.ts               # createApp(): middleware chain + routers
│   │   │   ├── config/env.ts        # Zod-validated env
│   │   │   ├── middleware/          # request-id, logger, auth-session, tenant, rate-limit, validate, error
│   │   │   ├── modules/             # Platform API (/v1), satu folder per fitur
│   │   │   │   ├── sites/           # sites.routes.ts, .controller.ts, .service.ts, .repository.ts, .schema.ts
│   │   │   │   ├── documents/  pages/  assets/  library/  deployments/  domains/
│   │   │   │   ├── workspaces/  billing/  ai/  collections/  workflows/  commerce/
│   │   │   │   └── admin/  moderation/  audit/  realtime-token/
│   │   │   ├── runtime/             # Runtime API (/runtime/v1): forms, records, members, commerce, workflows
│   │   │   ├── webhooks/            # /webhooks/billing/:provider, /webhooks/payments/:provider/:token
│   │   │   ├── internal/            # /internal/v1: host resolve, doc state, job callbacks
│   │   │   ├── auth/                # Better Auth instance & config
│   │   │   ├── queues/              # producer (enqueue helpers), typed job payloads
│   │   │   └── lib/                 # errors, http helpers, sse, pagination
│   │   └── test/
│   ├── worker/
│   │   └── src/
│   │       ├── main.ts              # register processors, health server
│   │       ├── processors/          # publish.ts, thumbnails.ts, ai-runs.ts, workflow-exec.ts, email.ts, …
│   │       ├── publish/             # build pipeline: snapshot → html/css → upload → KV
│   │       ├── ai/                  # orchestrator, context-builder, model-router, metering
│   │       ├── renderer-service/    # Playwright browser pool, screenshot API
│   │       ├── workflow/            # adapter ports (db, email, http) untuk @platform/workflow-blocks
│   │       └── lib/
│   ├── realtime/
│   │   └── src/
│   │       ├── server.ts            # Hocuspocus server
│   │       ├── extensions/          # auth.ts, persistence.ts, single-editor-lock.ts, redis-bus.ts, projections.ts
│   │       └── internal-http.ts     # /internal/documents/:id/state (untuk worker)
│   └── site-host/
│       ├── src/
│       │   ├── index.ts             # fetch handler
│       │   ├── resolve-host.ts      # KV → fallback api internal
│       │   ├── object-store.ts      # R2 binding | S3-compatible (MinIO lokal)
│       │   ├── runtime-proxy.ts     # /_api/v1/* → api /runtime/v1/* + signed token
│       │   ├── headers.ts           # CSP, cache-control, security headers
│       │   └── pages/               # 404/suspended/not-found-site fallback HTML
│       └── wrangler.toml
├── packages/
│   ├── document-model/              # JANTUNG: Zod schema + Yjs binding + ops
│   │   └── src/{schema/, yjs/, ops/, migrations/, query/, ids.ts, index.ts}
│   ├── renderer/
│   │   └── src/{react/, static/, css/, islands/, primitives/, index.ts}
│   ├── library-seed/
│   │   └── src/{components/<category>/, templates/, themes/, icons/, index.ts}
│   ├── workflow-blocks/
│   │   └── src/{blocks/<block>/{schema.ts,execute.ts}, engine/, expressions/, ports.ts}
│   ├── ai-tools/
│   │   ├── src/{tools/, registry.ts, skills-loader.ts, context/, prompts/}
│   │   ├── skills/                  # *.md (frontmatter: name, description, triggers)
│   │   └── evals/                   # dataset & runner (lihat spec 04)
│   ├── db/
│   │   ├── src/{schema/, client.ts, tenant.ts, rls/, types.ts}
│   │   ├── migrations/              # output drizzle-kit (SQL), commit ke git
│   │   ├── seed/                    # dev seed + library seed loader
│   │   ├── test/                    # factories, test-db helper
│   │   └── drizzle.config.ts
│   ├── shared/
│   │   └── src/{contracts/, errors/, ids/, result.ts, env.ts, utils/, node/ (logger, crypto, tokens)}
│   ├── sdk/                         # typed client dari contracts (dipakai web & editor)
│   ├── ui/                          # shadcn/ui + Radix + Tailwind preset (UI platform, bukan situs user)
│   ├── i18n/                        # locales/id/*.json, locales/en/*.json, helper format IDR/tanggal
│   └── config/                      # tsconfig/*.json, biome.json, tailwind preset, vitest preset
├── docker/                          # docker-compose.yml, init SQL, minio bootstrap
├── docs/                            # PRD, ARCHITECTURE, ROADMAP, specs/
├── .github/workflows/
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
└── CLAUDE.md
```

### 4.2 Tanggung jawab package

| Package | Tanggung jawab | Dipakai oleh |
|---|---|---|
| `@platform/document-model` | Zod schema node/style/breakpoint/token/instance; konversi JSON ↔ Y.Doc; **ops** (insertNode, moveNode, setStyle, …) yang bekerja di Y.Doc dalam satu transaksi; migrasi `schemaVersion`; query helper (findNode, walk). Sumber kebenaran: [spec 01](./specs/01-document-model.md). | semua |
| `@platform/renderer` | Document → React tree (editor & SSR) dan → HTML+CSS statis (publish); generator CSS breakpoint; primitives (Box, Text, Image, Link, Form…); runtime islands (bundle kecil yang di-hydrate di situs; rekomendasi **Preact** + `preact/compat`, ❓ OPEN — spike M7, lihat [spec 07 PUB-029](./specs/07-publishing-hosting.md)). | editor, worker, api (preview) |
| `@platform/library-seed` | Definisi component/template/theme awal dalam bentuk kode TS yang tervalidasi document-model; diimport oleh seed script. | db/seed, tests |
| `@platform/workflow-blocks` | Definisi blok workflow (schema Zod + executor murni), interpreter, expression evaluator aman. Efek samping lewat **ports** yang di-inject. | api (sync), worker (async), editor (UI config) |
| `@platform/ai-tools` | Definisi tool (Zod → JSON Schema), handler tool di atas document-model ops, skills Markdown + loader, prompt templates, context builder murni. | worker, editor (preview tool UI), evals |
| `@platform/db` | Drizzle schema semua tabel, migrations, client factory, `TenantContext` helper, RLS policy SQL (P1), seed, test factories. **Keputusan:** schema & migration hanya di sini; dipakai api, worker, realtime. | api, worker, realtime |
| `@platform/shared` | Kontrak API (Zod request/response), kode error, ID helper (UUIDv7), `Result`, util isomorfik. Subpath `@platform/shared/node`: logger pino, env loader, envelope encryption, signed tokens. | semua (subpath node hanya server) |
| `@platform/sdk` | Client HTTP typed dari `shared/contracts` (fetch wrapper, error mapping, SSE helper). | web, editor |
| `@platform/ui` | Komponen UI platform (shadcn/Radix/Tailwind), ikon Lucide, design token UI platform. | web, editor |
| `@platform/i18n` | String UI ID/EN, helper `t()`, format angka/mata uang/tanggal. | web, editor, api (pesan email), worker |
| `@platform/config` | tsconfig base, Biome config, Tailwind preset, Vitest preset. | semua (devDependency) |

### 4.3 Aturan dependensi

```
                     ┌──────────────┐
                     │ config (dev) │  ← boleh dipakai semua sebagai devDependency
                     └──────────────┘

 document-model ──► (zod, yjs, nanoid)               ← TIDAK boleh import package internal lain
 shared         ──► (zod)                            ← isomorfik; subpath /node boleh pino, node:crypto
 i18n           ──► (tanpa dependensi internal)
 renderer       ──► document-model, shared, react, react-dom
 workflow-blocks──► shared, zod                      ← efek samping hanya via ports
 ai-tools       ──► document-model, shared, zod, yjs
 library-seed   ──► document-model
 db             ──► shared, drizzle-orm, pg  (+ type-only import dari document-model untuk $type<>)
 sdk            ──► shared
 ui             ──► react, radix, tailwind, i18n
```

| Aturan | Alasan |
|---|---|
| `packages/*` **tidak boleh** import `apps/*`; `apps/*` **tidak boleh** import app lain. | Boundary deploy. |
| `document-model` hanya boleh `zod`, `yjs`, `nanoid`. | Dipakai di browser, Node, dan edge; harus murni. |
| `renderer` tidak boleh import `db`, `api`, `ui`, `ai-tools`, atau API browser khusus editor. | Output publish harus deterministik & bisa jalan di Node. Hook editor masuk lewat props (`mode: 'editor' \| 'publish'`). |
| `editor`, `web`, `site-host` tidak boleh import `db` atau `@platform/shared/node`. | Mencegah kode server/secret masuk bundle browser/edge. |
| `site-host` hanya boleh `shared` (isomorfik, edge-safe). | Batas ukuran & API Cloudflare Workers. |
| `workflow-blocks` & `ai-tools` tidak boleh mengakses DB/network langsung. | Testable murni; efek samping lewat ports yang di-inject worker/api. |

Penegakan: `dependency-cruiser` (rule di `.dependency-cruiser.cjs`) dijalankan di CI (`pnpm lint:deps`), plus field `exports` di setiap `package.json` agar subpath internal tidak bisa diimport.

### 4.4 Konvensi workspace

- Nama package `@platform/<name>`, `"type": "module"`, export TS source langsung (JIT, tanpa build) untuk package internal; app yang di-bundle (Next.js `transpilePackages`, Vite, wrangler/esbuild) men-transpile sendiri. Package yang dipakai `apps/worker`/`apps/api` di production dijalankan via build `tsup` per app (bundle app, bukan per package).
- `turbo.json` task: `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `db:generate`, `db:migrate`. `build` bergantung pada `^build`; `typecheck` memakai TS project references.
- Versi Node & pnpm dikunci di `package.json` (`engines`, `packageManager`) dan `.nvmrc`.

---

## 5. Aplikasi (apps/*)

### 5.1 `apps/web` — Next.js App Router

**Peran:** semua UI platform *selain* editor canvas.

| Route group | Path contoh | Render | Catatan |
|---|---|---|---|
| `(marketing)` | `/`, `/pricing`, `/templates`, `/templates/[slug]` | SSG/ISR | Host apex. Galeri template memakai thumbnail dari R2. |
| `(auth)` | `/login`, `/register`, `/verify-email`, `/reset-password` | Client + Server Actions tipis | Form memanggil Better Auth di `/api/auth/*`. |
| `(dashboard)` | `/sites`, `/sites/[siteId]/…`, `/billing`, `/account` | Server Components + client islands | Data diambil server-side via `API_INTERNAL_URL` dengan meneruskan header `cookie`. |
| `(admin)` | `/admin/…` | Server Components | `users.staff_role` (`super_admin`/`staff`/`library_admin`/`designer`, [spec 08 §10.1](./specs/08-accounts-plans-admin.md#101-role-staff)) + 2FA wajib. Bull Board di-embed via `/api/admin/queues` (P1). |

**Komunikasi ke API:**

- *Server Component / Route Handler* → `apiServer(req)` dari `@platform/sdk` dengan `baseUrl = API_INTERNAL_URL` dan header `cookie` + `x-request-id` diteruskan.
- *Client Component* → `@platform/sdk` dengan `baseUrl = /api` (same-origin). Data fetching client memakai TanStack Query.
- **Next.js tidak mengakses database secara langsung.** Semua lewat `apps/api` agar aturan bisnis & tenant isolation hanya ada di satu tempat.
- Mutasi memakai Route Handler/Server Action **hanya** sebagai proxy tipis bila perlu (mis. redirect setelah login); logika tetap di API.

**i18n:** `next-intl` dengan pesan dari `@platform/i18n`; locale dari preferensi user → cookie `locale` → `Accept-Language`; default `id`.

### 5.2 `apps/editor` — Vite + React SPA

**Kenapa SPA terpisah:** editor 100% client-side, berat state (Yjs, Zustand, pointer events 60 fps), tidak butuh SSR/SEO, dan butuh kontrol penuh atas bundling/worker/HMR. Lihat [ADR-011](#adr-011-editor-sebagai-vite-spa-terpisah-dari-nextjs).

**Mount:** Vite `base: '/editor/'`. Production: hasil `vite build` (`dist/`) di-deploy sebagai static ke `EDITOR_ORIGIN` (Cloudflare Pages atau bucket R2 statis), lalu `app.platformmu.com/editor/*` di-rewrite oleh Next.js ke origin tersebut. Asset ber-hash di-cache `immutable`; `index.html` `no-cache`. Dari sudut pandang browser, editor dan dashboard **satu origin** → cookie & `/api` sama.

> ❓ OPEN: origin static editor di production — Cloudflare Pages (rekomendasi) vs disalin ke `apps/web/public/editor` saat build (lebih sederhana, tapi build web dan editor jadi terikat).

**Struktur folder & tanggung jawab:**

| Folder | Isi | Aturan |
|---|---|---|
| `app/` | Bootstrap, router (`/editor/:siteId`, `?page=`), error boundary, providers (QueryClient, i18n, theme) | — |
| `document/` | Lifecycle Y.Doc, `useNode(id)`/`useChildren(id)` selector berbasis `observeDeep` granular, wrapper ops document-model, `UndoManager` (tracked origins: `local`, `ai:*`) | Satu-satunya tempat yang memanggil `doc.transact` |
| `canvas/` | Viewport (pan/zoom dengan CSS transform), `render-root` (memakai `@platform/renderer` mode `editor`), `overlay/` (selection box, handles, guides, distance, hover outline — layer terpisah di atas canvas), `interactions/` (drag/resize/rotate via `@use-gesture/react`), `hit-test/`, `snapping/` | Canvas tidak memodifikasi DOM renderer; overlay membaca rect via `ResizeObserver`/`getBoundingClientRect` cache |
| `tools/` | State machine per tool (select, frame, text, …) | Tool → memanggil `commands`, bukan Y.Doc langsung |
| `commands/` | Registry command (`id`, `label`, `shortcut`, `run(ctx)`), tinykeys bindings, command palette | Semua aksi user lewat command → mudah dipakai AI preview & testing |
| `panels/` | Layers (react-arborist), Properties (style per breakpoint), Pages, Assets, Components, Theme, Data (M7), AI chat | Panel membaca via selector; menulis via command |
| `store/` | Zustand slices untuk **UI state** saja (selection, tool aktif, viewport, breakpoint aktif, panel) | **Dokumen tidak disimpan di Zustand**; Y.Doc adalah source of truth |
| `collaboration/` | `HocuspocusProvider`, `IndexeddbPersistence` (y-indexeddb), status koneksi, awareness (cursor P2) | — |
| `ai/` | Chat UI, client SSE, penerapan update AI dengan origin `ai:<runId>`, review/accept/undo run | Lihat [§10](#10-ai-architecture) |
| `services/` | Instance `@platform/sdk`, upload (presigned URL ke R2) | — |

Detail fitur editor: [spec 02](./specs/02-editor.md).

### 5.3 `apps/api` — Express 5

**Struktur modul** (per fitur, sesuai brief):

```
modules/sites/
  sites.routes.ts       # Router(): path + middleware (auth, tenant, validate, rateLimit)
  sites.controller.ts   # parse req → panggil service → kirim response. Tanpa logika bisnis.
  sites.service.ts      # logika bisnis, transaksi, enqueue job, cek entitlement paket
  sites.repository.ts   # akses DB via Drizzle; SEMUA fungsi menerima TenantContext
  sites.schema.ts       # Zod: params/query/body/response (re-export dari @platform/shared/contracts)
  sites.test.ts         # integration test modul
```

**Middleware chain** (urutan di `app.ts`):

| # | Middleware | Fungsi |
|---|---|---|
| 1 | `requestId` | Ambil `x-request-id` (jika dari proxy tepercaya) atau buat UUIDv7; set di response header & `AsyncLocalStorage` |
| 2 | `httpLogger` (pino-http) | Log JSON per request (method, path, status, durasi, userId, siteId); redaksi `authorization`, `cookie`, `password`, `token` |
| 3 | `securityHeaders` (helmet) | Header keamanan untuk response API |
| 4 | `cors` | Hanya untuk router publik `api.` tertentu (stream, public API). Platform API via `/api` same-origin tidak perlu CORS |
| 5 | Body parsers | `express.json({ limit: '1mb' })`; `express.raw()` khusus `/webhooks/*` (verifikasi signature butuh raw body) dan endpoint binary Yjs |
| 6 | `authSession` | `auth.api.getSession({ headers })` dari Better Auth → `req.ctx.user` (atau `null`) |
| 7 | `requireAuth` / `requireRole` | Per router |
| 8 | `tenantResolver` | Dari `:workspaceId`/`:siteId` → cek membership & role → `req.ctx.tenant = { workspaceId, siteId, role, plan }`. Gagal → `404` (bukan 403, agar tidak membocorkan keberadaan resource) |
| 9 | `rateLimit` | Redis (`rate-limiter-flexible`), key per user/IP/site; policy per router |
| 10 | `validate(schema)` | Zod parse `params`, `query`, `body` → `req.valid` bertipe |
| 11 | Controller | — |
| 12 | `notFound` + `errorHandler` | Mapping `AppError` → HTTP; Zod error → `422`; unknown → `500` + Sentry; selalu sertakan `requestId` |

Express 5 sudah meneruskan rejection dari async handler ke error handler — **tidak perlu** wrapper `asyncHandler`.

**Konvensi response:**

```jsonc
// 200/201
{ "data": { "id": "0190f6c2-…", "name": "Toko Budi" }, "meta": { "requestId": "…" } }

// list (cursor pagination)
{ "data": [ … ], "meta": { "nextCursor": "eyJpZCI6…", "requestId": "…" } }

// error
{
  "error": {
    "code": "SITE_LIMIT_REACHED",            // UPPER_SNAKE, stabil, didefinisikan di @platform/shared/errors
    "message": "Batas jumlah website untuk paket Free sudah tercapai.",  // sudah dilokalkan (Accept-Language)
    "details": { "limit": 3, "current": 3 }, // opsional, untuk UI
    "requestId": "0190f6c2-…"
  }
}
```

| Kondisi | Status | `code` contoh |
|---|---|---|
| Validasi gagal | 422 | `VALIDATION_FAILED` (`details.issues` = Zod issues) |
| Tidak login | 401 | `UNAUTHENTICATED` |
| Tidak berhak / resource tenant lain | 404 | `NOT_FOUND` |
| Role kurang (dalam tenant sendiri) | 403 | `FORBIDDEN` |
| Batas paket / kredit | 402 | `PLAN_LIMIT_REACHED`, `INSUFFICIENT_CREDITS` |
| Konflik versi | 409 | `CONFLICT`, `SUBDOMAIN_TAKEN` |
| Rate limit | 429 | `RATE_LIMITED` (+ `Retry-After`) |

**Versioning:** prefix `/v1` untuk Platform API, `/runtime/v1` untuk Runtime API. Perubahan breaking → `/v2` berdampingan. Karena web & editor dideploy bersama API, Platform API boleh berevolusi cepat; **Runtime API harus stabil** karena island JS di situs yang sudah dipublish memanggilnya (situs lama tidak di-rebuild otomatis).

**OpenAPI (P1):** `@asteasolutions/zod-to-openapi` membangkitkan `openapi.json` dari `shared/contracts`; UI dokumentasi di `/v1/docs` hanya di dev/staging.

### 5.4 `apps/worker` — BullMQ

Satu proses Node mendaftarkan semua processor; dapat dipecah per queue via env `WORKER_QUEUES=publish,thumbnails` saat scaling.

| Queue | Producer | Concurrency (awal) | Attempts / backoff | Timeout | Catatan |
|---|---|---|---|---|---|
| `publish` | api (publish site) | 2 | 3 / exp 10 s | 120 s | Idempotent per `deploymentId` |
| `thumbnails` | api, publish, library | 2 | 2 / exp 30 s | 60 s | Playwright; dedupe `jobId = thumb:<docId>:<snapshotId>` |
| `ai-runs` | api | 5 | 1 (tanpa auto-retry) | 10 menit | Retry hanya di level panggilan Claude API (429/529/5xx) |
| `workflow-exec` | runtime api, scheduler | 10 | per-step policy, default 3 / exp 5 s | 60 s per step | Juga *repeatable job* untuk trigger terjadwal |
| `email` | api, workflow | 10 | 5 / exp 30 s | 30 s | Template React Email; Mailpit di lokal |
| `whatsapp` | workflow, commerce | 5 | 5 / exp 60 s | 30 s | Provider OPEN |
| `image-processing` | api (setelah upload) | 4 | 3 / exp 10 s | 60 s | sharp: varian WebP/AVIF, blurhash, strip EXIF |
| `domains` | api (custom domain) | 2 | 20 / fixed 5 menit | 30 s | Polling verifikasi DNS & status SSL Cloudflare (job `domain-check`, `reconcile-hosts` — spec 07) |
| `payments` | api (webhook gateway user), scheduler | 5 | 8 / exp 10 s | 30 s | Job `process-payment-event`, `reconcile-pending`, `expire-orders` (spec 06 COM-054, COM-170); idempotent per `provider_event_id` |
| `cleanup` | scheduler (repeatable) | 1 | 3 | 10 menit | Compaction dokumen, aset yatim, deployment lama, sesi kedaluwarsa |
| `dead-letter` | worker (on final fail) | 1 | — | — | Menyimpan payload + error; tampil di admin; alert Sentry |

Konvensi:

- Payload job tervalidasi Zod (`@platform/shared/contracts/jobs.ts`); job hanya membawa **ID**, bukan data besar.
- Setiap job membawa `requestId` asal untuk propagasi log.
- `removeOnComplete: { age: 86400, count: 1000 }`, `removeOnFail: { age: 7 * 86400 }`.
- Graceful shutdown: `SIGTERM` → `worker.close()` menunggu job aktif (max 30 s).
- **Renderer service (Playwright)**: modul `renderer-service/` di worker memelihara pool Chromium (1 browser, N context, default N=2). API internal: `screenshot({ html | url, viewport, fullPage })`. Dipakai `thumbnails`, `ai-runs` (AI "melihat" hasil), dan visual check publish (P1). Di production, worker image berbasis `mcr.microsoft.com/playwright` agar font & dependensi Chromium konsisten. Saat beban naik, pool ini dipisah menjadi service sendiri (lihat [§17](#17-scalability-path)).

### 5.5 `apps/realtime` — Hocuspocus

- **Keputusan:** dipakai **sejak M1** sebagai jalur sinkronisasi & autosave dokumen, walau masih **single-editor**. Dengan begitu multiplayer (M9+) hanya menambah awareness/cursor/izin, bukan mengganti jalur penyimpanan.
- `onAuthenticate`: verifikasi JWT pendek (`REALTIME_TOKEN_SECRET`, claims `sub` userId, `docId`, `siteId`, `role`, `exp`). Dokumen yang diminta harus sama dengan `docId` di token.
- `single-editor-lock` extension: lock Redis `doclock:<docId>` (TTL 30 s, diperpanjang heartbeat). Koneksi kedua dari user/tab lain mendapat pesan `locked` → UI menawarkan *takeover* (koneksi lama diputus). Read-only viewer (preview) diizinkan.
- `persistence` extension (custom, bukan `@hocuspocus/extension-database` bawaan karena kita butuh append-only): lihat [§7](#7-penyimpanan-dokumen-editor).
- `redis-bus` extension: subscribe `doc-ext:<docId>` untuk update dari server-side writer (mis. AI mode headless, migrasi, update component massal) lalu `Y.applyUpdate(doc, u, 'server')` agar klien yang terhubung ikut menerima.
- `projections` extension: setelah store, ekstrak read model ringan (daftar halaman, judul, path, SEO, jumlah node) ke tabel `site_pages` — dipakai dashboard tanpa harus memuat Y.Doc.
- `internal-http`: `GET /internal/documents/:id/state` (service token) mengembalikan state terkini (in-memory jika dokumen sedang dibuka, jika tidak dari DB). Dipakai worker (AI, publish).

### 5.6 `apps/site-host` — Cloudflare Worker

Alur `fetch(request)`:

1. Normalisasi host (lowercase, buang port & trailing dot).
2. `resolveHost(host)`: cache in-isolate (TTL 30 s) → KV `HOSTS` key `host:<hostname>` → jika miss, fallback `GET {API}/internal/v1/hosts/:hostname` (service token) lalu tulis-balik ke cache. Nilai:
   ```jsonc
   {
     "siteId": "0190…", "deploymentId": "0191…", "prefix": "sites/0190…/deployments/0191…",
     "status": "active",            // active | suspended | redirect | unpublished
     "redirectTo": null,            // mis. "https://tokobudi.platformmu.site" (301) untuk subdomain acak lama
     "badge": true, "runtime": true, "locale": "id"
   }
   ```
3. `redirect` → 301; `suspended` → halaman "situs ditangguhkan" (HTTP 451, tanpa cache); `unpublished`/tidak ditemukan → halaman "site not found" (404).
4. `/_api/v1/*` → `runtime-proxy` → api `/runtime/v1/*` (path setelah `/_api/v1` dipertahankan apa adanya; lihat [§12](#12-runtime-api-vs-platform-api)).
5. Path → key objek: `/about` → `{prefix}/about/index.html`; `/_assets/*` → file ber-hash; `/sitemap.xml`, `/robots.txt` dari deployment.
6. Edge cache (`caches.default`) dengan cache key yang **menyertakan `deploymentId`** → publish baru otomatis memakai key baru tanpa purge.
7. Header: `Cache-Control` HTML `public, max-age=0, s-maxage=300`, asset `public, max-age=31536000, immutable`; CSP & security headers; `x-robots-tag: noindex` untuk situs Free yang ditandai moderasi (opsional).

**Adapter** agar bisa jalan lokal tanpa Cloudflare: `ObjectStore` = `R2Bucket` binding (prod) atau HTTP S3-compatible ke MinIO (`STORAGE_MODE=s3`, lokal); `HostResolver` = KV (prod) atau API internal (`HOST_RESOLVER=api`, lokal).

Custom domain: Cloudflare for SaaS (Custom Hostnames) dengan fallback origin `cname.platformmu.site`; status verifikasi & SSL dipolling queue `domains`. Detail alur: [spec 07](./specs/07-publishing-hosting.md).

> ❓ OPEN: biaya & batas Cloudflare for SaaS untuk jumlah custom hostname besar; alternatif Caddy on-demand TLS di VPS jika biaya tidak cocok.

---

## 6. Data architecture

### 6.1 Konvensi

| Topik | Keputusan |
|---|---|
| Penamaan | Tabel & kolom `snake_case`, tabel jamak (`sites`, `component_versions`). Enum Postgres `snake_case`. |
| Primary key | **UUIDv7** (`uuid` type) dibuat di aplikasi (`@platform/shared/ids` → `uuidv7()`), terurut waktu → index B-tree ramah insert. Pengecualian: tabel append-only bervolume tinggi (`document_updates`, `audit_logs`, `workflow_run_steps`, `credit_ledger`) memakai `bigint generated always as identity`. |
| ID di dalam dokumen | Node ID di Y.Doc **bukan** UUID: **prefix tipe + `nanoid(10)`** alfabet `0-9a-z` (mis. `n_a8f3k2m1zx`, `pg_k3m9x2a7qp`, `cmp_…`, `ast_…`) — sumber kebenaran: [spec 01 DM-007](./specs/01-document-model.md#dm-007-format-id). Referensi component di dokumen memakai UUID `componentId` + `version` integer. |
| ID publik | Subdomain acak Free: default 8 karakter (`RANDOM_SUBDOMAIN_LENGTH`), alfabet `a-z2-9` tanpa karakter ambigu (`0 o 1 l i`), diawali huruf, dicek unik + blocklist — detail di [spec 07 PUB-080](./specs/07-publishing-hosting.md#pub-080-generator-subdomain-acak-free). ID resource di URL = UUIDv7. |
| Timestamp | `created_at timestamptz not null default now()`, `updated_at` (di-set repository), `deleted_at` (soft delete) untuk entitas yang bisa dipulihkan (sites, pages read model, assets, records, members, products). |
| Tenant key | Setiap tabel tenant punya `workspace_id` dan/atau `site_id` **NOT NULL** + index komposit diawali kolom tenant. |
| JSONB | Dipakai untuk: snapshot dokumen JSON, definisi component, schema collection, data record, konfigurasi workflow, settings. Selalu divalidasi Zod sebelum ditulis; ditipkan via `.$type<T>()`. |
| Uang | `bigint` dalam satuan terkecil (rupiah = 1) + `currency char(3)`; tidak pernah `float`. |
| Migration | `drizzle-kit generate` → SQL di `packages/db/migrations` (di-commit, di-review). `drizzle-kit migrate` saat deploy. Pola **expand → migrate data → contract** untuk perubahan yang tidak backward compatible. |
| Seed | `pnpm db:seed` → plan default, user admin dev, library dari `@platform/library-seed`, 2–3 situs contoh. Seed idempotent (upsert by key). |

### 6.2 Tenant isolation di data layer

**Keputusan:** isolasi **ditegakkan di repository layer** (wajib, P0) dan **Row Level Security sebagai defense-in-depth (P1)**.

```ts
// @platform/db/src/tenant.ts
export type TenantContext =
  | { kind: 'site'; workspaceId: string; siteId: string; actor: Actor }
  | { kind: 'workspace'; workspaceId: string; actor: Actor }
  | { kind: 'system'; reason: string };              // worker/cron, wajib dilog

// Contoh repository: tenant selalu parameter pertama, filter selalu ditambahkan
export async function findPage(db: Db, t: SiteTenant, pageId: string) {
  return db.query.sitePages.findFirst({
    where: and(eq(sitePages.siteId, t.siteId), eq(sitePages.id, pageId), isNull(sitePages.deletedAt)),
  });
}
```

- Tidak ada query tenant tanpa `TenantContext`; lint rule kustom/grep di CI melarang `db.select().from(<tabelTenant>)` di luar folder `*.repository.ts`.
- RLS (P1): setiap transaksi request menjalankan `SET LOCAL app.workspace_id = $1, app.site_id = $2`; policy `USING (workspace_id = current_setting('app.workspace_id')::uuid)`. Role `app_system` (bypass) hanya untuk worker job bertipe `system`.
- Integration test wajib per modul: "user A tidak bisa membaca/mengubah resource B" ([§14](#14-testing-strategy)).

### 6.3 Tabel per domain

> Kolom di bawah adalah **kolom kunci**, bukan definisi lengkap. Definisi lengkap & validasi ada di spec terkait dan di `packages/db/src/schema/*.ts`.

**Identity & workspace** (`schema/identity.ts`, `schema/workspaces.ts`) — [spec 08](./specs/08-accounts-plans-admin.md)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `users` | id, email, email_verified, name, image, locale, staff_role (null/`super_admin`/`staff`/`library_admin`/`designer`, spec 08), two_factor_enabled, banned_at | unique(lower(email)) |
| `sessions` | id, user_id, token, expires_at, ip, user_agent | unique(token), (user_id) |
| `accounts` | id, user_id, provider_id, account_id, password (hash) | unique(provider_id, account_id) |
| `verifications` | id, identifier, value, expires_at | (identifier) |
| `workspaces` | id, name, owner_user_id, plan_code, billing_email, settings jsonb | (owner_user_id) |
| `workspace_members` | workspace_id, user_id, role (`owner`/`admin`/`editor`/`viewer`/`billing`, spec 08) | pk(workspace_id, user_id) |
| `workspace_invitations` | id, workspace_id, email, role, token_hash, expires_at | (workspace_id), unique(token_hash) |

Tabel Better Auth (`users`, `sessions`, `accounts`, `verifications`, dan tabel plugin 2FA) dibuat lewat Drizzle adapter Better Auth dengan nama tabel jamak; skema di-generate lalu di-commit ke `packages/db`.

**Sites, pages, documents** (`schema/sites.ts`, `schema/documents.ts`) — [spec 01](./specs/01-document-model.md), [spec 07](./specs/07-publishing-hosting.md)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `sites` | id, workspace_id, name, status (`draft`/`published`/`suspended`/`archived`), document_id, theme_id, default_locale, live_deployment_id, settings jsonb (SEO default, favicon, analytics), is_dynamic | (workspace_id, deleted_at) |
| `site_pages` *(read model)* | id (= page node id), site_id, path, title, seo jsonb, sort_order, is_home, node_count, updated_at | unique(site_id, path) |
| `documents` | id, workspace_id, site_id (null untuk library), kind (`site`/`component`/`template`), schema_version, last_seq, last_snapshot_id, size_bytes | (site_id), (kind) |
| `document_updates` | id bigint, document_id, seq, update bytea, origin (`local`/`ai`/`server`/`migration`), actor_id, ai_run_id, created_at | unique(document_id, seq) |
| `document_snapshots` | id, document_id, upto_seq, state bytea (Yjs), json jsonb (opsional, untuk publish/history), kind (`auto`/`named`/`publish`/`pre_ai`), label, created_by | (document_id, created_at desc) |

**Library** (`schema/library.ts`) — [spec 03](./specs/03-components-templates.md)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `components` | id, key (slug stabil), scope (`platform`/`workspace`), workspace_id, category, name jsonb (i18n), tags text[], status, latest_version, draft_document_id, is_premium | unique(scope, workspace_id, key), (category) |
| `component_versions` | component_id, version int, definition jsonb (subtree document-model), props_schema jsonb, variants jsonb, changelog, preview_asset_id, published_by, published_at | pk(component_id, version) — **immutable** (no UPDATE; trigger menolak) |
| `templates` | id, key, category, name jsonb, status, latest_version, draft_document_id, is_premium | unique(key) |
| `template_versions` | template_id, version, snapshot jsonb (dokumen situs lengkap), preview_asset_ids, published_at | pk(template_id, version) |
| `themes` / `theme_versions` | id, key, tokens jsonb (warna, tipografi, radius, spacing) | unique(key) |
| `library_categories` | key, name jsonb, sort_order | — |

**Assets** (`schema/assets.ts`)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `assets` | id, workspace_id, site_id (null = pustaka workspace), kind (`image`/`video`/`font`/`file`), storage_key, mime, size_bytes, width, height, blurhash, sha256, variants jsonb, status (`pending`/`ready`/`rejected`), uploaded_by, deleted_at | (site_id, created_at), (workspace_id, sha256) |
| `storage_usage` | workspace_id, bytes_used, updated_at | pk(workspace_id) |

**Deployments & domains** (`schema/hosting.ts`) — [spec 07](./specs/07-publishing-hosting.md)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `deployments` | id, site_id, number, status (`queued`/`building`/`uploading`/`ready`/`failed`/`cancelled`; "live" = `sites.live_deployment_id` — spec 07 PUB-002), snapshot_id, storage_prefix, manifest jsonb (file list + hash), page_count, total_bytes, error, created_by, started_at, finished_at | unique(site_id, number), (site_id, status) |
| `site_domains` | id, site_id, hostname, kind (`random`/`subdomain`/`custom`), status (`pending`/`verifying`/`active`/`failed`/`redirect`), is_primary, redirect_to_domain_id, verification jsonb, cf_custom_hostname_id, ssl_status | unique(hostname), (site_id) |
| `reserved_subdomains` | name, reason | pk(name) |

**Dynamic data** (`schema/dynamic.ts`) — [spec 05](./specs/05-dynamic-data.md)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `collections` | id, site_id, key, name, schema jsonb (fields, relasi), schema_version, permissions jsonb, created_by (`user`/`ai`) | unique(site_id, key) |
| `records` | id, site_id, collection_id, data jsonb, owner_member_id, created_at, updated_at, deleted_at | (collection_id, created_at desc), GIN(data jsonb_path_ops), (site_id) |
| `members` | id, site_id, email, password_hash, email_verified_at, status, roles text[], profile jsonb | unique(site_id, lower(email)) |
| `member_sessions` | id, site_id, member_id, token_hash, expires_at, ip, user_agent | unique(token_hash) |
| `workflows` | id, site_id, key, name, trigger jsonb, steps jsonb, version, enabled | (site_id, enabled) |
| `workflow_runs` | id, site_id, workflow_id, workflow_version, trigger_type, idempotency_key, status, mode (`sync`/`async`), started_at, finished_at, error | unique(site_id, idempotency_key), (workflow_id, started_at desc) |
| `workflow_run_steps` | id bigint, run_id, step_index, block, status, input jsonb (redacted), output jsonb (dipotong 16 KB), duration_ms, error | (run_id, step_index) |

**Commerce** (`schema/commerce.ts`) — [spec 06](./specs/06-commerce-payments.md)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `products` / `product_variants` | id, site_id, slug, name, price, currency, stock, attributes jsonb, status | unique(site_id, slug) |
| `orders` | id, site_id, number, member_id, customer jsonb, status, subtotal, shipping, total, currency, payment_status, idempotency_key | unique(site_id, number), unique(site_id, idempotency_key) |
| `order_items` | id, order_id, site_id, product_id, variant_id, name_snapshot, qty, unit_price | (order_id) |
| `payment_gateway_configs` | id, site_id, provider (`midtrans`/`xendit`), mode (`sandbox`/`production`), credentials_ciphertext, credentials_dek_encrypted, kek_version, webhook_token, status, verified_at | unique(site_id, provider, mode), unique(webhook_token) |
| `payments` | id, site_id, order_id, provider, external_id, status, amount, raw jsonb (redacted) | unique(provider, external_id) |
| `payment_events` | id, site_id, payment_id, order_id, config_id, provider, provider_event_id, source (`webhook`/`reconcile`/`owner_manual`/`api_call`), verification, payload_redacted jsonb, processing_status, processed_at, error — log append-only semua event pembayaran (bukan hanya webhook; detail [spec 06 COM-180](./specs/06-commerce-payments.md#com-180-tabel-commerce--payments)) | unique(provider, provider_event_id) |

**Billing, plans, usage, credits** (`schema/billing.ts`) — [spec 08](./specs/08-accounts-plans-admin.md)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `plans` | code (`free`/`starter`/`pro`/`business`), name jsonb, entitlements jsonb (limits & features), is_public, sort | pk(code) |
| `plan_prices` | id, plan_code, interval (`month`/`year`), amount, currency, active | (plan_code) |
| `subscriptions` | id, workspace_id, plan_code, status, current_period_start/end, cancel_at, provider, external_id | (workspace_id), unique(provider, external_id) |
| `invoices` | id, workspace_id, subscription_id, number, amount, status, provider_ref, paid_at | unique(number) |
| `billing_webhook_events` | id, provider, external_event_id, payload jsonb, processed_at | unique(provider, external_event_id) |
| `billing_payments` | id, invoice_id, provider, provider_ref, provider_event_id, method, amount, status, raw jsonb (tanpa data kartu), paid_at — pembayaran langganan platform (spec 08); beda dengan `payments` commerce | unique(provider, provider_event_id) |
| `usage_counters` | workspace_id, metric (`sites`/`storage_bytes`/`ai_runs`/`records`/`workflow_runs`), period (`2026-10`), value | pk(workspace_id, metric, period) |
| `credit_ledger` | id bigint, workspace_id, user_id, delta, bucket (`trial`/`monthly`/`topup`/`bonus`/`override`), reason (`grant`/`consume`/`reserve`/`release`/`expire`/`refund`/`adjust`), ref_type, ref_id (mis. ai_run id), period_id, expires_at, created_at — detail [spec 08](./specs/08-accounts-plans-admin.md) | (workspace_id, id desc), (workspace_id, bucket, expires_at) |

Entitlement efektif = `plans.entitlements` + override per workspace (`workspaces.settings.entitlementOverrides`), dihitung oleh `EntitlementService` (dicache Redis 60 s, di-invalidate saat subscription berubah).

**AI** (`schema/ai.ts`) — [spec 04](./specs/04-ai-agent.md)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `ai_conversations` | id, workspace_id, site_id, user_id, title, mode (`user`/`admin_library`) | (site_id, updated_at desc) |
| `ai_messages` | id, conversation_id, role, content jsonb (blocks), created_at | (conversation_id, created_at) |
| `ai_runs` | id, conversation_id, site_id, document_id, status (`queued`/`running`/`waiting_user`/`waiting_confirmation`/`completed`/`failed`/`cancelled`/`expired`, spec 04 AI-040), draft_status (`pending`/`applied`/`discarded`/`partially_applied`), base_state_vector, draft_ref, touched_node_ids jsonb, model, skills text[], input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, credits_reserved, credits_charged, pre_snapshot_id, error, started_at, finished_at | (site_id, started_at desc), (status) |
| `ai_tool_calls` | id, run_id, seq, tool_name, input jsonb, output jsonb, status, duration_ms, error | (run_id, seq) |
| `ai_feedback` | id, run_id, user_id, rating, comment | (run_id) |
| `ai_compensations` | id, run_id, kind, undo_payload jsonb, applied_at | (run_id) |
| `ai_moderation_events` | id, run_id, stage, category, action, excerpt_hash | (run_id) |

**Moderation & audit** (`schema/moderation.ts`, `schema/audit.ts`)

| Tabel | Kolom kunci | Index penting |
|---|---|---|
| `moderation_reports` | id, site_id, hostname, reporter_email, reason, details, status | (status, created_at) |
| `moderation_actions` | id, site_id, action (`warn`/`unpublish`/`suspend`/`restore`), reason, admin_user_id | (site_id) |
| `content_scans` | id, site_id, deployment_id, result jsonb, score, flagged | (flagged, created_at) |
| `audit_logs` | id bigint, workspace_id, site_id, actor_type (`user`/`admin`/`system`/`ai`), actor_id, action (`site.publish`, `payment_config.update`, …), target_type, target_id, ip, user_agent, metadata jsonb, created_at | (workspace_id, created_at desc), (site_id, created_at desc) |
| `outbound_messages` | id, site_id, channel (`email`/`whatsapp`), provider, to_hash, template, status, provider_ref, error | (site_id, created_at desc) |

`audit_logs` append-only (role DB aplikasi hanya punya `INSERT, SELECT`); dipartisi bulanan saat besar ([§17](#17-scalability-path)).

---

## 7. Penyimpanan dokumen editor

### 7.1 Model penyimpanan

```
                  ┌──────────────────────────── documents (1 baris per dokumen) ───┐
                  │ id, last_seq, last_snapshot_id, schema_version                 │
                  └───────────────┬─────────────────────────────┬──────────────────┘
                                  │                             │
     document_updates (append-only)                    document_snapshots
     seq 1  ▓ update (bytea)                           #A upto_seq=500  state (Y.encodeStateAsUpdate)
     seq 2  ▓                                          #B upto_seq=1000 state  (+ json opsional)
     …                                                 #P kind=publish  state + json (untuk deployment)
     seq 1042 ▓  ← terbaru
```

- **Granularitas:** satu Y.Doc per **situs** (berisi semua halaman, theme lokal, setting global) sesuai rekomendasi [spec 01](./specs/01-document-model.md). Component & template draft masing-masing punya Y.Doc sendiri (`documents.kind`).

  > ❓ OPEN: pecah menjadi Y.Doc per halaman (subdocument Yjs) jika ukuran dokumen situs > ~5 MB atau load time > 3 s. Struktur tabel tidak berubah (setiap subdoc = baris `documents`).

- **Update** = byte Yjs (`Uint8Array`) hasil `doc.on('update')`. Disimpan **apa adanya** (bukan JSON) karena Yjs update idempotent dan dapat di-merge.
- **Snapshot** = `Y.encodeStateAsUpdate(doc)` pada `upto_seq` tertentu.

### 7.2 Write path (autosave)

1. Editor mengubah Y.Doc lokal → `HocuspocusProvider` mengirim update ke `apps/realtime` (real time, tanpa menunggu).
2. `persistence.onChange` men-*buffer* update per dokumen; **flush** setiap 2 s *debounce* (max 10 s) → `Y.mergeUpdates(buffer)` → `INSERT document_updates (seq = last_seq + 1)` dan `UPDATE documents SET last_seq` dalam satu transaksi.
3. Setiap ≥ 500 update **atau** ≥ 10 menit sejak snapshot terakhir → buat snapshot (`kind = auto`) dari doc in-memory.
4. `onDisconnect` terakhir / `onStoreDocument` → flush paksa.
5. Editor menampilkan status: `Tersimpan` (server mengonfirmasi via stateless message `saved:{seq}`), `Menyimpan…`, `Offline — perubahan disimpan di perangkat`.

### 7.3 Load path

1. Editor: `IndexeddbPersistence('doc:<docId>')` dimuat dulu → canvas langsung tampil dari cache lokal (jika ada).
2. Paralel: `POST /api/v1/realtime/token` → connect Hocuspocus.
3. Realtime `onLoadDocument`: snapshot terbaru + `document_updates WHERE seq > upto_seq ORDER BY seq` → `Y.applyUpdate` berurutan → jalankan migrasi `schemaVersion` jika perlu (origin `migration`).
4. Sync protocol Yjs (state vector) menyatukan state lokal IndexedDB dengan server → perubahan offline otomatis terkirim.

### 7.4 Compaction (queue `cleanup`)

- Untuk dokumen dengan snapshot terbaru di `upto_seq = S`: hapus `document_updates` dengan `seq <= S` **yang lebih tua dari retensi history paket** (mis. Free 7 hari, Pro 90 hari — angka di [spec 08](./specs/08-accounts-plans-admin.md)).
- Snapshot `auto` lama di-thinning: simpan 1/jam untuk 48 jam terakhir, 1/hari setelahnya, sampai batas retensi. Snapshot `named`, `publish`, `pre_ai` tidak di-thinning selama dalam retensi.
- Version history UI = daftar snapshot + kemampuan "restore" (restore = buat update baru yang mengubah state ke snapshot lama, bukan menghapus history).

### 7.5 Recovery lokal

- y-indexeddb menyimpan semua update lokal; jika server down/offline, editor tetap bisa bekerja (banner offline) dan sinkron saat kembali.
- IndexedDB dibersihkan untuk dokumen yang tidak dibuka > 30 hari atau saat logout.
- Jika server menolak dokumen (mis. schema lebih baru dari editor yang ter-cache) → editor memaksa reload versi terbaru.

### 7.6 Published snapshot

- Publish membuat snapshot `kind = publish` berisi **`state` dan `json`** (hasil `toJSON` tervalidasi Zod). Deployment merujuk `snapshot_id` → publish dapat diulang (rebuild) secara deterministik, dan rollback deployment cukup mengganti pointer KV ke deployment lama (file di R2 masih ada).
- Snapshot JSON juga dipakai untuk: thumbnail, konteks AI (ringkasan), diff "perubahan sejak publish terakhir".

---

## 8. Alur kunci (sequence diagrams)

### 8.a Buka editor & autosave

```
Browser(editor)        Next.js(app.)        api                realtime            Postgres     IndexedDB
     │ GET /editor/S1      │                  │                    │                   │            │
     │────────────────────►│ cek cookie ada   │                    │                   │            │
     │◄── index.html (rewrite ke EDITOR_ORIGIN)                    │                   │            │
     │ GET /api/v1/me, /api/v1/sites/S1 ─────►│ session+tenant     │                   │            │
     │◄────────────────── {user, site, docId, entitlements}        │                   │            │
     │ load doc:D1 ──────────────────────────────────────────────────────────────────────────────►│
     │◄─────────────────────────────────────────────────────── state lokal (jika ada) → render ────│
     │ POST /api/v1/realtime/token {docId} ──►│ cek akses → JWT 5m │                   │            │
     │ WS connect ?token ──────────────────────────────────────────►│ onAuthenticate    │            │
     │                                        │                    │ lock doclock:D1   │            │
     │                                        │                    │ onLoadDocument ──►│ snapshot+updates
     │◄──────────────────────────── sync step 1/2 (state vector) ──│◄──────────────────│            │
     │  … user mengedit (Y.Doc lokal) …       │                    │                   │            │
     │── Yjs update ──────────────────────────────────────────────►│ buffer            │            │
     │── simpan juga ────────────────────────────────────────────────────────────────────────────►│
     │                                        │                    │ debounce 2s:      │            │
     │                                        │                    │ INSERT update ───►│            │
     │◄──────────────────────────── stateless "saved:{seq}" ───────│                   │            │
     │ UI: "Tersimpan"                        │                    │ tiap 500 upd: snapshot ──────►│
```

### 8.b Publish

```
Editor/Dashboard     api                     Redis/BullMQ     worker(publish)              R2            Cloudflare KV
   │ POST /v1/sites/S1/deployments ─►│                         │                           │                │
   │                  │ cek entitlement, rate limit            │                           │                │
   │                  │ minta state terkini (realtime internal) & buat snapshot kind=publish │                │
   │                  │ INSERT deployments(status=queued, snapshot_id)                     │                │
   │                  │ enqueue publish {deploymentId} ─►│     │                           │                │
   │◄── 202 {deploymentId} ──────────│                         │                           │                │
   │ (poll/SSE status)                │                ────────►│ status=building           │                │
   │                  │                                        │ load snapshot.json        │                │
   │                  │                                        │ validate (document-model) │                │
   │                  │                                        │ resolve component@version │                │
   │                  │                                        │ renderer: per halaman     │                │
   │                  │                                        │  → HTML + CSS + islands   │                │
   │                  │                                        │ sitemap, robots, 404, OG  │                │
   │                  │                                        │ status=uploading          │                │
   │                  │                                        │ PUT sites/S1/deployments/Dp/** ──────────►│                │
   │                  │                                        │ PUT manifest.json ────────►│                │
   │                  │                                        │ tulis host:* → Dp ──────────────────────────►│
   │                  │                                        │ UPDATE sites.live_deployment_id, status=live │
   │                  │                                        │ deployment lama → superseded               │
   │                  │                                        │ enqueue thumbnails, content scan (P1)      │
   │◄── status live (SSE/poll) ──────│                         │ audit_logs site.publish   │                │
```

Kegagalan di tengah → status `failed`, pointer KV **tidak** berubah (situs lama tetap live). Detail output & SEO: [spec 07](./specs/07-publishing-hosting.md).

### 8.c Pengunjung membuka situs

```
Pengunjung            site-host (CF Worker)            KV           Edge cache        R2           api(/internal)
   │ GET https://tokobudi.platformmu.site/about │      │                │               │                │
   │──────────────────────►│ cache isolate host? miss  │                │               │                │
   │                       │ get host:tokobudi… ──────►│                │               │                │
   │                       │◄── {siteId, deploymentId, prefix, status:active}            │                │
   │                       │  (KV miss → GET /internal/v1/hosts/:host ─────────────────────────────────►│)
   │                       │ match cache key (Dp + /about) ────────────►│               │                │
   │                       │◄── miss ──────────────────────────────────│               │                │
   │                       │ get {prefix}/about/index.html ───────────────────────────►│                │
   │                       │◄─────────────────────────────────────────────── body+etag │                │
   │                       │ set headers (CSP, cache), put cache ─────►│               │                │
   │◄── 200 HTML (+ CSS & island JS dari /_assets, immutable) ─│       │               │                │
   │ island hydrate → fetch /_api/... (lihat 8.e)                                                        │
```

### 8.d AI run dengan streaming

```
Editor              api                     Redis                  worker(ai-runs)               Claude API     realtime
  │ POST /api/v1/sites/:siteId/ai/runs {conversationId, message, selection}│                       │              │
  │──────────────────►│ cek entitlement & saldo kredit              │                              │              │
  │                   │ reserve kredit (credit_ledger reserve)      │                              │              │
  │                   │ INSERT ai_runs(queued), enqueue ai-runs ───►│                              │              │
  │◄── {runId, streamToken} ─│                                      │                              │              │
  │ GET api.…/v1/ai/runs/:runId/events?token= (SSE) ─►│ XREAD airun-log:<id>                       │              │
  │                   │                             │ ─────────────►│ status=running               │              │
  │                   │                             │               │ GET doc state ─────────────────────────────►│
  │                   │                             │               │ fork → draft Y.Doc (run), snapshot pre_ai   │
  │                   │                             │               │ context builder + skills     │              │
  │                   │                             │               │ messages.stream ────────────►│              │
  │                   │◄── text.delta ──────────────│◄──────────────│◄─── text / tool_use ─────────│              │
  │◄── event: text.delta ─│                         │               │ validasi input tool (Zod)    │              │
  │                   │                             │               │ jalankan tool di DRAFT Y.Doc │              │
  │                   │                             │               │  (origin ai:<runId>)         │              │
  │◄── event: draft.updated {update(base64), touchedNodeIds} ──│◄───│ INSERT ai_tool_calls, simpan draft (R2)     │
  │ previewDoc = main + draft (read-only preview)   │               │ (opsional) render_preview    │              │
  │◄── event: run.completed {summary, diff} ────────│◄──────────────│ settle kredit, status=completed, draft=pending│
  │ UI: Preview / Terapkan / Batalkan semua         │               │                              │              │
  │ klik Terapkan → POST …/runs/:runId/apply → {draftUpdate}        │                              │              │
  │ cek konflik (touchedNodeIds ∩ node diubah user sejak fork)      │                              │              │
  │ main.transact(applyUpdate(draftUpdate), ai:<runId>) → 1 undo item                              │              │
  │  → provider sync ke realtime (autosave normal) ────────────────────────────────────────────────────────────►│
```

Jika editor ditutup/SSE terputus, run tetap berjalan sampai selesai dan draft disimpan sebagai **pending draft** (`ai_runs.draft_status = pending`); saat editor dibuka lagi, kartu ringkasan muncul untuk Preview/Terapkan/Batalkan. Tidak ada perubahan masuk dokumen utama tanpa Terapkan (kecuali mode headless, §10.4). Detail: [§10](#10-ai-architecture) dan [spec 04 §7](./specs/04-ai-agent.md#7-draft--transaction-model).

### 8.e Form submit → workflow

```
Pengunjung(island)   site-host            api /runtime/v1                 Postgres         Redis/BullMQ    worker(workflow-exec)
  │ POST /_api/v1/forms/F1/submit {data, idemKey, captchaToken}           │                │                    │
  │────────────────►│ tambah X-Site-Token (HMAC: siteId, deploymentId, ts)│                │                    │
  │                 │ POST /runtime/v1/forms/F1/submit ─►│                │                │                    │
  │                 │                   │ verifikasi token → siteId       │                │                    │
  │                 │                   │ rate limit (site+IP), captcha   │                │                    │
  │                 │                   │ load form binding & collection schema (cache)    │                    │
  │                 │                   │ validasi data (Zod dari schema) │                │                    │
  │                 │                   │ sync workflow (≤ 3 s, blok sync-safe):           │                    │
  │                 │                   │  create_record ────────────────►│ INSERT records  │                    │
  │                 │                   │  INSERT workflow_runs(idempotency_key)           │                    │
  │                 │                   │ blok async (email, WA, http) → enqueue ─────────►│                    │
  │◄──── 200 {ok, message, redirect?} ──│                                 │                │──────────────────►│
  │                 │                   │                                 │                │  kirim email/WA,   │
  │                 │                   │                                 │◄───────────────────── log steps ────│
```

### 8.f Checkout → webhook gateway milik user

```
Pembeli    site-host   api /runtime/v1          Postgres     Gateway milik user (mis. Midtrans)   api /webhooks       worker
  │ POST /_api/v1/commerce/checkout {cart, customer, idemKey}│                    │                    │                  │
  │──────────►│──────────►│ validasi harga & stok dari DB (abaikan harga dari klien)                    │                  │
  │           │           │ INSERT orders(pending) ───────►│                    │                    │                  │
  │           │           │ decrypt kredensial (envelope)  │                    │                    │                  │
  │           │           │ create transaction ─────────────────────────────────►│                    │                  │
  │           │           │◄─────────────── token / redirect_url ───────────────│                    │                  │
  │◄── {redirectUrl} ─────│                                │                    │                    │                  │
  │ bayar di halaman gateway ─────────────────────────────────────────────────►│                    │                  │
  │           │           │                                │                    │ POST /webhooks/payments/midtrans/<webhook_token>
  │           │           │                                │                    │───────────────────►│                  │
  │           │           │                                │                    │ lookup config by token → site      │
  │           │           │                                │                    │ verifikasi signature dg server key │
  │           │           │                                │◄── INSERT payment_events (unique)         │                  │
  │           │           │                                │                    │ re-query status ke gateway (P0)    │
  │           │           │                                │◄── UPDATE orders paid (idempotent)        │                  │
  │           │           │                                │                    │ enqueue email + workflow order.paid ►│
  │           │           │                                │                    │◄── 200 OK ─────────│                  │
  │ redirect kembali ke /order/<id> → island cek status via /_api                │                    │                  │
```

`webhook_token` acak per konfigurasi gateway membuat URL webhook unik per situs tanpa membocorkan `site_id`. Untuk gateway yang mendukung override notification URL per transaksi, URL ini dikirim saat create transaction; selain itu pengguna diberi instruksi menyalin URL ke dashboard gateway mereka. Detail: [spec 06](./specs/06-commerce-payments.md).

### 8.g Upgrade paket

```
User(dashboard)   api /v1/billing        Gateway platform        api /webhooks/billing     worker              KV
  │ POST checkout {plan:pro, interval} ─►│                       │                         │                   │
  │                 │ INSERT invoices(pending)                    │                         │                   │
  │                 │ create payment ───►│                       │                         │                   │
  │◄── redirectUrl ─│                    │                       │                         │                   │
  │ bayar ─────────────────────────────►│                       │                         │                   │
  │                 │                    │── webhook ───────────────────────────────────►│ verifikasi, dedupe │
  │                 │                    │                       │ invoice paid, subscription active (plan=pro)│
  │                 │                    │                       │ grant kredit AI periode (credit_ledger)      │
  │                 │                    │                       │ invalidate cache entitlement                 │
  │                 │                    │                       │ audit_logs billing.upgrade                   │
  │ (kembali) pilih subdomain "tokobudi" ─►│ cek unik/reserved, INSERT site_domains(subdomain, primary)        │
  │                 │ domain acak lama → status redirect ke domain baru                                       │
  │                 │ enqueue publish (rebuild tanpa badge, canonical URL baru) ──────────────────►│           │
  │                 │                                                                             │ tulis KV: │
  │                 │                                                                             │ tokobudi→Dp, x7k2p9mq→redirect 301
```

> ❓ OPEN: gateway & mekanisme perpanjangan langganan platform (recurring vs invoice + reminder) — lihat PRD O7 dan [spec 08](./specs/08-accounts-plans-admin.md).

---

## 9. Auth & security

### 9.1 Auth akun platform (Better Auth)

- Better Auth di-mount di `apps/api` pada `/auth/*` (diakses browser sebagai `app.platformmu.com/api/auth/*`). `baseURL = PUBLIC_APP_URL + '/api/auth'`, `trustedOrigins = [PUBLIC_APP_URL]`.
- Metode: email + password (hash scrypt/argon2 bawaan), verifikasi email, reset password, Google OAuth (P1), 2FA TOTP (wajib untuk semua user dengan `staff_role`).
- Session cookie: host-only, `Secure`, `HttpOnly`, `SameSite=Lax`, rolling 30 hari; session disimpan di Postgres (`sessions`) + cache Redis (secondary storage) untuk lookup cepat.
- **CSRF:** semua mutasi via same-origin `/api`. Pertahanan berlapis: (1) `SameSite=Lax`, (2) Better Auth memeriksa `Origin` untuk endpoint auth, (3) middleware `originCheck` di Platform API menolak request non-GET jika `Origin`/`Sec-Fetch-Site` bukan `same-origin`.
- Better Auth boleh diganti (brief); karena itu seluruh kode membaca user lewat `req.ctx.user` yang diisi satu middleware adapter.

### 9.2 End-user auth (member situs)

- Sistem **terpisah** dari Better Auth: tabel `members`, `member_sessions` per `site_id`; email unik **per situs**.
- Cookie `__Host-m_sess` di domain situs (host-only, `Secure`, `HttpOnly`, `SameSite=Lax`), token acak 256-bit; DB menyimpan **hash**-nya.
- Password: argon2id; rate limit login per (site, email) dan per IP; verifikasi email & reset via queue `email` dengan template milik situs.
- Island memanggil `/_api/v1/members/*` (same-origin di domain situs) → tidak ada CORS. Detail: [spec 05](./specs/05-dynamic-data.md).

### 9.3 Service-to-service

| Dari → Ke | Mekanisme |
|---|---|
| site-host → api `/runtime/v1/*` | Header `X-Site-Token`: HMAC-SHA256(`SITE_HOST_SIGNING_SECRET`, `siteId.deploymentId.timestamp.method.path`) ; toleransi ±60 s. API **hanya** mempercayai `siteId` dari token ini, bukan dari body/query. Header `X-Forwarded-For` dari `CF-Connecting-IP`. |
| site-host → api `/internal/v1/hosts/*` | Bearer `SITE_HOST_INTERNAL_TOKEN` (statis, rotasi manual). |
| worker → realtime `/internal/*`, worker → api `/internal/*` | JWT HS256 dengan `INTERNAL_JWT_SECRET`, `aud` per service, `exp` 60 s. |
| api → editor (stream SSE) | `streamToken` JWT (`aud=ai-stream`, `sub=userId`, `runId`, `exp` 10 menit). |
| api → realtime (browser) | Realtime JWT (lihat [§5.5](#55-appsrealtime--hocuspocus)). |

Semua endpoint `/internal/*` juga dibatasi jaringan (private network/allowlist) bila infrastruktur memungkinkan.

### 9.4 Secrets & enkripsi kredensial

- Secret aplikasi = environment variable, divalidasi Zod saat boot (gagal boot jika kurang). Tidak ada secret di repo; `.env.example` hanya placeholder.
- **Envelope encryption** — **satu skema untuk semua secret milik user**: kredensial payment gateway ([spec 06 COM-040](./specs/06-commerce-payments.md#com-040-enkripsi-envelope)) dan `site_secrets` (token WA, API key blok HTTP — [spec 05 DATA-324](./specs/05-dynamic-data.md#data-324-secret-storage)). Implementasi tunggal di `@platform/shared/node` (Node `crypto`):
  1. Buat DEK acak 256-bit per secret/config (per record).
  2. Enkripsi plaintext dengan AES-256-GCM (DEK, IV 96-bit acak) dan **AAD = konteks** (`site_id` + provider/nama secret + env + config id) → `ciphertext || tag`; memindah ciphertext ke baris lain membuat dekripsi gagal.
  3. Enkripsi DEK dengan KEK **per environment** (`CREDENTIALS_KEK_V{n}`, 32 byte base64, dari env/secret manager; versi aktif `CREDENTIALS_KEK_CURRENT`) memakai AES-256-GCM → `credentials_dek_encrypted`, simpan `kek_version`.
  4. Dekripsi hanya di service pemilik (`PaymentGatewayService`, `SiteSecretsService`) tepat sebelum dipakai; plaintext tidak pernah dilog/dikembalikan ke UI (UI hanya melihat 4 karakter terakhir).
  5. Rotasi KEK: tambah `V{n+1}`, job re-wrap DEK (data tidak perlu dienkripsi ulang).
- > ❓ OPEN: pindah KEK ke KMS terkelola (mis. AWS KMS/GCP KMS/Infisical) saat ada lingkungan production.

### 9.5 Tenant isolation checklist

- [ ] Setiap route tenant melewati `tenantResolver` (tes otomatis: daftar route di `app._router` vs allowlist publik).
- [ ] Repository menerima `TenantContext` dan selalu memfilter `site_id`/`workspace_id`.
- [ ] Akses lintas tenant mengembalikan **404**.
- [ ] Runtime API memperoleh `siteId` hanya dari `X-Site-Token`.
- [ ] Kunci Redis, nama queue job payload, key R2 selalu diawali ID tenant (`sites/<siteId>/…`).
- [ ] Presigned upload URL dibatasi key prefix, content-type, dan ukuran.
- [ ] Tool AI hanya bisa menyentuh dokumen/site dari run tersebut (context terikat `siteId`).
- [ ] Workflow hanya bisa membaca/menulis collection dalam situs yang sama.
- [ ] Integration test "cross-tenant" per modul (§14).
- [ ] RLS (P1) sebagai lapisan kedua.

### 9.6 Rate limiting (Redis)

| Scope | Key | Limit awal (dapat dikonfigurasi) |
|---|---|---|
| Auth platform (login/register/reset) | IP + email | 10/menit, 50/jam |
| Platform API umum | userId | 300/menit |
| Publish | siteId | 10/jam (Free), 60/jam (berbayar) |
| AI run | workspaceId | 10 run bersamaan/menit + saldo kredit |
| Runtime API per situs | siteId | sesuai paket (mis. 60 req/s burst) |
| Runtime form submit | siteId + IP | 10/menit |
| Member login | siteId + email, siteId + IP | 5/menit, 30/jam |
| Webhook | provider + token | 100/menit |

Selain itu Cloudflare WAF/rate limiting di depan `*.platformmu.site` dan `api.`.

### 9.7 Validasi, escaping & CSP

- **Input:** Zod di setiap boundary (HTTP, job, tool AI, workflow, webhook, env). Data record divalidasi dengan schema Zod yang dibangun dari `collections.schema`.
- **Output:** renderer selalu meng-escape teks (React). Rich text (Tiptap JSON) dirender dari node yang diizinkan saja — tidak ada `dangerouslySetInnerHTML` dari input user. URL (`href`, `src`) disanitasi (blok `javascript:`, `data:` kecuali gambar). Custom code embed = P2 dan hanya di iframe sandbox domain terpisah.
- **CSP situs publish** (default): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' data: https://assets.platformmu.site https:; font-src 'self' fonts.gstatic.com; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self' <gateway hosts>`. Integrasi pihak ketiga (analytics, chat) menambah sumber lewat allowlist per integrasi (P1).
- **CSP app/editor:** `script-src 'self'` + nonce untuk Next.js; `connect-src` termasuk `api.`, `realtime.`, Sentry.
- Editor me-render dokumen user di DOM yang sama dengan UI editor → karena itu **renderer tidak boleh** mengeksekusi script dari dokumen. Preview situs dengan island aktif dibuka di iframe `sandbox` dengan origin situs (`*.localhost:8787` / preview host).

### 9.8 SSRF guard (blok `http_request`, fetch URL oleh AI/import)

- Hanya `https` (port 443) kecuali allowlist; resolve DNS dulu lalu tolak IP privat/loopback/link-local/metadata (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`, `100.64/10`); koneksi dipin ke IP yang sudah divalidasi (cegah DNS rebinding).
- Timeout 10 s, max response 1 MB, max 3 redirect (setiap hop divalidasi ulang), tanpa meneruskan cookie/credential platform.
- Dijalankan hanya di worker (bukan di proses api) dengan egress proxy (P1).

### 9.9 Upload file

- Upload langsung ke R2 via **presigned PUT** (key `uploads/<workspaceId>/<assetId>`, `Content-Type` dan `Content-Length` dibatasi) → `POST /v1/assets/:id/complete` → job `image-processing`: cek magic bytes, ukuran, dimensi max, strip EXIF, buat varian, hitung sha256; status `ready`/`rejected`.
- SVG: disanitasi (DOMPurify server-side mode SVG) atau dikonversi; disajikan dari `assets.platformmu.site` dengan `Content-Security-Policy: sandbox` dan `X-Content-Type-Options: nosniff`.
- Kuota storage dicek saat presign dan saat complete.
- > ❓ OPEN: pemindaian malware untuk file non-gambar (ClamAV di worker) — P1/P2.

### 9.10 Audit log & supply chain

- `audit_logs` dicatat untuk aksi sensitif: login admin, perubahan paket, publish/unpublish, perubahan domain, perubahan kredensial payment, ekspor data, aksi moderasi, impersonation admin, penghapusan situs.
- Dependency: `pnpm audit --prod` di CI, Renovate/Dependabot mingguan, lockfile wajib, `pnpm` `onlyBuiltDependencies` allowlist, GitHub secret scanning, CodeQL (P1).

---

## 10. AI architecture

Spesifikasi perilaku, daftar tool, skills, UX, kredit, dan evals ada di [spec 04](./specs/04-ai-agent.md). Bagian ini menjelaskan **di mana dan bagaimana** agent berjalan.

### 10.1 Komponen

```
apps/api (modules/ai)            apps/worker (ai/)                                packages/ai-tools
 ├ POST /v1/sites/:siteId/ai/runs ├ orchestrator.ts  (agent loop)                  ├ tools/*.ts  (Zod input/output + handler)
 ├ GET  /v1/ai/runs/:id/events    ├ context-builder.ts                             ├ registry.ts (toolsFor(mode, plan, skills))
 ├ POST /v1/ai/runs/:id/apply|…   ├ model-router.ts                                ├ skills/<name>/SKILL.md + skills-loader.ts
 └ SSE ← Redis SUBSCRIBE          ├ metering.ts      (reserve/settle kredit)       ├ prompts/system.*.md
                                  ├ draft-store.ts   (fork Y.Doc per run)           └ context/ (ringkasan dokumen murni)
                                  └ renderer-service (screenshot)
```

### 10.2 Agent loop (worker, job `ai-runs`)

1. Load `ai_runs`, conversation, entitlement; ambil state dokumen dari realtime internal → **fork draft** `Y.Doc` per run (§10.4). Simpan snapshot `pre_ai`.
2. `skills-loader` memilih skill: index skills (nama + deskripsi, selalu di prompt) + isi skill yang relevan dimuat sesuai klasifikasi intent atau saat model memanggil tool `read_skill` ([spec 04 AI-081](./specs/04-ai-agent.md#ai-081-loading-skill)).
3. `context-builder` menyusun konteks: ringkasan struktur dokumen (tree terkompresi: id, type, nama, teks pendek), node terpilih (detail penuh), theme tokens, daftar component library relevan (hasil pencarian), batas paket. Dokumen tidak pernah dikirim utuh bila besar.
4. Panggil Claude API (Messages API, streaming, tool use). `model-router` memilih model per jenis tugas dari konfigurasi.
5. Untuk setiap `tool_use`: validasi input dengan Zod → jalankan handler pada draft di dalam `draft.transact(fn, aiOrigin(runId))` → tangkap update (`doc.on('update')`) → publish event `draft.updated` ke Redis → simpan `ai_tool_calls` → kembalikan `tool_result` (sukses/error terstruktur agar model bisa memperbaiki).
6. Tool `render_preview` (opsional per skill, [spec 04 §4.9](./specs/04-ai-agent.md#49-verification)): renderer → HTML → Playwright → PNG → dikirim sebagai image block. Dibatasi N kali per run.
7. Loop berhenti saat `end_turn`, batas langkah (default 30 tool call), batas waktu (10 menit), batas kredit, atau dibatalkan.
8. Settle kredit, update `ai_runs`, publish event `done`.

### 10.3 Tool registry dari Zod

```ts
// packages/ai-tools/src/tools/insert-component.ts
export const insertComponent = defineTool({
  name: 'insert_component',
  description: 'Insert a library component instance into a parent frame.',
  input: z.object({
    componentId: z.string(),
    version: z.number().int().positive().optional(), // default: latest published
    position: Position,                              // { parentId, index? } — skema lengkap di spec 04 §4.5
    props: z.record(z.unknown()).default({}),
    variant: z.string().optional(),
    clientRef: z.string().optional(),
  }),
  output: z.object({ nodeId: NodeId }),
  modes: ['user', 'admin_library'],
  requires: { feature: 'ai' },
  handler: (ctx, input) => ops.insertInstance(ctx.doc, input),   // ops dari document-model
});
```

- `registry.toolsFor({ mode, entitlements, loadedSkills })` → daftar tool → JSON Schema (`z.toJSONSchema` / `zod-to-json-schema`) untuk parameter `tools` Claude API.
- Tool **read-only** (query dokumen, cari library) dan **mutating** (ops dokumen, buat collection/workflow) ditandai; tool mutating untuk data dinamis (M7) mengembalikan *proposal* yang tetap harus lolos validasi document-model/collection schema.
- Tidak ada tool yang menerima kode bebas (HTML/JS/SQL) — lihat [ADR-007](#adr-007-ai-hanya-via-tools).

### 10.4 Penerapan perubahan & undo

Mekanisme sama persis dengan [spec 04 §7](./specs/04-ai-agent.md#7-draft--transaction-model) (spec yang menang bila ada detail berbeda):

- **Fork per run:** worker memuat state dokumen terbaru, membuat **draft Y.Doc** (fork) dan menyimpan `base_state_vector`. Semua tool mutasi berjalan di draft dengan origin `ai:<runId>` (= `TxOrigin { kind: "ai", runId }`, [spec 01 DM-060](./specs/01-document-model.md#dm-060-transaction-origin--undo-grouping)). Draft disimpan ke R2/MinIO (`ai-drafts/{siteId}/{runId}`) tiap iterasi; `touchedNodeIds` dicatat di `ai_runs`.
- **Ke editor:** update draft dikirim sebagai event SSE `draft.updated` → editor memelihara `previewDoc` (main + draft) untuk Preview; dokumen utama **tidak** berubah. Jika editor tertutup, draft tetap **pending** dan ditawarkan lagi saat editor dibuka.
- **Terapkan:** editor memanggil `POST /v1/ai/runs/:runId/apply` → menerima `draftUpdate = encodeStateAsUpdate(draft, base_state_vector)` → `undoManager.stopCapturing()`; `main.transact(() => Y.applyUpdate(main, draftUpdate), aiOrigin(runId))`; `stopCapturing()` → **satu kali Undo membatalkan seluruh run**. Update masuk storage lewat jalur autosave normal (realtime). Update Yjs idempotent sehingga apply ulang aman.
- **Konflik:** sebelum apply, editor menghitung node yang diubah user sejak `base_state_vector` dan mengirisnya dengan `touchedNodeIds`; ada irisan → dialog konflik (spec 04 AI-123).
- **Perubahan non-dokumen** (collection, workflow, konfigurasi commerce) tidak bisa di-undo lewat Yjs → memakai **compensating actions** (`ai_compensations`, spec 04 AI-125) untuk discard dan undo setelah apply.
- **Mode headless** (onboarding tanpa editor terbuka, produksi library batch oleh tim internal): server menerapkan draft lewat `DocumentWriter` (append `document_updates` origin `ai` + `ai_run_id`, publish `doc-ext:<docId>` ke realtime), dengan snapshot `pre_ai` sebelumnya agar bisa dibatalkan dari history.

### 10.5 Streaming

`worker → Redis PUBLISH airun:<runId>` (event sesuai skema [spec 04 §3.3](./specs/04-ai-agent.md#33-skema-event-stream): `run.started`, `text.delta`, `tool.started`, `tool.completed`, `tool.failed`, `draft.updated`, `question.asked`, `confirmation.required`, `credits.updated`, `run.completed`, `run.failed`, `run.cancelled`) → `api` endpoint SSE `SUBSCRIBE` dan meneruskan. Event juga ditulis ke Redis Stream `airun-log:<runId>` (TTL 1 jam) agar klien yang reconnect dengan `Last-Event-ID` bisa *replay*. Heartbeat `: ping` setiap 15 s.

### 10.6 Model routing, prompt caching, kredit

- `model-router` membaca konfigurasi (`AI_MODEL_CONFIG` JSON atau tabel admin P1): mis. `{ "plan": "<model besar>", "edit": "<model menengah>", "classify": "<model kecil>" }`. Nama model **tidak di-hardcode** di kode.
- **Prompt caching:** urutan prompt dibuat stabil → system prompt + tool definitions + skills index (paling stabil) diberi `cache_control` breakpoint; skill yang dimuat dan ringkasan dokumen di blok berikutnya; pesan percakapan terakhir. Token cache read/write dicatat per run.
- **Kredit:** `reserve` estimasi di awal (tolak 402 jika saldo kurang) → `settle` berdasarkan token aktual (input, output, cache) × tarif per model + biaya screenshot → `refund` selisih. Ledger append-only; saldo = SUM ledger (dicache). Rumus konversi token→kredit: [spec 04](./specs/04-ai-agent.md)/[spec 08](./specs/08-accounts-plans-admin.md).

### 10.7 Observability AI

Per run: model, durasi, jumlah tool call, token (input/output/cache), kredit, error per tool, `stop_reason`. Dashboard admin `/admin/ai`: biaya per hari, tool paling sering gagal, rata-rata langkah per run. Input/output tool disimpan (redacted) untuk debugging & dataset evals; retensi mengikuti kebijakan privasi.

---

## 11. Workflow engine

Bentuk trigger, blok, ekspresi, dan batas per paket: [spec 05](./specs/05-dynamic-data.md).

### 11.1 Interpreter

- Workflow = JSON `{ trigger, steps[] }` tervalidasi Zod di `@platform/workflow-blocks`. Engine adalah **interpreter** sederhana (bukan code generation): iterasi langkah, evaluasi kondisi/ekspresi dengan evaluator aman (subset ekspresi tanpa akses global, tanpa loop tak terbatas), jalankan executor blok.
- Executor blok murni dan menerima `ports` yang di-inject:

```ts
interface WorkflowPorts {
  records: RecordsPort;        // CRUD terikat siteId
  email: EmailPort;            // enqueue
  whatsapp: WhatsAppPort;      // enqueue
  http?: HttpPort;             // SSRF-guarded, hanya async
  clock: () => Date;
  log: (stepLog: StepLog) => void;
}
```

### 11.2 Sync vs async

| Jalur | Dijalankan di | Kapan | Batas |
|---|---|---|---|
| **Sync** | Runtime API (dalam request) | Trigger yang butuh respons ke pengunjung: form submit, validasi, create/update record, kalkulasi, redirect | ≤ 3 s total, ≤ 10 langkah, hanya blok bertanda `syncSafe` |
| **Async** | Worker (`workflow-exec`) | Email, WhatsApp, HTTP request, trigger terjadwal (cron), event `record.created`/`order.paid`, delay | ≤ 60 s per langkah, ≤ 50 langkah, retry per blok |

Satu workflow boleh campuran: bagian `syncSafe` di depan dijalankan sinkron, sisanya di-enqueue sebagai lanjutan run yang sama (`workflow_runs.mode = 'sync'` → lanjutan async dengan `run_id` sama).

### 11.3 Idempotency, limits, logging

- `idempotency_key`: dari klien (form submit `idemKey`), dari event (`order.paid:<orderId>`), atau dari jadwal (`cron:<workflowId>:<slot>`); unik per situs.
- Setiap langkah ditulis ke `workflow_run_steps` (input di-redact untuk field bertipe `password`/`secret`, output dipotong). Retensi log sesuai paket.
- Kuota per paket (run/bulan, langkah/run) dicek lewat `usage_counters`; melebihi → run ditolak dengan status `quota_exceeded` dan notifikasi pemilik.
- Workflow yang gagal berulang (mis. 20 kali berturut-turut) → auto-disable + email pemilik.

---

## 12. Runtime API vs Platform API

| Aspek | Platform API (control plane) | Runtime API (data plane) |
|---|---|---|
| Prefix | `/v1/*` | `/runtime/v1/*` |
| Klien | Dashboard & editor (pemilik situs) | Island JS di situs publish (pengunjung, member) |
| Akses browser | `app.platformmu.com/api/*` (same-origin proxy) | `<situs>/_api/v1/*` (same-origin via site-host → `/runtime/v1/*`) |
| Auth | Session Better Auth (cookie app) | `X-Site-Token` (site-host) + session member (cookie situs) opsional |
| Tenant | Dari path param + membership | Dari `X-Site-Token` saja |
| Rate limit | Per user | Per situs (sesuai paket) + per IP |
| Stabilitas kontrak | Boleh berubah bersama rilis web/editor | **Harus backward compatible** (situs lama tidak di-rebuild) |
| Modul | sites, documents, library, assets, billing, ai, … | forms, records (CRUD dengan permission collection), members, commerce, workflows (trigger manual) |

**Keputusan:** fase M7–M8 kedua router berjalan di **proses Express yang sama** (`apps/api`) dengan middleware chain berbeda (`createPlatformRouter()`, `createRuntimeRouter()`), dan tidak boleh saling import service secara langsung kecuali melalui `services/` bersama yang eksplisit. Pemisahan ke proses/deployment sendiri (`apps/runtime-api`) dilakukan saat beban runtime mengganggu control plane ([§17](#17-scalability-path)); karena itu Runtime API tidak boleh bergantung pada session platform atau state in-memory.

Runtime API juga melayani endpoint publik baca yang dapat di-cache (mis. daftar produk/record publik) dengan header `Cache-Control: s-maxage` sehingga site-host dapat meng-cache di edge.

---

## 13. Observability

| Aspek | Keputusan |
|---|---|
| Logging | `pino` JSON ke stdout di semua app Node (`@platform/shared/node/logger`). Level `info` di production, `debug` lokal (pretty via `pino-pretty`). Field wajib: `service`, `env`, `requestId`, `userId?`, `workspaceId?`, `siteId?`, `jobId?`. Redaksi: `password`, `token`, `authorization`, `cookie`, `credentials*`, `serverKey`. |
| Request ID | Dibuat di edge pertama (Next.js middleware / site-host / api) → header `x-request-id` → `AsyncLocalStorage` di api → disalin ke payload job (`meta.requestId`) → log worker → event SSE. Dikembalikan di setiap error response. |
| Error tracking | Sentry di `web` (client+server), `editor`, `api`, `worker`, `realtime`, `site-host` (`@sentry/cloudflare`). Release = git SHA, source maps di-upload di CI. `requestId` & tenant dijadikan tag. PII minimal. |
| Metrics | P1: OpenTelemetry (traces HTTP → DB → queue) ke backend OTLP (Grafana Cloud/Honeycomb — OPEN). P0: metrik minimal via log + BullMQ metrics + Cloudflare analytics. |
| Health checks | `GET /health/live` (proses hidup) & `GET /health/ready` (DB, Redis, R2 reachable) di api, realtime, worker (port health terpisah). Dipakai orchestrator container & uptime monitor. |
| Uptime | Monitor eksternal (UptimeRobot/Better Stack — OPEN) untuk `app.`, `api./health/ready`, `realtime.`, dan 1 situs canary `canary.platformmu.site`. |
| Dashboards | Admin panel: antrean (Bull Board), deployment gagal, AI biaya/hari, workflow error rate, webhook gagal. Infra: CPU/mem container, koneksi Postgres, Redis memory. |
| Alerts | Sentry (error baru, lonjakan), uptime down, DLQ > 0 bertambah, publish failure rate > 5%/jam, saldo/biaya AI harian > ambang, disk Postgres > 80%, backup harian gagal. Kanal: email + Telegram/WA owner. |

> ❓ OPEN: backend metrics/tracing & layanan uptime (pilih yang punya free tier memadai).

---

## 14. Testing strategy

| Lapisan | Tool | Cakupan | Target coverage (realistis solo dev) |
|---|---|---|---|
| Unit — `document-model` | Vitest | Schema valid/invalid, ops (insert/move/delete/style per breakpoint), JSON↔Yjs round-trip, migrasi schemaVersion, property-based (fast-check) untuk ops acak | **≥ 90%** |
| Unit — `renderer` | Vitest + snapshot | Document fixture → HTML/CSS snapshot (`toMatchFileSnapshot`), breakpoint CSS, escaping/sanitasi URL, output editor vs publish identik (selain atribut `data-node-id`) | ≥ 80% |
| Unit — `workflow-blocks` | Vitest | Interpreter, ekspresi, batas langkah/waktu, idempotency (ports di-mock) | ≥ 85% |
| Unit — `ai-tools` | Vitest | Validasi input tool, handler di Y.Doc fixture, registry per paket/mode | ≥ 80% |
| Integration — `api` | Vitest + Supertest + Postgres & Redis nyata | Per modul: happy path, validasi, **cross-tenant**, entitlement, webhook signature & idempotency | ≥ 60% service/repository |
| Integration — `worker` | Vitest + Postgres/Redis/MinIO | Publish pipeline end-to-end ke MinIO, workflow async, metering kredit (Claude API di-mock) | jalur utama |
| E2E | Playwright | Register → buat situs dari template → edit teks/gambar → publish → buka `x.localhost:8787`; editor: select/drag/resize/undo; form submit; checkout sandbox (M8) | ~10–20 skenario kritis |
| Visual regression | Playwright `toHaveScreenshot` dalam Docker (font konsisten) | Galeri library: setiap `component_version` & template × 3 breakpoint; halaman contoh renderer | semua item library |
| AI evals | Runner di `packages/ai-tools/evals` | Dataset prompt → hasil dinilai (validitas dokumen, rubric, screenshot judge). Dijalankan manual/nightly dengan budget. Detail: [spec 04](./specs/04-ai-agent.md) | — |

**Database test:** Postgres dari docker compose (port `5433`, DB `platform_test`). Global setup menjalankan migration ke `platform_test_template`; setiap worker Vitest membuat DB dari template (`CREATE DATABASE … TEMPLATE …`) → cepat & terisolasi. Di CI memakai service container yang sama.

**Factories:** `packages/db/test/factories` (`createUser`, `createWorkspace`, `createSite({ plan })`, `createCollection`, `createOrder`) memakai `@faker-js/faker` locale `id_ID`; document fixture di `packages/document-model/test/fixtures`. Factory menulis lewat repository (bukan SQL mentah) agar konsisten dengan aturan bisnis.

**Aturan:** bug yang diperbaiki wajib punya test regresi; PR yang mengubah `document-model` atau `renderer` wajib lulus snapshot + visual regression.

---

## 15. Development environment

### 15.1 Prasyarat

- Node.js LTS (versi dikunci di `.nvmrc`, mis. 22.x), pnpm (via `corepack enable`), Docker (Docker Desktop dengan WSL integration atau Docker Engine di WSL), Git.
- **WSL2 (owner):** simpan repo di filesystem Linux (`~/projects/...`, bukan `/mnt/c`) agar file watching & I/O cepat. Browser Windows dapat membuka `*.localhost:<port>` karena WSL localhost forwarding (atau `networkingMode=mirrored` di `.wslconfig`). Tools CLI di dalam WSL (curl) mungkin tidak me-resolve `foo.localhost` → pakai `curl -H 'Host: foo.localhost' http://127.0.0.1:8787` atau `--resolve`. Chromium (Playwright) me-resolve `*.localhost` sendiri.
- Wrangler (devDependency `apps/site-host`), Playwright browsers (`pnpm exec playwright install chromium`).

### 15.2 docker-compose (`docker/docker-compose.yml`)

| Service | Image | Port host | Catatan |
|---|---|---|---|
| `postgres` | `postgres:17` | 5432 | DB `platform_dev`, user `platform` |
| `postgres-test` | `postgres:17` | 5433 | tmpfs, untuk integration test |
| `redis` | `redis:7` | 6379 | `appendonly yes` |
| `minio` | `minio/minio` | 9000 (S3), 9001 (console) | Bucket `sites`, `assets` (public-read), `uploads`, `backups` dibuat oleh `minio-init` |
| `mailpit` | `axllent/mailpit` | 1025 (SMTP), 8025 (UI) | Semua email lokal tertangkap di sini |

### 15.3 Port mapping

| App | Port | URL |
|---|---|---|
| `apps/web` | 3000 | `http://localhost:3000`, `http://app.localhost:3000` |
| `apps/editor` (Vite) | 5173 | diakses via `app.localhost:3000/editor/:siteId` |
| `apps/api` | 4000 | `http://api.localhost:4000` |
| `apps/realtime` | 4100 | `ws://realtime.localhost:4100` |
| `apps/worker` (health + Bull Board dev) | 4200 | `http://localhost:4200/queues` |
| `apps/site-host` (wrangler dev) | 8787 | `http://<sub>.localhost:8787` |
| Postgres / Postgres test | 5432 / 5433 | — |
| Redis | 6379 | — |
| MinIO S3 / console | 9000 / 9001 | `http://localhost:9001` |
| Mailpit SMTP / UI | 1025 / 8025 | `http://localhost:8025` |
| Storybook `packages/ui` (opsional) | 6006 | — |

### 15.4 `.env.example`

Satu file `.env` di root dibaca semua app (via `dotenv-cli` di script turbo); setiap app memvalidasi subset-nya dengan Zod. Variabel `PUBLIC_*`/`NEXT_PUBLIC_*`/`VITE_*` aman untuk browser.

```bash
# ── Umum ─────────────────────────────────────────────
NODE_ENV=development
APP_ENV=local                         # local | staging | production
LOG_LEVEL=debug
PUBLIC_MARKETING_URL=http://localhost:3000
PUBLIC_APP_URL=http://app.localhost:3000
PUBLIC_API_URL=http://api.localhost:4000          # origin publik api (SSE, webhook)
PUBLIC_REALTIME_URL=ws://realtime.localhost:4100
SITES_ROOT_DOMAIN=localhost                        # prod: platformmu.site (OPEN: nama final)
SITES_PORT=8787                                    # prod: kosong
RANDOM_SUBDOMAIN_LENGTH=8                          # spec 07 PUB-080
SITES_PROTOCOL=http
PUBLIC_ASSETS_URL=http://localhost:9000/assets     # prod: https://assets.platformmu.site
SENTRY_DSN=
SENTRY_ENVIRONMENT=local

# ── Database & Redis (api, worker, realtime) ─────────
DATABASE_URL=postgres://platform:platform@localhost:5432/platform_dev
DATABASE_URL_TEST=postgres://platform:platform@localhost:5433/platform_test
DATABASE_POOL_MAX=10
REDIS_URL=redis://localhost:6379

# ── Object storage (api, worker) ─────────────────────
S3_ENDPOINT=http://localhost:9000                  # prod: https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_SITES=sites
S3_BUCKET_ASSETS=assets
S3_BUCKET_UPLOADS=uploads
S3_BUCKET_BACKUPS=backups
S3_FORCE_PATH_STYLE=true

# ── apps/web ─────────────────────────────────────────
API_INTERNAL_URL=http://localhost:4000
EDITOR_ORIGIN=http://localhost:5173
NEXT_PUBLIC_SENTRY_DSN=

# ── apps/editor ──────────────────────────────────────
VITE_API_BASE=/api
VITE_PUBLIC_API_URL=http://api.localhost:4000
VITE_REALTIME_URL=ws://realtime.localhost:4100
VITE_SITES_ROOT_DOMAIN=localhost:8787
VITE_SENTRY_DSN=

# ── apps/api ─────────────────────────────────────────
API_PORT=4000
BETTER_AUTH_SECRET=change-me-32-bytes-min
BETTER_AUTH_URL=http://app.localhost:3000/api/auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
REALTIME_TOKEN_SECRET=change-me
AI_STREAM_TOKEN_SECRET=change-me
INTERNAL_JWT_SECRET=change-me
SITE_HOST_SIGNING_SECRET=change-me
SITE_HOST_INTERNAL_TOKEN=change-me
CREDENTIALS_KEK_CURRENT=1
CREDENTIALS_KEK_V1=base64-32-bytes
BILLING_PROVIDER=midtrans                          # OPEN: midtrans | xendit
BILLING_MIDTRANS_SERVER_KEY=
BILLING_MIDTRANS_CLIENT_KEY=
BILLING_MIDTRANS_IS_PRODUCTION=false
BILLING_XENDIT_SECRET_KEY=
BILLING_XENDIT_WEBHOOK_TOKEN=
CAPTCHA_SECRET=                                    # Cloudflare Turnstile
CUSTOM_DOMAIN_CNAME_TARGET=cname.localhost        # prod: cname.platformmu.site (spec 07 §12.2)
RATE_LIMIT_ENABLED=true

# ── apps/worker ──────────────────────────────────────
WORKER_QUEUES=*                                    # atau daftar: publish,thumbnails
WORKER_HEALTH_PORT=4200
ANTHROPIC_API_KEY=
AI_MODEL_CONFIG={"plan":"<model-id>","edit":"<model-id>","classify":"<model-id>"}
AI_MAX_TOOL_CALLS=30
PLAYWRIGHT_POOL_SIZE=2
EMAIL_PROVIDER=smtp                                # smtp (Mailpit lokal) | resend
SMTP_URL=smtp://localhost:1025
RESEND_API_KEY=
EMAIL_FROM="Platform <no-reply@platformmu.com>"
WHATSAPP_PROVIDER=                                 # OPEN
WHATSAPP_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=                              # KV write + custom hostnames
CLOUDFLARE_KV_HOSTS_NAMESPACE_ID=
CLOUDFLARE_ZONE_ID_SITES=
KV_WRITE_MODE=noop                                 # lokal: noop (site-host resolve via api) | cloudflare

# ── apps/realtime ────────────────────────────────────
REALTIME_PORT=4100
REALTIME_FLUSH_DEBOUNCE_MS=2000
REALTIME_SNAPSHOT_EVERY=500

# ── apps/site-host (wrangler: .dev.vars) ─────────────
STORAGE_MODE=s3                                    # s3 (MinIO lokal) | r2
HOST_RESOLVER=api                                  # api (lokal) | kv
SITE_STORAGE_PUBLIC_BASE=http://localhost:9000/sites
RUNTIME_API_ORIGIN=http://localhost:4000
# SITE_HOST_SIGNING_SECRET & SITE_HOST_INTERNAL_TOKEN sama dengan api
```

### 15.5 Script

| Perintah | Fungsi |
|---|---|
| `pnpm install` | Install semua workspace |
| `pnpm infra:up` / `pnpm infra:down` | `docker compose -f docker/docker-compose.yml up -d` / `down` |
| `pnpm db:generate` | `drizzle-kit generate` (dari `packages/db`) |
| `pnpm db:migrate` | Terapkan migration ke `DATABASE_URL` |
| `pnpm db:seed` | Plan, user dev (`owner@platform.test` / `admin@platform.test`), library seed, situs contoh |
| `pnpm db:reset` | Drop + migrate + seed (lokal saja; menolak jika `APP_ENV != local`) |
| `pnpm dev` | `turbo run dev --parallel` → web, editor, api, worker, realtime, site-host |
| `pnpm dev --filter=@platform/api...` | Hanya api dan dependensinya |
| `pnpm lint` / `pnpm lint:deps` / `pnpm typecheck` | Biome, dependency-cruiser, `tsc -b` |
| `pnpm test` / `pnpm test:integration` / `pnpm test:e2e` | Vitest unit / integration / Playwright |

Alur pertama kali: `pnpm install && pnpm infra:up && pnpm db:migrate && pnpm db:seed && pnpm dev` → buka `http://app.localhost:3000`, login user dev, publish situs contoh → buka `http://<subdomain-acak>.localhost:8787`.

### 15.6 site-host lokal

`wrangler dev --port 8787` dengan `.dev.vars`. Karena worker lokal (publish) menulis ke **MinIO** dan tidak ke KV Cloudflare, site-host lokal memakai `STORAGE_MODE=s3` (fetch HTTP ke bucket `sites` public-read di MinIO) dan `HOST_RESOLVER=api` (resolve host via `api /internal/v1/hosts/:host`). Mode `r2`/`kv` (binding Miniflare) bisa diuji dengan `wrangler dev --remote` terhadap akun staging.

---

## 16. CI/CD & deployment

### 16.1 GitHub Actions

| Workflow | Trigger | Langkah |
|---|---|---|
| `ci.yml` | PR & push | checkout → pnpm + cache → `turbo run lint lint:deps typecheck test --affected` → integration test (service container postgres+redis+minio) → `turbo build` → **migration check**: `drizzle-kit generate` lalu `git diff --exit-code packages/db/migrations` (schema & migration sinkron) + jalankan semua migration ke DB kosong |
| `e2e.yml` | push ke `main`, nightly | docker compose + build + seed → Playwright E2E + visual regression; artefak trace/screenshot saat gagal |
| `deploy-staging.yml` | push ke `main` (setelah CI hijau) | build image Docker (api, worker, realtime) tag `sha` → push registry (GHCR) → migrate staging → deploy → smoke test; editor static → staging origin; `wrangler deploy --env staging`; upload source maps Sentry |
| `deploy-production.yml` | tag `v*` / manual dengan approval environment | sama seperti staging dengan image `sha` yang sudah lulus staging (promote, bukan rebuild) |
| `security.yml` | mingguan | `pnpm audit`, CodeQL (P1) |
| `ai-evals.yml` | manual/nightly (P1) | Eval suite dengan budget token |

> ❓ OPEN: Turborepo remote cache (Vercel Remote Cache atau self-host) — tidak wajib di awal.

### 16.2 Environments

| Env | Tujuan | Data |
|---|---|---|
| `local` | Pengembangan | Seed |
| `staging` | Uji sebelum rilis, domain `staging.platformmu.com` / `*.staging-platformmu.site` | Seed + data uji; gateway mode sandbox |
| `production` | Pengguna nyata | — |

### 16.3 Target deploy

| Komponen | Usulan | Status |
|---|---|---|
| `apps/api`, `apps/worker`, `apps/realtime` | Container Docker. Opsi A: 1 VPS (Docker Compose + Caddy) — murah, kontrol penuh. Opsi B: Railway/Fly.io — lebih sedikit ops. Worker butuh RAM cukup untuk Chromium (≥ 2 GB). Realtime butuh WebSocket & sticky per dokumen (1 instance di awal). | > ❓ OPEN |
| `apps/web` | Vercel (paling mudah untuk Next.js) atau self-host container di VPS yang sama (`output: 'standalone'`). Catatan: rewrite `/api` lewat Vercel menambah hop & batas durasi; SSE & WS sudah dirancang tidak lewat proxy ini. | > ❓ OPEN |
| `apps/editor` | Static (Cloudflare Pages) | Rekomendasi |
| `apps/site-host` | Cloudflare Workers + R2 + KV (+ Cloudflare for SaaS untuk custom domain) | Diputuskan |
| PostgreSQL | Managed dengan PITR (Neon/Supabase/RDS/DO) **atau** container di VPS + backup | > ❓ OPEN |
| Redis | Managed (Upstash/Redis Cloud — pastikan kompatibel BullMQ, tanpa eviction) atau container | > ❓ OPEN |

### 16.4 Migration, rollback, backup

- **Migration on deploy:** job/container `migrate` (`pnpm db:migrate`) berjalan **sebelum** image baru menerima traffic; gagal → deploy dibatalkan. Migration harus backward compatible terhadap versi kode sebelumnya (expand/contract) agar rollback kode aman.
- **Rollback:** redeploy image `sha` sebelumnya (tidak ada down migration otomatis); site-host `wrangler rollback`; editor: re-point origin ke build sebelumnya. Situs pengguna: rollback deployment = ubah pointer KV ke deployment lama.
- **Backup:** `pg_dump` harian terenkripsi ke bucket R2 `backups` (retensi 30 hari harian + 12 bulanan) + PITR bila memakai Postgres managed. R2 `sites/` dapat dibangun ulang dari snapshot; `assets/` & `uploads/` memakai R2 object versioning/lifecycle (P1). Uji restore setiap kuartal (checklist di runbook).
- **Secrets:** GitHub Environments secrets untuk CI/CD; runtime secret di platform hosting (env) atau Doppler/Infisical (OPEN); Cloudflare secrets via `wrangler secret put`. Rotasi terjadwal untuk `INTERNAL_JWT_SECRET`, `SITE_HOST_SIGNING_SECRET` (dukung 2 secret aktif saat rotasi).

---

## 17. Scalability path

| Skala | Kondisi | Perubahan |
|---|---|---|
| **≤ 1k situs** | Rilis publik awal | Semua di desain dasar: 1 instance api, 1 worker (semua queue), 1 realtime, 1 Postgres, 1 Redis. Situs publish sudah di CDN sehingga trafik pengunjung tidak menyentuh server kecuali `/_api`. Fokus: backup, monitoring, index yang benar. |
| **~10k situs** | Banyak editor aktif bersamaan, situs dinamis mulai ramai | Api 2+ instance di belakang load balancer (stateless). Worker dipecah per queue: `publish+thumbnails+renderer` (CPU/RAM), `ai-runs` (I/O), `workflow-exec+email+whatsapp`. Renderer Playwright dipisah menjadi service sendiri bila CPU worker jenuh. PgBouncer (transaction pooling). Read replica untuk dashboard/analytics/admin. Cache edge untuk Runtime API baca publik. Realtime: beberapa instance dengan routing per `docId` (consistent hashing) + Redis extension Hocuspocus. Compaction `document_updates` lebih agresif. |
| **~100k situs** | Data besar, trafik runtime tinggi | **Pisahkan Runtime API** menjadi deployment sendiri (`apps/runtime-api`) dengan pool DB sendiri; pertimbangkan cache baca di Workers KV/Durable Objects. **Partisi tabel**: `records` (hash by `site_id`), `document_updates` (range bulanan atau hash by `document_id`), `audit_logs`, `workflow_run_steps`, `credit_ledger` (range bulanan) + retensi via drop partition. Arsip snapshot lama ke R2. Queue: BullMQ Pro/group rate-limit per tenant agar satu situs tidak memonopoli. Sharding situs dinamis besar ke database terpisah (hanya bila benar-benar perlu). Multi-region read untuk Runtime API (P2). |

Prinsip: ukur dulu (p95 latency per endpoint, queue lag, ukuran tabel, koneksi DB), baru pecah. Batas logis yang sudah dirancang sejak awal (Runtime vs Platform API, queue per jenis job, tenant key di setiap tabel, ID terurut waktu) membuat pemecahan tidak menuntut rewrite.

---

## 18. Coding conventions (ringkas)

Detail & contoh di [CLAUDE.md](../CLAUDE.md).

- **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), **ESM** di semua package, target ES2022+.
- **Tanpa `any`** (Biome `noExplicitAny` = error). Pakai `unknown` + Zod parse di boundary.
- **Zod di boundary**; tipe diturunkan dengan `z.infer`. Tidak menulis interface duplikat untuk data yang sudah punya schema.
- **Naming:** file `kebab-case.ts`; komponen React `PascalCase.tsx`; variabel/fungsi `camelCase`; konstanta `UPPER_SNAKE`; kode error `UPPER_SNAKE`; kolom DB `snake_case` (Drizzle memetakan ke `camelCase` di TS); event/action audit `domain.verb` (`site.publish`).
- **Feature folders:** kode dikelompokkan per fitur (`modules/sites/*`, `panels/layers/*`), bukan per jenis file global.
- **Repository pattern:** hanya `*.repository.ts` yang mengimport tabel Drizzle; parameter pertama `TenantContext`. Service tidak menulis SQL.
- **Error handling:** lempar `AppError(code, httpStatus, details?)` dari service; jangan `throw new Error('...')` untuk error yang diharapkan. Fungsi murni boleh mengembalikan `Result<T, E>`. Jangan menelan error tanpa log.
- **Transaksi:** service membuka `db.transaction()`; enqueue job **setelah** commit (pola outbox sederhana: `afterCommit` hook) agar worker tidak membaca data yang belum ada.
- **Async & side effects:** semua efek samping lambat (email, render, AI, HTTP keluar) lewat queue.
- **Biome** untuk format + lint, **dependency-cruiser** untuk boundary, Conventional Commits.

---

## 19. Daftar keputusan terbuka

| # | Topik | Bagian | Rekomendasi sementara |
|---|---|---|---|
| A1 | Nama domain final produk & domain situs (`platformmu.site`) | §3.1 | Domain situs terpisah + daftar PSL |
| A2 | Origin static editor di production | §5.2 | Cloudflare Pages |
| A3 | Biaya/batas Cloudflare for SaaS untuk custom domain | §5.6 | Mulai dengan CF for SaaS; Caddy on-demand TLS sebagai cadangan |
| A4 | Pecah Y.Doc per halaman | §7.1 | Tunda sampai ada data ukuran dokumen |
| A5 | Gateway & mekanisme perpanjangan langganan platform | §8.g | Invoice + reminder (lihat PRD O7) |
| A6 | KMS terkelola untuk KEK | §9.4 | Env KEK di awal |
| A7 | Malware scan file non-gambar | §9.9 | ClamAV di worker (P1/P2) |
| A8 | Backend metrics/tracing & uptime monitor | §13 | Pilih free tier memadai |
| A9 | Hosting api/worker/realtime | §16.3 | VPS Docker (biaya) vs Railway/Fly (ops) |
| A10 | Hosting `apps/web` | §16.3 | Vercel atau self-host standalone |
| A11 | Postgres & Redis managed vs self-host | §16.3 | Managed Postgres dengan PITR |
| A12 | Secret manager (Doppler/Infisical) & Turborepo remote cache | §16.1, §16.4 | Tidak wajib di awal |
| A13 | Provider WhatsApp | §5.4 | BSP resmi WhatsApp Business API (PRD O9) |
| A14 | Runtime islands Preact vs React | ADR-005 | Preact + `preact/compat` (spike M7; spec 05 & 07) |

---

## 20. Architecture Decision Records

### ADR-001: Canvas berbasis DOM (bukan WebGL)

- **Konteks:** Editor harus WYSIWYG terhadap situs publish yang berupa HTML/CSS. Target ≥ 2.000 node per halaman pada 60 fps. Owner solo developer.
- **Keputusan:** Node dirender sebagai elemen HTML/CSS asli oleh `@platform/renderer`; interaksi (seleksi, handle, guide, snapping) di overlay layer terpisah; pan/zoom dengan CSS transform pada container.
- **Alternatif:** WebGL/Canvas2D custom (gaya Figma: Skia/CanvasKit) — performa tertinggi untuk puluhan ribu objek, tapi harus mengimplementasi ulang layout teks, flexbox, font, dan tetap butuh renderer HTML kedua untuk publish (melanggar P2).
- **Konsekuensi:** Layout identik dengan browser (flexbox, teks, font) dan satu renderer untuk dua tujuan. Risiko performa di dokumen sangat besar → mitigasi: virtualisasi halaman di luar viewport, `content-visibility`, memoized node, update Yjs granular; diuji di M0 (spike). Efek grafis tingkat lanjut (blend kompleks, vector network penuh) terbatas pada kemampuan CSS/SVG.

### ADR-002: Yjs sejak hari pertama

- **Konteks:** Multiplayer real-time adalah fitur nanti (Business), tapi format penyimpanan & undo/redo dibangun sejak M1.
- **Keputusan:** Dokumen editor adalah Y.Doc; undo/redo memakai `Y.UndoManager`; sinkronisasi & autosave lewat Hocuspocus (single-editor dulu); penyimpanan append-only update + snapshot.
- **Alternatif:** JSON + patch (Immer/JSON Patch) dan migrasi ke CRDT nanti; OT server (ShareDB); Liveblocks (SaaS).
- **Konsekuensi:** Offline/recovery (y-indexeddb), undo transaksi AI, dan multiplayer hampir gratis kelak. Biaya: kompleksitas binding Yjs ↔ Zod (ditangani `document-model`), ukuran dokumen bertambah (butuh compaction), validasi harus dilakukan di level ops karena CRDT tidak menolak update tidak valid.

### ADR-003: Express 5 (bukan NestJS)

- **Konteks:** Owner sudah mahir Express; AI coding agent juga produktif dengan pola sederhana dan eksplisit.
- **Keputusan:** Express 5 + struktur modul (`routes/controller/service/repository/schema`) + Zod + middleware chain eksplisit.
- **Alternatif:** NestJS (DI, dekorator, opini kuat), Fastify, Hono, tRPC.
- **Konsekuensi:** Kurva belajar minimal, kontrol penuh, async error native di Express 5. Konvensi harus dijaga sendiri (didokumentasikan di CLAUDE.md, ditegakkan lint & review). Performa cukup karena trafik pengunjung dilayani CDN.

### ADR-004: Drizzle ORM

- **Konteks:** Butuh tipe kuat, kontrol SQL (JSONB, index GIN, partisi, RLS), migration yang bisa direview, dan integrasi Zod.
- **Keputusan:** Drizzle ORM + drizzle-kit (SQL migration di-commit) + drizzle-zod; schema di `packages/db`.
- **Alternatif:** Prisma (DX bagus, tapi engine terpisah & kontrol SQL lanjut terbatas), TypeORM/Sequelize (tipe lemah, pola decorator/active record), Kysely (query builder murni, tanpa schema/migration terpadu).
- **Konsekuensi:** SQL-like, ringan, cocok untuk edge/serverless kelak. Fitur lanjut (RLS policy, partisi, trigger immutability) ditulis sebagai custom SQL migration.

### ADR-005: Static-first publish + islands

- **Konteks:** Situs Free harus hampir tanpa biaya, cepat (Lighthouse ≥ 90), dan andal (99,9%).
- **Keputusan:** Publish menghasilkan HTML+CSS statis per halaman di R2; interaktivitas & data via island JS kecil yang memanggil Runtime API (same-origin `/_api/v1/*`). Runtime island: **Preact** (+ `preact/compat`) — rekomendasi bersama spec 05 & 07, ❓ OPEN sampai spike M7; editor tetap React.
- **Alternatif:** SSR per request (Next.js multi-tenant), SPA penuh per situs.
- **Konsekuensi:** Biaya & latensi minimal, situs tetap hidup walau control plane down. Perubahan konten butuh publish ulang; data dinamis tidak SEO-friendly kecuali dirender saat publish (P1: pre-render data publik saat publish + revalidate).

### ADR-006: Cloudflare R2 + Workers untuk hosting situs

- **Konteks:** Butuh wildcard subdomain, custom domain dengan SSL otomatis, CDN global, dan biaya egress rendah.
- **Keputusan:** `apps/site-host` di Cloudflare Workers, file di R2, mapping host di KV, custom domain via Cloudflare for SaaS.
- **Alternatif:** VPS + Nginx/Caddy (on-demand TLS) + CDN terpisah; Vercel/Netlify multi-tenant; S3 + CloudFront.
- **Konsekuensi:** R2 tanpa biaya egress, edge global, SSL terkelola. Ketergantungan vendor Cloudflare (dimitigasi adapter `ObjectStore`/`HostResolver`). Batas runtime Workers (CPU time, ukuran bundle) membatasi logika di edge — logika berat tetap di api.

### ADR-007: AI hanya via tools

- **Konteks:** AI harus aman, dapat diaudit, dapat di-undo, dan tidak merusak dokumen/data pengguna.
- **Keputusan:** AI hanya bertindak melalui tool berskema Zod yang memanggil ops document-model/collection/workflow; tidak ada code generation bebas (HTML/JS/SQL) yang dieksekusi.
- **Alternatif:** AI menghasilkan JSON dokumen utuh; AI menulis kode React/HTML (gaya generator kode).
- **Konsekuensi:** Setiap aksi tervalidasi dan tercatat (`ai_tool_calls`), mudah dibatasi per paket, undo per run. Kreativitas AI dibatasi oleh kosakata tools → tools & skills harus terus ditambah; evals diperlukan untuk menjaga kualitas.

### ADR-008: Records generik JSONB

- **Konteks:** Setiap situs dinamis punya collection berbeda, dibuat/diubah AI kapan saja, untuk ribuan situs.
- **Keputusan:** Satu tabel `records` (`site_id`, `collection_id`, `data jsonb`) dengan schema collection di `collections.schema` dan validasi Zod dinamis; index GIN + expression index untuk field yang sering difilter (dibuat otomatis untuk collection besar, P1).
- **Alternatif:** Tabel fisik per collection (DDL dinamis), database per tenant, EAV.
- **Konsekuensi:** Tanpa DDL runtime, migrasi schema collection murah, isolasi tenant sederhana. Query kompleks/agregasi & constraint relasional lebih lemah (ditegakkan di aplikasi); butuh partisi saat volume besar ([§17](#17-scalability-path)).

### ADR-009: Domain terpisah untuk situs pengguna

- **Konteks:** Situs pengguna menjalankan konten & JS yang tidak sepenuhnya dikontrol platform; risiko phishing di situs Free.
- **Keputusan:** Situs di `*.platformmu.site` (terdaftar di Public Suffix List), aset upload di `assets.platformmu.site`; platform di `platformmu.com`.
- **Alternatif:** Subdomain dari domain utama (`*.platformmu.com`).
- **Konsekuensi:** Cookie & reputasi domain utama terlindungi; setiap situs terisolasi sebagai *site* terpisah. Biaya: dua domain & sertifikat, branding URL sedikit kurang "satu merek". Butuh konfirmasi owner (OPEN A1).

### ADR-010: Bring-your-own payment gateway

- **Konteks:** Platform tidak ingin menjadi perantara dana (regulasi, rekonsiliasi, risiko) di pasar Indonesia.
- **Keputusan:** Pengguna memasukkan kredensial akun gateway miliknya (Midtrans/Xendit); dana langsung ke pengguna; kredensial dienkripsi envelope; webhook unik per konfigurasi.
- **Alternatif:** Platform sebagai marketplace/payment facilitator (split payment).
- **Konsekuensi:** Tanpa lisensi/rekonsiliasi dana di sisi platform; onboarding pengguna lebih sulit (harus punya akun gateway); platform harus memelihara adapter per gateway & menangani verifikasi webhook per tenant.

### ADR-011: Editor sebagai Vite SPA terpisah dari Next.js

- **Konteks:** Editor sangat client-heavy (pointer events, Yjs, worker, canvas 60 fps), tidak butuh SSR/SEO.
- **Keputusan:** `apps/editor` = Vite + React SPA di `app.<domain>/editor/*` lewat rewrite Next.js; dashboard tetap di Next.js.
- **Alternatif:** Route editor di dalam Next.js App Router (`'use client'` penuh).
- **Konsekuensi:** Dev server & HMR lebih cepat, build editor independen, tidak ada friksi RSC/hydration. Biaya: dua aplikasi frontend (dibagi lewat `@platform/ui`, `@platform/sdk`, `@platform/i18n`), konfigurasi rewrite & auth gate di perbatasan, deploy static terpisah.

### ADR-012: Isolasi style canvas dengan Shadow DOM

- **Status:** Diterima 2026-10-13 (T0.8.1, disetujui owner). Angka fps laptop referensi (T0.7.4) & uji manual Safari menyusul sebagai konfirmasi.
- **Konteks:** CSS situs user (reset, token, custom CSS) tidak boleh merusak chrome editor dan CSS editor (Tailwind preflight, shadcn/Radix) tidak boleh mengubah konten canvas (ED-016). Spike M0 membangun kedua opsi berdampingan (`?isolation=shadow|prefix`) dan mengujinya dengan E2E, Tiptap, hit-test, dan benchmark (T0.4.3–T0.4.5, T0.5.2, T0.7.3).
- **Keputusan:** Konten canvas dirender di dalam **shadow root** `#world` (Opsi A) dengan `:host { all: initial }`, stylesheet renderer + token di dalam shadow root, font situs via `FontFace` (document-wide).
- **Alternatif:** Opsi B prefix class (`.pf-*` + preflight editor di-scope ke chrome). Ditolak karena isolasinya bergantung disiplin, bukan dijamin browser: semua CSS situs harus ditulis ulang selector-nya (termasuk `@media`, `@keyframes`, `:is()`, kombinator) dan **setiap** CSS editor — termasuk library pihak ketiga — wajib di-scope; preflight global terbukti menembus canvas di spike. Keunggulan Opsi B (DOM biasa untuk `querySelector`/selection API) ternyata kecil: Tiptap berjalan setara di kedua opsi pada Chromium & Firefox.
- **Bukti spike:** E2E CSS agresif dua arah lulus; fps pan/zoom/drag/reorder/resize & latensi klik → seleksi setara (headless); hit-test 2.000 node ≈ 0,011–0,013 ms/hit di kedua opsi; seleksi, IME (CDP), copy/paste ProseMirror lulus di shadow.
- **Konsekuensi (aturan wajib):**
  - Handler keyboard global membaca target lewat `isEditableEvent` (`composedPath()[0]`) — event dari dalam shadow root di-retarget ke host.
  - Hit-test & query DOM canvas lewat `shadowRoot` (`shadowRoot.elementsFromPoint`, `shadowRoot.querySelector`), bukan `document`.
  - Tiptap/ProseMirror memakai `injectCSS: false`; CSS dasar editor teks ikut stylesheet canvas.
  - Overlay (`#overlay`) tetap di light DOM (chrome editor).
  - Risiko terbuka: Safari (selection di shadow root) belum diuji — wajib uji manual sebelum M2 (T2 teks inline); jika gagal, Opsi B tetap tersedia karena renderer tidak bergantung pada mekanisme isolasi. Mode `?isolation=prefix` dipertahankan sampai uji Safari lulus, lalu dihapus (T0.8.7).

### ADR-013: Breakpoint frame canvas tanpa iframe (class-scope)

- **Status:** Diterima 2026-10-13 (T0.8.2, disetujui owner — mengikuti model Figma: semua breakpoint frame di satu canvas).
- **Konteks:** Canvas menampilkan beberapa breakpoint frame (Desktop/Tablet/Mobile) berdampingan (ED-034). Opsi: (a) satu dokumen, style breakpoint diterapkan per frame lewat class/context; (b) iframe per frame agar media query asli bekerja. Diuji di spike T0.4.6 (`?frames=all&bpMode=class|iframe`).
- **Keputusan:** Canvas memakai **(a) tanpa iframe**: setiap breakpoint frame dirender di dokumen yang sama (di dalam shadow root ADR-012) dengan style hasil cascade `resolveStyle(style, bp)` (DM-036). **Preview & publish** tetap memakai media query asli.
- **Alternatif:** (b) iframe per frame. Ditolak: fps tidak lebih baik (setara di 3 × 200 node), sementara kompleksitasnya tinggi — event pointer tidak sampai ke viewport (harus `pointer-events: none` + hit-test manual), jebakan cross-realm (`instanceof` & `ResizeObserver` per window), teks inline/dblclick butuh penerusan event, dan isolasi style harus diulang per dokumen.
- **Konsekuensi:**
  - Renderer punya dua jalur keluaran style responsif: **mode editor** = style ter-resolve per breakpoint frame (tanpa media query), **mode publish** = CSS dengan media query. Keduanya harus diturunkan dari fungsi cascade yang sama dan dijaga oleh visual regression editor vs static (ED-240).
  - Hal yang bergantung pada viewport nyata (unit `vw/vh`, `position: fixed`, media query di custom CSS) tidak akurat di canvas; ditampilkan benar di mode Preview. Dokumentasikan di UI bila fitur tersebut dipakai.
  - Hit-test, seleksi, drag, dan Tiptap bekerja seragam di semua frame tanpa kode khusus per frame.
