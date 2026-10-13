# Roadmap

> Rencana kerja bertahap **M0 → M9+** untuk Platform (website builder Figma + Wix + AI).
> Dokumen ini adalah **daftar task yang dieksekusi** oleh owner bersama Claude Code, satu task per sesi.
>
> Dokumen terkait: [PRD](./PRD.md) · [ARCHITECTURE](./ARCHITECTURE.md) · [CLAUDE.md](../CLAUDE.md) ·
> [01 Document Model](./specs/01-document-model.md) · [02 Editor](./specs/02-editor.md) ·
> [03 Components & Templates](./specs/03-components-templates.md) · [04 AI Agent](./specs/04-ai-agent.md) ·
> [05 Dynamic Data](./specs/05-dynamic-data.md) · [06 Commerce & Payments](./specs/06-commerce-payments.md) ·
> [07 Publishing & Hosting](./specs/07-publishing-hosting.md) · [08 Accounts, Plans & Admin](./specs/08-accounts-plans-admin.md)
>
> Status dokumen: v1 (2026-10-12). Tidak ada deadline ("selesainya saja"); urutan lebih penting daripada tanggal.

## Daftar isi

1. [Cara memakai roadmap ini dengan Claude Code](#1-cara-memakai-roadmap-ini-dengan-claude-code)
2. [Ringkasan fase](#2-ringkasan-fase)
3. [M0 — Spike canvas](#m0--spike-canvas)
4. [M1 — Fondasi](#m1--fondasi)
5. [M2 — Editor inti](#m2--editor-inti)
6. [M3 — Sistem component & mode admin](#m3--sistem-component--mode-admin)
7. [M4 — Template, mode user, publish, paket Free → 🚀 rilis publik](#m4--template-mode-user-publish-subdomain-paket-free---rilis-publik-pertama)
8. [M5 — Billing & paket berbayar](#m5--billing--paket-berbayar)
9. [M6 — AI asisten](#m6--ai-asisten)
10. [M7 — Website dinamis (M7.1–M7.9)](#m7--website-dinamis)
11. [M8 — E-commerce](#m8--e-commerce)
12. [M9+ — Lanjutan](#m9--lanjutan)
13. [Lampiran A — Keputusan OPEN yang memblokir per fase](#lampiran-a--keputusan-open-yang-memblokir-per-fase)
14. [Lampiran B — Matriks traceability](#lampiran-b--matriks-traceability)
15. [Lampiran C — Backlog P2 & ide (tidak dijadwalkan)](#lampiran-c--backlog-p2--ide-tidak-dijadwalkan)
16. [Lampiran D — Log perubahan roadmap](#lampiran-d--log-perubahan-roadmap)

---

## 1. Cara memakai roadmap ini dengan Claude Code

### 1.1 Alur per sesi

Setiap sesi Claude Code mengerjakan **tepat satu task**. Alurnya (selaras dengan [CLAUDE.md § Alur kerja per sesi](../CLAUDE.md#alur-kerja-per-sesi)):

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. AMBIL   Cari task pertama "- [ ]" di fase aktif (lihat §1.6), kecuali owner │
│            menyebut task lain. Cek prasyarat & Definition of Ready (§1.5).     │
│ 2. BACA    Baca setiap requirement ID yang dirujuk task di spec terkait        │
│            (acceptance criteria = definisi selesai task). Baca juga section    │
│            ARCHITECTURE/CLAUDE.md yang dirujuk.                                │
│ 3. PLAN    Plan mode bila menyentuh > 3 file: daftar file dibuat/diubah, test │
│            yang ditulis, risiko. Jika ada ❓ OPEN yang menghalangi → STOP,      │
│            tanya owner (opsi + rekomendasi).                                   │
│ 4. IMPLEMENT  Perubahan kecil, ikuti pola file tetangga, tanpa scope creep.   │
│ 5. VERIFY  pnpm typecheck && pnpm lint && pnpm lint:deps && pnpm test          │
│            (+ test:integration bila menyentuh api/db, + test:e2e bila UI).     │
│            Jalankan langkah "Verifikasi:" yang tertulis di task.               │
│ 6. CENTANG Ubah "- [ ]" → "- [x]" + tanggal (§1.4). Catat keputusan baru.     │
│ 7. RINGKAS Ke owner: apa berubah, cara mencoba, hal yang perlu diputuskan,    │
│            temuan di luar scope (jangan dikerjakan).                           │
│ 8. COMMIT  Hanya bila owner meminta. Conventional Commits, sebut ID task:      │
│            feat(editor): resize 8 handle (T2.4.3)                              │
└───────────────────────────────────────────────────────────────────────────────┘
```

Prompt pembuka sesi yang disarankan untuk owner:

```text
Kerjakan task berikutnya di docs/ROADMAP.md (fase aktif: M2).
Baca requirement yang dirujuk, buat plan dulu, lalu implementasikan dan verifikasi.
```

atau untuk task spesifik:

```text
Kerjakan T2.4.3. Jangan sentuh hal di luar task ini.
```

### 1.2 Aturan ukuran task

| Aturan | Penjelasan |
|---|---|
| **1 task = 1 sesi** | Bisa diselesaikan dalam satu sesi Claude Code (kira-kira ≤ 2–4 jam kerja agent termasuk test). |
| **≤ ~10 file** | Task yang menyentuh lebih dari ~10 file (di luar file test/fixture/locale) harus dipecah. |
| **Bisa diverifikasi** | Setiap task punya baris `Verifikasi:` yang konkret: unit test, integration test, Playwright, atau perilaku manual yang bisa dicek owner dalam < 5 menit. |
| **Satu tujuan** | Jangan menggabungkan "fitur + refactor besar". Refactor yang diperlukan = task sendiri. |
| **Vertikal bila mungkin** | Lebih baik "endpoint + service + repository + test untuk 1 operasi" daripada "semua repository sekaligus". |
| **Konten ≠ kode** | Produksi konten (component, template, skill, teks legal) adalah task terpisah dari fitur yang memakainya. |

Jika ternyata task terlalu besar saat dikerjakan: hentikan di titik hijau terakhir, pecah sisa pekerjaan menjadi task baru (`T2.4.3a`, `T2.4.3b`) tepat di bawah task asal, centang bagian yang selesai.

### 1.3 Definition of Done (global)

Sebuah task **baru boleh dicentang** jika semua butir ini terpenuhi:

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm lint:deps`, `pnpm test` **hijau** (dan `pnpm test:integration` / `pnpm test:e2e` bila relevan).
- [ ] Acceptance criteria dari **setiap requirement ID** yang dirujuk task terpenuhi untuk lingkup task itu. Bila task hanya memenuhi sebagian AC (mis. requirement multi-fase), sebutkan AC mana di catatan task.
- [ ] Langkah `Verifikasi:` di task sudah dijalankan dan lulus.
- [ ] Tidak ada `TODO`/`FIXME` baru tanpa rujukan issue atau task roadmap (`// TODO(T4.2.7): ...`).
- [ ] Tidak ada `any`, tidak ada `eval`/`new Function`, tidak ada query tenant tanpa `TenantContext` ([CLAUDE.md § Aturan wajib](../CLAUDE.md#aturan-wajib-jangan-dilanggar)).
- [ ] String UI lewat `@platform/i18n` (ID + EN).
- [ ] Bila ada keputusan baru (memilih opsi dari ❓ OPEN, mengubah kontrak API, schema DB, format dokumen): dokumen terkait diperbarui (spec/ARCHITECTURE/ADR) **atau** dicatat di catatan task + [Lampiran D](#lampiran-d--log-perubahan-roadmap) agar owner menyelaraskan.
- [ ] Perubahan schema dokumen: `schemaVersion` naik + fungsi migrasi + fixture test (DM-071, DM-072).
- [ ] Perubahan schema DB: migration di-generate (`pnpm db:generate`) dan di-commit.

### 1.4 Menandai progres

- Belum: `- [ ] **T2.4.3** ...`
- Selesai: `- [x] **T2.4.3** ... ✅ 2026-11-03`
- Selesai dengan catatan: tambahkan baris indent di bawahnya:
  ```markdown
  - [x] **T2.4.3** Resize dengan 8 handle ... ✅ 2026-11-03
    - Catatan: memilih snapping ke integer px; AC ED-065 #3 (rotate-aware) ditunda ke T4.x (rotate = P1).
  ```
- Sedang dikerjakan lintas sesi (hindari): `- [ ] **T2.4.3** ... 🚧 (sesi 2026-11-02, berhenti di test resize multi)`.
- Diblokir: `- [ ] **T2.4.3** ... ⛔ diblokir OPEN 02#2` — lalu lompat ke task berikutnya yang tidak diblokir.
- Dibatalkan: ~~coret~~ + alasan, jangan dihapus: `- [x] ~~**T2.4.9** ...~~ dibatalkan 2026-11-10: digabung ke T2.4.8`.

Fase dianggap **selesai** jika semua task P0 di fase itu tercentang **dan** checklist "Exit criteria" fase tercentang. Task P1 yang tersisa boleh dipindah ke fase berikutnya (catat di Lampiran D).

### 1.5 Definition of Ready (sebelum mulai task)

Task siap dikerjakan bila:

- [ ] Semua task prasyarat (task sebelumnya di epic yang sama, atau yang disebut eksplisit) sudah selesai.
- [ ] Requirement ID yang dirujuk ada di spec dan punya acceptance criteria.
- [ ] Tidak ada ❓ OPEN **pemblokir** yang belum diputuskan (lihat bagian "Prasyarat" fase dan [Lampiran A](#lampiran-a--keputusan-open-yang-memblokir-per-fase)). OPEN non-pemblokir boleh memakai rekomendasi spec, dibuat mudah diganti (config/env), dan disebutkan di ringkasan.
- [ ] Paket/app yang disentuh sudah ada (atau task ini yang membuatnya).
- [ ] Data/fixture yang dibutuhkan tersedia.

### 1.6 Fase aktif & urutan

- Fase aktif = fase **terendah** yang belum selesai. Saat ini: **M0**.
- Di dalam fase, kerjakan **epic berurutan** kecuali dinyatakan "boleh paralel". Di dalam epic, kerjakan task berurutan.
- Jangan mengerjakan P1/P2 saat fase aktif masih punya P0 yang belum selesai ([CLAUDE.md § Scope](../CLAUDE.md#scope)). Task P1 diberi label `(P1)` di judulnya.
- Fase M5–M9 sudah dirinci sampai task, tetapi **wajib dirinci ulang** (refinement) saat fase dimulai — lihat task `T<n>.0.1` di awal setiap fase.

### 1.7 Menambah task baru

1. Tentukan fase & epic. Tambahkan di akhir epic dengan nomor berikutnya (`T2.4.12`), atau sisipkan dengan sufiks huruf (`T2.4.3a`) bila harus dikerjakan sebelum task tertentu. **Jangan menomori ulang** task yang ada (ID task dirujuk di commit).
2. Format wajib:
   ```markdown
   - [ ] **T<fase>.<epic>.<n>** <Judul imperatif ringkas> — <ID requirement | §ARCHITECTURE/CLAUDE.md> · <app/paket> · Verifikasi: <bukti selesai>
   ```
3. Jika task tidak punya requirement (tooling, refactor, bug), rujuk section ARCHITECTURE/CLAUDE.md atau tulis `bug: <deskripsi singkat>`.
4. Jika pekerjaan baru memerlukan requirement baru: tambahkan requirement di spec dengan nomor berikutnya setelah ID terakhir di bagian itu (lihat tabel rentang ID di spec) **sebelum** membuat task.
5. Catat di [Lampiran D](#lampiran-d--log-perubahan-roadmap).

### 1.8 Konvensi penulisan task

- **ID task**: `T<fase>.<epic>.<n>`; khusus M7: `T7.<subfase>.<epic>.<n>` (mis. `T7.4.2.3` = M7.4, epic 2, task 3).
- **Rujukan**: ID requirement dipisah koma. Rentang hanya dipakai di lampiran, bukan di task.
- **Lokasi**: path app/paket utama, mis. `apps/editor/canvas`, `packages/document-model`.
- **Verifikasi**: `unit` = Vitest, `int` = integration test API + Postgres, `e2e` = Playwright, `manual` = langkah yang owner cek di browser.
- Simbol: `(P1)` task P1; `⚑` task yang mengunci keputusan sulit dibalik (schema/format/API publik) — wajib minta konfirmasi owner sebelum merge; `🧪` task spike/eksperimen yang hasilnya boleh dibuang.

---

## 2. Ringkasan fase

### 2.1 Tabel fase

| Fase | Tujuan | Hasil yang bisa didemokan | Exit criteria (ringkas) | Dependensi |
|---|---|---|---|---|
| **M0** Spike canvas | Membuktikan canvas DOM-based terasa mulus sebelum investasi besar | Halaman 2.000 node: pan/zoom, select, drag, resize, auto-layout sederhana, undo — 60 fps | Target performa M0 (ED-022) lulus; keputusan OPEN spike tercatat; go/no-go = GO | — |
| **M1** Fondasi | Rangka seluruh sistem end-to-end yang tipis tapi benar | Register → login → buat situs kosong → editor terbuka → edit node → reload → perubahan tersimpan (autosave Hocuspocus) | CI hijau; document-model v1 + renderer v1 teruji; autosave & crash recovery bekerja; isolasi tenant teruji | M0 GO |
| **M2** Editor inti | Fitur Figma P0 untuk desain dari nol | Membuat landing page lengkap dari kanvas kosong (tools, auto-layout, styling, typography, layers, shortcuts, assets) | Semua ED P0 fase M2 selesai; target performa M2 (2.000 node); e2e editor lulus | M1 |
| **M3** Component & mode admin | Sistem component berversi + produksi library | Admin membuat component dengan props/variants → publish v1 → user insert instance → admin publish v2 → instance tetap v1; ≥ 110 varian library | Lifecycle component lengkap; library seed P0 published; AI admin (opsional) jalan | M2 |
| **M4** Template, Simple mode, publish, Free | **🚀 Rilis publik pertama (statis)** | User baru: daftar → pilih template → Simple mode ganti teks/gambar → publish → situs live di `x7k2p9mq.platformmu.site` | ≥ 20 template, publish pipeline + site-host production, admin & moderasi dasar, legal, checklist rilis | M3 |
| **M5** Billing & paket berbayar | Monetisasi: Starter/Pro | Upgrade Free → Pro: bayar → subdomain pilihan → custom domain aktif SSL → badge hilang | Siklus langganan penuh (checkout, renewal, dunning, downgrade) teruji | M4 |
| **M6** AI asisten | Pembeda utama: AI merakit/redesign lewat tools | "Buatkan website katering di Bandung" → AI membangun 4 halaman dari library → preview → Terapkan → undo sekali | Agent + tools + skills + kredit + eval baseline lulus; biaya per run terukur | M5 (ledger/entitlement), M3 (library), M4 (preview pipeline) |
| **M7** Website dinamis | Collections, bindings, forms, member login, dashboard/CRUD, workflows (lewat AI) | "Buat sistem pesanan" → AI membuat collection + form + workflow email + dashboard admin → pengunjung pesan → owner melihat di dashboard | M7.1–M7.9 selesai; tenant-escape suite lulus | M6 |
| **M8** E-commerce | Jualan dengan payment gateway milik user | Toko Kue: produk → keranjang → checkout Midtrans/Xendit sandbox → webhook → order lunas → resi | DoD COM-190 lulus di sandbox dua gateway | M7 |
| **M9+** Lanjutan | Fitur lanjutan, tim, multiplayer, marketplace | Tim 3 orang edit situs bersamaan dengan cursor & komentar | Dirinci per sub-fase saat dimulai | M4+ (berbeda per item) |

### 2.2 Diagram dependensi

```
                          ┌──────────────┐
                          │ M0 Spike     │  go/no-go canvas DOM
                          └──────┬───────┘
                                 ▼
                          ┌──────────────┐
                          │ M1 Fondasi   │  monorepo · db · auth · api · doc-model v1
                          └──────┬───────┘  renderer v1 · realtime autosave · CI
                                 ▼
                          ┌──────────────┐
                          │ M2 Editor    │  fitur Figma P0
                          └──────┬───────┘
                                 ▼
                          ┌──────────────┐        ┌───────────────────────────┐
                          │ M3 Component │◄──────►│ (opsional) agent AI admin │ spec 04 §14
                          └──────┬───────┘        └───────────────────────────┘
                                 ▼
                          ┌──────────────────────────────────┐
                          │ M4 Template · Simple · Publish   │
                          │    Free · Admin · Moderasi ·Legal│  🚀 RILIS PUBLIK PERTAMA (statis)
                          └──────┬───────────────────────────┘
                                 ▼
                          ┌──────────────┐
                          │ M5 Billing   │  Starter/Pro · subdomain pilihan · custom domain
                          └──────┬───────┘  ledger kredit disiapkan
                                 ▼
                          ┌──────────────┐
                          │ M6 AI        │  agent · tools · skills · kredit · eval
                          └──────┬───────┘
                                 ▼
        ┌────────────────────────────────────────────────────────────┐
        │ M7 Dinamis                                                  │
        │  M7.1 Data inti ─► M7.2 Bindings & publish ─► M7.3 Forms     │
        │        │                    │                    │           │
        │        └────────────► M7.4 Member & access ◄─────┘           │
        │                             ▼                                │
        │                     M7.5 Dashboard blocks                    │
        │  M7.6 Workflows (setelah M7.3) ─► M7.7 AI ─► M7.8 Hardening  │
        │  M7.9 Commerce ringan (WA order) setelah M7.2                │
        └───────────────────────────┬────────────────────────────────┘
                                    ▼
                          ┌──────────────┐
                          │ M8 Commerce  │  BYOG Midtrans/Xendit · checkout · order
                          └──────┬───────┘
                                 ▼
                          ┌──────────────┐
                          │ M9+ Lanjutan │  Figma lanjutan · Tim · multiplayer · marketplace
                          └──────────────┘
```

Catatan paralelisme (solo developer → tetap satu jalur utama, tapi boleh disisipkan):

- **Produksi konten** (component M3, template M4, skill M6) boleh dicicil di sela task kode setelah fitur pendukungnya ada.
- **Task legal non-kode** (PSE, badan usaha, kebijakan) di M4/M5 **harus dimulai lebih awal** (mis. sejak M2) karena butuh waktu tunggu pihak luar. Lihat T4.17.x dan T5.9.x.
- **Keputusan OPEN** pemblokir sebuah fase harus diputuskan sebelum fase itu dimulai (Lampiran A). Owner disarankan membaca Lampiran A satu fase lebih awal.

### 2.3 Hitungan task (v1)

| Fase | Epic | Task | Catatan |
|---|---|---|---|
| M0 | 8 | 44 | spike, sebagian kode boleh dibuang |
| M1 | 16 | 140 | fondasi, sangat rinci |
| M2 | 20 | 124 | mengikuti ED P0/P1 baris M2 |
| M3 | 13 | 102 | termasuk produksi konten library & AI admin opsional |
| M4 | 20 | 234 | termasuk template, legal, checklist rilis, P1 editor |
| M5 | 10 | 62 | dirinci ulang saat mulai |
| M6 | 11 | 75 | dirinci ulang saat mulai |
| M7 | 9 sub-fase (+ refinement) | 132 | dirinci ulang per sub-fase |
| M8 | 11 | 54 | dirinci ulang saat mulai |
| M9+ | 8 | 37 | backlog terstruktur |

---

## M0 — Spike canvas

### M0.a Tujuan & ruang lingkup

Membuktikan bahwa **canvas berbasis DOM** (ADR-001) bisa terasa mulus untuk halaman nyata (200 node) dan tetap layak di halaman besar (2.000 node), serta mengunci keputusan arsitektur canvas yang mahal dibalik. Spike adalah eksperimen terukur, bukan produk.

Termasuk:
- Monorepo minimal (pnpm + Turborepo + TypeScript strict + Biome) — cukup untuk `apps/editor` dan `packages/document-model` prototipe.
- Canvas: world container dengan CSS transform, pan, zoom, overlay terpisah.
- Render node `frame` / `text` / `image` dari dokumen prototipe (flat map, mengikuti bentuk spec 01).
- Select (klik, marquee), drag move, resize 8 handle, auto-layout sederhana (flex row/column + gap + padding + reorder drag).
- Undo/redo via `Y.UndoManager` di atas Y.Doc.
- Benchmark otomatis 200 & 2.000 node.
- Eksperimen keputusan: isolasi style (Shadow DOM vs prefix), iframe per breakpoint, rentang zoom, deteksi overflow untuk auto-responsive (`stackRows`), Tiptap di dalam canvas.

**Tidak termasuk**: auth, DB, API, autosave server, styling panel, layers panel, schema lengkap, i18n, CI lengkap, desain UI final. Kode spike **boleh dibuang**; yang dipertahankan hanya yang lolos review (geometri murni, state machine interaksi, hasil benchmark).

### M0.b Prasyarat

- Tidak ada fase sebelumnya.
- Keputusan OPEN yang **diputuskan di dalam** spike (bukan sebelum): 02 OPEN #1 (rentang zoom), #2 (Shadow DOM vs prefix), #11 (iframe per breakpoint), #13 (angka batas awal); OPEN-DM-5 (deteksi overflow `stackRows`); validasi rich text `y-prosemirror` (sudah diputuskan di spec 01, dicoba di spike).
- Laptop referensi untuk benchmark ditetapkan (ED-022: i5 gen-10 / M1, 8 GB, Chrome stabil, 1080p).

### M0.c Epic & task

#### Epic 0.1 — Monorepo minimal

- [x] **T0.1.1** Inisialisasi repo: `pnpm-workspace.yaml`, `package.json` root (`packageManager`, `engines`), `.nvmrc`, `turbo.json` (dev/build/test/typecheck/lint) — ARCHITECTURE §4.4 · root · Verifikasi: `pnpm install && pnpm turbo run typecheck` sukses di WSL2 ✅ 2026-10-13
  - Catatan: Node 22 (`.nvmrc`, `engines` `>=22 <23`), `pnpm@9.15.9`, `turbo` 2.11.7 di-pin. Typecheck masih 0 package (workspace package pertama datang di T0.1.3/T0.1.4). Ditambah `.gitignore` minimal.
- [x] **T0.1.2** `tsconfig.base.json` strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + Biome config minimal (`noExplicitAny` = error) — ARCHITECTURE §18 · `packages/config` · Verifikasi: file dengan `any` gagal `pnpm lint` ✅ 2026-10-13
  - Catatan: base tsconfig ada di `packages/config/tsconfig/base.json` (mengikuti tree ARCHITECTURE §4.1), di-extend lewat `@platform/config/tsconfig/base.json`. TypeScript 7.0.2 (native) + Biome 2.5.15 di root devDependencies. `pnpm lint` = `biome lint .` (seluruh repo); formatter & import sorting menyusul di T1.1.3.
- [x] **T0.1.3** Scaffold `apps/editor` (Vite + React + TS, `base: '/editor/'`, port 5173) dengan halaman kosong "canvas" — ARCHITECTURE §5.2 · `apps/editor` · Verifikasi: `pnpm dev --filter=@platform/editor` membuka `localhost:5173/editor/` ✅ 2026-10-13
  - Catatan: Vite 8.3.4, `@vitejs/plugin-react` 6.1.2, React 19.3.0. `strictPort: true` (gagal jelas bila 5173 terpakai, tidak pindah port diam-diam). Halaman berisi `<main id="editor-viewport">` kosong; lapisan world/overlay di T0.3.1.
- [x] **T0.1.4** Scaffold `packages/document-model` prototipe (zod, yjs, nanoid saja) + Vitest — ARCHITECTURE §4.3, DM-007 · `packages/document-model` · Verifikasi: 1 unit test `createId('n')` cocok regex DM-007 ✅ 2026-10-13
  - Catatan: zod 4.6.7, yjs 13.6.33, nanoid 6.0.2, vitest 5.0.4. `src/ids.ts` berisi `createId`, `ID_PATTERN`, `ID_PREFIXES`; test juga mencakup AC DM-007 "1 juta ID tanpa duplikat" (~0,7 dtk). AC DM-007 lain (ID stabil, remap saat duplikasi) menyusul bersama ops.

#### Epic 0.2 — Dokumen prototipe & fixture

- [x] **T0.2.1** 🧪 Schema Zod prototipe: `SiteDocument` flat map, node `page`/`frame`/`text`/`image`, style `{ base, tablet?, mobile? }` subset (layout flex, size fixed/hug/fill, fills solid, radius, padding, gap) — DM-004, DM-008, DM-011, DM-013, DM-014, DM-026, DM-027, DM-036 · `packages/document-model/src/schema` · Verifikasi: unit test fixture valid/invalid ✅ 2026-10-13
  - Catatan: 2 fixture valid (`test/fixtures/basic-documents.ts`) + 19 kasus invalid struktur + 9 invariant (key=id, pageOrder↔page, children↔parentId, asset image, image `hug`, siklus). Ditunda dari prototipe: `settings`/`theme`/`componentDeps`, `position` (perlu di T0.6.2), typography/color, link, list rich text, metadata/a11y/htmlId. Layout mendukung `none` + `flex`. Regex token `{1,2}` (DM-067/DM-041: `<group>.<name>`, nested maks 1 level); teks DM-025 diselaraskan 2026-10-13 atas persetujuan owner.
- [x] **T0.2.2** 🧪 Mapping JSON ↔ Y.Doc prototipe (`nodes` Y.Map per node, `children` Y.Array, style sebagai Y.Map) — DM-058, DM-059 · `packages/document-model/src/yjs` · Verifikasi: round-trip deep-equal pada 3 fixture ✅ 2026-10-13
  - Catatan: style = `Y.Map<bp, Y.Map<styleGroup, JSON>>`, props = `Y.Map<key, JSON>`; nilai daun di-clone saat tulis/baca (Yjs menyimpan per referensi). `yDocToJson` mengembalikan `unknown` → wajib divalidasi Zod. Rich text **masih JSON atomik**, belum `Y.XmlFragment` (butuh `y-prosemirror`, di luar dependensi yang diizinkan untuk document-model; diputuskan di T0.8.5). Fixture ketiga `nestedDocument` ditambahkan.
- [x] **T0.2.3** 🧪 Ops prototipe di Y.Doc dalam satu transaksi: `createNode`, `moveNode`, `updateStyle`, `deleteNodes` — DM-073, DM-074 · `packages/document-model/src/ops` · Verifikasi: unit test per op + undo satu langkah per op ✅ 2026-10-13
  - Catatan: `runOp(ctx, op, input)` = validasi Zod → satu `transact` ber-origin → `{ ok, value, affected }` / `{ ok: false, error }`. Konvensi: op memeriksa semua syarat sebelum menulis (Yjs tanpa rollback) — diuji: op gagal = 0 update Yjs. `updateStyle` mengikuti 5 aturan merge DM-036 & hanya menulis style group yang disentuh. Folder `src/ops/` (ARCHITECTURE §4.1), spec DM-073 menyebut `src/commands/` — perlu diselaraskan. Ditunda: lock/permission (DM-075, M2), deskripsi dwibahasa & `aiExposed` (M1/M6), batch `runCommands`, `keepVisualPosition`. 4 mutation check lolos (test menangkap kode yang dirusak).
- [x] **T0.2.4** Generator fixture: halaman "landing realistis" 200 node dan 2.000 node (nested auto-layout 4–6 level, teks, gambar placeholder) — ED-022 · `packages/document-model/test/fixtures` · Verifikasi: fixture lolos schema, jumlah node tepat ✅ 2026-10-13
  - Catatan: `generateLandingDocument({ nodeCount, seed })` deterministik (PRNG mulberry32); jumlah node termasuk page. Struktur: navbar → hero → section fitur × N (grid 3–12 kartu: foto, judul, deskripsi, tombol); kedalaman maks 6. 2.000 node = 720 frame, 981 text, 298 image, 42 section; JSON ≈ 876 KB, state Yjs ≈ 1.010 KB (angka kasar di WSL2, pengukuran resmi di T0.7.5). Fixture masih di `test/` package — T0.7.3 (bench editor) perlu subpath export agar bisa diimport `apps/editor`.

#### Epic 0.3 — Viewport, pan & zoom

- [x] **T0.3.1** Struktur lapisan `#editor-viewport` → `#world` (CSS `transform: translate() scale()`, `transform-origin: 0 0`) → `#overlay` terpisah — ED-013, ED-014 · `apps/editor/src/canvas` · Verifikasi: manual — overlay tidak ikut ter-scale (garis 1px tetap 1px di zoom 400%) ✅ 2026-10-13
  - Catatan: `cameraStore` (Zustand vanilla) diterapkan ke `#world` via rAF tanpa render React; `will-change` dilepas 150 ms setelah idle (ED-013). Kamera awal dari URL `?zoom=4&x=-250&y=-250` (alat cek spike). Isi world & outline overlay masih demo statis (diganti di T0.4.1/T0.5.6). Diverifikasi via screenshot headless Chromium: garis 1px di zoom 1× dan 4× (diukur per piksel); konfirmasi manual owner di browser Windows menyusul. Zustand 5.0.15 ditambahkan.
- [x] **T0.3.2** Modul koordinat murni `screenToWorld`, `worldToScreen`, `nodeLocalToWorld` — ED-015 · `apps/editor/src/canvas/geometry` · Verifikasi: unit test (zoom 0.05–16, offset negatif) ✅ 2026-10-13
  - Catatan: titik bertag `__space` (`ScreenPoint`/`WorldPoint`/`LocalPoint`, ED-015) + `worldToNodeLocal` & `screenDeltaToWorld` (untuk drag T0.6.2). Uji invers memakai grid sampel deterministik (10 zoom × 3 offset × 2 viewport × 4 titik), bukan property-based (fast-check belum di stack). Rotasi ancestor (AC ED-015) ditunda ke M2 bersama DM-033. Vitest ditambahkan ke `apps/editor`; overlay memakai `worldToScreen`.
- [x] **T0.3.3** Pan: trackpad two-finger, Space+drag, middle-mouse drag, scroll wheel vertikal/Shift horizontal — ED-026 · `apps/editor/src/canvas/interactions` · Verifikasi: manual + e2e sederhana Space+drag menggeser world ✅ 2026-10-13
  - Catatan: logika murni di `interactions/pan.ts` (deltaMode LINE ×16/PAGE, Shift→horizontal, Space diabaikan di input/contentEditable); event DOM di `use-pan-interactions.ts` (pointer capture, cegah scroll/back-swipe/zoom halaman/autoscroll tombol tengah). Status Space masih lokal di hook → dipindah ke model tool di T0.3.5. Playwright 1.63.0 dipasang (cocok dengan Chromium di cache); e2e jalan di port 5180 (`pnpm --filter @platform/editor test:e2e`): Space+drag, drag tanpa Space, tombol tengah, wheel & Shift+wheel. Uji manual trackpad Windows/Mac oleh owner menyusul.
- [x] **T0.3.4** Zoom: Ctrl/⌘+wheel & pinch dengan anchor di kursor, `+`/`-`, clamp rentang kandidat (5%–1600%) — ED-027 · `apps/editor/src/canvas` · Verifikasi: unit test titik di bawah kursor tetap; manual pinch di trackpad Windows ✅ 2026-10-13
  - Catatan: `zoomAtPoint` (error < 0.5px, diuji 3 kamera × 3 anchor × 6 zoom termasuk clamp), faktor wheel `exp(-deltaY·0.01)` diakumulasi per rAF, preset `+`/`-` 5…1600% di tengah viewport, gesture Safari ditangani (belum diuji di Safari). Batas zoom dipindah ke `canvas/zoom-limits.ts`. E2E: Ctrl+wheel anchor, clamp, Ctrl+=/−. Belum: Z+klik (ED-027), zoom ke tengah seleksi (tunggu seleksi). **Perlu uji manual owner**: pinch trackpad Windows & rasa sensitivitas mouse wheel (1 notch ≈ ×2,7 dengan konstanta spec).
- [x] **T0.3.5** Hand tool (`H`) & tool model umum (aktif/sementara saat Space ditahan) — ED-047, ED-037 · `apps/editor/src/tools` · Verifikasi: unit test state machine tool ✅ 2026-10-13
  - Catatan: `toolReducer` murni `{ active, temporary }` (tool efektif = temporary ?? active) + `toolStore` Zustand; shortcut V/H & Space di `use-tool-shortcuts.ts` (diabaikan saat mengetik/ada modifier, dilepas saat blur). Hook pan tidak lagi menyimpan status Space sendiri. `isEditableTarget` dipindah ke `src/commands/`. Ditunda ke M2 (bersama tool pembuat node): kembali ke Move setelah membuat node & tool lock (ED-037); AC ED-047 "klik hand tidak mengubah seleksi" diuji setelah seleksi ada (T0.5.4). Kursor grab/grabbing diganti SVG berlapis (halo putih + garis gelap, bentuk Lucide `hand`/`grab`) karena kursor bawaan hilang di background putih (masukan owner).

#### Epic 0.4 — Render & isolasi style

- [x] **T0.4.1** 🧪 Renderer prototipe `renderNode(doc, id)` → React element untuk frame/text/image; style base → inline/class CSS; `data-node-id` — ED-017, DM-001 · `apps/editor/src/canvas/render-root` (sementara) · Verifikasi: snapshot DOM fixture kecil ✅ 2026-10-13
  - Catatan: style `base` → CSS inline lewat fungsi murni `style-to-css.ts` (DM-026/027/029/030, diuji per nilai enum); token → `var(--…)` dengan nilai default sementara (theme menyusul T1.8.12); rich text paragraf/heading + mark; gambar memakai placeholder (URL asset dari CDN menyusul). Snapshot DOM fixture hero & nested; landing 2.000 node dirender lengkap. Canvas memuat fixture via `?fixture=hero|nested|minimal|landing200|landing2000` (default landing200) dari subpath baru `@platform/document-model/fixtures`. Belum: override breakpoint (hanya `base`). **Temuan untuk renderer M1 (T1.10):** `fill` + `maxWidth` di parent kolom ber-`align: center` tampil rata kiri karena aturan DM-027 (`align-self: stretch`) — perlu keputusan aturan CSS-nya.
- [x] **T0.4.2** 🧪 Rendering inkremental: subscribe `observeDeep` per node; re-render hanya node yang berubah (React.memo + selector) — ED-018, DM-077 · `apps/editor/src/document` · Verifikasi: React Profiler — ubah 1 node → ≤ 2 komponen re-render ✅ 2026-10-13
  - Catatan: `NodeStore` = satu `observeDeep` di map `nodes` + dispatch per ID (`event.path[0]`), snapshot divalidasi `NodeSchema` & di-cache sampai node berubah; `useNode` (useSyncExternalStore) + `NodeView` memo. Hasil (jsdom + Profiler, landing200): ubah style 1 node → **1** komponen render, 1 commit; 2 node dalam 1 transaksi → 1 commit; reorder → hanya parent; create → parent + node baru; delete → hanya parent; pindah parent → parent lama/baru + subtree yang di-mount ulang (perilaku React). Test menemukan bug memo (nama fungsi dalam membayangi konstanta `memo`) — sudah diperbaiki. Pembuatan elemen dipakai bersama render statis & `NodeView`. Y.Doc spike di `canvas/spike-document.ts` + `window.__spike` (dev) untuk uji manual. Dependency: `yjs` (editor), `jsdom` 30.1.2 (dev, untuk test React).
- [x] **T0.4.3** 🧪 Eksperimen isolasi **Opsi A Shadow DOM**: `#world` attach shadow root, stylesheet renderer + token di dalamnya; uji Tailwind preflight editor tidak bocor — ED-016 · `apps/editor/src/canvas` · Verifikasi: fixture CSS agresif (`* { box-sizing: content-box; font-family: serif }`) tidak merusak chrome ✅ 2026-10-13
  - Catatan: mode dipilih via `?isolation=shadow|none` (default shadow; prefix menyusul T0.4.4), CSS situs uji via `?siteCss=aggressive`. Isi canvas di-portal ke shadow root `#world` (host tetap menerima transform kamera). E2E dua arah lulus untuk shadow & terbukti bocor di `none` (pembanding). **Hasil untuk T0.8.1:** (1) shadow root tidak memutus pewarisan — wajib `:host { all: initial }`; tanpa itu font monospace body editor masuk (h1 32px → 26px, tertangkap mutation check); (2) `document.querySelector`/`elementsFromPoint` tidak menembus shadow root → hit-test (T0.5.2) harus lewat `shadowRoot.elementsFromPoint`; (3) event pointer di-retarget ke host (handler di viewport tetap jalan); (4) StrictMode → `attachShadow` dua kali, root dipakai ulang; (5) tanpa isolasi, aturan `*` situs kalah spesifisitas dari class chrome ber-`font` sendiri, tapi menimpa semua elemen yang mewarisi font (pola Tailwind). Belum diuji: Tiptap/IME di shadow (T0.4.5), Safari.
- [x] **T0.4.4** 🧪 Eksperimen isolasi **Opsi B prefix** (`.pf-*`, preflight di-scope `#editor-chrome`) pada branch terpisah — ED-016 · `apps/editor/src/canvas` · Verifikasi: AC ED-016 sama dengan T0.4.3; catat kompleksitas ✅ 2026-10-13
  - Catatan: dibuat sebagai mode `?isolation=prefix` (bukan branch terpisah, atas persetujuan owner) agar bisa dibenchmark berdampingan dengan shadow di T0.7.4. Isi canvas di `.pf-root` (`all: initial`), CSS situs di-scope lewat `scopeCss()` (spike: tanpa @-rule). AC ED-016 lulus untuk arah situs → editor & pewarisan body. **Kompleksitas untuk T0.8.1:** (1) butuh penulis ulang selector untuk semua CSS situs, termasuk @media/@keyframes/@font-face & selector rumit (`:is()`, `>`, `~`) — di Opsi A tidak perlu; (2) **setiap** CSS editor (Tailwind preflight, shadcn, library pihak ketiga) wajib di-scope ke chrome — preflight global terbukti menembus canvas (E2E "KETERBATASAN"), jadi isolasinya bergantung disiplin, bukan dijamin browser; (3) kelebihan dibanding Opsi A: DOM biasa → `document.elementsFromPoint`, `querySelector`, selection API & Tiptap/IME tanpa kasus khusus shadow root (diuji di T0.4.5).
- [x] **T0.4.5** 🧪 Uji Tiptap (inline edit teks) di dalam Shadow DOM vs prefix: selection, IME, copy/paste di Chrome/Edge/Firefox/Safari — ED-016, ED-115 · `apps/editor` · Verifikasi: matriks hasil per browser dicatat di catatan task ✅ 2026-10-13
  - Catatan: Tiptap 3.31.4 (StarterKit dibatasi ke schema DM-013); double-click node teks → edit inline, Esc/klik di luar → keluar; **perubahan belum disimpan** (binding `y-prosemirror` = T0.8.5). E2E Playwright di Chromium & Firefox (project Firefox ditambahkan).

    | Kemampuan | Chromium shadow | Chromium prefix | Firefox shadow | Firefox prefix | Safari | Edge |
    |---|---|---|---|---|---|---|
    | Ketik termasuk spasi & huruf shortcut | ✅ (setelah fix) | ✅ | ✅ | ✅ | ⏳ manual | ⏳ manual (≈Chromium) |
    | Seleksi + Ctrl+B | ✅ | ✅ | ✅ | ✅ | ⏳ | ⏳ |
    | IME (komposisi → commit) | ✅ (simulasi CDP) | ✅ | ⏳ manual | ⏳ manual | ⏳ | ⏳ |
    | Paste HTML (bold dipertahankan, font asing dibuang) | ✅ | ✅ | ⏳ manual¹ | ⏳ manual¹ | ⏳ | ⏳ |
    | Copy teks terpilih | ✅ | ✅ | ✅ | ✅ | ⏳ | ⏳ |
    | Esc / klik di luar | ✅ | ✅ | ✅ | ✅ | ⏳ | ⏳ |

    ¹ Firefox mengabaikan `clipboardData` pada `ClipboardEvent` sintetis (keterbatasan harness, bukan editor). WebKit Playwright butuh library sistem (`install-deps webkit`, perlu sudo) → Safari diuji manual owner.
    **Temuan untuk T0.8.1:** (1) di Shadow DOM event keyboard di `window` di-retarget ke host → Space/`-` tercuri shortcut canvas (terbukti di E2E sebelum fix); diperbaiki dengan `isEditableEvent` (`composedPath()[0]`) — semua handler keyboard global wajib memakainya; (2) CSS bawaan Tiptap disuntik ke `document.head` dan tidak berlaku di shadow root → `injectCSS: false` + CSS dasar ProseMirror ikut stylesheet canvas; (3) selain dua hal itu, seleksi/IME/copy/paste ProseMirror bekerja sama baiknya di shadow & prefix pada Chromium/Firefox. Catatan lain: bundle editor naik 243 → 803 kB karena Tiptap → lazy-load saat mulai edit (M2).
- [x] **T0.4.6** 🧪 Eksperimen breakpoint frame: (a) tanpa iframe, style breakpoint di-scope class `.bp-mobile`; (b) iframe per breakpoint frame dengan media query asli. Ukur fps & kompleksitas hit-test — ED-034, ED-022 · `apps/editor/src/canvas` · Verifikasi: tabel fps 3 frame × 200 node untuk (a) dan (b) ✅ 2026-10-13
  - Catatan: `resolveStyle(style, bp)` (cascade DM-036) ditambahkan ke `@platform/document-model` (`src/query`); renderer membaca breakpoint & lebar frame dari context. Canvas `?frames=all&bpMode=class|iframe` (Desktop 1440 / Tablet 768 / Mobile 390, jarak 100px). Kedua opsi memakai style hasil resolve JS per frame — **media query asli di iframe belum diuji** (butuh renderer CSS, T1.10); keunggulan iframe untuk "preview lebar fluid" (ED-034) belum terbukti. E2E kedua mode: style per breakpoint benar, edit konten tampil di semua frame, patch mobile tidak mengubah Desktop (AC ED-034), hit-test benar di zoom 50% & 100%. Benchmark `pnpm --filter @platform/editor bench:frames` (3 run, headless WSL2 tanpa GPU — indikatif):

    | Skenario (landing 200 node) | Pan fps | Pan p95 ms | Zoom fps | Zoom p95 ms | Frame >50 ms |
    |---|---|---|---|---|---|
    | 1 frame (baseline) | 59.7–60 | 16.7–16.8 | 56–60 | 16.8–33.3 | 0 |
    | 3 frame · (a) class | 59–60 | 16.7–16.8 | 58.3–59.7 | 16.7–16.8 | 0 |
    | 3 frame · (b) iframe | 59.3–59.7 | 16.7–16.8 | 54.7–59 | 16.7–33.3 | 0–1 |

    **Hasil untuk T0.8.2:** fps tidak membedakan kedua opsi di 3×200 node (pan/zoom murni compositor); pembeda ada di kompleksitas: (b) iframe → (1) event pointer di dalam iframe tidak sampai ke viewport, jadi iframe harus `pointer-events: none` + hit-test manual via rect & bagi zoom; (2) **jebakan cross-realm**: `instanceof HTMLElement` selalu false untuk elemen iframe (hit-test sempat salah) dan ResizeObserver dari window induk memicu error "loop" tiap frame — harus dibuat dari window iframe; (3) teks inline/dblclick di dalam iframe belum jalan (butuh penerusan event); (4) isolasi shadow/prefix jadi tidak relevan di dalam iframe (dokumen terpisah). (a) class: hit-test cukup `elementsFromPoint` (lewat shadow root bila Opsi A). Ulangi benchmark di laptop referensi (T0.7.4), termasuk 2.000 node.
- [x] **T0.4.7** Font website dimuat via `FontFace` API (Google Fonts subset) tanpa mempengaruhi chrome — ED-016, ED-224 · `apps/editor` · Verifikasi: manual — font canvas berganti, font chrome tetap ✅ 2026-10-13
  - Catatan: `?siteFont=<Family>`; file `.woff2` Fontsource (subset latin, weight 400 & 700 saja — ED-224) via jsDelivr `@latest` (SEMENTARA; versi dikunci & dicerminkan ke CDN platform saat katalog font dibuat, M2). Token `fontFamily.body` → `var(--fontFamily-body)` di root canvas; gagal muat → fallback `system-ui, sans-serif` + `console.warn` (ED-116). E2E (Chromium & Firefox, font dilayani lokal lewat `page.route`): font canvas berganti di shadow, prefix & iframe; fallback saat gagal. **Temuan:** (1) `FontFace` berlaku document-wide → font situs bernama sama dengan font UI editor ikut mengubah chrome (terbukti: lebar teks chrome 252,8 → 300 px tanpa namespace) → font situs didaftarkan sebagai `"pf-site <Family>"`; (2) jebakan realm lagi: Chromium mengabaikan FontFace buatan window induk di dokumen iframe → harus pakai constructor window iframe; (3) `document.fonts.check()` bernilai true bila tidak ada face yang cocok — jangan dipakai untuk mendeteksi gagal muat. Verifikasi manual owner di browser Windows menyusul.

#### Epic 0.5 — Geometri, hit-test & seleksi

- [x] **T0.5.1** Geometry store: cache rect per node via `ResizeObserver` + invalidasi saat transform/scroll; API `getRect(id)` world-space — ED-019 · `apps/editor/src/canvas/geometry` · Verifikasi: unit test invalidasi + manual overlay menempel saat zoom ✅ 2026-10-13
  - Catatan: `GeometryStore` (DOM/ResizeObserver/rAF di-inject → 8 unit test tanpa layout browser). Rect world = `getBoundingClientRect` relatif origin `#world` ÷ zoom yang **diterapkan ke DOM** (bukan cameraStore, yang bisa satu frame lebih baru). Invalidasi: ResizeObserver per node; semua rect via generasi O(1) pada setiap transaksi Y.Doc & `document.fonts` `loadingdone`; pan/zoom **tidak** menginvalidasi (ED-019) — beda dari teks task "invalidasi saat transform/scroll", sengaja mengikuti spec. Ukur ulang dalam satu batch (baca semua → tulis), terjadwal per rAF; `peekRect` untuk handler pointermove (tanpa forced layout). NodeView mendaftar lewat ref callback, hanya frame Desktop mode class (iframe & rotasi di luar scope). E2E `?outline=<nodeId>` (Chromium & Firefox): outline ±0,5px di zoom 50/100/200%, setelah resize, setelah node bergeser tanpa berubah ukuran (mutation check: tanpa invalidasi transaksi → gagal), setelah pan/zoom, dan di mode 3 frame.
- [x] **T0.5.2** Hit-test: `elementsFromPoint` + pemetaan `data-node-id` + aturan locked/hidden — ED-020 · `apps/editor/src/canvas/hit-test` · Verifikasi: unit test pada DOM jsdom + e2e klik node bertumpuk ✅ 2026-10-13
  - Catatan: `hitTestNode(root, x, y, isSelectable)` menelusuri tumpukan `elementsFromPoint` → node terdekat via `closest("[data-node-id]")`, hasil `{ nodeId, path }` (path untuk resolver kedalaman ED-051/T0.5.4). Node terkunci **atau ancestor-nya terkunci** dilewati → klik tembus ke node di bawahnya (perilaku Figma); hidden otomatis tak terkena (`display: none`). Renderer kini memetakan `frame.props.clipContent` → `overflow: hidden` (DM-011) agar AC "child terpotong tidak terpilih" berlaku. Hit-test spike T0.4.6 (iframe) memakai fungsi yang sama. 6 unit test (jsdom + tumpukan buatan) + 8 E2E (Chromium & Firefox, shadow & prefix): anak di atas parent, padding milik parent, locked tembus, ancestor locked, hidden, clip. Mutation check aturan locked tertangkap. Benchmark `bench/hit-test.bench.ts` (2.000 titik di area page, landing2000): **≈ 0,011–0,013 ms/hit** (AC < 1 ms), shadow ≈ prefix. Belum: aturan kedalaman klik (T0.5.4), hover throttle rAF (T0.5.6), `pointer-events` dari style user (belum ada di schema).
- [x] **T0.5.3** Interaction state machine (idle → pointerdown → dragging/resizing/marquee → commit/cancel, Esc membatalkan) — ED-023, ED-025 · `apps/editor/src/canvas/interactions` · Verifikasi: unit test transisi termasuk Esc & pointercancel ✅ 2026-10-13
  - Catatan: reducer murni `reduceInteraction` (state idle/pressing/dragMove/dragResize/marquee/panning; threshold 3px; efek `click`/`commit`/`cancel`) — 24 unit test termasuk semua kombinasi state×event tanpa error & event pointer lain diabaikan. `interactionStore` (UI state) + adapter `useInteractionMachine` (hit-test T0.5.2, handle via `data-handle` untuk T0.5.6; pointer di dalam teks yang sedang diedit tidak memulai drag). Pan tetap digerakkan hook pan; state `panning` mencegah drag/marquee bersamaan. ED-025: blok Mod+S/P/D/G (di luar input), `dragstart` & context menu native di canvas. 7 E2E × 2 browser. **Temuan:** pointer capture dipasang saat tekan **berubah menjadi drag**, bukan saat ditekan — capture sejak ditekan mengarahkan click/dblclick ke viewport sehingga double-click edit teks rusak (tertangkap E2E). Catatan test: Firefox (Playwright) tidak bisa mengirim event pointer di luar viewport → koordinat test harus di dalam 1280×720. Belum dipakai: state `drawing`, `dragInsert`, `dragReorder`, `textEditing`, `dragRotate` (fase berikutnya).
- [x] **T0.5.4** Select tool + aturan kedalaman klik tunggal (pilih top-level section dulu, double-click masuk) — ED-038, ED-051 · `apps/editor/src/tools/select` · Verifikasi: unit test resolver kedalaman + e2e klik/dblclick ✅ 2026-10-13
  - Catatan: resolver murni `resolveClickSelection` (konteks = parent seleksi lalu ancestor-nya sampai page; pilih anak langsung konteks pada path hit-test; latar page/area kosong → kosongkan seleksi; pengecualian teks/gambar di frame non-section terseleksi) & `resolveDoubleClick` (masuk ke anak di bawah pointer; teks terseleksi → edit). `selectionStore` (UI state); klik dari efek `click` state machine (target node kini membawa `path`); hand tool tak menghasilkan klik (AC ED-047 lulus). Outline 1px untuk node terseleksi. **Perubahan perilaku T0.4.5:** double-click tidak lagi langsung mengedit teks mana pun — sekarang pilih → masuk → edit (ED-038/ED-051). 9 unit test + 5 E2E × 2 browser (termasuk urutan AC ED-051 di landing: Hero → Row → Copy → Title → edit); mutation check tertangkap. Belum: pilih sambil drag (T0.6.2), marquee (T0.5.5), Shift multi-select (ED-052), Esc pilih parent, double-click gambar (crop) & instance.
- [x] **T0.5.5** Marquee selection (intersect vs contain sesuai spec) — ED-053 · `apps/editor/src/canvas` · Verifikasi: unit test geometri rect-intersect; e2e drag di area kosong ✅ 2026-10-13
  - Catatan: **intersect** (default Figma; tepi bersentuhan tidak dihitung). Kandidat = anak langsung frame tempat marquee dimulai: dari latar page/di luar page → section; dari latar frame yang "dimasuki" (parent node terseleksi) → anak frame itu; drag di latar frame biasa tetap = pindah (`resolvePressTarget`, murni & teruji). Node tersembunyi/terkunci bukan kandidat. Rect dari cache geometry (`peekRect`, tanpa forced layout). Shift menambah; marquee tanpa kena mengosongkan; Esc membatalkan. Overlay: kotak marquee + highlight live (garis putus-putus). Target kosong kini membawa `path` sehingga klik di latar frame yang dimasuki memilih frame itu. 15 unit test + 4 E2E × 2 browser; mutation "contain" tertangkap. Bench `bench/marquee.bench.ts` (landing2000): hitung ≈ 0,005 ms/update (AC ≤ 4 ms), drag p95 frame 16,7 ms. `rbush` belum dipakai — kandidat hanya anak langsung satu frame (≤ 500, batas schema), scan linear cukup; spatial index tetap dibutuhkan untuk snapping/culling (ED-020/021). Koordinat marquee dikonversi dengan kamera saat ini (zoom di tengah marquee menggeser titik awal — diterima untuk spike).
- [x] **T0.5.6** Visual seleksi: bounding box, 8 handle, label ukuran W×H, hover outline — ED-060 · `apps/editor/src/canvas/overlay` · Verifikasi: e2e screenshot overlay; garis 1px di semua zoom ✅ 2026-10-13
  - Catatan: `SelectionOverlay` (kotak 1px; multi-seleksi = kotak gabungan + outline tipis per node; 8 handle terlihat 6×6 dengan area klik 10×10 — ED-014; handle sisi disembunyikan bila node < 24px screen; label `W × H` dengan Hug/Fill untuk anak auto-layout; nama frame top-level di atas; handle & label disembunyikan saat edit teks). Handle ditandai `data-handle` + `data-handle-node` (bukan `data-node-id`) → menekannya masuk `dragResize` (logika resize = T0.6.3); resize multi-seleksi belum (handle hanya untuk 1 node). Hover (ED-038): outline pada node yang **akan** terpilih (aturan ED-051), hit-test di-throttle per rAF (ED-020), tidak tampil saat drag/pan/hand tool/edit teks atau bila sudah terseleksi. Fungsi murni `unionRect`/`handlePositions`/`sizeLabel` (6 unit test). E2E: ukuran handle tetap 10×10/6×6 & posisi tepat di zoom 50/100/400% (AC ED-060), garis 1px, label, 4 handle untuk node kecil, hover, edit teks, handle → dragResize; screenshot baseline `e2e/overlay.spec.ts-snapshots/` (Chromium, diperiksa manual). Belum (P1): visual padding/gap auto-layout. Teks "Hug"/"Fill" belum lewat i18n (M0 tanpa i18n).

#### Epic 0.6 — Transformasi & auto-layout sederhana

- [x] **T0.6.1** Preview sementara vs commit: selama drag hanya transform CSS sementara (tanpa Yjs), commit satu transaksi saat pointerup — ED-024 · `apps/editor/src/canvas/interactions` · Verifikasi: hitung update Yjs = 1 per drag; undo satu langkah ✅ 2026-10-13
  - Catatan: dua mekanisme preview ED-024 — (1) `translate` CSS sementara langsung di elemen (`canvas/drag/transform-preview.ts`, dipakai move di T0.6.2) dan (2) override style sementara `previewStore` yang di-merge renderer (`applyStylePatch`, baru di `@platform/document-model/query`) untuk resize yang butuh reflow. `useDragSessions`: rect awal diukur sekali saat drag mulai; commit = **satu** `runOp(updateStyle)` ber-origin lokal lalu preview dibuang; cancel = preview dibuang tanpa menyentuh dokumen. `spikeUndoManager` (origin lokal) ditambahkan — shortcut & grouping di T0.7.1. Kendaraan verifikasi: resize handle `se` saja (7 handle lain, flip = T0.6.3); move absolut butuh `position` (T0.6.2). E2E × 2 browser: 0 update Yjs selama drag → 1 saat lepas & 1 langkah undo, undo mengembalikan dokumen identik; drag 2 detik = 1 update (AC ED-024); Esc → dokumen identik & preview hilang (AC ED-024). Mutation "tulis Yjs tiap gerakan" tertangkap.
- [x] **T0.6.2** Drag move node absolute/freeform — ED-062 · `apps/editor/src/canvas/interactions` · Verifikasi: unit test delta world vs screen di zoom 0.25/1/4; e2e drag ✅ 2026-10-13
  - Catatan: **schema prototipe** `Style.position` = `flow` | `absolute {x, y, constraints?}` (DM-028; fixed/sticky P1); merge DM-036: type sama per field, type beda diganti. `schemaVersion` tidak dinaikkan — schema M0 masih prototipe tanpa dokumen tersimpan; versi & migrasi dimulai dengan schema final M1 (T1.8.x/T1.9.9). Renderer: absolute → `left/top` (constraints belum diterapkan, selalu kiri/atas); frame & page kini `position: relative` (containing block, snapshot diperbarui setelah dicek). Fixture baru `freeform` (`?fixture=freeform`). Drag (ED-038/062): pada node terseleksi memindah seluruh seleksi; pada node lain memilihnya dulu (aturan ED-051) lalu memindah; hanya node absolute & tidak terkunci. Preview `translate` + kotak seleksi ikut bergeser; Shift kunci sumbu dominan (AC ED-062 lulus); posisi dibulatkan ke pixel; commit semua node dalam satu transaksi. `moveDelta` diuji di zoom 0,25/1/4; 7 E2E × 2 browser (zoom 50/100/200%, Shift, multi-seleksi, Esc, node non-absolute); mutation "tanpa bagi zoom" tertangkap. Test marquee T0.5.5 diperbaiki: titik awalnya ternyata latar Container (bukan celah grid) — kini drag di sana = pilih & pindah sesuai ED-038. Belum: reparent saat drag (AC ED-062 kedua), Alt-duplikat, Mod tanpa snapping, ghost saat keluar parent ber-clip, batas tepi page.
- [x] **T0.6.3** Resize dengan 8 handle (min 1px, flip dicegah di M0) — ED-065 · `apps/editor/src/canvas/interactions` · Verifikasi: unit test geometri resize per handle + e2e drag handle ✅ 2026-10-13
  - Catatan: `resizeRect` murni (`canvas/drag/resize.ts`, menggantikan versi `se`-saja T0.6.1): w/e/n/s menggeser tepi masing-masing, sudut dua dimensi; **tepi yang tidak dipegang tidak bergeser** (ukuran dibulatkan ke integer lalu posisi dihitung dari tepi diam — AC ED-065); 1px ≤ ukuran ≤ 100.000px; melewati sisi berlawanan berhenti di 1px (flip dicegah). `resizePatch`: hanya dimensi yang di-drag menjadi Fixed (AC ED-065 Fill → Fixed — dikoreksi dari T0.6.1 yang memfiksasi kedua dimensi); node absolute ikut digeser bila tepi kiri/atas ditarik. Patch yang sama dipakai preview & commit. 14 unit test + 11 E2E × 2 browser (8 handle di dokumen, tepi kanan tetap ±0,5px saat handle kiri ditarik, clamp 1px, Fill → Fixed); mutation "tepi kiri tanpa koreksi x" tertangkap. Belum: flip sungguhan, Shift/Alt (ED-066), teks auto-width → fixed (butuh op ubah props), drag tepi seleksi (hit area 6px), kursor berotasi, constraints anak freeform (P1), resize multi-seleksi.
- [x] **T0.6.4** 🧪 Auto-layout render: frame `layout.mode = flex` (direction, gap, padding, align) via flexbox nyata; anak hug/fill/fixed — DM-026, DM-027 · `apps/editor` · Verifikasi: snapshot DOM + visual cek 3 kombinasi ✅ 2026-10-13
  - Catatan: pemetaan flexbox sudah ada sejak T0.4.1; task ini membuktikannya di browser. Fixture `autolayout` (`?fixture=autolayout`): baris (padding 24, gap 16, align center, anak fixed/fill/hug), kolom (tinggi 300, spaceBetween, stretch), baris wrap (gap 12, crossGap 20). Snapshot DOM + 3 E2E geometri × 2 browser (posisi & ukuran tiap anak dibandingkan hitungan manual, ±0,5px) + screenshot baseline Chromium (diperiksa manual). **Temuan:** mutation `fill → width:100%` awalnya hanya tertangkap screenshot — flex-shrink membuat rumus "fill = sisa ruang" tetap terpenuhi, tetapi anak Hug ikut terjepit (teks patah 2 baris); assertion "Hug tidak terjepit" ditambahkan dan kini menangkapnya. Temuan T0.4.1 (`fill` + `maxWidth` di kolom ber-`align: center` tampil rata kiri) tetap terbuka untuk renderer M1 (T1.10).
- [x] **T0.6.5** 🧪 Drag reorder di dalam auto-layout: indikator sisip (garis biru), hitung index dari posisi kursor, reparent antar frame flex — ED-063 · `apps/editor/src/canvas/interactions` · Verifikasi: unit test perhitungan index; e2e reorder 3 item ✅ 2026-10-13
  - Catatan: `reorderIndex` & `insertionMarker` murni (`canvas/drag/reorder.ts`, 21 unit test: baris, kolom, wrap baris-terdekat-lalu-kolom). Satu anak non-absolute di parent flex → sesi reorder: node asli redup 40%, ghost mengikuti pointer, penanda 2px; target = container flex terdalam di bawah pointer yang bukan node itu/turunannya (reparent); commit satu `moveNode`; drop di posisi asal = tanpa update/undo kosong. **Aturan baru:** node ber-role `section` hanya bisa di-drop ke page — tanpa itu section (selebar page) tidak pernah bisa diurutkan ulang karena setiap titik berada di dalam section lain (edge case ED-063). 8 E2E × 2 browser: AC ED-063 penanda & ghost sebelum lepas, reorder 3 item (ke akhir & tengah) = urutan `children` Yjs benar + 1 update + 1 undo, reparent baris → kolom, wrap, frame di root page, section landing, drop di tempat asal, Esc. Mutation "tanpa aturan section" tertangkap. Test T0.6.2 disesuaikan (anak auto-layout kini reorder, bukan posisi absolute). Belum: reorder via tombol panah (AC ED-063 kedua, bersama nudge ED-064), live reorder (P1), drop ke frame freeform (jadi absolute), multi-seleksi reorder (P1), tolak drop ke instance (M3).
- [x] **T0.6.6** 🧪 Resize frame auto-layout dengan 100 anak (wrap) dan ukur fps — ED-022 · `apps/editor` · Verifikasi: angka fps dicatat (target ≥ 45 fps) ✅ 2026-10-13
  - Catatan: fixture `wrapGridDocument(count)` (`?fixture=wrap100`: grid flex-wrap 1200px, 100 kartu frame + teks = 202 node). Bench `bench/wrap-resize.bench.ts`: handle kanan grid di-drag bolak-balik dengan mouse sungguhan 3 detik (lebar 1200 → 500 → 1200px; tiap gerakan = preview resize + render ulang + reflow 100 kartu); bench memverifikasi lebar render grid benar-benar turun ke ±500px agar tidak mengukur halaman diam. Hasil (3 run, headless WSL2 tanpa GPU — indikatif): **zoom 50%: 60 fps, p95 16,7 ms; zoom 100%: 59,7–60 fps, p95 16,7–16,8 ms; 0 frame > 50 ms** (target ≥ 45 fps). Angka resmi di laptop referensi (T0.7.4).

#### Epic 0.7 — Undo & benchmark

- [x] **T0.7.1** `Y.UndoManager` dengan tracked origin `local`, capture timeout untuk grouping, undo/redo `Mod+Z`/`Mod+Shift+Z` — ED-197, DM-060 · `apps/editor/src/document` · Verifikasi: unit test: drag+resize+style → 3 langkah undo; seleksi dipulihkan ✅ 2026-10-13
  - Catatan: `createUndoController` (`document/undo-controller.ts`) menggantikan `spikeUndoManager` T0.6.1: hanya origin lokal yang dilacak (system/remote tidak pernah di-undo); `captureTimeout` 500ms; commit drag/resize/reorder dibatasi `stopCapturing()` (aksi diskrit tidak digabung); kedalaman maks 200; meta seleksi sebelum/sesudah per langkah — undo memulihkan "sebelum", redo "sesudah" (meta disalin ke item lawan di stack), node yang hilang disaring. Shortcut Mod+Z, Mod+Shift+Z, Mod+Y (`undoShortcut` murni, pakai `code` agar tak bergantung layout keyboard); diabaikan saat edit teks (undo Tiptap). 7 unit test (termasuk AC ED-197: 50 aksi → 50× undo = awal, 50× redo = akhir; remote tak ter-undo dengan dua Y.Doc tersinkron) + 3 E2E × 2 browser; mutation "tanpa stopCapturing" tertangkap. Belum: label aksi & history panel, pindah page saat undo (single page di spike), pan kamera ke node di luar viewport, satu sesi edit teks = satu langkah (butuh binding y-prosemirror, T0.8.5).
- [x] **T0.7.2** Unit test geometri & logika murni (koordinat, resize, marquee, hit-test resolver, index reorder) mencapai ≥ 90% coverage modul `canvas/geometry` — ED-238 · `apps/editor` · Verifikasi: `pnpm test --coverage` ✅ 2026-10-13
  - Catatan: `@vitest/coverage-v8` 5.0.4; perintah `pnpm test:coverage` (root, lewat turbo — `pnpm test --coverage` tidak diteruskan turbo). Coverage diukur pada **19 modul logika murni** (daftar eksplisit di `apps/editor/vitest.config.ts`; ED-238 menyebut `src/core/**`, struktur kita mengikuti ARCHITECTURE §5.2) dengan ambang 90% **per file** untuk lines/branches/functions/statements — modul lemah tidak bisa bersembunyi di balik rata-rata (awalnya `geometry-store.ts` branch 72% & tiga modul lain < 90% walau agregat sudah 93%). Hasil: agregat 99,8% stmt / 97,9% branch / 100% func / 100% lines; terendah 90% branch (`zoom.ts`, sisa cabang `?? zoom` tak tercapai). Test baru: siklus hidup geometry store, `isEditableEvent` dengan event dari shadow root di jsdom (dibaca di dalam listener — composedPath kosong setelah dispatch), node tak dikenal di aturan seleksi, canRedo, ujung penanda reorder, data-node-id kosong, maxHeight di kolom. Guard tak tercapai di `undo-controller` dihapus (Yjs hanya menggabung item di luar undo/redo); dua cabang pengaman lain diberi `v8 ignore` beralasan. Mutation: menyembunyikan satu file test → coverage gagal. Belum: `fast-check` property-based (ED-238, dependency baru) — saat ini grid sampel deterministik.
- [x] **T0.7.3** Harness benchmark Playwright: buka fixture 200 & 2.000 node, rekam trace (`performance.measure` + `requestAnimationFrame` counter) untuk pan, zoom, drag, reorder, resize, klik→seleksi — ED-022 · `apps/editor/bench` · Verifikasi: `pnpm bench:canvas` mencetak tabel fps/latency ✅ 2026-10-13
  - Catatan: `bench/canvas.bench.ts` mencetak tabel §M0.e langsung (kolom Shadow DOM / Prefix / Non-iframe / Iframe). Pan/zoom = kamera terprogram per frame; drag/reorder/resize = mouse sungguhan dengan bukti interaksi aktif (translate preview, penanda sisip ≥ 50% frame, lebar grid berubah) sehingga benchmark gagal alih-alih melaporkan angka palsu (mutation check: preview drag dimatikan → gagal). Drag move memakai landing 200 + satu frame absolute di page (landing generator hanya auto-layout). Klik → seleksi = `pointerup` → rAF+task setelah seleksi berubah, 30 klik bergantian dua section. Kolom iframe/non-iframe hanya pan/zoom (interaksi mouse di frame breakpoint belum ada). Opsi env: `BENCH_VARIANTS`, `BENCH_DURATION_MS` (default 3000), `BENCH_RAW=1` (JSON mentah ke stdout → `| tee bench/results/…` di T0.7.4), `BENCH_TRACE=1` (trace Chrome per skenario, di-gitignore). Tanpa `@types/node`: tsconfig editor sengaja DOM-only, cukup deklarasi `process.env` di `bench/env.d.ts`. Run WSL2 headless (1,5 s/gerak): semua skenario 58–60 fps (dibatasi vsync headless), klik → seleksi p95 5–9 ms — indikatif, angka resmi T0.7.4.
- [ ] **T0.7.4** Jalankan benchmark di laptop referensi; isi tabel hasil (§M0.e) untuk kandidat Shadow DOM vs prefix dan iframe vs non-iframe — ED-022 · docs · Verifikasi: tabel terisi, data mentah disimpan di `apps/editor/bench/results/`
- [x] **T0.7.5** 🧪 Ukur biaya Yjs: ukuran update per drag, ukuran state 2.000 node, waktu `jsonToYDoc` & `yDocToJson` — DM-061, DM-077 · `packages/document-model` · Verifikasi: angka dicatat; bandingkan dengan target DM-077 ✅ 2026-10-13
  - Catatan: `pnpm --filter @platform/document-model bench` (Vitest 5 `context.bench`, file `bench/yjs-cost.bench.ts`, tsconfig terpisah agar `src` tetap tanpa lib DOM). Angka WSL2 (indikatif):

    | Fixture landing | JSON | State Yjs | State/JSON | Validasi Zod | `jsonToYDoc` | `yDocToJson` | Decode state |
    |---|---|---|---|---|---|---|---|
    | 200 node | 87 KB | 99 KB | 1,14 | 1,3 ms | 2,5 ms | 0,9 ms | 2,9 ms |
    | 2.000 node | 876 KB | 1.010 KB | 1,15 | 13 ms | 30 ms | 11 ms | 32 ms |
    | 5.000 node | 2.193 KB | 2.549 KB | 1,16 | 41 ms | 82 ms | 31 ms | 84 ms |

    Update per aksi (tak bergantung ukuran dokumen): commit drag ≈ 56 B, resize ≈ 87 B, reorder ≈ 40 B; pembanding bila preview drag ditulis ke Yjs tiap frame: ≈ 3,3 KB/detik (60 update) — membenarkan preview tanpa Yjs (ED-024). Banding target: DM-061 decode 5.000 node < 500 ms ✅ (84 ms); DM-062 10.000 edit acak pada 2.000 node → state/JSON 1,23 ≤ 3 ✅; DM-077 bench validasi 5k & round-trip Yjs 5k kini ada (≈ 41 ms & ≈ 113 ms; DM-077 tidak menetapkan angka — usulan batas diputuskan di T0.8.6). Bench "resolve 200 instance" & "compile site 10 page" DM-077 menunggu fitur instance/renderer (M1+). Vitest memberi peringatan overhead getter export (`cloneJson`) — angka sedikit pesimistis.

#### Epic 0.8 — Keputusan spike & laporan

- [x] **T0.8.1** ⚑ Putuskan **isolasi style canvas** (Shadow DOM vs prefix) berdasarkan T0.4.3–T0.4.5 & T0.7.4; tulis ADR baru di ARCHITECTURE §20 dan tutup OPEN 02#2 di spec 02 — ED-016 · docs · Verifikasi: owner menyetujui ADR
  - ✅ 2026-10-13 — **ADR-012 diterima owner** (Shadow DOM); OPEN 02#2 ditutup. Konfirmasi tersisa: uji manual Safari & angka T0.7.4; mode `?isolation=prefix` dihapus setelah Safari lulus (T0.8.7).
- [x] **T0.8.2** ⚑ Putuskan **iframe per breakpoint** vs class-scope di canvas; tutup OPEN 02#11 — ED-034 · docs · Verifikasi: ADR + catatan dampak ke renderer mode editor
  - ✅ 2026-10-13 — **ADR-013 diterima owner** (tanpa iframe, mengikuti model Figma); OPEN 02#11 ditutup. Dampak renderer: mode editor = style ter-resolve per frame, mode publish = media query (dijaga visual regression ED-240). Mode `?bpMode=iframe` spike dibuang di T0.8.7.
- [x] **T0.8.3** ⚑ Putuskan **rentang zoom** final (5%–1600% atau sampai 3200%); tutup OPEN 02#1 — ED-027 · docs · Verifikasi: nilai di spec 02 diperbarui
  - Status: rekomendasi **5%–1600%** (tetap). Eksperimen sementara `MAX_ZOOM = 32` (dikembalikan): pan landing 200 di 400%/1600%/3200% semuanya 60 fps, teks & overlay 1px tetap tajam (Chromium headless). 3200% secara teknis aman, tetapi nilai tambahnya kecil untuk website builder (1 px = 16 px layar di 1600%), dan Safari/GPU belum diuji. Bisa dinaikkan kapan saja: hanya konstanta `MAX_ZOOM`. Diputuskan owner 2026-10-13: **5%–1600%**; OPEN 02#1 ditutup. ✅
- [x] **T0.8.4** ⚑ 🧪 Prototipe deteksi overflow statis (tanpa DOM) untuk rule `stackRows` pada 10 section nyata; bandingkan dengan pengukuran DOM; putuskan "hitung statis" vs "selalu stack + `keepRowOnMobile`"; tutup OPEN-DM-5 — DM-038 · `packages/document-model` (prototipe) · Verifikasi: tabel akurasi ≥ 9/10 atau keputusan alternatif
  - ✅ 2026-10-13 — **Diputuskan owner: hitung statis + margin 0,9**; OPEN-DM-5 ditutup, DM-038 diperbarui. Estimator murni `estimateMaxContentWidth` / `estimateAvailableWidth` / `rowOverflowsStatic` di `@platform/document-model` (`src/query/estimate-width.ts`, 21 unit test); fixture `responsiveSectionsDocument()` = 10 section UMKM (navbar, hero, fitur, statistik, logo, CTA, testimoni, harga, footer, kontak; beberapa row sengaja dekat ambang). Pembanding DOM: `bench/overflow-estimate.bench.ts` mengukur `width: max-content` tiap row di frame Mobile 390 px; metrik font (em/karakter 400 & 700) dikalibrasi sekali per font dari kalimat terpisah (meniru katalog font), bukan dari isi fixture.

    | Font | Row benar | Section benar | Galat lebar rata-rata | Margin 0,9: row meluber lolos | Margin 0,9: tumpuk tak perlu |
    |---|---|---|---|---|---|
    | system-ui | 18/18 | 10/10 | 4,2% | 0 | 0 |
    | Inter | 18/18 | 10/10 | 5,2% | 0 | 0 |
    | Poppins | 17/18 | 9/10 | 5,2% | 0 | 1 |

    Galat per row maksimum ≈ 10%; satu-satunya salah = grup tombol hero (DOM 362 px vs tersedia 358 px, 1% di atas ambang). **Rekomendasi: hitung statis** dengan margin keamanan 0,9 (row ditumpuk bila ≥ 90% penuh) — condong menumpuk karena row meluber (scroll horizontal) lebih buruk daripada row muat yang ikut ditumpuk; user tetap bisa membatalkan dengan override `direction` di mobile (DM-038: rule tidak berlaku bila properti di-override) tanpa flag baru `keepRowOnMobile`. Syarat: katalog font (M2) menyimpan em/karakter per weight; font size dari typography eksplisit (UA default dipakai hanya di prototipe). Belum diuji: teks non-Latin, letter-spacing, gambar tanpa lebar fixed (estimator memakai `asset.width`, sama dengan lebar alami di browser).
- [x] **T0.8.5** ⚑ Validasi keputusan rich text spec 01 (`Y.XmlFragment` + `y-prosemirror` + Tiptap) di spike: edit teks inline, undo, dan isolasi style canvas berjalan; jika gagal, eskalasi ke owner sebelum M1 — DM-013, ED-125 · docs · Verifikasi: catatan hasil spike di spec 01 §4.4
  - ✅ 2026-10-13 — **Lolos.** Keputusan owner: binding `@tiptap/y-tiptap` 3.0.9 (fork resmi y-prosemirror untuk Tiptap 3; dependency baru `apps/editor`) dan konversi JSON ↔ `Y.XmlFragment` ditulis sendiri di document-model (aturan dependensi `zod`/`yjs`/`nanoid` tetap). `props.content` text node kini `Y.XmlFragment` (`jsonToYDoc`/`yDocToJson`/`yNodeToJson`); test kompatibilitas dua arah vs y-tiptap. Editor: `ySyncPlugin` lewat extension kecil (bukan Collaboration — undo plugin-nya men-`destroy()` UndoManager yang diberikan), Ctrl+Z → UndoController dokumen yang kini melacak `[LOCAL_ORIGIN, ySyncPluginKey]`; `beginGroup()/end()` menggabung satu sesi edit jadi satu langkah (ED-115). **Bug Shadow DOM ditemukan & diperbaiki:** y-tiptap memanggil `root.createRange()` yang tidak ada di ShadowRoot → update Yjs ke editor fokus gagal; shim `shadow-root-compat.ts` (regresi E2E dengan `pageerror`). Mutation check: origin ySync dilepas & grup dimatikan → E2E gagal. Gap M2: schema Tiptap belum punya align/link/list/textStyle (`richTextSchema` tunggal). Bundle 803 → 889 kB (lazy-load Tiptap di M2). Catatan di spec 01 DM-013 (spec tidak punya §4.4).
- [x] **T0.8.6** Tetapkan angka batas awal (node per page, ukuran state) dari hasil benchmark; perbarui DM-076 & OPEN 02#13 — DM-076, ED-223 · docs · Verifikasi: angka di spec 01 & 02
  - ✅ 2026-10-13 — disetujui owner. Spec 01 DM-076 & 02 ED-223 sebelumnya bertentangan (3.000/1.500 vs 5.000/2.000, 16 vs 20 MB, dst.); kini DM-076 sumber tunggal: **node/page soft 2.000 / hard 5.000**, node/site 20.000, **state Yjs soft 8 / hard 16 MB**, JSON snapshot 6/12 MB, kedalaman 20/32, teks/node 5.000/20.000 (kedalaman & teks tanpa data benchmark → ambil yang lebih ketat). Data spike (WSL headless, indikatif; eksperimen sementara, kode dikembalikan):

    | Node per page | Load | Heap | Commit 1 node → frame | Commit ubah layout → paint (median / maks) |
    |---|---|---|---|---|
    | 200 | — | — | — | 17 / 18 ms |
    | 2.000 | 1,2 s | 64 MB | 18 ms | 26 / 30 ms |
    | 3.000 | 1,3 s | 77 MB | 16 ms | 28 / 31 ms |
    | 5.000 | 1,5 s | 103 MB | 27 ms | 33 / 40 ms |
    | 10.000 | 2,2 s | 177 MB | 19 ms | 46 / 71 ms |

    Pan headless selalu 60 fps (compositor) sehingga tidak membedakan ukuran; pembedanya relayout. **Syarat:** ulangi di laptop referensi (T0.7.4) — bila relayout 5.000 node > 50 ms, hard limit turun ke 3.000.
- [x] **T0.8.7** Laporan spike & keputusan **go/no-go** (§M0.e) ditandatangani owner; tandai kode spike yang dibuang vs dipertahankan — ADR-001 · docs · Verifikasi: checklist go/no-go terisi
  - ✅ 2026-10-13 — **GO bersyarat, ditandatangani owner** di [docs/reports/m0-spike-report.md](./reports/m0-spike-report.md) §7. Syarat konfirmasi: T0.7.4 (laptop referensi, termasuk relayout 5.000 node ≤ 50 ms) & uji manual Safari. Daftar kode dipertahankan/dibuang disetujui "selagi on track dengan requirement"; pembersihan kode spike jadi task awal M1.

### M0.d Exit criteria / demo

- [ ] Demo: fixture 200 node — pan/zoom trackpad mulus, klik memilih, marquee, drag, resize, reorder di auto-layout, undo/redo.
- [ ] Target M0 ED-022 lulus pada laptop referensi: pan/zoom 60 fps @ 200; drag 60 fps @ 200; reorder ≥ 50 fps @ 200; resize auto-layout 100 child ≥ 45 fps; klik→seleksi < 50 ms.
- [x] Fixture 2.000 node terbuka dan bisa di-pan (angka fps dicatat sebagai baseline M2, tidak wajib lulus target M2). ✅ headless 59–60 fps (T0.7.3)
- [x] Keputusan T0.8.1–T0.8.6 tercatat (ADR/spec diperbarui). ✅ ADR-012/013, spec 01 & 02, Lampiran A/D
- [x] Go/no-go = **GO**. ✅ 2026-10-13 (bersyarat T0.7.4 & Safari)

### M0.e Kriteria go/no-go & tabel hasil

| Kriteria | GO | NO-GO → tindakan |
|---|---|---|
| Pan/zoom @ 200 node | ≥ 55 fps rata-rata, tanpa jank > 50 ms | Profiling; coba `will-change`, layer promotion, culling (ED-021) — ulangi 1× |
| Drag/resize @ 200 node | ≥ 55 fps | Pastikan preview sementara tidak menyentuh Yjs/React tree |
| Pan @ 2.000 node | ≥ 30 fps (baseline; target M2 60 fps) | Rencanakan culling/virtualisasi wajib di M2 (naikkan ED-021 ke P0) |
| Tiptap di isolasi terpilih | Edit, IME, paste bekerja di Chrome & Safari | Pilih opsi isolasi lain |
| Undo | 1 aksi = 1 langkah, seleksi pulih | Perbaiki grouping origin |
| Kompleksitas kode | Geometri murni teruji, state machine jelas | Refactor sebelum M1 |
| **Gagal total** (≤ 30 fps @ 200 setelah 2 iterasi optimasi) | — | Evaluasi ulang ADR-001 bersama owner (opsi: render canvas hybrid). **Jangan** lanjut ke M1 tanpa keputusan. |

Tabel hasil (diisi di T0.7.4):

| Skenario | Target M0 | Shadow DOM | Prefix | Non-iframe | Iframe |
|---|---|---|---|---|---|
| Pan/zoom 200 node | 60 fps | | | | |
| Drag move 200 node | 60 fps | | | | |
| Reorder auto-layout 200 node | ≥ 50 fps | | | | |
| Resize frame 100 child | ≥ 45 fps | | | | |
| Klik → seleksi | < 50 ms | | | | |
| Pan 2.000 node (baseline) | — | | | | |

### M0.f Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Spike melebar menjadi produk (scope creep) | Hanya fitur di §M0.a; tanda 🧪; batas waktu lunak, ulas setelah ±15 sesi |
| Benchmark tidak representatif (fixture terlalu sederhana) | Fixture meniru landing nyata (nested 4–6 level, teks panjang, gambar) |
| Hasil berbeda antar browser | Uji minimal Chrome + Safari (Mac/iOS bila ada) + Firefox; catat |
| WSL2 menyulitkan benchmark (GPU/headless) | Benchmark manual di browser Windows; Playwright headed di Windows bila perlu |
| Keputusan diambil terburu-buru | Setiap keputusan ⚑ wajib disetujui owner dengan data |

---

## M1 — Fondasi

### M1.a Tujuan & ruang lingkup

Membangun **rangka seluruh sistem** sesuai [ARCHITECTURE §4](./ARCHITECTURE.md#4-struktur-monorepo) secara tipis tapi benar: monorepo lengkap, tooling, DB + migration, auth platform, workspace pribadi, API Express dengan middleware chain, SDK, **document-model v1**, **renderer v1** (React + static), realtime Hocuspocus dengan autosave & snapshot, dashboard daftar situs, editor shell yang terhubung ke dokumen, i18n dasar, CI.

Termasuk: semua requirement P0 berfase M1 di spec 01 (DM-*), 02 (ED-012, ED-017, ED-018, ED-061, ED-197, ED-198, ED-200, ED-201, ED-221, ED-227–ED-231, ED-242), 03 (CMP-140–CMP-143), 07 (PUB-190, PUB-191, PUB-193, PUB-211), 08 (ACC-001–ACC-005, ACC-007–ACC-009, ACC-030, ACC-033 layer, ACC-050, ACC-051 blank, ACC-271, ACC-290, ACC-291, ACC-370).

**Tidak termasuk**: fitur editor Figma (M2), component/instance (M3), publish ke subdomain (M4), billing (M5), AI (M6), 2FA user (M5), team workspace (M9), RLS Postgres (P1), OpenAPI docs (P1).

### M1.b Prasyarat

- M0 selesai dengan keputusan **GO**; ADR isolasi style & breakpoint canvas sudah ada.
- Keputusan OPEN yang harus diputuskan sebelum mulai:
  - 08 OPEN #1 — Better Auth dipertahankan atau diganti → ✅ dipertahankan (2026-10-13).
  - Rich text di Yjs sudah diputuskan di spec 01 (`Y.XmlFragment` + `@tiptap/y-tiptap`); T0.8.5 lolos ✅.
  - Group sudah diputuskan: node type `group` (DM-012).
  - 02 OPEN #4 — urutan layer → ✅ Figma order di layers panel (2026-10-13); `children` tetap DOM order, jadi semantik data tidak berubah.
  - ARCHITECTURE A12 — secret manager & remote cache (boleh ditunda; tidak memblokir).
- Non-pemblokir (pakai rekomendasi): A4 (Y.Doc per halaman — tunda), OPEN-DM-9 (granularitas `layout` di Yjs — atomik dulu).

### M1.c Epic & task

#### Epic 1.1 — Monorepo & tooling lengkap

- [x] **T1.1.1** Rapikan hasil M0 menjadi struktur final `apps/*` & `packages/*` sesuai tree §4.1 (folder kosong + `package.json` `@platform/<name>`, `"type": "module"`, field `exports`) — ARCHITECTURE §4.1, §4.4 · root · Verifikasi: `pnpm -r exec pwd` mendaftar semua paket; `pnpm typecheck` hijau
  - Catatan: ✅ 2026-10-13 — 14 workspace baru (apps `web`, `api`, `worker`, `realtime`, `site-host`; packages `renderer`, `library-seed`, `workflow-blocks`, `ai-tools`, `db`, `shared` (+ subpath `./node`), `sdk`, `ui`, `i18n`), masing-masing `package.json` `@platform/<name>` + `type: module` + `exports` (package) + `typecheck`, `tsconfig.json` dari base, dan entry kosong berisi tanggung jawabnya (§4.2). Tanpa dependency baru — framework dipasang di task fiturnya. `pnpm -r exec pwd` = 17 paket; `pnpm typecheck` 16/16. Subfolder kosong dari tree §4.1 tidak dibuat (git tidak melacak folder kosong); dibuat saat diisi. Struktur `apps/editor/src` & `packages/document-model/src` hasil M0 sudah sesuai §4.1/§5.2 (`ops/` mengikuti ARCHITECTURE; DM-073 masih menyebut `commands/` — diselaraskan saat command layer M1). Pembersihan kode spike (laporan M0 §4) ditunda sampai T0.7.4 selesai.
- [x] **T1.1.2** `packages/config`: `tsconfig/base.json`, `tsconfig/react.json`, `tsconfig/node.json`, Vitest preset, Tailwind preset; TS project references untuk `tsc -b` — ARCHITECTURE §4.2, §4.4 · `packages/config` · Verifikasi: `pnpm typecheck` memakai references
  - Catatan: ✅ 2026-10-13 — `tsconfig/base.json` kini `composite` + `emitDeclarationOnly` ke `${configDir}/node_modules/.tsc` (TS 7 menolak `noEmit` pada project yang direferensikan) dan `types: []` (tipe global hanya bila diminta); `react.json` (DOM + JSX) dan `node.json` (`types: ["node"]`). Semua paket `typecheck` = `tsc -b` dengan `references` ke paket internal yang diimport (editor → document-model, config; document-model → config; bench → document-model); dicek: error di document-model gagal saat `tsc -b` editor. `@platform/config/vitest` (`vitestPreset`, dipakai lewat `mergeConfig` di editor & document-model) dan `@platform/config/tailwind/preset.css` (Tailwind v4 CSS-first; hanya varian `dark` berbasis kelas — token desain di T1.15.4; Tailwind belum dipasang). Biome: komentar diizinkan di `tsconfig*.json`, sintaks Tailwind di CSS. Dependency baru: `@types/node` 22.20.5 di api/worker/realtime/db (pemakai `node.json`); `vitest` jadi peer/dev `@platform/config`. `shared` tetap base (subpath `node` mendapat tipe Node di T1.2.4); `site-host` menunggu tipe Workers.
- [x] **T1.1.3** Biome final (format + lint, `noExplicitAny` error, import sorting) + script `pnpm lint`/`pnpm format` — ARCHITECTURE §18 · root · Verifikasi: CI lint gagal pada pelanggaran contoh
  - Catatan: ✅ 2026-10-13 — formatter Biome aktif di `@platform/config/biome.json` (spasi 2, `lineWidth` 120 — p99 panjang baris kode M0 = 124, sehingga reformat paling kecil; kutip ganda, titik koma, trailing comma), import sorting (`assist.organizeImports`), `noExplicitAny` = error. `pnpm lint` = `biome check .` (lint + format + urutan import, gagal bila ada pelanggaran); `pnpm format` = `biome check --write .`. Biome membaca `.gitignore` (VCS) sehingga `test-results/` dll. diabaikan. Reformat sekali jalan: 91 file (format & urutan import saja); typecheck, 434 unit, 234 E2E, build hijau setelahnya. Verifikasi lokal: file contoh dengan `any`, format salah, dan import tak terurut → `pnpm lint` exit 1; CI menjalankan perintah yang sama di T1.16.1.
- [x] **T1.1.4** dependency-cruiser `.dependency-cruiser.cjs` dengan semua aturan §4.3 (packages ↛ apps, app ↛ app, document-model hanya zod/yjs/nanoid, renderer ↛ db/ui/ai-tools, editor/web/site-host ↛ db & shared/node, workflow-blocks/ai-tools ↛ db/network) + `pnpm lint:deps` — ARCHITECTURE §4.3 · root · Verifikasi: import terlarang contoh gagal `lint:deps`
  - Catatan: ✅ 2026-10-13 — `.dependency-cruiser.cjs` + `pnpm lint:deps` (`depcruise apps packages`). Aturan: `no-package-to-app`, `no-app-to-app`, `document-model-pure` (kode produksi hanya zod/yjs/nanoid; test dikecualikan), `renderer-deterministic`, `browser-edge-no-server-code` (editor/web/site-host ↛ db & `shared/node`), `site-host-shared-only`, `ports-only-no-db` & `ports-only-no-network` (workflow-blocks/ai-tools ↛ db, driver DB/Redis/BullMQ, modul `http/net/tls/dns`, klien HTTP), allowlist paket internal per paket sesuai diagram §4.3 (`internal-deps-*`), `db-document-model-type-only`, `not-to-unresolvable`. Global `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource` di workflow-blocks & ai-tools ditolak Biome (`noRestrictedGlobals`) karena tidak terlihat sebagai import. Parser **SWC** (`@swc/core` 1.16.18): dependency-cruiser 18.6.0 belum mendukung TypeScript 7; SWC tetap menandai `import type` sebagai `type-only` (diuji). Verifikasi: 13 contoh import terlarang (satu per aturan) → gagal dengan nama aturan yang tepat; import type-only db → document-model lolos; repo bersih: 0 pelanggaran (199 modul, 437 dependensi). Dependency baru: `dependency-cruiser` 18.6.0, `@swc/core` 1.16.18 (root dev).
- [x] **T1.1.5** `turbo.json` lengkap: `dev`, `build` (`^build`), `lint`, `lint:deps`, `typecheck`, `test`, `test:integration`, `test:e2e`, `db:generate`, `db:migrate`; dotenv-cli memuat `.env` root — ARCHITECTURE §4.4, §15.4 · root · Verifikasi: `pnpm turbo run test --dry` menunjukkan graf benar
  - Catatan: ✅ 2026-10-13 — task turbo: `dev`, `build` (`^build`, output `dist/` & `.next/`), `typecheck` (`^typecheck`), `test`, `test:coverage`, `test:integration` & `test:e2e` & `db:generate` & `db:migrate` (tanpa cache), serta task root `//#lint` dan `//#lint:deps` (sekali per repo, sehingga `turbo run lint lint:deps typecheck test` di CI T1.16.1 berfungsi). `.env` root dimuat **sekali** oleh script root (`dotenv -e .env -- turbo run …`, dotenv-cli 11.0.0) dan diwarisi semua task; `envMode: loose` karena mode strict turbo menyaring variabel `.env` yang tidak dideklarasikan, sementara variabel yang mengubah output build (`VITE_*`, `NEXT_PUBLIC_*`, `PUBLIC_*`, `NODE_ENV`, `APP_ENV`) tetap dideklarasikan di `build.env` dan `.env` jadi `globalDependencies` (cache benar). Diverifikasi: variabel uji di `.env` terbaca oleh script paket lewat `pnpm test`. Catatan pemakaian: `pnpm --filter <pkg> <script>` melewati script root sehingga `.env` tidak dimuat — pakai `pnpm <script> -- --filter=<pkg>`.
- [x] **T1.1.6** `docker/docker-compose.yml`: postgres:17 (5432), postgres-test (5433, tmpfs), redis:7 (appendonly), minio + `minio-init` (bucket `sites`, `assets`, `uploads`, `backups`), mailpit — ARCHITECTURE §15.2, PUB-191 · `docker/` · Verifikasi: `pnpm infra:up` → semua healthy; console MinIO di :9001
  - Catatan: ✅ 2026-10-13 — `docker/docker-compose.yml` (project `platform`): `postgres:17` (`platform_dev`, volume), `postgres-test` (`platform_test`, tmpfs, fsync off), `redis:7` (`appendonly yes`), MinIO, `minio-init`, `axllent/mailpit:v1.31.2`; semua dengan healthcheck. **Image MinIO resmi (`minio/minio`, `minio/mc`) sudah tidak ada di Docker Hub** → atas keputusan owner tetap MinIO lewat `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` (build komunitas kode MinIO; image yang sama memuat `mc` untuk `minio-init`). `pnpm infra:up`/`infra:down` → `docker/infra.sh` (`up --wait`, lalu `compose run --rm minio-init` di profil `init` karena `up --wait` menganggap container one-shot yang selesai sebagai gagal). Port host bisa diatur lewat `.env` (mesin owner: `postgres16` lain sudah memakai 5432 → set `POSTGRES_PORT=5434`; container platform terpisah agar `db:reset` tidak menyentuh data project lain & sesuai Postgres 17). Diverifikasi (POSTGRES_PORT=5434): semua healthy, Postgres 17.11, test di tmpfs, AOF Redis aktif, console MinIO :9001 & Mailpit :8025 = 200, `assets` terbaca anonim (200) sedangkan `uploads` 403, `infra:up` kedua kali idempoten. Spec 07 PUB-191 (cuplikan `postgres:16`, bucket `pf-*`) diselaraskan dengan ARCHITECTURE.
- [ ] **T1.1.7** `.env.example` lengkap sesuai ARCHITECTURE §15.4 + loader env tervalidasi Zod per app (`@platform/shared/env`) — ARCHITECTURE §15.4 · `packages/shared` · Verifikasi: app gagal start dengan pesan jelas bila env wajib hilang
- [ ] **T1.1.8** Script root: `infra:up/down`, `db:*`, `dev`, `test*`, `bench`; dokumentasi WSL2 (repo di FS Linux, `*.localhost`, `curl -H Host`) — ARCHITECTURE §15.1, §15.5, PUB-190, PUB-193 · root · Verifikasi: alur pertama kali §15.5 berjalan dari clone bersih
- [ ] **T1.1.9** Konvensi commit & hook ringan (opsional): commitlint Conventional Commits — CLAUDE.md § Alur kerja · root · Verifikasi: commit tidak valid ditolak lokal

#### Epic 1.2 — `packages/shared`

- [ ] **T1.2.1** `ids`: `uuidv7()`, helper prefix untuk ID dokumen (re-export dari document-model tidak boleh — duplikasi dihindari, cukup UUID di sini) — ARCHITECTURE §6.1 · `packages/shared/src/ids` · Verifikasi: unit test urutan waktu UUIDv7
- [ ] **T1.2.2** `errors`: `AppError(code, status, details)`, katalog kode (`VALIDATION_FAILED`, `UNAUTHENTICATED`, `NOT_FOUND`, `FORBIDDEN`, `PLAN_LIMIT_REACHED`, `CONFLICT`, `RATE_LIMITED`, …), `Result<T,E>` — ARCHITECTURE §5.3, §18 · `packages/shared/src/errors` · Verifikasi: unit test mapping kode → status
- [ ] **T1.2.3** `contracts` skeleton: envelope response `{ data, meta }`/`{ error }`, pagination cursor, schema `sites`, `documents`, `realtime-token`, `jobs.ts` (payload job Zod) — ARCHITECTURE §5.3, §5.4 · `packages/shared/src/contracts` · Verifikasi: unit test parse contoh response
- [ ] **T1.2.4** `shared/node`: logger pino (field wajib, redaksi), signed token helper (JWT pendek HS256) — ARCHITECTURE §13, §9.3 · `packages/shared/src/node` · Verifikasi: unit test redaksi `password`/`token`/`cookie`
- [ ] **T1.2.5** Request context (`AsyncLocalStorage` requestId/userId/workspaceId/siteId) helper isomorfik-aman untuk api/worker — ARCHITECTURE §13 · `packages/shared/src/node` · Verifikasi: unit test propagasi async

#### Epic 1.3 — `packages/db` & migration awal

- [ ] **T1.3.1** `drizzle.config.ts`, `client.ts` (pool pg), konvensi kolom (`created_at`, `updated_at`, `deleted_at`, UUIDv7 default dari app) + helper kolom bersama — ARCHITECTURE §6.1 · `packages/db` · Verifikasi: `pnpm db:generate` menghasilkan SQL kosong tanpa error
- [ ] **T1.3.2** ⚑ Schema identity Better Auth (tabel jamak `users`, `sessions`, `accounts`, `verifications`) + kolom tambahan (`locale`, `timezone`, `platform_role`, `banned_at`) — ACC-370, ARCHITECTURE §6.3 · `packages/db/src/schema/identity.ts` · Verifikasi: migration jalan ke DB kosong
- [ ] **T1.3.3** ⚑ Schema `workspaces`, `workspace_members` (+ `workspace_invitations` kosong untuk M9) — ACC-370, ACC-030 · `packages/db/src/schema/workspaces.ts` · Verifikasi: migration + unique/index sesuai tabel §6.3
- [ ] **T1.3.4** ⚑ Schema `sites`, `site_pages` (read model), `documents`, `document_updates` (bigint identity, bytea), `document_snapshots` — DM-078, ARCHITECTURE §6.3, §7.1 · `packages/db/src/schema/{sites,documents}.ts` · Verifikasi: migration; constraint unique(document_id, seq)
- [ ] **T1.3.5** Schema `assets` & `storage_usage` (dipakai M2 upload) dan `audit_logs` (append-only) — ARCHITECTURE §6.3, §9.10 · `packages/db/src/schema` · Verifikasi: migration; role app hanya INSERT/SELECT pada `audit_logs` (SQL grant di migration)
- [ ] **T1.3.6** `TenantContext` + helper repository (`siteScope`, `workspaceScope`, `systemScope` wajib alasan) — ARCHITECTURE §6.2, CLAUDE.md § Multi-tenant · `packages/db/src/tenant.ts` · Verifikasi: unit test tipe — fungsi repository tanpa tenant tidak bisa dipanggil (type test)
- [ ] **T1.3.7** Test DB helper: migrate ke `platform_test_template`, `CREATE DATABASE … TEMPLATE` per worker Vitest — ARCHITECTURE §14 · `packages/db/test` · Verifikasi: 2 file test paralel tidak saling mengganggu
- [ ] **T1.3.8** Factories (`createUser`, `createWorkspace`, `createSite`) dengan faker `id_ID` lewat repository — ARCHITECTURE §14 · `packages/db/test/factories` · Verifikasi: unit/int test factory
- [ ] **T1.3.9** Seed dev idempotent: `owner@platform.test`, `admin@platform.test` (platform_admin), 1 workspace, 2 situs contoh (dokumen fixture), plans placeholder `free` — ARCHITECTURE §6.1 (Seed) · `packages/db/seed` · Verifikasi: `pnpm db:seed` dua kali tanpa duplikasi
- [ ] **T1.3.10** Script `db:reset` menolak bila `APP_ENV != local`; migration check (`drizzle-kit generate` + `git diff --exit-code`) — ARCHITECTURE §15.5, §16.1 · root · Verifikasi: jalankan di APP_ENV=staging → ditolak

#### Epic 1.4 — `apps/api` skeleton & middleware chain

- [ ] **T1.4.1** Bootstrap `main.ts` + `app.ts` `createApp()`, graceful shutdown, `config/env.ts` — ARCHITECTURE §5.3 · `apps/api` · Verifikasi: `GET /health/live` 200; SIGTERM menutup koneksi
- [ ] **T1.4.2** Middleware 1–5: `requestId`, `httpLogger` (pino-http + redaksi), helmet, cors terbatas, body parsers (`json 1mb`, `raw` untuk `/webhooks/*` & binary) — ARCHITECTURE §5.3 · `apps/api/src/middleware` · Verifikasi: int test header `x-request-id` dikembalikan; log tanpa cookie
- [ ] **T1.4.3** `validate(schema)` → `req.valid` bertipe; Zod error → 422 `VALIDATION_FAILED` — ARCHITECTURE §5.3 · `apps/api/src/middleware` · Verifikasi: int test body invalid → 422 + `details.issues`
- [ ] **T1.4.4** `errorHandler` + `notFound`: `AppError` → HTTP, unknown → 500 + Sentry, selalu `requestId`; pesan dilokalkan via `Accept-Language` — ARCHITECTURE §5.3 · `apps/api/src/middleware` · Verifikasi: int test 3 jenis error
- [ ] **T1.4.5** `rateLimit` Redis (`rate-limiter-flexible`) dengan policy per router + `Retry-After` — ARCHITECTURE §9.6 · `apps/api/src/middleware` · Verifikasi: int test 429 setelah N request
- [ ] **T1.4.6** `GET /health/ready` (DB, Redis, MinIO reachable) — ARCHITECTURE §13 · `apps/api` · Verifikasi: matikan Redis → 503
- [ ] **T1.4.7** Pola modul contoh `modules/sites/*` (routes/controller/service/repository/schema/test) sebagai template untuk modul lain — CLAUDE.md § Struktur modul API · `apps/api/src/modules/sites` · Verifikasi: int test CRUD minimal
- [ ] **T1.4.8** Producer queue (`queues/`): enqueue helper bertipe + `afterCommit` hook (enqueue setelah transaksi commit) — ARCHITECTURE §18 (Transaksi) · `apps/api/src/queues` · Verifikasi: int test job tidak ter-enqueue bila transaksi rollback
- [ ] **T1.4.9** Router `/internal/v1` dengan service token (`INTERNAL_JWT_SECRET`) — ARCHITECTURE §9.3 · `apps/api/src/internal` · Verifikasi: int test tanpa token → 401

#### Epic 1.5 — Auth platform (Better Auth) & workspace pribadi

- [ ] **T1.5.1** ⚑ Instance Better Auth di `apps/api/src/auth` dengan Drizzle adapter, cookie di domain `app.`, mount `/api/auth/*` — ARCHITECTURE §9.1, ACC-004 · `apps/api/src/auth` · Verifikasi: int test sign-up/sign-in lewat endpoint Better Auth
- [ ] **T1.5.2** Registrasi email + password (aturan password, normalisasi email, rate limit) — ACC-001 · `apps/api`, `apps/web/(auth)` · Verifikasi: int test + e2e register
- [ ] **T1.5.3** Verifikasi email (token, kedaluwarsa, kirim ulang) via queue `email` → Mailpit — ACC-003, ACC-271 · `apps/api`, `apps/worker` · Verifikasi: e2e: register → buka Mailpit → klik link → status verified
- [ ] **T1.5.4** Login & logout (sesi, remember me) + middleware `authSession`/`requireAuth` — ACC-004, ARCHITECTURE §5.3 · `apps/api`, `apps/web` · Verifikasi: int test endpoint terproteksi 401 tanpa sesi
- [ ] **T1.5.5** Lupa & reset password (token sekali pakai, cabut sesi lain) — ACC-005 · `apps/api`, `apps/web/(auth)` · Verifikasi: e2e reset via Mailpit
- [ ] **T1.5.6** Login Google (OAuth) + penautan akun email yang sama — ACC-002 · `apps/api/src/auth`, `apps/web` · Verifikasi: manual dengan kredensial OAuth dev; int test callback di-mock
- [ ] **T1.5.7** Sesi & perangkat: daftar sesi aktif, cabut sesi — ACC-007 · `apps/api`, `apps/web/(dashboard)/account` · Verifikasi: e2e cabut sesi lain → sesi itu 401
- [ ] **T1.5.8** Profil pengguna (nama, avatar, email) — ACC-008 · `apps/api/src/modules/account`, `apps/web` · Verifikasi: int test update profil; e2e
- [ ] **T1.5.9** Bahasa UI & timezone tersimpan di user, dipakai web/editor/email — ACC-009 · `apps/api`, `apps/web` · Verifikasi: ganti ke EN → UI & email berikutnya EN
- [ ] **T1.5.10** Personal workspace otomatis saat registrasi (transaksi yang sama) — ACC-030 · `apps/api/src/modules/workspaces` · Verifikasi: int test user baru punya 1 workspace role owner
- [ ] **T1.5.11** Layer permission `can(actor, action, resource)` + matriks role (owner/admin/editor/viewer) — dipakai `tenantResolver` — ACC-033 · `apps/api/src/modules/workspaces` · Verifikasi: unit test tabel matriks
- [ ] **T1.5.12** Middleware `tenantResolver` (membership + role → `req.ctx.tenant`; gagal → 404) — ARCHITECTURE §5.3, §9.5 · `apps/api/src/middleware` · Verifikasi: int test user A akses site B → 404
- [ ] **T1.5.13** Template email transaksional dasar (verifikasi, reset, selamat datang) ID/EN dengan React Email — ACC-271 · `apps/worker/src/processors/email.ts`, `packages/i18n` · Verifikasi: snapshot HTML email ID & EN

#### Epic 1.6 — Sites & documents API

- [ ] **T1.6.1** `GET /v1/workspaces/:id/sites` daftar situs (cursor pagination, soft delete disembunyikan) — ACC-050 · `apps/api/src/modules/sites` · Verifikasi: int test + isolasi tenant
- [ ] **T1.6.2** `POST /v1/workspaces/:id/sites` buat situs **kosong**: buat `documents` + snapshot awal dari dokumen default (1 page Home, theme default) — ACC-051, DM-004, DM-010 · `apps/api/src/modules/sites` · Verifikasi: int test dokumen awal lolos validator strict
- [ ] **T1.6.3** `GET/PATCH/DELETE /v1/sites/:siteId` (rename, soft delete) — ACC-050 · `apps/api/src/modules/sites` · Verifikasi: int test + cross-tenant 404
- [ ] **T1.6.4** `POST /v1/realtime/token` (JWT pendek: sub, docId, siteId, role, exp) — ARCHITECTURE §5.5, §7.3 · `apps/api/src/modules/realtime-token` · Verifikasi: int test token hanya untuk site milik user
- [ ] **T1.6.5** `GET /internal/v1/documents/:id/state` proxy/kontrak untuk worker (state Yjs terbaru) — ARCHITECTURE §5.5 · `apps/api/src/internal` · Verifikasi: int test dengan service token
- [ ] **T1.6.6** Test isolasi tenant generik: helper yang menjalankan setiap endpoint data dengan user lain → wajib 404 — ARCHITECTURE §9.5, CLAUDE.md § Testing · `apps/api/test` · Verifikasi: suite dijalankan di CI

#### Epic 1.7 — `packages/sdk`

- [ ] **T1.7.1** Fetch wrapper typed dari `shared/contracts` (baseUrl, error mapping ke `AppError`-like, `x-request-id`) — ARCHITECTURE §4.2 · `packages/sdk` · Verifikasi: unit test dengan fetch mock
- [ ] **T1.7.2** `apiServer(req)` untuk Next.js server (meneruskan cookie) + client TanStack Query hooks dasar — ARCHITECTURE §5.1 · `packages/sdk` · Verifikasi: unit test header diteruskan
- [ ] **T1.7.3** SSE helper (dipakai publish progress M4 & AI M6) — ARCHITECTURE §10.5 · `packages/sdk` · Verifikasi: unit test parsing event stream

#### Epic 1.8 — `packages/document-model` v1: schema

- [ ] **T1.8.1** ⚑ Prinsip & top-level `SiteDocument` (meta, settings, theme, assets, componentDeps, dataSources, pageOrder, nodes) — DM-001, DM-002, DM-003, DM-004 · `packages/document-model/src/schema` · Verifikasi: AC DM-001–DM-004 (round-trip JSON, tanpa `userId`)
- [ ] **T1.8.2** `SiteSettings` field P0 (language, seo default, favicon, breakpoints, manualResponsive, autoResponsive) — DM-005, DM-035, DM-037 · `packages/document-model/src/schema` · Verifikasi: unit test default & validasi
- [ ] **T1.8.3** Format ID & generator (`n_`, `pg_`, `cmp_`, `ast_`, `ix_`) — DM-007 · `packages/document-model/src/ids.ts` · Verifikasi: unit test regex & tabrakan 1e5 ID
- [ ] **T1.8.4** Node base (id, type, name, parentId, visible, locked, tag, htmlId, style, states, props, metadata) + semantic tag — DM-008, DM-009 · `packages/document-model/src/schema/node.ts` · Verifikasi: unit test tag tidak valid ditolak
- [ ] **T1.8.5** Node `page` (pages adalah node; path, title, isHome, seo) — DM-006, DM-010 · `packages/document-model/src/schema` · Verifikasi: invariant tepat 1 home
- [ ] **T1.8.6** Node `frame` (layout flex P0; grid disiapkan sebagai P1) — DM-011, DM-026 · `packages/document-model/src/schema` · Verifikasi: fixture frame flex valid; grid ditolak/di-flag sesuai keputusan
- [ ] **T1.8.7** Node `text` rich text (Tiptap JSON; representasi Yjs sesuai T0.8.5) — DM-013 · `packages/document-model/src/schema` · Verifikasi: fixture marks (bold, link, textStyle token)
- [ ] **T1.8.8** Node `image` + `AssetRef` & registry `assets` — DM-014, DM-057 · `packages/document-model/src/schema` · Verifikasi: invariant assetId harus ada di registry
- [ ] **T1.8.9** Value types: literal vs `{ $token }` vs `{ $prop }` (`tv()`), Length, Color — DM-025 · `packages/document-model/src/schema/values.ts` · Verifikasi: unit test token path regex
- [ ] **T1.8.10** Style model: sizing (fixed/hug/fill, min/max), position & constraints, strokes & radius, typography, fills solid, style terlarang — DM-027, DM-028, DM-029, DM-030, DM-032, DM-034 · `packages/document-model/src/schema/style.ts` · Verifikasi: fixture per kelompok + properti terlarang ditolak
- [ ] **T1.8.11** Breakpoint & override per node `{ base, tablet?, mobile? }` sparse, cascade desktop-first, visibility per breakpoint — DM-035, DM-036, DM-039 · `packages/document-model/src/schema` · Verifikasi: unit test `resolveStyle(node, 'mobile')` mewarisi tablet
- [ ] **T1.8.12** Theme & token: struktur theme, alias token, resolver `$token` (siklus terdeteksi) — DM-041, DM-042 · `packages/document-model/src/schema/theme.ts` · Verifikasi: unit test alias berantai & siklus → error
- [ ] **T1.8.13** `LinkValue` (url, page, anchor, email, phone, whatsapp) — DM-056 · `packages/document-model/src/schema` · Verifikasi: unit test sanitasi `javascript:` ditolak
- [ ] **T1.8.14** Mode validasi (strict/lenient) & invariants (parent-child konsisten, tanpa siklus, home unik, asset ref valid) — DM-067, DM-068, DM-069 · `packages/document-model/src/validate` · Verifikasi: fixture invalid per invariant
- [ ] **T1.8.15** Batas dokumen (node per page, kedalaman, ukuran teks) sesuai angka M0 — DM-076 · `packages/document-model` · Verifikasi: unit test melebihi batas → error informatif

#### Epic 1.9 — `packages/document-model` v1: Yjs, ops, migrasi

- [ ] **T1.9.1** Mapping JSON ↔ Y.Doc final (flat map, `Y.XmlFragment`/JSON untuk rich text sesuai keputusan) — DM-058, DM-059 · `packages/document-model/src/yjs` · Verifikasi: round-trip semua fixture deep-equal
- [ ] **T1.9.2** Transaction origin (`local`, `ai:<runId>`, `server`, `migration`) & aturan undo grouping — DM-060 · `packages/document-model/src/yjs` · Verifikasi: unit test UndoManager hanya melacak `local`
- [ ] **T1.9.3** Encoding & penyimpanan (update biner, state vector, snapshot) + kebijakan GC Yjs — DM-061, DM-062 · `packages/document-model/src/yjs` · Verifikasi: unit test snapshot+updates = state sama
- [ ] **T1.9.4** Command API kerangka: `transact(doc, origin, fn)`, validasi pra/pasca, error informatif — DM-073 · `packages/document-model/src/ops` · Verifikasi: command invalid tidak mengubah doc (atomik)
- [ ] **T1.9.5** Command node & tree: `createNode`, `insertSubtree`, `deleteNodes`, `duplicateNodes`, `moveNode`, `reorderNode`, `renameNode`, `setVisible`, `setLocked`, `setTag` — DM-074 · `packages/document-model/src/ops` · Verifikasi: unit test per command + property-based (fast-check) urutan acak tetap valid
- [ ] **T1.9.6** Command style & layout: `updateStyle` (per breakpoint/state), `setLayoutMode`, `setBreakpointOverride`, `clearBreakpointOverrides`, `setSettings` — DM-074, DM-036 · `packages/document-model/src/ops` · Verifikasi: unit test patch sparse
- [ ] **T1.9.7** Command konten & page: `setTextContent`, `replaceText`, `setImage`, `setLink`, `setNodeProps`, `createPage`, `updatePage`, `reorderPages`, `deletePage` — DM-074 · `packages/document-model/src/ops` · Verifikasi: unit test; hapus home ditolak
- [ ] **T1.9.8** Command theme: `setToken`, `renameToken` (update refs), `deleteToken` (replaceWith), `addFont` — DM-074, DM-042 · `packages/document-model/src/ops` · Verifikasi: unit test jumlah ref ter-update
- [ ] **T1.9.9** `schemaVersion` & runner migrasi berurutan + fixture migrasi (v0 contoh → v1) — DM-071, DM-072 · `packages/document-model/src/migrations` · Verifikasi: unit test fixture lama dimigrasi & valid
- [ ] **T1.9.10** Query helper (`findNode`, `walk`, `ancestors`, `pageOf`) — ARCHITECTURE §4.2 · `packages/document-model/src/query` · Verifikasi: unit test
- [ ] **T1.9.11** Normalisasi konflik struktur (orphan, siklus pasca-merge) (P1) — DM-063 · `packages/document-model/src/yjs` · Verifikasi: unit test 2 Y.Doc konkuren di-merge tetap valid
- [ ] **T1.9.12** Benchmark Vitest bench: validasi 5k node, round-trip Yjs 5k node, (resolve instance & compile disiapkan) — DM-077 · `packages/document-model/bench` · Verifikasi: angka di bawah target DM-077

#### Epic 1.10 — `packages/renderer` v1

- [ ] **T1.10.1** Primitives (Box, Text, Image, Link) + `render(document, ctx)` murni; ctx: breakpoint, mode (`editor`/`publish`), data — DM-001, ED-017 · `packages/renderer/src/primitives`, `src/react` · Verifikasi: unit test render fixture
- [ ] **T1.10.2** Generator CSS: style → class per style-signature (rekomendasi spec 07 OPEN #2), token → CSS custom properties — DM-041, DM-042 · `packages/renderer/src/css` · Verifikasi: snapshot CSS fixture
- [ ] **T1.10.3** Breakpoint CSS: media query (publish) dan scope class (editor, sesuai ADR M0) dari sumber yang sama — DM-035, DM-036, ED-017 · `packages/renderer/src/css` · Verifikasi: snapshot kedua mode identik selain selector
- [ ] **T1.10.4** Auto-responsive rules `applyAutoResponsive(resolvedTree, bp, config)` + `autoApplied` per node di mode editor — DM-038 · `packages/renderer/src/responsive` · Verifikasi: unit test per rule (stackRows, wrapRowsTablet, gridColumns, fixedToFluid, absoluteToFlow, scaleSpacing, scaleType)
- [ ] **T1.10.5** Visibility per breakpoint & semantic tag output — DM-039, DM-009 · `packages/renderer` · Verifikasi: snapshot HTML tag benar
- [ ] **T1.10.6** Rich text renderer (Tiptap JSON → HTML aman, escaping) + link sanitasi — DM-013, DM-056 · `packages/renderer` · Verifikasi: unit test XSS payload ter-escape
- [ ] **T1.10.7** Static renderer: `renderToStaticHtml(doc, pageId)` → HTML + CSS (Node, tanpa browser API) — DM-001, ARCHITECTURE §4.2 · `packages/renderer/src/static` · Verifikasi: snapshot `toMatchFileSnapshot`; output deterministik (2 run identik)
- [ ] **T1.10.8** Test kesetaraan editor vs publish (identik selain `data-node-id`) — ARCHITECTURE §14 · `packages/renderer` · Verifikasi: unit test diff
- [ ] **T1.10.9** Hook mode editor via props (overlay data, `data-node-id`, tanpa import API editor) — ED-017 · `packages/renderer` · Verifikasi: `lint:deps` hijau

#### Epic 1.11 — `packages/library-seed` (kerangka)

- [ ] **T1.11.1** Struktur paket `src/{components/<category>/, templates/, themes/, icons/}` + index — CMP-140 · `packages/library-seed` · Verifikasi: build/typecheck
- [ ] **T1.11.2** Format file seed component (TS yang tervalidasi document-model; key stabil) — CMP-141 · `packages/library-seed` · Verifikasi: 1 contoh seed (button sederhana sebagai subtree biasa)
- [ ] **T1.11.3** Validasi Zod semua seed di unit test — CMP-143 · `packages/library-seed` · Verifikasi: seed invalid gagal test
- [ ] **T1.11.4** Script import seed ke DB (upsert by key; tabel library dibuat M3, di M1 cukup dry-run/validate) — CMP-142 · `packages/db/seed` · Verifikasi: `pnpm db:seed --library --dry-run`

#### Epic 1.12 — `apps/realtime` (Hocuspocus) & autosave

- [ ] **T1.12.1** Server Hocuspocus (port 4100) + `onAuthenticate` verifikasi JWT (docId harus cocok) — ARCHITECTURE §5.5 · `apps/realtime` · Verifikasi: int test token salah → ditolak
- [ ] **T1.12.2** `persistence` extension: `onLoadDocument` (snapshot + updates seq > upto) + migrasi schemaVersion dengan origin `migration` — ARCHITECTURE §7.3, DM-071 · `apps/realtime/src/extensions/persistence.ts` · Verifikasi: int test load dokumen dengan 100 update
- [ ] **T1.12.3** Buffer & flush update (debounce 2 s, max 10 s) → `document_updates` + `last_seq` dalam satu transaksi; flush paksa saat disconnect — ARCHITECTURE §7.2 · `apps/realtime` · Verifikasi: int test 50 update → ≤ N baris; tidak ada seq bolong
- [ ] **T1.12.4** Snapshot otomatis (≥ 500 update atau ≥ 10 menit) `kind=auto` — ARCHITECTURE §7.2 · `apps/realtime` · Verifikasi: int test ambang
- [ ] **T1.12.5** Stateless message `saved:{seq}` untuk indikator status — ED-200 · `apps/realtime` · Verifikasi: int test client menerima seq
- [ ] **T1.12.6** `single-editor-lock` (Redis `doclock:<docId>`, heartbeat, takeover) — ARCHITECTURE §5.5 · `apps/realtime/src/extensions` · Verifikasi: int test koneksi kedua menerima `locked`
- [ ] **T1.12.7** `projections` extension → `site_pages` (path, title, seo, node_count) — ARCHITECTURE §5.5 · `apps/realtime` · Verifikasi: int test rename page → read model ter-update
- [ ] **T1.12.8** `redis-bus` extension (update server-side `doc-ext:<docId>`) — ARCHITECTURE §5.5 · `apps/realtime` · Verifikasi: int test update dari publisher diterima klien
- [ ] **T1.12.9** `internal-http` `GET /internal/documents/:id/state` + health — ARCHITECTURE §5.5 · `apps/realtime` · Verifikasi: int test in-memory vs DB

#### Epic 1.13 — `apps/worker` skeleton

- [ ] **T1.13.1** Bootstrap worker: registrasi processor, `WORKER_QUEUES`, health server :4200, graceful shutdown, Bull Board dev — ARCHITECTURE §5.4 · `apps/worker` · Verifikasi: `localhost:4200/queues` tampil
- [ ] **T1.13.2** Processor `email` (React Email + SMTP Mailpit lokal / Resend prod) dengan retry 5 / exp 30 s — ARCHITECTURE §5.4, ACC-271 · `apps/worker/src/processors/email.ts` · Verifikasi: int test job → email tertangkap Mailpit
- [ ] **T1.13.3** Dead-letter handler (simpan payload + error, alert Sentry) — ARCHITECTURE §5.4 · `apps/worker` · Verifikasi: int test job gagal final masuk DLQ
- [ ] **T1.13.4** Processor `cleanup` kerangka (compaction dokumen dijadwalkan; implementasi retensi di M4) — ARCHITECTURE §7.4 · `apps/worker` · Verifikasi: repeatable job terdaftar

#### Epic 1.14 — `apps/web` (Next.js): auth UI & dashboard

- [ ] **T1.14.1** Scaffold Next.js App Router, route groups `(marketing)`, `(auth)`, `(dashboard)`, `(admin)` kosong; rewrites `/api` → api, `/editor` → Vite dev — ARCHITECTURE §5.1, §3.4 · `apps/web` · Verifikasi: `app.localhost:3000/editor/x` menampilkan editor Vite
- [ ] **T1.14.2** `middleware.ts`: host routing (apex vs `app.`), auth gate, locale, `x-request-id` — ARCHITECTURE §5.1 · `apps/web/src/middleware.ts` · Verifikasi: e2e akses `/sites` tanpa login → redirect `/login`
- [ ] **T1.14.3** Header keamanan platform (CSP, frame-ancestors, HSTS prod) untuk web & editor — PUB-211 · `apps/web/next.config.ts` · Verifikasi: int/e2e cek header
- [ ] **T1.14.4** Halaman auth: register, login, verifikasi email, lupa/reset password (form memanggil Better Auth) — ACC-001, ACC-003, ACC-004, ACC-005 · `apps/web/(auth)` · Verifikasi: e2e alur lengkap
- [ ] **T1.14.5** Layout dashboard (sidebar, workspace switcher placeholder, user menu, bahasa) memakai `@platform/ui` — ACC-050 · `apps/web/(dashboard)` · Verifikasi: e2e render
- [ ] **T1.14.6** Halaman `/sites`: daftar kartu situs (nama, updated, status draft), empty state — ACC-050 · `apps/web/(dashboard)/sites` · Verifikasi: e2e
- [ ] **T1.14.7** Dialog "Buat website" → opsi **Kosong** (template & AI disabled "segera") → buka editor — ACC-051 · `apps/web` · Verifikasi: e2e buat situs → URL editor
- [ ] **T1.14.8** Halaman akun: profil, bahasa & timezone, sesi aktif — ACC-007, ACC-008, ACC-009 · `apps/web/(dashboard)/account` · Verifikasi: e2e ganti bahasa
- [ ] **T1.14.9** Landing marketing placeholder (apex) + halaman 404 — ARCHITECTURE §5.1 · `apps/web/(marketing)` · Verifikasi: manual

#### Epic 1.15 — `packages/ui`, `packages/i18n` & editor shell

- [ ] **T1.15.1** `packages/i18n`: struktur `locales/{id,en}/*.json`, helper `t()`, tipe key, deteksi key hilang — ACC-290 · `packages/i18n` · Verifikasi: unit test key EN hilang → gagal test
- [ ] **T1.15.2** Format angka, mata uang IDR, tanggal (Asia/Jakarta), relatif — ACC-291 · `packages/i18n` · Verifikasi: unit test `formatIDR(1500000)` → `Rp1.500.000`
- [ ] **T1.15.3** Integrasi next-intl di web (cookie `locale` → Accept-Language → default `id`) — ACC-290, ARCHITECTURE §5.1 · `apps/web` · Verifikasi: e2e header EN
- [ ] **T1.15.4** `packages/ui`: shadcn/ui + Radix + Tailwind preset, token UI platform, light/dark chrome editor — ED-012 · `packages/ui` · Verifikasi: Storybook (opsional) atau halaman katalog dev
- [ ] **T1.15.5** Editor bootstrap: router `/editor/:siteId[?page=]`, providers (QueryClient, i18n, theme), error boundary app — ARCHITECTURE §5.2 · `apps/editor/src/app` · Verifikasi: e2e buka editor situs milik sendiri; situs orang lain → halaman 404
- [ ] **T1.15.6** UI editor dwibahasa ID/EN (semua string via i18n) — ED-221 · `apps/editor/src/i18n` · Verifikasi: lint/grep tidak ada string literal di JSX (rule kustom)
- [ ] **T1.15.7** Lifecycle Y.Doc: `IndexeddbPersistence` dulu → token → `HocuspocusProvider`; typed accessors `useNode(id)`/`useChildren(id)` — ARCHITECTURE §5.2, §7.3, ED-018 · `apps/editor/src/document`, `src/collaboration` · Verifikasi: e2e reload menampilkan state terakhir
- [ ] **T1.15.8** Render canvas memakai `@platform/renderer` mode editor + pan/zoom/select/drag/resize dari M0 (dipindah ke struktur final) — ED-017, ED-018 · `apps/editor/src/canvas` · Verifikasi: e2e regresi M0
- [ ] **T1.15.9** Sinkronisasi seleksi (canvas ↔ panel ↔ store; ID hilang dibersihkan) — ED-061 · `apps/editor/src/store` · Verifikasi: unit test node dihapus → keluar dari seleksi
- [ ] **T1.15.10** Undo/redo dengan `Y.UndoManager` (tracked origin `local`, seleksi dipulihkan) — ED-197, ED-198 · `apps/editor/src/document` · Verifikasi: e2e undo setelah reload tidak membatalkan perubahan sebelum reload
- [ ] **T1.15.11** Indikator autosave "Tersimpan / Menyimpan… / Offline" — ED-200 · `apps/editor` · Verifikasi: e2e matikan realtime → status Offline; hidupkan → Tersimpan
- [ ] **T1.15.12** Offline dasar & crash recovery dari IndexedDB (banner, sinkron saat online) — ED-201, ED-227 · `apps/editor/src/collaboration` · Verifikasi: e2e edit offline → reload → online → server menerima
- [ ] **T1.15.13** Error boundary per node & per panel (node rusak tampil placeholder) — ED-228 · `apps/editor` · Verifikasi: unit test node invalid tidak menjatuhkan canvas
- [ ] **T1.15.14** Error jaringan & sinkronisasi (retry, pesan, takeover lock) — ED-229 · `apps/editor` · Verifikasi: e2e tab kedua → dialog takeover
- [ ] **T1.15.15** Migrasi skema & dokumen invalid di klien (paksa reload bila schema lebih baru) — ED-230 · `apps/editor` · Verifikasi: e2e dokumen schemaVersion+1 → reload dipaksa
- [ ] **T1.15.16** Telemetri & pelaporan error editor (Sentry, tag siteId/requestId, PII minimal) — ED-231 · `apps/editor` · Verifikasi: error dipicu muncul di Sentry dev
- [ ] **T1.15.17** Fixture, `data-testid`, dan test API `window.__editorTest` (dev only) — ED-242 · `apps/editor` · Verifikasi: e2e memakai test API untuk setup cepat
- [ ] **T1.15.18** Tombol dev "tambah frame/teks/gambar" sementara (sampai toolbar M2) untuk uji alur end-to-end — ED-037 · `apps/editor` · Verifikasi: e2e tambah node → reload → tetap ada

#### Epic 1.16 — CI & observability dasar

- [ ] **T1.16.1** `ci.yml`: pnpm cache → `turbo run lint lint:deps typecheck test --affected` → integration (service postgres+redis+minio) → build → migration check — ARCHITECTURE §16.1 · `.github/workflows` · Verifikasi: PR contoh hijau; pelanggaran lint:deps merah
- [ ] **T1.16.2** `e2e.yml` (push main + nightly): compose + seed + Playwright, artefak trace — ARCHITECTURE §16.1 · `.github/workflows` · Verifikasi: run nightly hijau
- [ ] **T1.16.3** Sentry di web, editor, api, worker, realtime (release = SHA) — ARCHITECTURE §13 · semua app · Verifikasi: error contoh per app terlihat
- [ ] **T1.16.4** Playwright setup: global setup (seed user, login state), helper `*.localhost` — ARCHITECTURE §14 · `e2e/` · Verifikasi: 1 smoke e2e lulus lokal & CI
- [ ] **T1.16.5** `security.yml` mingguan (`pnpm audit`) — ARCHITECTURE §16.1 · `.github/workflows` · Verifikasi: workflow dapat dipicu manual

### M1.d Exit criteria / demo

- [ ] Demo end-to-end: clone bersih → `pnpm install && pnpm infra:up && pnpm db:migrate && pnpm db:seed && pnpm dev` → register user baru (verifikasi via Mailpit) → buat situs kosong → editor terbuka → tambah frame & teks (tombol dev) → drag/resize → undo → tutup tab → buka lagi → perubahan ada.
- [ ] Offline: matikan realtime, edit, nyalakan, perubahan tersinkron tanpa kehilangan.
- [ ] Tab kedua menampilkan dialog takeover (single-editor lock).
- [ ] `pnpm typecheck && pnpm lint && pnpm lint:deps && pnpm test && pnpm test:integration && pnpm test:e2e` hijau di CI.
- [ ] Coverage `document-model` ≥ 90%, `renderer` ≥ 80% (ARCHITECTURE §14).
- [ ] Suite isolasi tenant dijalankan untuk semua endpoint data yang ada.
- [ ] UI web & editor dapat diganti ke EN tanpa string Indonesia tersisa.

### M1.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Schema document-model v1 salah → migrasi mahal (PRD R3) | Task ⚑ wajib review owner; fixture lengkap; `schemaVersion` + migrasi sejak hari pertama |
| Better Auth tidak cocok (nama tabel, Express 5) | Spike kecil di T1.5.1; bila gagal, putuskan ulang 08 OPEN #1 sebelum lanjut |
| Hocuspocus persistence custom rumit | Ikuti ARCHITECTURE §7 persis; integration test berbasis seq; jangan optimasi dulu |
| Fondasi terlalu lama (over-engineering) | Hanya task di epic ini; P1 (RLS, OpenAPI) jangan disentuh |
| WSL2 + `*.localhost` + cookie lintas port | Ikuti ARCHITECTURE §3.3/§15.1; catat solusi di README |

---

## M2 — Editor inti

### M2.a Tujuan & ruang lingkup

Menghadirkan **fitur Figma P0** di Design mode sehingga owner bisa membuat landing page lengkap dari kanvas kosong. Acuan utama: [spec 02 §36.2](./specs/02-editor.md#362-requirement-per-fase-berdasarkan-fase--prioritas-utama-pada-baris-prioritas) baris M2 (P0 dan P1).

Termasuk: chrome editor (toolbar, sidebar, inspector, bottom bar), navigasi, pages & breakpoint frames, semua tool P0, selection lengkap, transformasi, snapping & pengukuran, auto-layout penuh, constraints, properti visual, typography & rich text, layers panel, assets (upload, media library, ikon), preview device, link, clipboard, shortcuts & command palette, context menu, preview interaktif, aksesibilitas dasar, semantic HTML, performa 2.000 node, e2e & visual regression. Juga requirement DM berfase M2 (group, icon, shape, effects, transform, grid P1, interaction states P0, command lock/permission).

**Tidak termasuk**: component/instance/variants (M3), panel token lengkap & text styles (M4), edit per breakpoint/override manual (M4), Simple mode (M4), publish (M4), prototype interaksi lanjutan (P1 M4), rotate/flip (P1 M4), pen/vector, boolean, mask (P2 M9), komentar & multiplayer (M9).

### M2.b Prasyarat

- M1 selesai (exit criteria tercentang).
- Keputusan OPEN yang harus diputuskan sebelum/selama awal M2:
  - 02 OPEN #4 — urutan layer panel: ✅ diputuskan 2026-10-13 (Figma order, tampilan saja); Epic 2.13 mengikuti ED-090.
  - Group: node type `group` (DM-012, sudah diputuskan) — dipakai di T2.13.9.
  - 02 OPEN #3 — preview width custom disimpan per user (rekomendasi UI state) — **sebelum T2.15.2**.
  - 02 OPEN #10 — shortcut layout grid Windows vs Mac — non-pemblokir (layout grid P1 M4).
  - 03 OPEN O-4 / OPEN-DM-2 — ikon merek (WA/IG/TikTok) — **sebelum T2.12.5** (boleh Lucide saja dulu).
  - 02 OPEN #7 — stock image — tidak memblokir (P1 M4).

### M2.c Epic & task

#### Epic 2.1 — Chrome editor & layout UI

- [ ] **T2.1.1** Toolbar atas: menu, tool group, nama situs/page, undo/redo, device switcher, zoom, Preview, Publish (disabled), mode toggle (disabled) — ED-006 · `apps/editor/src/app/chrome` · Verifikasi: e2e semua tombol punya `aria-label` & tooltip shortcut
- [ ] **T2.1.2** Left sidebar dengan tab Layers / Pages / Assets / Insert (placeholder) yang bisa diciutkan — ED-007 · `apps/editor/src/panels` · Verifikasi: e2e pindah tab, state tersimpan per user
- [ ] **T2.1.3** Right sidebar (Inspector) kerangka: tab Design & Settings; section collapsible; multi-seleksi menampilkan nilai "Mixed" — ED-008 · `apps/editor/src/panels/properties` · Verifikasi: unit test util nilai campuran
- [ ] **T2.1.4** Bottom bar & zoom control (persentase, preset, fit) — ED-009 · `apps/editor/src/app/chrome` · Verifikasi: e2e pilih 200% → world scale 2
- [ ] **T2.1.5** Komponen input inspector bersama: number input dengan scrub (drag label), unit, ekspresi matematika (`100/3`, `+=10`) — ED-070 · `apps/editor/src/panels/properties/inputs` · Verifikasi: unit test parser ekspresi (aman, tanpa eval)
- [ ] **T2.1.6** Store UI Zustand (selection, tool, viewport, ui, breakpoint, clipboard) final + persist preferensi per user — ARCHITECTURE §5.2 · `apps/editor/src/store` · Verifikasi: unit test slice; dokumen tidak pernah di Zustand

#### Epic 2.2 — Navigasi canvas

- [ ] **T2.2.1** Zoom to fit (`Shift+1`), zoom to selection (`Shift+2`), 100% (`Mod+0`), zoom in/out bertahap — ED-028 · `apps/editor/src/canvas` · Verifikasi: unit test perhitungan fit; e2e shortcut
- [ ] **T2.2.2** (P1) Rulers dengan marker seleksi — ED-029 · `apps/editor/src/canvas/overlay` · Verifikasi: e2e screenshot ruler
- [ ] **T2.2.3** (P1) Navigasi keyboard antar node & pencarian node — ED-031 · `apps/editor/src/commands` · Verifikasi: e2e Tab/Shift+Tab memilih sibling
- [ ] **T2.2.4** (P1) Virtualisasi & culling node di luar viewport — ED-021 · `apps/editor/src/canvas` · Verifikasi: benchmark 2.000 node pan ≥ 60 fps

#### Epic 2.3 — Pages & breakpoint frames

- [ ] **T2.3.1** Pages panel: daftar, tambah, rename, duplikat, hapus (home dilindungi), reorder drag, set home — ED-032 · `apps/editor/src/panels/pages` · Verifikasi: e2e CRUD page; undo bekerja
- [ ] **T2.3.2** Page settings dasar: title, path (validasi unik & slug), dasar SEO (title/description) — ED-033 · `apps/editor/src/panels/pages` · Verifikasi: unit test validasi path; e2e
- [ ] **T2.3.3** Breakpoint frames di canvas: desktop/tablet/mobile berdampingan, label, lebar dari `settings.breakpoints` (render sesuai ADR M0) — ED-034 · `apps/editor/src/canvas` · Verifikasi: e2e 3 frame tampil; edit di desktop tercermin di semua
- [ ] **T2.3.4** Page root & section ordering (section = anak langsung page; naik/turun) — ED-036 · `apps/editor` · Verifikasi: e2e reorder section via keyboard
- [ ] **T2.3.5** Switch page cepat (< 500 ms untuk 1.000 node) dengan code splitting render — ED-022, ED-226 · `apps/editor` · Verifikasi: benchmark switch page

#### Epic 2.4 — Tools pembuat node

- [ ] **T2.4.1** Frame tool (`F`/`A`): drag membuat frame, klik = preset; daftar preset device — ED-039 · `apps/editor/src/tools/frame` · Verifikasi: e2e buat frame 300×200 di posisi kursor
- [ ] **T2.4.2** Section tool (`S`): section full-width di page dengan auto-layout default — ED-040 · `apps/editor/src/tools/section` · Verifikasi: e2e section tersisip di index benar
- [ ] **T2.4.3** Rectangle tool (`R`) & Shift = persegi; node `shape` — ED-041, DM-016 · `apps/editor/src/tools` · Verifikasi: unit test geometri constrain; e2e
- [ ] **T2.4.4** Ellipse tool (`O`) — ED-042, DM-016 · `apps/editor/src/tools` · Verifikasi: e2e; render `border-radius:50%`
- [ ] **T2.4.5** (P1) Line tool (`L`) — ED-043 · `apps/editor/src/tools` · Verifikasi: e2e
- [ ] **T2.4.6** Text tool (`T`): klik = auto-width, drag = fixed width; langsung masuk edit — ED-044 · `apps/editor/src/tools/text` · Verifikasi: e2e ketik teks → tersimpan
- [ ] **T2.4.7** Image tool: pilih file → sisipkan image node dengan ukuran natural ter-clamp — ED-045 · `apps/editor/src/tools/image` · Verifikasi: e2e upload → image tampil
- [ ] **T2.4.8** Icon tool: picker Lucide (search) → node `icon` — ED-046, DM-015 · `apps/editor/src/tools/icon` · Verifikasi: e2e cari "phone" → sisip
- [ ] **T2.4.9** Element dasar web: Button (frame role button + teks), Link, Divider, Embed video (YouTube/Vimeo allowlist) — ED-050 · `apps/editor/src/tools` · Verifikasi: e2e sisip tiap elemen; render tag semantik benar
- [ ] **T2.4.10** Tool state & shortcut huruf tunggal, kembali ke Move setelah membuat (kecuali dikunci) — ED-037 · `apps/editor/src/tools` · Verifikasi: unit test state machine

#### Epic 2.5 — Selection

- [ ] **T2.5.1** Multi-select Shift+klik (toggle) & bounding gabungan — ED-052 · `apps/editor/src/tools/select` · Verifikasi: e2e
- [ ] **T2.5.2** Deep select `Mod+klik` (langsung ke node terdalam) — ED-054 · `apps/editor/src/tools/select` · Verifikasi: e2e
- [ ] **T2.5.3** Select parent (`Shift+Enter`), child (`Enter`), sibling (Tab) — ED-055 · `apps/editor/src/commands` · Verifikasi: e2e
- [ ] **T2.5.4** Select all (`Mod+A`) dalam konteks parent — ED-056 · `apps/editor/src/commands` · Verifikasi: e2e
- [ ] **T2.5.5** Lock & hide (`Mod+Shift+L`, `Mod+Shift+H`): locked tidak bisa diklik di canvas tapi bisa di layers — ED-059 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.5.6** Command lock/permission di document-model (command menolak node locked kecuali `force`) — DM-075 · `packages/document-model/src/ops` · Verifikasi: unit test

#### Epic 2.6 — Transformasi

- [ ] **T2.6.1** Move di dalam auto-layout final: reorder & reparent dengan indikator, `keepVisualPosition` saat keluar ke absolute — ED-063 · `apps/editor/src/canvas/interactions` · Verifikasi: unit test index; e2e reparent antar frame
- [ ] **T2.6.2** Nudge panah (1px) & Shift+panah (10px); di auto-layout = reorder — ED-064 · `apps/editor/src/commands` · Verifikasi: e2e
- [ ] **T2.6.3** Modifier resize: Shift (aspect), Alt (dari tengah), kombinasi — ED-066 · `apps/editor/src/canvas/interactions` · Verifikasi: unit test geometri resize + Playwright drag handle
- [ ] **T2.6.4** Resize mengubah mode sizing (hug → fixed saat di-drag) sesuai aturan — ED-065, ED-084 · `apps/editor` · Verifikasi: unit test
- [ ] **T2.6.5** (P1) Resize multi-seleksi proporsional — ED-067 · `apps/editor` · Verifikasi: unit test
- [ ] **T2.6.6** Panel posisi & ukuran (X, Y, W, H) dengan ekspresi — ED-070 · `apps/editor/src/panels/properties` · Verifikasi: e2e ketik `W=100*2` → 200
- [ ] **T2.6.7** Duplikat dengan Alt+drag — ED-071 · `apps/editor` · Verifikasi: e2e; undo = 1 langkah
- [ ] **T2.6.8** Align (6 arah) & distribute (H/V) untuk multi-seleksi — ED-072 · `apps/editor/src/commands` · Verifikasi: unit test geometri align/distribute
- [ ] **T2.6.9** Transform model (rotate/flip disiapkan di dokumen; UI P1 M4) — DM-033 · `packages/document-model`, `packages/renderer` · Verifikasi: unit test render transform

#### Epic 2.7 — Snapping & pengukuran

- [ ] **T2.7.1** Smart guides: snap ke tepi/tengah node sibling & parent, garis guide merah — ED-073 · `apps/editor/src/canvas/snapping` · Verifikasi: unit test algoritma snap (threshold dalam screen px)
- [ ] **T2.7.2** Snap ke pixel grid (bilangan bulat) — ED-074 · `apps/editor/src/canvas/snapping` · Verifikasi: unit test
- [ ] **T2.7.3** Pengukuran jarak Alt+hover (ke parent/sibling) — ED-076 · `apps/editor/src/canvas/overlay` · Verifikasi: e2e screenshot label jarak
- [ ] **T2.7.4** (P1) Equal spacing indicators — ED-077 · `apps/editor/src/canvas/snapping` · Verifikasi: unit test

#### Epic 2.8 — Auto-layout

- [ ] **T2.8.1** Add/remove auto-layout (`Shift+A`): bungkus seleksi atau ubah frame; inferensi direction & gap dari posisi — ED-079 · `apps/editor/src/commands` · Verifikasi: unit test inferensi; e2e
- [ ] **T2.8.2** Direction (row/column) & wrap — ED-080 · `apps/editor/src/panels/properties/auto-layout` · Verifikasi: e2e
- [ ] **T2.8.3** Gap (angka, auto/space-between) termasuk drag gap di canvas — ED-081 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.8.4** Padding (seragam, H/V, per sisi) termasuk drag padding di canvas — ED-082 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.8.5** Alignment 9-titik — ED-083 · `apps/editor/src/panels/properties/auto-layout` · Verifikasi: e2e klik grid → align/justify benar
- [ ] **T2.8.6** Sizing per child Fixed / Hug / Fill — ED-084 · `apps/editor` · Verifikasi: e2e; render flex benar
- [ ] **T2.8.7** Min/max width & height — ED-085 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.8.8** Nested auto-layout & kemudahan (wrap seleksi dalam auto-layout baru) — ED-086 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.8.9** Panel UI auto-layout lengkap (sesuai mockup spec) — ED-087 · `apps/editor/src/panels/properties/auto-layout` · Verifikasi: e2e screenshot panel
- [ ] **T2.8.10** Absolute position di dalam auto-layout (ignore layout) — ED-088 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.8.11** Reorder via drag & keyboard di auto-layout (ringkas) — ED-090 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.8.12** Bring forward / send backward (z-index eksplisit untuk absolute) — ED-091 · `apps/editor/src/commands` · Verifikasi: unit test
- [ ] **T2.8.13** (P1) Visual helper auto-layout di canvas (garis padding/gap saat hover) — ED-096 · `apps/editor/src/canvas/overlay` · Verifikasi: e2e screenshot
- [ ] **T2.8.14** (P1) Grid layout di document-model & renderer (dasar, tanpa UI lengkap) — DM-011, DM-026 · `packages/document-model`, `packages/renderer` · Verifikasi: unit test render grid

#### Epic 2.9 — Constraints

- [ ] **T2.9.1** Constraints horizontal & vertikal (left/right/both/center/scale) untuk anak frame non-auto-layout — ED-098 · `apps/editor`, `packages/renderer` · Verifikasi: unit test CSS hasil; e2e resize parent
- [ ] **T2.9.2** Default constraints & anjuran auto-layout (hint di panel) — ED-099 · `apps/editor` · Verifikasi: e2e hint muncul

#### Epic 2.10 — Properti visual

- [ ] **T2.10.1** Color picker (react-colorful, HEX/RGB/HSL, alpha, eyedropper bila didukung, swatch dokumen) — ED-102 · `apps/editor/src/panels/properties/color` · Verifikasi: unit test konversi warna; e2e
- [ ] **T2.10.2** Fill solid (tambah/hapus/toggle) — ED-102, DM-029 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.10.3** Image fill (cover/contain/tile, focal point) — ED-104 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.10.4** (P1) Gradient fill di document-model & renderer (UI linear di M4) — DM-029 · `packages/document-model`, `packages/renderer` · Verifikasi: unit test CSS gradient
- [ ] **T2.10.5** Stroke (warna, tebal, posisi inside/center/outside, per sisi, dash) — ED-106, DM-030 · `apps/editor`, `packages/renderer` · Verifikasi: unit test CSS outline/box-shadow
- [ ] **T2.10.6** Corner radius (seragam & per sudut) — ED-107 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.10.7** Effects: drop shadow & inner shadow (multi) — ED-108, DM-031 · `apps/editor`, `packages/renderer` · Verifikasi: unit test CSS
- [ ] **T2.10.8** Opacity layer — ED-110, DM-031 · `apps/editor` · Verifikasi: e2e; shortcut angka 1–0
- [ ] **T2.10.9** Overflow / clip content — ED-112 · `apps/editor`, `packages/renderer` · Verifikasi: unit test
- [ ] **T2.10.10** Interaction states hover & pressed sebagai style variant di dokumen + renderer CSS `:hover`/`:active` — DM-040 · `packages/document-model`, `packages/renderer` · Verifikasi: snapshot CSS

#### Epic 2.11 — Typography & rich text

- [ ] **T2.11.1** Inline text editing dengan Tiptap (masuk/keluar edit, Esc, klik luar), commit satu transaksi — ED-115 · `apps/editor/src/canvas/text` · Verifikasi: e2e ketik → undo 1 langkah per sesi edit
- [ ] **T2.11.2** Font family picker (Google Fonts list, search, preview, lazy load) + `addFont` ke theme — ED-116 · `apps/editor/src/panels/properties/typography` · Verifikasi: e2e ganti font → canvas berubah
- [ ] **T2.11.3** Weight, size, line height, letter spacing — ED-117 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.11.4** Alignment horizontal & vertikal — ED-119 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.11.5** Decoration (underline, strike), case (upper/lower/title), italic — ED-120 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.11.6** List bullet & numbered — ED-121 · `apps/editor`, `packages/renderer` · Verifikasi: snapshot HTML `<ul>/<ol>`
- [ ] **T2.11.7** Link pada teks (LinkValue: URL, page, anchor, email, phone, WhatsApp) — ED-122, DM-056 · `apps/editor` · Verifikasi: e2e; sanitasi URL
- [ ] **T2.11.8** Text auto-resize (auto width, auto height, fixed) — ED-123 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.11.9** Rich text per range (marks per seleksi teks: warna, weight, size) — ED-125 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.11.10** Token warna & typography dasar dapat dipilih di input (subset M2 dari ED-129) — ED-129, DM-041 · `apps/editor` · Verifikasi: e2e pilih `color.primary` → ref `$token` tersimpan

#### Epic 2.12 — Assets & media

- [ ] **T2.12.1** API upload: presigned URL ke MinIO/R2, validasi mime/size, record `assets` status `pending` — ED-160, ARCHITECTURE §9.9 · `apps/api/src/modules/assets` · Verifikasi: int test + isolasi tenant
- [ ] **T2.12.2** Processor `image-processing` (sharp: WebP/AVIF varian, blurhash, strip EXIF, dimensi) → status `ready` — ED-160, ARCHITECTURE §5.4 · `apps/worker` · Verifikasi: int test file JPEG → varian di MinIO
- [ ] **T2.12.3** Upload di editor: drag-drop ke canvas, paste dari clipboard, dari URL (lewat SSRF guard) — ED-160, ARCHITECTURE §9.8 · `apps/editor/src/services/upload` · Verifikasi: e2e drag file → image node
- [ ] **T2.12.4** Media library per website (grid, search, hapus, info, pakai ulang) — ED-161 · `apps/editor/src/panels/assets` · Verifikasi: e2e
- [ ] **T2.12.5** Ikon Lucide di panel Assets (search, kategori) — ED-163 · `apps/editor/src/panels/assets` · Verifikasi: e2e
- [ ] **T2.12.6** Replace & edit gambar (ganti file, fit, focal point, alt) — ED-165 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.12.7** Lazy load font & gambar di editor (placeholder blurhash) — ED-224 · `apps/editor` · Verifikasi: e2e network idle lebih cepat pada fixture berat

#### Epic 2.13 — Layers panel

- [ ] **T2.13.1** Tree layers dengan react-arborist (virtualized), urutan sesuai keputusan OPEN 02#4 — ED-136 · `apps/editor/src/panels/layers` · Verifikasi: e2e 2.000 node scroll lancar
- [ ] **T2.13.2** Rename layer (double-click, F2) — ED-137 · `apps/editor/src/panels/layers` · Verifikasi: e2e
- [ ] **T2.13.3** Drag reorder & reparent di layers (validasi nesting tag) — ED-138 · `apps/editor/src/panels/layers` · Verifikasi: e2e
- [ ] **T2.13.4** Toggle visibility & lock di baris layer — ED-139 · `apps/editor/src/panels/layers` · Verifikasi: e2e
- [ ] **T2.13.5** Collapse & expand (Alt+klik = rekursif), auto-expand ke seleksi — ED-140 · `apps/editor/src/panels/layers` · Verifikasi: e2e
- [ ] **T2.13.6** Ikon per tipe node — ED-141 · `apps/editor/src/panels/layers` · Verifikasi: snapshot
- [ ] **T2.13.7** Multi-select & keyboard di layers (Shift range, Mod toggle, panah) — ED-143 · `apps/editor/src/panels/layers` · Verifikasi: e2e
- [ ] **T2.13.8** Frame selection / wrap in frame (`Mod+Alt+G`) — ED-146 · `apps/editor/src/commands` · Verifikasi: unit test command `wrapInFrame`
- [ ] **T2.13.9** (P1) Group & ungroup (sesuai keputusan OPEN 02#6) + node `group` — ED-144, ED-145, DM-012 · `apps/editor`, `packages/document-model` · Verifikasi: unit test; e2e `Mod+G`
- [ ] **T2.13.10** (P1) Search & filter layers — ED-142 · `apps/editor/src/panels/layers` · Verifikasi: e2e

#### Epic 2.14 — Clipboard

- [ ] **T2.14.1** Copy, cut, paste (format internal + HTML/teks plain), paste ke parent terpilih — ED-190 · `apps/editor/src/commands/clipboard` · Verifikasi: e2e copy-paste 3 node; ID baru
- [ ] **T2.14.2** Paste in place (`Mod+Shift+V`) — ED-191 · `apps/editor` · Verifikasi: e2e posisi sama
- [ ] **T2.14.3** Duplicate (`Mod+D`) dengan offset/urutan — ED-193 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.14.4** Paste gambar & teks dari luar (gambar → upload; teks → text node) — ED-190, ED-160 · `apps/editor` · Verifikasi: e2e paste teks

#### Epic 2.15 — Responsif dasar & preview

- [ ] **T2.15.1** Breakpoint switcher (preview: desktop/tablet/mobile) — ED-173 · `apps/editor/src/app/chrome` · Verifikasi: e2e
- [ ] **T2.15.2** Preview device & custom width (disimpan per OPEN 02#3) — ED-174 · `apps/editor` · Verifikasi: e2e lebar 1024
- [ ] **T2.15.3** Preview mode di dalam editor (tanpa chrome, interaktif) — ED-004, ED-207 · `apps/editor` · Verifikasi: e2e link antar page bekerja di preview
- [ ] **T2.15.4** Link navigasi pada node (page, URL, anchor, WA) + interaksi `navigate`/`scrollTo` di dokumen — ED-181, DM-055 · `apps/editor`, `packages/renderer` · Verifikasi: e2e klik di preview pindah page

#### Epic 2.16 — Shortcuts, command palette, context menu

- [ ] **T2.16.1** Sistem shortcut (tinykeys, scope canvas/teks/input, Mac/Windows) & registry command — ED-202 · `apps/editor/src/commands` · Verifikasi: unit test konflik shortcut terdeteksi
- [ ] **T2.16.2** Implementasi baris P0 tabel shortcut fase M2 — ED-203 · `apps/editor/src/commands` · Verifikasi: e2e tabel shortcut (data-driven)
- [ ] **T2.16.3** Command palette (`Mod+K`/`Mod+/`): cari command & layer — ED-204 · `apps/editor/src/commands/palette` · Verifikasi: e2e
- [ ] **T2.16.4** Context menu klik kanan (canvas & layers) sesuai seleksi — ED-206 · `apps/editor/src/commands` · Verifikasi: e2e

#### Epic 2.17 — Aksesibilitas output & semantic HTML

- [ ] **T2.17.1** Alt text gambar (field + peringatan jika kosong) — ED-210 · `apps/editor` · Verifikasi: e2e
- [ ] **T2.17.2** Heading level & struktur (outline h1–h6, peringatan h1 ganda) — ED-211 · `apps/editor` · Verifikasi: unit test analyzer
- [ ] **T2.17.3** Pengaturan tag per node (section, header, nav, main, footer, article, ul/li, button, a) — ED-218 · `apps/editor/src/panels/properties` · Verifikasi: e2e; snapshot HTML
- [ ] **T2.17.4** Validasi nesting tag (a dalam a, button dalam a, li tanpa ul) — ED-219, DM-009 · `packages/document-model`, `apps/editor` · Verifikasi: unit test
- [ ] **T2.17.5** ID & anchor (htmlId unik, slug) — ED-220 · `apps/editor` · Verifikasi: unit test keunikan

#### Epic 2.18 — Performa & batasan

- [ ] **T2.18.1** Batasan dokumen di editor (peringatan mendekati batas, blokir di atas batas) — ED-223, DM-076 · `apps/editor` · Verifikasi: e2e fixture di atas batas
- [ ] **T2.18.2** Loading dokumen besar & code splitting panel — ED-226 · `apps/editor` · Verifikasi: load 500 node < 3 s TTI (cache dingin)
- [ ] **T2.18.3** Optimasi menuju target M2 (2.000 node 60 fps): profiling, memo, culling — ED-022, DM-077 · `apps/editor` · Verifikasi: benchmark §M0.e versi M2 lulus
- [ ] **T2.18.4** (P1) Benchmark performa otomatis di CI nightly (regresi > 20% gagal) — ED-241 · `.github/workflows`, `apps/editor/bench` · Verifikasi: job nightly hijau

#### Epic 2.19 — Testing editor

- [ ] **T2.19.1** Suite Playwright interaksi utama (select, drag, resize, auto-layout, teks, layers, clipboard, undo) — ED-239 · `e2e/editor` · Verifikasi: ≥ 15 skenario lulus CI
- [ ] **T2.19.2** Visual regression WYSIWYG: renderer editor vs static untuk 10 fixture × 3 breakpoint (Docker untuk font konsisten) — ED-240 · `e2e/visual` · Verifikasi: baseline dibuat; diff 0
- [ ] **T2.19.3** Dogfooding: owner membuat 2 landing page dari nol; catat bug sebagai task baru — §M2.d · manual · Verifikasi: daftar bug masuk roadmap

#### Epic 2.20 — Sisa M2 & penutup

- [ ] **T2.20.1** Settings tab inspector (nama, tag, htmlId, visibility, lock) — ED-008, ED-218 · `apps/editor/src/panels/properties` · Verifikasi: e2e
- [ ] **T2.20.2** Status bar & feedback (toast error command, pesan invalid) — ED-228 · `apps/editor` · Verifikasi: e2e command ditolak → toast
- [ ] **T2.20.3** Review spec 02 baris M2 §36.2: centang semua ED P0 M2 terpetakan; catat gap sebagai task — §36.2 spec 02 · docs · Verifikasi: tidak ada ED P0 M2 tanpa task

### M2.d Exit criteria / demo

- [ ] Demo: dari kanvas kosong owner membangun landing page (navbar, hero 2 kolom, 3 fitur, testimoni, CTA, footer) **hanya dengan editor**, responsif otomatis terlihat benar di 3 breakpoint, dalam < 45 menit.
- [ ] Semua ED P0 baris M2 di spec 02 §36.2 tercentang (T2.20.3).
- [ ] Target performa M2 (ED-022) lulus: 60 fps pan/drag @ 2.000 node; load 500 node < 3 s; switch page 1.000 node < 500 ms.
- [ ] Visual regression editor vs static = identik (ED-240).
- [ ] ≥ 15 skenario Playwright editor hijau di CI.
- [ ] Tidak ada bug P0 terbuka dari dogfooding.

### M2.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Jumlah fitur besar → kelelahan & kualitas turun | Task kecil, e2e per epic, dogfooding di akhir setiap 3 epic |
| Tiptap + undo Yjs bentrok (grouping) | Satu sesi edit = satu transaksi commit (keputusan T0.8.5); test khusus |
| Performa turun seiring fitur | Benchmark nightly (T2.18.4) sejak awal epic 2.8 |
| Auto-layout drag/reorder kompleks | Geometri murni + unit test sebelum UI |
| Upload & image processing menambah infra | Pakai MinIO lokal; queue `image-processing` sederhana dulu |

---

## M3 — Sistem component & mode admin

### M3.a Tujuan & ruang lingkup

Membangun **sistem component berversi** (definisi immutable per versi, instance `componentId@version` + `propValues` + `overrides`, variants, slots, detach) beserta **Mode Admin** di editor untuk memproduksi library, lalu **memproduksi library seed** (target P0 dari [CMP-093](./specs/03-components-templates.md#cmp-093-ringkasan-jumlah-target)) yang akan dipakai template M4.

Termasuk: DM component (DM-018, DM-019, DM-045–DM-051, DM-044 preset), ED M3 (ED-003, ED-058, ED-150–ED-156, ED-158, ED-167 dasar, ED-170, ED-183; P1 ED-157), CMP M3 ([03 §21](./specs/03-components-templates.md#21-traceability-per-fase) baris M3), tabel & endpoint admin library, thumbnail Playwright, theme preset di Mode Admin, konten library dwibahasa (ACC-292), manajemen library dasar di admin (ACC-208 bagian M3), dan **opsional** fondasi agent AI khusus admin ([04 §14](./specs/04-ai-agent.md#14-fase--urutan-implementasi) baris M3) untuk mempercepat produksi library.

**Tidak termasuk**: notifikasi update & preview diff untuk user (M4), Simple mode (M4), insert panel lengkap dengan search/facet (M4), template (M4), library pribadi user (P2), marketplace (P2), AI untuk user (M6), kredit AI (M6).

### M3.b Prasyarat

- M2 selesai.
- Keputusan OPEN sebelum mulai:
  - OPEN-DM-7 — instance boleh override link/interaction target atau hanya via prop `link` — **sebelum Epic 3.1** (mempengaruhi DM-049).
  - OPEN-DM-11 — dependensi component transitif di `componentDeps` (`transitive: true`) — **sebelum T3.1.6**.
  - 03 O-1 — library dikunci per paket (`min_plan`/`tier`) — **sebelum T3.3.2** (kolom DB).
  - 03 O-2 — nomor versi rollback dari MAJOR — non-pemblokir (CMP-046 P1).
  - 03 O-4 / OPEN-DM-2 — kebijakan ikon merek — **sebelum Epic 3.11 kategori Navigation/Contact**.
  - 03 O-10 / PRD O10 — sumber foto contoh berlisensi komersial — **sebelum Epic 3.11** (CMP-190).
  - 03 O-12 — detach component `hardLocked` — non-pemblokir di M3 (berlaku M7).
  - 04 OPEN #3 (embedding) — hanya bila Epic 3.13 (AI admin) dikerjakan; boleh ditunda.

### M3.c Epic & task

#### Epic 3.1 — Document model: component & instance

- [ ] **T3.1.1** ⚑ Schema `ComponentDefinition` (rootId, nodes, propsSchema, variantAxes, variants, aiHints, requires) — DM-045 · `packages/document-model/src/schema/component.ts` · Verifikasi: fixture `cmp_prodgrid01@2` dari spec 01 §20.2 valid
- [ ] **T3.1.2** Props schema (text, richText, image, link, number, boolean, select, color, list) — DM-046, CMP-020 · `packages/document-model` · Verifikasi: unit test default & validasi
- [ ] **T3.1.3** Binding node ke props `{ $prop }` (+ fallback, eq) — DM-047, CMP-021 · `packages/document-model` · Verifikasi: unit test resolusi
- [ ] **T3.1.4** Variants (axes, `when`, overrides per variant) — DM-048 · `packages/document-model` · Verifikasi: unit test pemilihan variant
- [ ] **T3.1.5** Node `instance` & `slot` + overrides beralamat node path (`a/b/c`) — DM-018, DM-019, DM-049 · `packages/document-model` · Verifikasi: fixture spec 01 §20.1 valid
- [ ] **T3.1.6** Registry `componentDeps` (versi per component; transitif sesuai OPEN-DM-11) + invariant instance ↔ deps — DM-004, DM-045 · `packages/document-model` · Verifikasi: unit test instance tanpa deps → invalid
- [ ] **T3.1.7** Algoritma resolusi instance (definition@version → variant → propValues → overrides → slots) dengan cache per id+versi — DM-051, DM-077 · `packages/document-model/src/resolve` · Verifikasi: unit test + bench resolve 200 instance
- [ ] **T3.1.8** Detach (instance → subtree biasa, ID baru, overrides diterapkan) — DM-050, CMP-057 · `packages/document-model/src/ops` · Verifikasi: unit test hasil identik secara visual (render snapshot sama)
- [ ] **T3.1.9** Command component: `createInstance`, `setProp`, `setVariant`, `setInstanceOverride`, `resetOverride`, `setSlotContent`, `detachInstance`, `updateInstanceVersion` — DM-074 · `packages/document-model/src/ops` · Verifikasi: unit test per command
- [ ] **T3.1.10** Theme preset & aturan ganti tema (`applyThemePreset`, keep groups) — DM-044, CMP-120 · `packages/document-model` · Verifikasi: unit test token user dipertahankan sesuai aturan
- [ ] **T3.1.11** Migrasi `schemaVersion` bila schema v1 berubah oleh epic ini + fixture — DM-071, DM-072 · `packages/document-model/src/migrations` · Verifikasi: unit test migrasi

#### Epic 3.2 — Renderer: instance & states

- [ ] **T3.2.1** Render instance (resolve → render subtree; `data-instance-id` di mode editor) — DM-051, ED-017 · `packages/renderer` · Verifikasi: snapshot editor & static
- [ ] **T3.2.2** Interaction states hover/focus/pressed/disabled dari component → CSS — CMP-032, ED-183, DM-040 · `packages/renderer` · Verifikasi: snapshot CSS `:hover`, `:focus-visible`
- [ ] **T3.2.3** Prop `list` (repeater statis) rendering — CMP-022 · `packages/renderer` · Verifikasi: snapshot 3 item
- [ ] **T3.2.4** Visual regression per component (3 breakpoint) di harness Docker — ARCHITECTURE §14 · `e2e/visual/library` · Verifikasi: baseline per component

#### Epic 3.3 — Database & API library

- [ ] **T3.3.1** Tabel `library_categories` + seed kategori (ID/EN) — CMP-150 · `packages/db/src/schema/library.ts` · Verifikasi: migration + seed
- [ ] **T3.3.2** ⚑ Tabel `components` (key, scope, category, name jsonb, tags, status, latest_version, draft_document_id, is_premium/tier) — CMP-151 · `packages/db` · Verifikasi: migration; unique(scope, workspace_id, key)
- [ ] **T3.3.3** ⚑ Tabel `component_versions` immutable (trigger menolak UPDATE) — CMP-152, CMP-044 · `packages/db` · Verifikasi: int test UPDATE → error
- [ ] **T3.3.4** Tabel `themes` / `theme_versions` — CMP-155 · `packages/db` · Verifikasi: migration
- [ ] **T3.3.5** Tabel `site_component_usage` + pencatatan dari projections realtime — CMP-156, CMP-051 · `packages/db`, `apps/realtime` · Verifikasi: int test insert instance → usage tercatat
- [ ] **T3.3.6** (P1) Tabel pendukung lain (review notes, QA results) — CMP-157 · `packages/db` · Verifikasi: migration
- [ ] **T3.3.7** Endpoint admin library: CRUD component draft, publish versi, deprecate, archive, metadata — CMP-159 · `apps/api/src/modules/library` · Verifikasi: int test role non-admin → 404
- [ ] **T3.3.8** Endpoint baca untuk editor (GET definisi `componentId@version`, cache immutable) — CMP-158 (subset), CMP-050 · `apps/api/src/modules/library` · Verifikasi: int test header cache immutable
- [ ] **T3.3.9** Importer seed lengkap: `pnpm db:seed --library` upsert component/theme dari `@platform/library-seed` sebagai versi — CMP-142 · `packages/db/seed` · Verifikasi: seed 2× idempotent; versi baru hanya bila hash berubah
- [ ] **T3.3.10** Konten library dwibahasa (name/description/default content ID+EN) — ACC-292 · `packages/library-seed`, `packages/db` · Verifikasi: unit test semua item punya ID & EN

#### Epic 3.4 — Mode Admin di editor

- [ ] **T3.4.1** Akses Mode Admin: role `platform_admin` + 2FA, dokumen `kind=component` — CMP-010, ED-003 · `apps/editor`, `apps/api` · Verifikasi: e2e user biasa tidak melihat Mode Admin
- [ ] **T3.4.2** Create component dari seleksi (subtree → definisi draft, Y.Doc sendiri) — CMP-011, ED-150 · `apps/editor/src/panels/components` · Verifikasi: e2e
- [ ] **T3.4.3** Panel Component (Mode Admin): daftar props, variants, slots, metadata, status — CMP-012 · `apps/editor/src/panels/components` · Verifikasi: e2e
- [ ] **T3.4.4** Metadata: kategori, tag, deskripsi, keywords (ID/EN) — CMP-013 · `apps/editor` · Verifikasi: e2e simpan metadata
- [ ] **T3.4.5** Definisikan props & binding prop → node (pilih node → "Jadikan prop") — CMP-020, CMP-021 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.4.6** Props `list` (repeater) di Mode Admin — CMP-022 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.4.7** Editable vs locked node (flag per node; Simple mode menghormati) — CMP-024 · `apps/editor`, `packages/document-model` · Verifikasi: unit test
- [ ] **T3.4.8** (P1) Validasi & batas props; prop groups & urutan — CMP-023, CMP-025 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.4.9** Variant properties ala Figma (axes, kombinasi, grid variant di canvas) — CMP-030, ED-152 · `apps/editor` · Verifikasi: e2e buat axis `layout` 3 opsi
- [ ] **T3.4.10** (P1) Varian responsif vs breakpoint (panduan & validasi) — CMP-033 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.4.11** States interaktif di Mode Admin (hover/focus/pressed/disabled) — CMP-032, ED-183 · `apps/editor` · Verifikasi: e2e preview hover
- [ ] **T3.4.12** Slot area (definisi slot & konten default) — CMP-017, DM-019 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.4.13** Default content (teks/gambar contoh dwibahasa) — CMP-016, CMP-190 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.4.14** Aturan desain wajib (design rules linter: token-only warna, auto-layout, alt text, kontras) — CMP-015 · `apps/editor`, `packages/document-model` · Verifikasi: unit test linter
- [ ] **T3.4.15** Edit main component (admin only) dari instance → buka draft — CMP-073 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.4.16** Theme di Mode Admin (edit preset theme) — CMP-124, CMP-120 · `apps/editor/src/panels/theme` · Verifikasi: e2e simpan preset

#### Epic 3.5 — Lifecycle & versioning

- [ ] **T3.5.1** State machine status component (draft → review → published → deprecated → archived) — CMP-040 · `apps/api/src/modules/library` · Verifikasi: unit test transisi terlarang
- [ ] **T3.5.2** Review & checklist QA (form checklist, hasil linter, screenshot 3 breakpoint) — CMP-041, CMP-133 · `apps/editor`, `apps/api` · Verifikasi: e2e publish ditolak bila QA belum lulus
- [ ] **T3.5.3** Nomor versi semver-ish (deteksi breaking: prop dihapus/ganti tipe) — CMP-042 · `apps/api/src/modules/library` · Verifikasi: unit test diff props → MAJOR
- [ ] **T3.5.4** Changelog per versi (wajib saat publish) — CMP-043 · `apps/api`, `apps/editor` · Verifikasi: int test
- [ ] **T3.5.5** Immutability & integritas (hash definisi, verifikasi saat load) — CMP-044 · `apps/api` · Verifikasi: int test hash mismatch → error
- [ ] **T3.5.6** Deprecate & archive (instance lama tetap render) — CMP-045 · `apps/api` · Verifikasi: int test
- [ ] **T3.5.7** (P1) Rollback (publish ulang konten versi lama sebagai versi baru) — CMP-046 · `apps/api` · Verifikasi: int test
- [ ] **T3.5.8** Definisi migrasi props saat breaking change (fungsi deklaratif rename/map) — CMP-054 · `packages/library-seed`, `packages/document-model` · Verifikasi: unit test migrasi propValues v1 → v2
- [ ] **T3.5.9** Pinned version: instance tidak berubah saat versi baru publish — CMP-050 · `apps/editor` · Verifikasi: e2e publish v2 → instance tetap v1

#### Epic 3.6 — Instance di editor (Design mode)

- [ ] **T3.6.1** Insert instance dari panel Components dasar (daftar per kategori, drag) — ED-151, ED-167 · `apps/editor/src/panels/insert` · Verifikasi: e2e
- [ ] **T3.6.2** Drag ke canvas & smart insert (sisip antar section, auto-layout aware) — ED-170 · `apps/editor` · Verifikasi: e2e drop di antara 2 section
- [ ] **T3.6.3** Seleksi di dalam instance (klik → instance; dblclick → node editable; locked tidak) — ED-058 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.6.4** Props panel instance (form dari propsSchema) — ED-153, ED-008 · `apps/editor/src/panels/properties/instance` · Verifikasi: e2e ubah prop → canvas update
- [ ] **T3.6.5** Variant picker di instance — ED-152, CMP-031 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.6.6** Swap instance (component lain kategori sama; mapping prop by key) — ED-154 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.6.7** Indikator override & reset overrides — ED-155 · `apps/editor` · Verifikasi: e2e reset → nilai default
- [ ] **T3.6.8** Detach instance (UI + konfirmasi) — ED-156, CMP-057 · `apps/editor` · Verifikasi: e2e; undo
- [ ] **T3.6.9** Update versi component di instance (manual, admin/dev; UI user penuh di M4) — ED-158 · `apps/editor` · Verifikasi: e2e
- [ ] **T3.6.10** (P1) Go to main component — ED-157 · `apps/editor` · Verifikasi: e2e

#### Epic 3.7 — Thumbnail & renderer service

- [ ] **T3.7.1** `renderer-service` di worker: pool Chromium Playwright (1 browser, N context), API `screenshot({ html, viewport })` — ARCHITECTURE §5.4 · `apps/worker/src/renderer-service` · Verifikasi: int test screenshot HTML sederhana
- [ ] **T3.7.2** Processor `thumbnails` (dedupe jobId, simpan ke `assets` bucket) — CMP-014 · `apps/worker/src/processors/thumbnails.ts` · Verifikasi: int test publish component → thumbnail 3 breakpoint
- [ ] **T3.7.3** Thumbnail ditampilkan di panel Components & admin — CMP-014 · `apps/editor`, `apps/web` · Verifikasi: e2e

#### Epic 3.8 — Admin web: library management dasar

- [ ] **T3.8.1** Route `(admin)/admin/library` (role + 2FA) daftar component/theme, filter status/kategori — ACC-208 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T3.8.2** Detail component: versi, changelog, usage count, aksi deprecate/archive — ACC-208, CMP-045, CMP-051 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T3.8.3** 2FA wajib untuk staff (TOTP Better Auth plugin) — ACC-200 (bagian staff), ACC-006 (staff) · `apps/api/src/auth`, `apps/web` · Verifikasi: e2e admin tanpa 2FA ditolak

#### Epic 3.9 — Aset library

- [ ] **T3.9.1** Pustaka gambar contoh berlisensi (kurasi, metadata lisensi, upload ke bucket `assets`) — CMP-190 · `packages/library-seed/src/assets` · Verifikasi: setiap gambar punya sumber & lisensi tercatat
- [ ] **T3.9.2** Daftar font terkurasi (Google Fonts OFL/Apache) untuk theme preset — CMP-191 · `packages/library-seed/src/themes` · Verifikasi: unit test semua font punya lisensi valid
- [ ] **T3.9.3** Set ikon: Lucide + ikon sosial/merek sesuai keputusan OPEN — CMP-192 · `packages/library-seed/src/icons` · Verifikasi: unit test ikon yang dirujuk component ada

#### Epic 3.10 — Konsep library & dokumentasi internal

- [ ] **T3.10.1** Implementasi glosarium & tipe `kind` component (element/block/section/page) di schema & UI — CMP-001, CMP-002, CMP-003 · `packages/document-model`, `apps/editor` · Verifikasi: unit test enum `kind`
- [ ] **T3.10.2** Kepemilikan & visibilitas library (scope `platform` vs `workspace`) — CMP-004 · `apps/api/src/modules/library` · Verifikasi: int test workspace lain tidak melihat component workspace
- [ ] **T3.10.3** Panduan produksi library (style guide internal: spacing, token, penamaan) — CMP-015, CMP-133 · `packages/library-seed/README` · Verifikasi: owner review

#### Epic 3.11 — Produksi konten library seed (P0 M3)

> Task konten. Setiap task = produksi satu kelompok item di Mode Admin (atau seed TS), lulus QA (CMP-133), published, thumbnail ada. Target jumlah dari [CMP-093](./specs/03-components-templates.md#cmp-093-ringkasan-jumlah-target). Verifikasi umum: jumlah item published di admin + visual regression + kontras di semua theme preset.

- [ ] **T3.11.1** Theme preset awal (minimal 6 untuk dogfooding; 16 di M4) — CMP-120, CMP-124 · `packages/library-seed/src/themes` · Verifikasi: 6 preset published
- [ ] **T3.11.2** Elements batch 1: Buttons (primary/secondary/ghost/WA, size), Badges, Dividers — CMP-089 · library · Verifikasi: ≥ 10 variasi published
- [ ] **T3.11.3** Elements batch 2: Inputs (visual), Icon+text, Media (image frame, video lite) — CMP-089 · library · Verifikasi: ≥ 12 variasi (total Elements ≥ 22)
- [ ] **T3.11.4** Navigation: Navbar simple (5 varian), Navbar WA CTA, Navbar mobile drawer — CMP-081 · library · Verifikasi: ≥ 8 variasi
- [ ] **T3.11.5** Navigation: Footer (4 varian) + Floating WhatsApp button — CMP-081 · library · Verifikasi: ≥ 6 variasi (total Nav ≥ 14 bersama M4)
- [ ] **T3.11.6** Hero batch: centered, split image, background image — CMP-082 · library · Verifikasi: ≥ 10 variasi
- [ ] **T3.11.7** Feature/Benefit: feature grid ikon, alternating, checklist, steps/process — CMP-083 · library · Verifikasi: ≥ 9 variasi
- [ ] **T3.11.8** Content batch 1: text block, image+text, gallery grid, video embed — CMP-084 · library · Verifikasi: ≥ 8 variasi
- [ ] **T3.11.9** Content batch 2: about/story, menu restoran/daftar harga, jadwal/jam operasional — CMP-084 · library · Verifikasi: ≥ 6 variasi (total Content ≥ 14)
- [ ] **T3.11.10** Social proof: testimonial cards, rating, logo cloud, stats — CMP-085 · library · Verifikasi: ≥ 8 variasi
- [ ] **T3.11.11** Pricing/FAQ/CTA: pricing cards, price list jasa, FAQ accordion, CTA banner, CTA WhatsApp — CMP-086 · library · Verifikasi: ≥ 11 variasi
- [ ] **T3.11.12** Team/Contact: team grid, contact info, map embed — CMP-087 · library · Verifikasi: ≥ 7 variasi
- [ ] **T3.11.13** Product & Cards umum (bagian M3): product card statis, service card, info card — CMP-088 · library · Verifikasi: ≥ 6 variasi
- [ ] **T3.11.14** Audit library M3: hitung per kategori vs CMP-093, uji kontras semua preset, perbaiki gagal — CMP-080, CMP-133 · admin · Verifikasi: laporan jumlah; ≥ 85 variasi published di akhir M3

#### Epic 3.12 — Dogfooding template internal

- [ ] **T3.12.1** Susun 2 halaman contoh (kuliner & company profile) hanya dari component published — CMP-080 · editor · Verifikasi: node bebas < 10%
- [ ] **T3.12.2** Catat gap library (item yang kurang) sebagai task tambahan Epic 3.11 / Epic 4.4 — CMP-080 · docs · Verifikasi: daftar gap di Lampiran D

#### Epic 3.13 — (Opsional, disarankan) Fondasi agent AI khusus admin

> Mengikuti [04 §14](./specs/04-ai-agent.md#14-fase--urutan-implementasi) baris M3: mempercepat produksi library sekaligus menguji arsitektur agent dengan risiko rendah. **Hanya role admin, tanpa kredit.** Boleh dilewati jika owner memilih produksi manual; bila dilewati, pindahkan ke M6.

- [ ] **T3.13.1** `packages/ai-tools`: `defineTool` (Zod → JSON Schema), registry, error informatif untuk model — AI-060, ARCHITECTURE §10.3 · `packages/ai-tools` · Verifikasi: unit test schema tool ter-serialisasi
- [ ] **T3.13.2** Serializer outline dokumen ringkas untuk model + budget — AI-043, DM-077 · `packages/ai-tools/src/context` · Verifikasi: unit test 1.500 node < 25k token
- [ ] **T3.13.3** Draft store: fork Y.Doc per run, origin `ai:<runId>`, apply/discard, admin draft — AI-120, AI-121, AI-122, AI-126, AI-061 · `packages/ai-tools`, `apps/worker` · Verifikasi: unit test apply = 1 undo
- [ ] **T3.13.4** Tools Read + Library + Mutation dasar (`get_page_tree`, `get_node`, `search_components`, `insert_component`, `update_node_style`, `update_text`, `set_prop`) — AI-061, AI-102 · `packages/ai-tools/src/tools` · Verifikasi: unit test handler di Y.Doc fixture
- [ ] **T3.13.5** Tools admin `admin_create_component_draft`, `admin_add_variant` — AI-006 · `packages/ai-tools` · Verifikasi: unit test
- [ ] **T3.13.6** Worker `AgentRunner` dengan model mock (loop think → tool → observe, batas iterasi) — AI-040, AI-041, AI-042 · `apps/worker/src/ai` · Verifikasi: unit test loop dengan skrip mock
- [ ] **T3.13.7** Klien Claude API nyata (model dari `AI_MODEL_CONFIG`, retry 429/529) + routing model dasar — AI-047, AI-211 · `apps/worker/src/ai` · Verifikasi: int test manual dengan API key dev
- [ ] **T3.13.8** Endpoint API run + SSE stream (admin only) — AI-051 · `apps/api/src/modules/ai` · Verifikasi: int test stream event
- [ ] **T3.13.9** Panel chat sederhana di Mode Admin (stream, Terapkan/Batalkan) — AI-006, AI-027 · `apps/editor/src/ai` · Verifikasi: e2e dengan model mock
- [ ] **T3.13.10** Tool `render_preview` (screenshot via renderer-service) — AI-186, ARCHITECTURE §10.1 · `packages/ai-tools`, `apps/worker` · Verifikasi: int test
- [ ] **T3.13.11** Skill `admin-component-authoring` & `admin-variation-generation` (konten Markdown + frontmatter) — AI-080 · `packages/ai-tools/skills` · Verifikasi: unit test loader membaca frontmatter
- [ ] **T3.13.12** Audit log & logging token per run (admin) — AI-107, AI-160 · `apps/worker`, `packages/db` · Verifikasi: int test baris `ai_runs` terisi token
- [ ] **T3.13.13** Schema DB AI (`ai_conversations`, `ai_messages`, `ai_runs`, `ai_tool_calls`) — ARCHITECTURE §6.3 (AI) · `packages/db/src/schema/ai.ts` · Verifikasi: migration
- [ ] **T3.13.14** Eval harness minimal (5 skenario admin) — AI-084 · `packages/ai-tools/evals` · Verifikasi: runner jalan dengan budget

### M3.d Exit criteria / demo

- [ ] Demo J9 (PRD): admin membuat component "Hero split" dari seleksi → props (judul, gambar, CTA) + variant `imagePosition` → QA → publish v1 → di situs user insert instance → ubah props → admin publish v2 (tambah prop) → instance user **tetap v1** → update manual ke v2 berhasil dengan propValues termigrasi.
- [ ] Detach instance menghasilkan subtree identik secara visual.
- [ ] ≥ 85 variasi library published & lulus QA (sisa menuju ≥ 110 diselesaikan di M4 Epic 4.4).
- [ ] Visual regression library (3 breakpoint) hijau di CI.
- [ ] (Bila Epic 3.13 dikerjakan) Admin AI membuat 3 variasi dari 1 component dan admin mengkurasi.

### M3.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Model instance/override salah → mahal diubah | Task ⚑ + fixture spec 01 §20; review owner sebelum T3.1.9 |
| Produksi konten lambat (PRD R10) | Seed TS untuk item sederhana; AI admin (Epic 3.13); batch per kategori |
| Kualitas visual library tidak konsisten | Design rules linter (T3.4.14), QA checklist, visual regression |
| Lisensi gambar/ikon/font bermasalah | Metadata lisensi wajib (T3.9.x); hanya OFL/Apache/CC0/berlisensi komersial |
| Agent AI admin menyita waktu | Opsional; boleh pindah ke M6 tanpa mengubah urutan M4 |

---

## M4 — Template, mode user, publish subdomain, paket Free → 🚀 rilis publik pertama

### M4.a Tujuan & ruang lingkup

Mengubah editor menjadi **produk yang bisa dipakai UMKM**: memilih template, mengedit konten di **Simple mode**, **publish** menjadi situs statis cepat di **subdomain acak** domain situs terpisah, di bawah aturan paket **Free**, dengan **admin panel & moderasi dasar**, **legal**, dan **kesiapan operasional** (monitoring, backup, status page). Akhir M4 = **🚀 rilis publik pertama (statis, tanpa AI)**.

Termasuk:
- 02: semua ED P0 baris M4 (§36.2) + P1 M4 sebagai task bertanda (P1).
- 03: baris M4 di §21 (update component untuk user, Simple/Design mode instance, insert panel & search, template, theme preset, lisensi) + **produksi template** (gate 20, target 24) dan penyelesaian library (≥ 110 variasi P0).
- 07: baris M4 di §17 (publish pipeline, renderer output, site-host, subdomain acak, SEO dasar, performa, storage, domain production, keamanan, observabilitas, skema).
- 08: baris M4 di §19 (Free & entitlements, onboarding, lifecycle situs, hapus/export akun, admin panel dasar, moderasi dasar, notifikasi, legal, help center, event tracking).
- 01: DM-064, DM-065 (+ DM-066 P1), DM-037 (P0 data), DM-020 `video` (P1).
- 04: admin AI untuk template & eval set awal (opsional, lanjutan Epic 3.13).

**Tidak termasuk**: billing & paket berbayar (M5), subdomain nama pilihan & custom domain (M5), analytics bawaan (P1 M5), AI untuk user (M6), form yang menyimpan data / dinamis (M7; form kontak statis tergantung 05 OPEN #2), commerce (M8).

### M4.b Prasyarat

- M3 selesai (≥ 85 variasi published).
- Keputusan OPEN **pemblokir** (wajib sebelum epic terkait):
  - **PRD O1 / ARCHITECTURE A1** — nama produk & domain final (apex + domain situs) — sebelum Epic 4.11 & rilis.
  - **07 OPEN #19 / PRD O5 / PUB-201** — domain terpisah untuk situs user (`platformmu.site` + PSL) — sebelum Epic 4.11.
  - **07 OPEN #1** — bentuk URL preview (rekomendasi host-based `p-<id>`) — sebelum T4.8.9.
  - **07 OPEN #2** — atomic CSS vs class style-signature — sebelum Epic 4.9 (seharusnya sudah di M1).
  - **07 OPEN #14** — noindex untuk Free — sebelum T4.11.7.
  - **07 OPEN #4, #5** — badge dofollow/nofollow; status suspended 403 vs 451 — sebelum Epic 4.10.
  - **07 OPEN #8** — `shop`/`store` reserved — sebelum T4.11.2.
  - **07 OPEN #20, #21** — retensi deployment & rate limit publish per paket — sebelum T4.8.12.
  - **ARCHITECTURE A2, A9, A10, A11** — origin editor production, hosting api/worker/realtime, hosting web, Postgres/Redis managed — sebelum Epic 4.19.
  - **ARCHITECTURE A8 / 08 OPEN #29** — uptime monitor & status page tool — sebelum T4.19.6.
  - **08 OPEN #9** — angka batas Free (usulan §6.2) — sebelum Epic 4.12.
  - **08 OPEN #24** — SLA moderasi & kanal notifikasi staff — sebelum Epic 4.16.
  - **08 OPEN #27, #28** — kewajiban PSE, lokasi data — sebelum Epic 4.17 (legal).
  - **08 OPEN #30** — tool analytics produk — sebelum T4.17.8.
  - **03 O-5** — jumlah template final (gate 20, target 24–30) — sebelum Epic 4.5.
  - **03 O-6** — stemmer/sinonim search (rekomendasi keywords + trigram) — sebelum T4.2.4.
  - **02 OPEN #8** — daftar final auto-responsive rules & nilai skala divalidasi dengan template — selama Epic 4.6.
  - **02 OPEN #9 / 08 §6** — retensi version history per paket — sebelum T4.7.10.
  - **05 OPEN #2 / 08 OPEN #12 / PRD O12** — form kontak untuk paket statis — sebelum T4.4.4 (contact form statis).
  - **PRD O14 / 08 OPEN #26** — badan usaha (dibutuhkan untuk PSE & payment M5) — mulai proses di M2–M3.

### M4.c Epic & task

#### Epic 4.1 — Component untuk user: update, konflik, Simple/Design instance

- [ ] **T4.1.1** Notifikasi "update tersedia" per instance/component di editor (badge di panel & inspector) — CMP-052 · `apps/editor`, `apps/api/src/modules/library` · Verifikasi: e2e publish v2 → badge muncul di situs user
- [ ] **T4.1.2** Preview diff sebelum update (side-by-side render v-lama vs v-baru dengan propValues user) — CMP-053 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.1.3** UI migrasi props saat breaking change (tampilkan prop yang dipetakan/hilang) — CMP-054 · `apps/editor` · Verifikasi: e2e update MAJOR
- [ ] **T4.1.4** Konflik overrides (override yatim ditampilkan, opsi pertahankan/buang) — CMP-055 · `apps/editor`, `packages/document-model` · Verifikasi: unit test `orphanedOverrides`; e2e
- [ ] **T4.1.5** Simple mode untuk instance: edit konten via props saja — CMP-070 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.1.6** Design mode untuk instance: override style & nested — CMP-071 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.1.7** Reset override (per field, per node, semua) — CMP-072 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.1.8** Swap component sisi user (kategori sama, prop dipetakan) — CMP-074 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.1.9** (P1) Informasi instance di Properties panel (nama, versi, sumber, lisensi) — CMP-076 · `apps/editor` · Verifikasi: e2e

#### Epic 4.2 — Insert panel lengkap & search library

- [ ] **T4.2.1** Struktur Insert panel lengkap (Sections, Elements, Page templates; tab kategori) — ED-167, CMP-075 · `apps/editor/src/panels/insert` · Verifikasi: e2e
- [ ] **T4.2.2** Search & kategori di Insert (query + filter) — ED-168 · `apps/editor` · Verifikasi: e2e cari "harga" menemukan pricing
- [ ] **T4.2.3** Preview hover (thumbnail besar + deskripsi) — ED-169 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.2.4** Full-text search Postgres (tsvector ID/EN + keywords manual + trigram) — CMP-160 · `apps/api/src/modules/library`, `packages/db` · Verifikasi: int test relevansi 10 kueri
- [ ] **T4.2.5** Filter & facet (kategori, tag, kind, tier) — CMP-161 · `apps/api` · Verifikasi: int test
- [ ] **T4.2.6** Endpoint publik/user library (list, detail, search; tier-aware) — CMP-158 · `apps/api/src/modules/library` · Verifikasi: int test Free tidak bisa insert item premium (402)
- [ ] **T4.2.7** Page templates & section templates (sisip halaman jadi) — CMP-107 · `apps/editor`, `apps/api` · Verifikasi: e2e tambah halaman "Kontak" dari page template
- [ ] **T4.2.8** Lisensi template & component untuk user (teks lisensi, tampil di UI) — CMP-193 · `apps/web`, `apps/editor` · Verifikasi: halaman lisensi dapat diakses
- [ ] **T4.2.9** (P1) Discovery & kurasi (unggulan, terbaru) — CMP-163 · `apps/api`, `apps/editor` · Verifikasi: e2e
- [ ] **T4.2.10** (P1) Recent & favorit di Insert — ED-172 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.2.11** (P1) Components & tokens di Assets panel — ED-166 · `apps/editor` · Verifikasi: e2e

#### Epic 4.3 — Tokens, text styles & theme

- [ ] **T4.3.1** Kategori token lengkap (color, typography, space, radius, shadow, size) di editor — ED-129 · `apps/editor/src/panels/theme` · Verifikasi: e2e
- [ ] **T4.3.2** Panel token / Theme (lihat, edit nilai, tambah, rename, hapus dengan pengganti) — ED-130 · `apps/editor/src/panels/theme` · Verifikasi: e2e rename token → ref terbarui
- [ ] **T4.3.3** Memilih token di setiap input (warna, spacing, radius, shadow) — ED-131 · `apps/editor/src/panels/properties` · Verifikasi: e2e
- [ ] **T4.3.4** Detach token (jadikan literal) — ED-132 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.3.5** Gap & padding dengan token — ED-094 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.3.6** Text styles (typography token) diterapkan & dikelola — ED-126 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.3.7** Katalog theme preset awal 16 preset (konten) — CMP-121 · `packages/library-seed/src/themes` · Verifikasi: 16 preset published; kontras lulus
- [ ] **T4.3.8** Ganti theme global satu klik (preview sebelum terapkan, 1 undo) — CMP-122, DM-044 · `apps/editor/src/panels/theme` · Verifikasi: e2e
- [ ] **T4.3.9** (P1) Local styles vs token — ED-134 · `apps/editor` · Verifikasi: e2e

#### Epic 4.4 — Penyelesaian library v1 (konten)

> Target: total ≥ 110 variasi P0 published & lulus QA (gate CMP-093). Verifikasi umum seperti Epic 3.11.

- [ ] **T4.4.1** Navigation M4: Sidebar app-shell (3 varian), Tabs (3 varian) — CMP-081 · library · Verifikasi: ≥ 6 variasi; total Nav ≥ 14
- [ ] **T4.4.2** Blog card (3 varian) & Blog list section (3 varian) statis — CMP-087 · library · Verifikasi: ≥ 6 variasi
- [ ] **T4.4.3** Product & Cards umum sisa (product card variasi, category card, promo card) — CMP-088 · library · Verifikasi: total Product & Cards ≥ 10
- [ ] **T4.4.4** Contact form statis (kirim email owner bila OPEN 05#2 disetujui; jika tidak, form → WhatsApp) — CMP-087 · library · Verifikasi: 2 variasi; perilaku sesuai keputusan
- [ ] **T4.4.5** Dashboard widgets visual (4 varian statis untuk M7) — CMP-090 · library · Verifikasi: 4 variasi
- [ ] **T4.4.6** Gap filling dari dogfooding M3 (Lampiran D) — CMP-080 · library · Verifikasi: daftar gap tertutup
- [ ] **T4.4.7** Audit gate library: ≥ 110 variasi P0, tiap kategori P0 lulus kontras semua preset — CMP-093, CMP-133 · admin · Verifikasi: laporan audit tercentang

#### Epic 4.5 — Template: sistem & produksi

- [ ] **T4.5.1** ⚑ Tabel `templates` & `template_versions` — CMP-153, CMP-154 · `packages/db/src/schema/library.ts` · Verifikasi: migration
- [ ] **T4.5.2** Struktur template (snapshot dokumen lengkap, sample content, theme, halaman, preview assets) — CMP-100 · `packages/document-model`, `apps/api` · Verifikasi: unit test validasi template
- [ ] **T4.5.3** Versioning template (immutable per versi; situs yang dibuat tidak terikat) — CMP-101 · `apps/api/src/modules/library` · Verifikasi: int test
- [ ] **T4.5.4** Mode Admin untuk template (simpan situs sebagai template draft, publish) — CMP-100, ED-003 · `apps/editor`, `apps/api` · Verifikasi: e2e
- [ ] **T4.5.5** Buat situs dari template (copy snapshot + remap ID asset/component ref) — ACC-051, DM-001 · `apps/api/src/modules/sites` · Verifikasi: int test dokumen hasil valid & independen
- [ ] **T4.5.6** Galeri template publik `(marketing)/templates` + detail + preview — CMP-103 · `apps/web` · Verifikasi: e2e
- [ ] **T4.5.7** Template kuliner ×2 ("Warung Nusantara", "Kopi Senja") — CMP-102 · library · Verifikasi: QA CMP-133 + Lighthouse mobile ≥ 90
- [ ] **T4.5.8** Template restoran menu QR ×1 + link-in-bio ×1 + landing generik ×1 — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.9** Template fashion ×2 ("Butik Hijab", "Streetwear Lokal") — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.10** Template UMKM produk rumahan ×2 ("Kue Kering Bunda", "Sambal Rumahan") — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.11** Template jasa ×1 + bengkel ×1 — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.12** Template salon/barbershop ×2 — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.13** Template klinik ×1 + pendidikan/kursus ×1 — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.14** Template portfolio ×2 (fotografer, freelancer) — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.15** Template company profile ×3 (kontraktor, konsultan, pabrik) — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.16** Template event/undangan ×2 (pernikahan, seminar) — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.17** Template kos ×1 (P0) + properti ×1, travel ×1, komunitas ×1 (P1) — CMP-102 · library · Verifikasi: QA + Lighthouse
- [ ] **T4.5.18** Audit gate template: ≥ 20 template published, ≥ 12 industri, displayName/description ID+EN, sample content ID — CMP-102 · admin · Verifikasi: laporan audit

#### Epic 4.6 — Responsif per breakpoint

- [ ] **T4.6.1** Breakpoint switcher mode edit (edit di breakpoint aktif menulis override) — ED-173 · `apps/editor` · Verifikasi: e2e ubah font di mobile → `style.mobile` tersimpan
- [ ] **T4.6.2** Auto-responsive rules terlihat di panel ("diatur otomatis" + matikan per node/site) — ED-175, DM-038 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.6.3** Toggle "Manual override per device" (data siap, UI dasar) — ED-176, DM-037 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.6.4** Indikator override & reset per breakpoint — ED-177 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.6.5** Hide per breakpoint — ED-178, DM-039 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.6.6** Auto-layout per breakpoint (direction/gap/padding per device) — ED-089 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.6.7** Constraints & breakpoint — ED-100 · `apps/editor`, `packages/renderer` · Verifikasi: unit test
- [ ] **T4.6.8** Validasi auto-responsive dengan 24 template (tutup 02 OPEN #8; ubah nilai skala bila perlu) — DM-038 · `packages/renderer` · Verifikasi: tabel hasil per template
- [ ] **T4.6.9** (P1) Resize breakpoint frame (preview fluid) & responsive checker — ED-179, ED-180 · `apps/editor` · Verifikasi: e2e

#### Epic 4.7 — Simple mode & fitur editor M4

- [ ] **T4.7.1** Simple mode UI: toolbar ringkas, sidebar Pages/Insert/Theme, Content panel berbasis props — ED-001 · `apps/editor/src/app/simple` · Verifikasi: AC ED-001 (toggle tanpa update Yjs)
- [ ] **T4.7.2** Simple mode canvas: hover outline section, edit teks inline, popover ganti gambar, toolbar section (naik/turun/duplikat/hapus/ganti variant) — ED-001, CMP-070 · `apps/editor` · Verifikasi: e2e tanpa melihat input CSS
- [ ] **T4.7.3** Perpindahan mode & discoverability (toggle `Mod+Shift+M`, onboarding hint, preferensi per user per situs) — ED-002 · `apps/editor`, `apps/api` · Verifikasi: e2e preferensi bertahan
- [ ] **T4.7.4** Sticky position (navbar sticky) — ED-185 · `apps/editor`, `packages/renderer` · Verifikasi: e2e preview scroll
- [ ] **T4.7.5** Gradient fill linear (UI) — ED-103 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.7.6** Paste antar website (format internal membawa asset & component ref) — ED-196 · `apps/editor` · Verifikasi: e2e copy section situs A → B
- [ ] **T4.7.7** Optimasi gambar otomatis (pilih varian sesuai ukuran render) — ED-164 · `apps/editor`, `packages/renderer` · Verifikasi: unit test pemilihan varian
- [ ] **T4.7.8** SEO per page (entry point dari page settings) + detail SEO page settings — ED-216, ED-033 · `apps/editor/src/panels/pages` · Verifikasi: e2e
- [ ] **T4.7.9** Publish entry point & checklist pra-publish (alt text, SEO, link rusak, verifikasi email) — ED-208 · `apps/editor` · Verifikasi: e2e checklist memblokir error, tidak memblokir warning
- [ ] **T4.7.10** Version history: snapshot saat publish (P0) + daftar snapshot & restore (P1) — ED-199 · `apps/editor`, `apps/api` · Verifikasi: e2e restore membuat update baru
- [ ] **T4.7.11** Shortcut baris M4 dari tabel shortcut — ED-203 · `apps/editor/src/commands` · Verifikasi: e2e data-driven
- [ ] **T4.7.12** Node `video` (P1) — DM-020 · `packages/document-model`, `packages/renderer` · Verifikasi: snapshot
- [ ] **T4.7.13** Command `createComponentFromNodes` scope site (P1 local component) — ED-150, DM-074 · `apps/editor` · Verifikasi: e2e

#### Epic 4.8 — Publish pipeline

- [ ] **T4.8.1** ⚑ Tabel `deployments`, `deployment_events`, `deployment_assets`, preview tokens; kolom publishing di `sites` — PUB-240, PUB-243 · `packages/db/src/schema/hosting.ts` · Verifikasi: migration
- [ ] **T4.8.2** Working doc vs published snapshot: snapshot `kind=publish` berisi state + JSON tervalidasi — DM-064, PUB-001 · `apps/api`, `apps/realtime` · Verifikasi: int test snapshot JSON lolos validator strict
- [ ] **T4.8.3** Compile step (resolve instances, tokens, breakpoints → compiled doc) — DM-065, PUB-023 · `packages/renderer` · Verifikasi: unit test + bench compile 10 page
- [ ] **T4.8.4** Endpoint `POST /v1/sites/:id/publish` → enqueue `publish` (idempotent per deploymentId) — PUB-020 · `apps/api/src/modules/deployments` · Verifikasi: int test
- [ ] **T4.8.5** Validasi pra-build (link rusak, asset hilang, ukuran, batas paket) — PUB-022 · `apps/worker/src/publish` · Verifikasi: unit test daftar error/warning
- [ ] **T4.8.6** Render HTML statis per page + generate CSS — PUB-025, PUB-026 · `apps/worker/src/publish`, `packages/renderer` · Verifikasi: int test output ke MinIO
- [ ] **T4.8.7** Fonts: download, subset, self-host (Fontsource) — PUB-027 · `apps/worker/src/publish` · Verifikasi: int test file woff2 ter-upload
- [ ] **T4.8.8** Optimasi aset gambar untuk publish (varian, srcset) — PUB-028 · `apps/worker/src/publish` · Verifikasi: snapshot `srcset`
- [ ] **T4.8.9** Preview link (deployment `kind=preview`, token, revoke, masa berlaku, noindex) — PUB-004, DM-066 · `apps/api`, `apps/worker`, `apps/site-host` · Verifikasi: AC PUB-004
- [ ] **T4.8.10** Meta files (sitemap.xml, robots.txt, manifest, favicon) — PUB-030 · `apps/worker/src/publish` · Verifikasi: snapshot
- [ ] **T4.8.11** Upload ke R2/MinIO dengan prefix deployment + manifest hash — PUB-031, PUB-002 · `apps/worker/src/publish` · Verifikasi: int test manifest
- [ ] **T4.8.12** Promote & purge: live alias atomic switch (KV/API), deployment immutable, retensi — PUB-003, PUB-032, PUB-170 · `apps/worker`, `apps/api` · Verifikasi: int test switch atomik; deployment lama tetap ada
- [ ] **T4.8.13** Progress UI real-time (SSE) + status publish di editor — PUB-021, PUB-007 · `apps/editor`, `apps/api` · Verifikasi: e2e progress tampil sampai live
- [ ] **T4.8.14** Laporan error & warning publish (tautan ke node bermasalah) — PUB-024 · `apps/editor` · Verifikasi: e2e klik error → node terseleksi
- [ ] **T4.8.15** Rollback (pilih deployment lama → jadi live) — PUB-005 · `apps/api`, `apps/web` · Verifikasi: int test + e2e
- [ ] **T4.8.16** Unpublish — PUB-006 · `apps/api` · Verifikasi: int test host → halaman not found
- [ ] **T4.8.17** Target performa publish (situs 10 page < 30 s) & log/metrik publish — PUB-033, PUB-230 · `apps/worker` · Verifikasi: bench + log terstruktur
- [ ] **T4.8.18** Rate limit publish per paket — PUB-216 · `apps/api` · Verifikasi: int test 429
- [ ] **T4.8.19** Islands JS bundle minimal (P0 untuk interaksi statis seperti accordion/menu mobile bila dibutuhkan; data islands M7) — PUB-029 · `packages/renderer/src/islands` · Verifikasi: bundle < batas spec; tanpa JS bila tidak perlu

#### Epic 4.9 — Renderer output publish

- [ ] **T4.9.1** HTML semantic & landmark — PUB-040 · `packages/renderer` · Verifikasi: snapshot + axe
- [ ] **T4.9.2** Auto-layout → flexbox & sizing — PUB-041 · `packages/renderer` · Verifikasi: snapshot
- [ ] **T4.9.3** Breakpoints → media queries — PUB-042 · `packages/renderer` · Verifikasi: snapshot
- [ ] **T4.9.4** Tokens → CSS custom properties — PUB-043 · `packages/renderer` · Verifikasi: snapshot
- [ ] **T4.9.5** Visual style → CSS (fills, stroke, radius, effects) — PUB-044 · `packages/renderer` · Verifikasi: snapshot
- [ ] **T4.9.6** Interactions & hover states → CSS — PUB-045 · `packages/renderer` · Verifikasi: snapshot
- [ ] **T4.9.7** Aksesibilitas output (alt, label, focus, skip link, lang) — PUB-047 · `packages/renderer` · Verifikasi: axe-core 0 pelanggaran serius pada 5 template
- [ ] **T4.9.8** Tanpa framework runtime untuk halaman statis — PUB-049 · `packages/renderer` · Verifikasi: halaman tanpa island = 0 KB JS
- [ ] **T4.9.9** Target ukuran & Lighthouse (HTML+CSS budget) — PUB-048 · `packages/renderer` · Verifikasi: Lighthouse CI pada 5 template ≥ 90 mobile
- [ ] **T4.9.10** Resource hints & font loading (preload, `font-display`) — PUB-152 · `packages/renderer` · Verifikasi: snapshot head
- [ ] **T4.9.11** Lazy loading & prioritas (LCP image eager + fetchpriority) — PUB-154 · `packages/renderer` · Verifikasi: snapshot
- [ ] **T4.9.12** Target Core Web Vitals (LCP, CLS: width/height eksplisit) — PUB-153 · `packages/renderer` · Verifikasi: Lighthouse CLS < 0.1
- [ ] **T4.9.13** Image resizing pra-generate (sharp) — PUB-151 · `apps/worker` · Verifikasi: int test
- [ ] **T4.9.14** (P1) Animasi sederhana di output — PUB-046 · `packages/renderer` · Verifikasi: snapshot

#### Epic 4.10 — Site-host (Cloudflare Worker)

- [ ] **T4.10.1** Scaffold `apps/site-host` (wrangler, `.dev.vars`, port 8787) + adapter `ObjectStore` (R2 | S3/MinIO) & `HostResolver` (KV | API) — PUB-192, ARCHITECTURE §5.6, §15.6 · `apps/site-host` · Verifikasi: `wrangler dev` serve file dari MinIO
- [ ] **T4.10.2** Resolusi host → site (cache in-isolate 30 s → KV → API internal) — PUB-060 · `apps/site-host/src/resolve-host.ts` · Verifikasi: unit test cache & fallback
- [ ] **T4.10.3** Endpoint `GET /internal/v1/hosts/:hostname` + format KV — PUB-245, PUB-061 · `apps/api/src/internal` · Verifikasi: int test
- [ ] **T4.10.4** Serve file dari R2 (path → key, `index.html`, `_assets`) — PUB-062 · `apps/site-host` · Verifikasi: unit test mapping path
- [ ] **T4.10.5** Header cache & ETag; cache key dengan deploymentId — PUB-063, PUB-150 · `apps/site-host` · Verifikasi: unit test header
- [ ] **T4.10.6** Kompresi (brotli/gzip) — PUB-064 · `apps/site-host` · Verifikasi: int test `content-encoding`
- [ ] **T4.10.7** Redirect sistem (trailing slash, http→https, alias) — PUB-065 · `apps/site-host` · Verifikasi: unit test
- [ ] **T4.10.8** Halaman 404 & error (situs & platform) — PUB-066 · `apps/site-host/src/pages` · Verifikasi: e2e path tidak ada → 404 situs
- [ ] **T4.10.9** Badge "Made with Platform" untuk Free (disuntik berdasarkan KV `badge`) — PUB-070 · `apps/site-host` · Verifikasi: e2e situs Free menampilkan badge; tidak bisa dihapus lewat editor
- [ ] **T4.10.10** Maintenance & suspended page (status sesuai OPEN 07#5) — PUB-071 · `apps/site-host` · Verifikasi: e2e situs suspended
- [ ] **T4.10.11** Header keamanan situs user (CSP, nosniff, referrer, permissions) — PUB-210 · `apps/site-host/src/headers.ts` · Verifikasi: unit test header
- [ ] **T4.10.12** Isolasi cookie (domain situs terpisah, tanpa cookie platform) — PUB-212 · `apps/site-host` · Verifikasi: e2e tidak ada cookie `app.` terkirim
- [ ] **T4.10.13** Observabilitas site-host (Sentry Cloudflare, log sampling) — PUB-231 · `apps/site-host` · Verifikasi: error dipicu terlihat
- [ ] **T4.10.14** DDoS & bot (Cloudflare rules, rate limit `/_api` disiapkan) — PUB-217 · Cloudflare config · Verifikasi: checklist konfigurasi

#### Epic 4.11 — Subdomain, domain production & SEO dasar

- [ ] **T4.11.1** ⚑ Tabel `site_domains`, `reserved_subdomains`, kolom `sites` publishing — PUB-240, PUB-241 · `packages/db` · Verifikasi: migration
- [ ] **T4.11.2** Reserved list (platform words, brand besar, kata kasar) + seed — PUB-082 · `packages/db/seed` · Verifikasi: unit test
- [ ] **T4.11.3** Generator subdomain acak Free (8 karakter, alfabet aman, diawali huruf, unik + blocklist) — PUB-080 · `apps/api/src/modules/domains` · Verifikasi: unit test 1e5 tanpa tabrakan & tanpa kata terlarang
- [ ] **T4.11.4** Wildcard DNS & SSL domain situs (Cloudflare) — PUB-200 · infra · Verifikasi: `https://acak.<domain>` SSL valid
- [ ] **T4.11.5** Domain terpisah untuk situs user + pengajuan PSL — PUB-201 · infra · Verifikasi: PR PSL diajukan; cookie isolasi
- [ ] **T4.11.6** Deploy site-host ke Cloudflare (staging & production, R2, KV) — PUB-202 · `apps/site-host`, `.github/workflows` · Verifikasi: smoke test production
- [ ] **T4.11.7** noindex untuk subdomain acak Free (sesuai OPEN 07#14) — PUB-125 · `apps/site-host`, `packages/renderer` · Verifikasi: header `X-Robots-Tag`
- [ ] **T4.11.8** SEO per page di output (title, description, OG, Twitter card) — PUB-120 · `packages/renderer` · Verifikasi: snapshot head
- [ ] **T4.11.9** Canonical URL (domain primer) — PUB-121 · `packages/renderer` · Verifikasi: snapshot
- [ ] **T4.11.10** Sitemap & robots — PUB-126 · `apps/worker/src/publish` · Verifikasi: snapshot
- [ ] **T4.11.11** Tabel `domains` & `site_redirects`/`site_settings` (disiapkan untuk M5) — PUB-242, PUB-244 · `packages/db` · Verifikasi: migration
- [ ] **T4.11.12** Media upload pipeline lengkap (dedupe sha256, kuota, status) — PUB-180 · `apps/api`, `apps/worker` · Verifikasi: int test upload sama 2× → 1 objek
- [ ] **T4.11.13** Kuota storage (cek saat upload, meter) — PUB-172 · `apps/api` · Verifikasi: int test melebihi → 402
- [ ] **T4.11.14** Abuse & moderasi hook pada publish (panggil scan) — PUB-215 · `apps/worker` · Verifikasi: int test konten terlarang → flagged
- [ ] **T4.11.15** Uptime & synthetic check (canary site) + alert publish failure — PUB-232, PUB-233 · infra · Verifikasi: alert uji terkirim

#### Epic 4.12 — Entitlements & paket Free

- [ ] **T4.12.1** ⚑ Skema `plans`, `plan_prices` (kosong), `usage_counters`, override per workspace — ACC-371, ACC-090 · `packages/db/src/schema/billing.ts` · Verifikasi: migration + seed plan `free` dari data
- [ ] **T4.12.2** Definisi plan sebagai data (entitlements jsonb, key §6.2) — ACC-090 · `packages/db/seed` · Verifikasi: unit test schema entitlements
- [ ] **T4.12.3** `EntitlementService` (satu sumber kebenaran, cache Redis 60 s, invalidasi) — ACC-130 · `apps/api/src/modules/billing` · Verifikasi: unit/int test
- [ ] **T4.12.4** Titik pengecekan (buat situs, halaman, upload, publish, insert premium) — ACC-131 · `apps/api` · Verifikasi: int test per titik → 402 `PLAN_LIMIT_REACHED`
- [ ] **T4.12.5** Kategori limit kapasitas vs periodik + reset bulanan (Asia/Jakarta) — ACC-132, ACC-136 · `apps/api`, `apps/worker` · Verifikasi: unit test reset
- [ ] **T4.12.6** Usage counters (Redis + rekonsiliasi DB) — ACC-133 · `apps/api`, `apps/worker` · Verifikasi: int test rekonsiliasi
- [ ] **T4.12.7** Soft limit warning 80% & 100% (in-app + email) — ACC-134 · `apps/api`, `apps/web` · Verifikasi: e2e
- [ ] **T4.12.8** Hard limit behavior per resource (pesan jelas + CTA upgrade "segera") — ACC-135 · `apps/web`, `apps/editor` · Verifikasi: e2e situs ke-2 di Free ditolak
- [ ] **T4.12.9** Usage meter di dashboard — ACC-056 · `apps/web/(dashboard)` · Verifikasi: e2e
- [ ] **T4.12.10** Halaman pricing publik (Free aktif; paket lain "segera hadir") — ACC-092 · `apps/web/(marketing)/pricing` · Verifikasi: e2e
- [ ] **T4.12.11** Plans & override entitlements per akun di admin (P0 override) — ACC-205 · `apps/web/(admin)` · Verifikasi: e2e override → limit berubah

#### Epic 4.13 — Dashboard: lifecycle situs, akun & notifikasi

- [ ] **T4.13.1** Buat website dari template (dialog: template / kosong) — ACC-051 · `apps/web` · Verifikasi: e2e
- [ ] **T4.13.2** Duplikasi website — ACC-052 · `apps/api`, `apps/web` · Verifikasi: int test dokumen independen
- [ ] **T4.13.3** Arsip website — ACC-053 · `apps/api`, `apps/web` · Verifikasi: e2e
- [ ] **T4.13.4** Hapus (soft delete) & restore 30 hari + purge job — ACC-054 · `apps/api`, `apps/worker` · Verifikasi: int test purge setelah 30 hari (waktu di-mock)
- [ ] **T4.13.5** Status publish & riwayat deployment di dashboard — ACC-055 · `apps/web` · Verifikasi: e2e
- [ ] **T4.13.6** Pengaturan site ringkas (nama, favicon, bahasa, SEO default) — ACC-058 · `apps/web` · Verifikasi: e2e
- [ ] **T4.13.7** Status akun (aktif, suspended, banned; efek ke situs) — ACC-012 · `apps/api` · Verifikasi: int test
- [ ] **T4.13.8** Hapus akun (konfirmasi, masa tenggang, hapus data) — ACC-010 · `apps/api`, `apps/web` · Verifikasi: int test
- [ ] **T4.13.9** Export data pribadi (ZIP JSON via email) — ACC-011 · `apps/api`, `apps/worker` · Verifikasi: int test isi export
- [ ] **T4.13.10** ⚑ Skema notifikasi, admin, moderasi (in-app notifications, preferences) — ACC-372 · `packages/db` · Verifikasi: migration
- [ ] **T4.13.11** Katalog notifikasi M4 + in-app notifications + pusat notifikasi — ACC-270, ACC-272, ACC-057 · `apps/api`, `apps/web` · Verifikasi: e2e publish gagal → notifikasi
- [ ] **T4.13.12** Preferensi notifikasi — ACC-273 · `apps/web` · Verifikasi: e2e
- [ ] **T4.13.13** (P1) Sesi & perangkat lanjutan (lokasi, logout semua) — ACC-007 · `apps/web` · Verifikasi: e2e

#### Epic 4.14 — Onboarding

- [ ] **T4.14.1** Survei singkat (tujuan, industri, keahlian) — ACC-070 · `apps/web` · Verifikasi: e2e; data tersimpan
- [ ] **T4.14.2** Pilih titik awal (template / kosong; AI "segera") — ACC-071, CMP-103 · `apps/web` · Verifikasi: e2e
- [ ] **T4.14.3** Isi info bisnis (nama, WA, alamat, logo) → dipakai template — ACC-072, CMP-104 · `apps/web`, `apps/api` · Verifikasi: int test placeholder template terisi
- [ ] **T4.14.4** Checklist "Website siap publish" di dashboard & editor — ACC-074 · `apps/web`, `apps/editor` · Verifikasi: e2e
- [ ] **T4.14.5** (P1) Tur editor — ACC-073 · `apps/editor` · Verifikasi: e2e

#### Epic 4.15 — Admin panel dasar

- [ ] **T4.15.1** Akses & keamanan admin (role, 2FA, IP log, sesi pendek) — ACC-200 · `apps/web/(admin)`, `apps/api/src/modules/admin` · Verifikasi: e2e
- [ ] **T4.15.2** Users (cari, detail, suspend/ban, reset 2FA) — ACC-201 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T4.15.3** Workspaces (detail, plan, usage) — ACC-202 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T4.15.4** Sites (cari by host, detail, unpublish/suspend) — ACC-203 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T4.15.5** Impersonate dengan audit (read-only default, banner) — ACC-204 · `apps/api`, `apps/web` · Verifikasi: int test audit tercatat
- [ ] **T4.15.6** Library management lengkap (template, kategori, kurasi) — ACC-208 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T4.15.7** Feature flags (global, per workspace, persentase) — ACC-210 · `apps/api`, `apps/web` · Verifikasi: unit test evaluasi flag
- [ ] **T4.15.8** Audit log viewer (filter actor/target/aksi) — ACC-213 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T4.15.9** (P1) Announcement banner — ACC-211 · `apps/web`, `apps/editor` · Verifikasi: e2e
- [ ] **T4.15.10** (P1) System health (queue, DLQ, deployment gagal) — ACC-212 · `apps/web/(admin)` · Verifikasi: e2e

#### Epic 4.16 — Moderasi dasar & anti-abuse

- [ ] **T4.16.1** Kebijakan Penggunaan (AUP) teks ID/EN + tampil saat register & publish — ACC-240 · `apps/web` · Verifikasi: e2e centang AUP wajib
- [ ] **T4.16.2** Deteksi saat publish (keyword & pola: phishing, judi, penipuan, brand impersonation) → skor & flag — ACC-241 · `apps/worker` · Verifikasi: unit test daftar contoh
- [ ] **T4.16.3** Tabel `moderation_reports`, `moderation_actions`, `content_scans` — ACC-372 · `packages/db` · Verifikasi: migration
- [ ] **T4.16.4** Laporan dari publik ("Laporkan situs" di badge & halaman) — ACC-244 · `apps/web`, `apps/site-host` · Verifikasi: e2e laporan masuk antrean
- [ ] **T4.16.5** Antrean moderasi & SLA (status, prioritas skor) — ACC-245, ACC-209 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T4.16.6** Tindakan moderasi (warn, unpublish, suspend, restore) + KV status — ACC-246 · `apps/api` · Verifikasi: int test suspend → site-host halaman suspended
- [ ] **T4.16.7** Banding (appeal) — ACC-247 · `apps/web` · Verifikasi: e2e
- [ ] **T4.16.8** Rate limit pembuatan akun & site — ACC-255 · `apps/api` · Verifikasi: int test
- [ ] **T4.16.9** Verifikasi email wajib sebelum publish — ACC-256 · `apps/api`, `apps/editor` · Verifikasi: e2e publish ditolak bila belum verifikasi
- [ ] **T4.16.10** (P1) Laporan dari otoritas / takedown request — ACC-248 · `apps/web/(admin)` · Verifikasi: e2e

#### Epic 4.17 — Legal, kepatuhan & support (non-kode + kode ringan)

- [ ] **T4.17.1** (non-kode) Proses badan usaha dimulai/selesai sesuai keputusan (PT Perorangan vs PT, KBLI) — ACC-310 · owner · Verifikasi: dokumen pendirian / NIB
- [ ] **T4.17.2** (non-kode) Pendaftaran PSE (cek kewajiban & tenggat terbaru) — ACC-311 · owner · Verifikasi: bukti pendaftaran atau catatan "tidak wajib" + dasar hukum
- [ ] **T4.17.3** (non-kode) Kebijakan privasi sesuai UU PDP (data yang dikumpulkan, lokasi data, hak subjek, kontak) — ACC-312 · owner (+ konsultan) · Verifikasi: teks final ID/EN disetujui
- [ ] **T4.17.4** (non-kode) Syarat & Ketentuan (ToS) termasuk AUP & lisensi library — ACC-313, CMP-193 · owner · Verifikasi: teks final ID/EN
- [ ] **T4.17.5** Halaman legal di web (privacy, terms, AUP, lisensi) + persetujuan versi saat register (simpan versi yang disetujui) — ACC-312, ACC-313 · `apps/web/(marketing)` · Verifikasi: e2e
- [ ] **T4.17.6** (P1) Kebijakan konten & hak cipta (prosedur DMCA-like) — ACC-315 · owner, `apps/web` · Verifikasi: halaman terbit
- [ ] **T4.17.7** Help center / docs (minimal 15 artikel: mulai, template, Simple mode, publish, domain, akun) — ACC-330 · `apps/web/(marketing)/help` · Verifikasi: artikel terbit ID (EN P1)
- [ ] **T4.17.8** Event tracking produk (register, create site, publish, aktivasi) + privasi analytics — ACC-350, ACC-352 · `apps/api`, `apps/web` · Verifikasi: int test event tercatat tanpa PII berlebih
- [ ] **T4.17.9** Cookie/consent & DPA internal sub-processor (Cloudflare, Sentry, Resend) — ACC-312 · `apps/web`, docs · Verifikasi: daftar sub-processor terbit

#### Epic 4.18 — (Opsional) AI admin untuk template & eval set

- [ ] **T4.18.1** Tool `admin_save_template_draft` & `admin_update_library_metadata` + skill `admin-template-authoring` — AI-006 · `packages/ai-tools` · Verifikasi: unit test
- [ ] **T4.18.2** Eval set skenario UMKM awal (≥ 20 skenario dari kebutuhan template) — AI-180 · `packages/ai-tools/evals` · Verifikasi: dataset tervalidasi

#### Epic 4.19 — Infrastruktur production & checklist rilis publik

- [ ] **T4.19.1** Provision production sesuai keputusan A9–A11 (container api/worker/realtime, Postgres dengan PITR, Redis tanpa eviction) — ARCHITECTURE §16.3 · infra · Verifikasi: `health/ready` hijau di production
- [ ] **T4.19.2** Deploy web & editor static (sesuai A2, A10) + rewrite `/editor` — ARCHITECTURE §5.2, §16.3 · infra · Verifikasi: editor production terbuka
- [ ] **T4.19.3** `deploy-staging.yml` & `deploy-production.yml` (promote image, migrate sebelum traffic, source maps Sentry) — ARCHITECTURE §16.1, §16.4 · `.github/workflows` · Verifikasi: deploy staging otomatis dari main
- [ ] **T4.19.4** Backup harian `pg_dump` terenkripsi ke R2 `backups` + **uji restore** — ARCHITECTURE §16.4 · infra · Verifikasi: restore ke DB kosong berhasil, dicatat di runbook
- [ ] **T4.19.5** Monitoring & alert (Sentry, DLQ, publish failure > 5%/jam, disk, backup gagal) ke email + Telegram/WA owner — ARCHITECTURE §13, PUB-233 · infra · Verifikasi: alert uji diterima
- [ ] **T4.19.6** Uptime monitor eksternal + status page publik — ACC-333, PUB-232 · infra · Verifikasi: status page dapat diakses
- [ ] **T4.19.7** Security review: header, CSP, rate limit, cookie flags, CSRF, upload, SSRF guard, secrets, `pnpm audit` bersih — ARCHITECTURE §9 · semua · Verifikasi: checklist §9.5 & §9.7 tercentang
- [ ] **T4.19.8** Uji isolasi tenant menyeluruh (semua endpoint data M1–M4) — ARCHITECTURE §9.5 · `apps/api/test` · Verifikasi: suite hijau
- [ ] **T4.19.9** Lighthouse audit: 24 template dipublish di staging, mobile ≥ 90 (perf & a11y) — PUB-048, PUB-153 · staging · Verifikasi: laporan Lighthouse ≥ 80% template ≥ 90
- [ ] **T4.19.10** Load test ringan site-host & publish (100 publish berurutan, 1k rps statis dari CDN) — PUB-033, PUB-150 · staging · Verifikasi: tidak ada error, p95 tercatat
- [ ] **T4.19.11** Runbook operasional (deploy, rollback, restore, insiden, takedown) — ARCHITECTURE §16.4 · docs · Verifikasi: owner review
- [ ] **T4.19.12** Email production (domain pengirim, SPF/DKIM/DMARC) — ACC-271 · infra · Verifikasi: email tidak masuk spam (uji Gmail)
- [ ] **T4.19.13** Beta tertutup 10–20 UMKM (feedback → task) — PRD §11 · owner · Verifikasi: ≥ 10 situs live dari beta tester
- [ ] **T4.19.14** Go-live checklist final (§M4.d) ditandatangani owner → **🚀 rilis publik** — PRD §12 · owner · Verifikasi: semua butir tercentang

#### Epic 4.20 — P1 editor M4 (bila sempat; boleh dipindah ke M9)

- [ ] **T4.20.1** (P1) Panel layout responsif & state UI — ED-011 · `apps/editor` · Verifikasi: e2e lebar 1280
- [ ] **T4.20.2** (P1) Draft area (node di luar page) — ED-035 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.3** (P1) Select matching layers — ED-057 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.4** (P1) Rotate & flip — ED-068, ED-069 · `apps/editor` · Verifikasi: unit test geometri rotate
- [ ] **T4.20.5** (P1) Layout grid kolom & snap, pengaturan snapping — ED-075, ED-078 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.6** (P1) Konversi freeform ↔ auto-layout aman; text baseline & align-self — ED-093, ED-095 · `apps/editor` · Verifikasi: unit test
- [ ] **T4.20.7** (P1) Grid layout UI (CSS Grid) — ED-097 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.8** (P1) Scale mode dekoratif — ED-101 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.9** (P1) Multiple fills, layer & background blur — ED-105, ED-109 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.10** (P1) Cursor & properti interaksi; advanced (aspect ratio, z-index, visibility) — ED-113, ED-114 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.11** (P1) Paragraph spacing & indent; truncation max lines — ED-118, ED-124 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.12** (P1) Konversi group ↔ frame; slots / nested content di user — ED-147, ED-159 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.13** (P1) Stock image (sesuai OPEN 02#7) — ED-162 · `apps/editor`, `apps/api` · Verifikasi: e2e
- [ ] **T4.20.14** (P1) Prototype: model interaction, transisi, scroll behavior, overlay modal/drawer, toggle visibility, runtime JS interaksi — ED-182, ED-184, ED-186, ED-187, ED-188, ED-189 · `apps/editor`, `packages/renderer` · Verifikasi: e2e accordion & menu mobile di preview publish
- [ ] **T4.20.15** (P1) Paste to replace; copy/paste properties — ED-192, ED-194 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.16** (P1) Quick actions & cheat sheet; share preview link dari editor — ED-205, ED-209 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.17** (P1) ARIA label, kontras warning, fokus keyboard output, panel pemeriksa a11y, a11y editor — ED-212, ED-213, ED-214, ED-215, ED-217 · `apps/editor` · Verifikasi: axe pada editor
- [ ] **T4.20.18** (P1) Web Worker untuk kalkulasi berat — ED-225 · `apps/editor` · Verifikasi: bench
- [ ] **T4.20.19** (P1) States pada node non-component (focus/active/disabled) — ED-183, DM-040 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.20** (P1) Fixed/floating position — ED-185 · `apps/editor` · Verifikasi: e2e
- [ ] **T4.20.21** (P1) Atribut kustom node — ED-220 · `apps/editor` · Verifikasi: unit test allowlist atribut
- [ ] **T4.20.22** (P1) Offline multi-tab/multi-device — ED-201 · `apps/editor` · Verifikasi: e2e

### M4.d Exit criteria / checklist rilis publik

Produk:
- [ ] Demo J1 (PRD): user baru → register → verifikasi email → survei → pilih template kuliner → isi info bisnis → Simple mode ganti teks & foto & warna → publish → situs live di `https://<acak>.<domain-situs>` dengan badge, dalam < 15 menit.
- [ ] Demo J2: tambah section dari Insert; J3: desain dari nol di Design mode lalu publish.
- [ ] Preview link, rollback, unpublish bekerja di production.
- [ ] ≥ 20 template published (≥ 12 industri), ≥ 110 variasi library, 16 theme preset.
- [ ] Free: 1 situs aktif, 5 halaman, 500 MB (atau angka final OPEN 08#9) ditegakkan.

Kualitas:
- [ ] Lighthouse mobile ≥ 90 (performance & accessibility) untuk ≥ 80% template yang dipublish (PRD §11).
- [ ] Semua e2e kritis (ARCHITECTURE §14) hijau di staging; visual regression library hijau.
- [ ] Tidak ada bug P0 terbuka dari beta.

Keamanan & operasional:
- [ ] Security review T4.19.7 & uji isolasi tenant T4.19.8 lulus.
- [ ] Backup harian berjalan + uji restore berhasil (T4.19.4).
- [ ] Monitoring, alert, uptime monitor, status page aktif (T4.19.5, T4.19.6).
- [ ] Moderasi: AUP, deteksi publish, laporan publik, antrean, tindakan, banding aktif; owner tahu SLA.
- [ ] Runbook tersedia.

Legal:
- [ ] Kebijakan privasi, ToS, AUP terbit; PSE ditangani (T4.17.2); badan usaha jelas.

### M4.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Produksi 20+ template memakan waktu sangat lama | Mulai produksi template paralel sejak awal M4; AI admin (Epic 4.18/3.13); gate 20 bukan 30 |
| Penyalahgunaan subdomain gratis (PRD R4) | Domain situs terpisah + PSL, subdomain acak, verifikasi email, deteksi publish, laporan publik, noindex Free |
| Publish pipeline rapuh | Idempotent per deploymentId, rebuild dari snapshot, rollback = pointer KV |
| Biaya infra melonjak | Statis di CDN; ukur biaya per situs; retensi deployment |
| Legal tertunda (pihak luar) | Mulai T4.17.1–T4.17.4 sejak M2; jangan rilis tanpa privacy & ToS |
| Rilis tertunda karena P1 | Epic 4.20 boleh dipindah ke M9 tanpa menahan rilis |

---

## M5 — Billing & paket berbayar

> ⚠️ Fase M5–M9 sudah dirinci sampai level task, tetapi **wajib dirinci ulang** (task `T<n>.0.1`) saat fase dimulai: cek ulang spec yang mungkin berubah, hasil rilis sebelumnya, dan keputusan OPEN terbaru.

### M5.a Tujuan & ruang lingkup

Monetisasi: paket **Starter** dan **Pro** (Business disiapkan datanya), checkout langganan via gateway platform, upgrade/downgrade/cancel, invoice, renewal manual + dunning, downgrade otomatis; **subdomain nama pilihan** (Starter+), **custom domain** (Pro), penghapusan badge (Pro), fitur hosting/SEO lanjutan berbasis paket, serta **ledger kredit AI disiapkan** untuk M6.

Termasuk: 08 baris M5 di §19; 07 baris M5 di §17; 03 CMP template/component premium (ACC-093); 04 §14 baris M5 (ledger & entitlement).

**Tidak termasuk**: AI untuk user (M6), recurring auto-debit kartu (P1, tergantung gateway), team workspace (M9), referral (P2), faktur pajak (P2).

### M5.b Prasyarat

- M4 selesai & rilis publik stabil (≥ 2 minggu tanpa insiden besar disarankan).
- OPEN pemblokir:
  - **PRD O2 / 08 OPEN #16** — harga final semua paket, diskon tahunan.
  - **PRD O7 / ARCHITECTURE A5 / 08 OPEN #19** — gateway langganan platform & model perpanjangan (rekomendasi: invoice + reminder).
  - **PRD O14 / 08 OPEN #17, #26** — PPN, PKP, badan usaha (wajib sebelum menagih).
  - **08 OPEN #10** — Starter boleh hapus badge (usulan: tidak).
  - **08 OPEN #20** — proration.
  - **08 OPEN #21, #22, #31** — retensi data frozen, kriteria refund, item premium setelah downgrade.
  - **PRD O11 / 07 OPEN #6, #7, #9, #10** — aturan subdomain pilihan, rename, downgrade.
  - **07 OPEN #11, #12 / ARCHITECTURE A3** — strategi apex & grace custom domain; biaya Cloudflare for SaaS.
  - **07 OPEN #13, #15, #16, #17, #18** — password protect, verifikasi & GA4/Pixel per paket, OG image, analytics storage, image CDN.
  - **08 OPEN #18** — harga add-on (boleh ditunda).
  - **ARCHITECTURE A6** — KMS vs env KEK (dipakai juga M8) — non-pemblokir di M5.

### M5.c Epic & task

#### Epic 5.0 — Refinement

- [ ] **T5.0.1** Rinci ulang M5: baca ulang spec 08 §6–§9 & 07 §6–§9, putuskan OPEN pemblokir bersama owner, perbarui task di bawah — §1.6 · docs · Verifikasi: Lampiran D mencatat perubahan

#### Epic 5.1 — Data plan, harga & billing schema

- [ ] **T5.1.1** ⚑ Skema `subscriptions`, `invoices`, `billing_webhook_events`, `plan_prices`, saldo akun — ACC-371 · `packages/db/src/schema/billing.ts` · Verifikasi: migration
- [ ] **T5.1.2** Konfigurasi harga sebagai data + seed Starter/Pro/Business — ACC-110 · `packages/db/seed` · Verifikasi: unit test schema harga
- [ ] **T5.1.3** (P1) Versi plan & grandfathering — ACC-091 · `apps/api/src/modules/billing` · Verifikasi: int test user lama tetap harga lama
- [ ] **T5.1.4** Halaman pricing publik final (harga, perbandingan fitur, FAQ) — ACC-092 · `apps/web/(marketing)/pricing` · Verifikasi: e2e
- [ ] **T5.1.5** Template & component premium (tier gating; item premium terkunci di Free) — ACC-093 · `apps/api`, `apps/editor` · Verifikasi: int test 402 untuk Free

#### Epic 5.2 — Checkout & siklus langganan

- [ ] **T5.2.1** Adapter gateway langganan platform (sesuai OPEN 08#19) + verifikasi webhook signature + idempotency — ACC-161, ARCHITECTURE §8.g · `apps/api/src/modules/billing`, `apps/api/src/webhooks` · Verifikasi: int test webhook duplikat diproses sekali
- [ ] **T5.2.2** Halaman Billing workspace (paket aktif, periode, invoice, metode) — ACC-160 · `apps/web/(dashboard)/billing` · Verifikasi: e2e
- [ ] **T5.2.3** Checkout langganan baru (upgrade dari Free) end-to-end sandbox — ACC-161 · `apps/api`, `apps/web` · Verifikasi: e2e sandbox → plan aktif → entitlements berubah
- [ ] **T5.2.4** Upgrade antar paket berbayar (proration sesuai OPEN) — ACC-162 · `apps/api` · Verifikasi: unit test kalkulasi
- [ ] **T5.2.5** Downgrade antar paket (efektif akhir periode) — ACC-163 · `apps/api` · Verifikasi: int test
- [ ] **T5.2.6** Pembatalan langganan — ACC-164 · `apps/api`, `apps/web` · Verifikasi: e2e
- [ ] **T5.2.7** Invoice & kwitansi (nomor, PDF) — ACC-165 · `apps/api`, `apps/worker` · Verifikasi: snapshot PDF
- [ ] **T5.2.8** Renewal & reminder (model invoice manual: H-7, H-3, H-1) — ACC-167 · `apps/worker` · Verifikasi: int test jadwal reminder (waktu di-mock)
- [ ] **T5.2.9** Dunning — kegagalan pembayaran (grace, notifikasi) — ACC-169 · `apps/worker`, `apps/api` · Verifikasi: int test
- [ ] **T5.2.10** Downgrade otomatis ke Free + pilihan site yang tetap aktif — ACC-170, ACC-171 · `apps/api`, `apps/web` · Verifikasi: e2e
- [ ] **T5.2.11** Aturan dampak downgrade per resource (badge kembali, domain dilepas, data frozen) — ACC-172, PUB-104 · `apps/api` · Verifikasi: int test per resource
- [ ] **T5.2.12** Reaktivasi & pemulihan — ACC-173 · `apps/api` · Verifikasi: int test
- [ ] **T5.2.13** Refund (manual oleh admin) & kebijakan refund — ACC-174, ACC-207 · `apps/api`, `apps/web/(admin)` · Verifikasi: e2e admin refund tercatat
- [ ] **T5.2.14** (P1) Saldo akun — ACC-175 · `apps/api` · Verifikasi: int test
- [ ] **T5.2.15** (P1) Auto-renew kartu / recurring (bila gateway mendukung) — ACC-168 · `apps/api` · Verifikasi: sandbox
- [ ] **T5.2.16** (P1) Kupon & promo — ACC-111, ACC-206 · `apps/api`, `apps/web/(admin)` · Verifikasi: int test

#### Epic 5.3 — Entitlements lanjutan

- [ ] **T5.3.1** (P1) Grace period kuota — ACC-137 · `apps/api` · Verifikasi: int test
- [ ] **T5.3.2** (P1) Bandwidth metering (Cloudflare analytics → usage) — ACC-138 · `apps/worker` · Verifikasi: int test rollup
- [ ] **T5.3.3** Ledger kredit AI disiapkan (`credit_ledger`, grant bulanan per paket, tanpa konsumsi) — ACC-150, AI-140 · `packages/db`, `apps/api` · Verifikasi: int test grant bulanan idempoten

#### Epic 5.4 — Subdomain nama pilihan

- [ ] **T5.4.1** Aturan subdomain nama pilihan (panjang, karakter, blocklist, pola acak dilarang) — PUB-081 · `apps/api/src/modules/domains` · Verifikasi: unit test
- [ ] **T5.4.2** Upgrade Free → nama pilihan; subdomain acak redirect 301 — PUB-085, PUB-065 · `apps/api`, `apps/site-host` · Verifikasi: e2e redirect 301
- [ ] **T5.4.3** (P1) Deteksi kemiripan brand (anti-phishing) — PUB-083 · `apps/api` · Verifikasi: unit test
- [ ] **T5.4.4** (P1) Rename subdomain (alias, karantina) — PUB-084 · `apps/api` · Verifikasi: int test
- [ ] **T5.4.5** (P1) Release saat downgrade / hapus site — PUB-086 · `apps/worker` · Verifikasi: int test jadwal

#### Epic 5.5 — Custom domain

- [ ] **T5.5.1** Alur connect custom domain (input, instruksi DNS, verifikasi, SSL via Cloudflare for SaaS) + queue `domains` — PUB-100 · `apps/api`, `apps/worker`, `apps/web` · Verifikasi: staging dengan domain uji → SSL aktif
- [ ] **T5.5.2** www vs apex (redirect apex → www MVP) — PUB-101 · `apps/site-host` · Verifikasi: e2e staging
- [ ] **T5.5.3** Pemutusan otomatis saat downgrade (grace) — PUB-104 · `apps/worker` · Verifikasi: int test
- [ ] **T5.5.4** Email & DNS lain milik user tidak terganggu (hanya CNAME/TXT yang diminta) — PUB-105 · docs, `apps/web` · Verifikasi: panduan + checklist
- [ ] **T5.5.5** (P1) Banyak domain per site; troubleshooting UI — PUB-102, PUB-103 · `apps/web` · Verifikasi: e2e
- [ ] **T5.5.6** (P1) Rekonsiliasi DB ↔ KV ↔ Cloudflare — PUB-246 · `apps/worker` · Verifikasi: int test drift terdeteksi

#### Epic 5.6 — Hosting, SEO & analytics berbasis paket

- [ ] **T5.6.1** Badge removal Pro (KV `badge=false`) — PUB-070 · `apps/api`, `apps/site-host` · Verifikasi: e2e
- [ ] **T5.6.2** (P1) Redirect rules buatan user — PUB-067 · `apps/site-host`, `apps/web` · Verifikasi: e2e
- [ ] **T5.6.3** (P1) Password-protected site — PUB-069 · `apps/site-host` · Verifikasi: e2e
- [ ] **T5.6.4** (P1) Injeksi runtime lain oleh Worker — PUB-072 · `apps/site-host` · Verifikasi: unit test
- [ ] **T5.6.5** (P1) Auto-generate OG image — PUB-122 · `apps/worker` · Verifikasi: snapshot gambar
- [ ] **T5.6.6** (P1) JSON-LD dasar (Organization, LocalBusiness) — PUB-124 · `packages/renderer` · Verifikasi: validator schema.org
- [ ] **T5.6.7** (P1) Verifikasi Google Search Console & lainnya — PUB-127 · `apps/web` · Verifikasi: meta muncul
- [ ] **T5.6.8** (P1) Analytics built-in privacy-friendly — PUB-130 · `apps/site-host`, `apps/web` · Verifikasi: e2e views tercatat
- [ ] **T5.6.9** (P1) Integrasi GA4 & Meta Pixel — PUB-131 · `packages/renderer` · Verifikasi: snapshot script
- [ ] **T5.6.10** (P1) Custom code per paket (head/body snippet) — PUB-140 · `apps/web`, `apps/site-host` · Verifikasi: e2e Pro saja
- [ ] **T5.6.11** (P1) Image CDN on-the-fly (evaluasi) — PUB-151 · infra · Verifikasi: catatan keputusan
- [ ] **T5.6.12** (P1) GC aset yatim — PUB-171 · `apps/worker` · Verifikasi: int test
- [ ] **T5.6.13** (P1) Fallback resolusi API hardening & integritas deployment — PUB-061, PUB-218 · `apps/site-host` · Verifikasi: unit test

#### Epic 5.7 — Akun & anti-abuse lanjutan

- [ ] **T5.7.1** 2FA untuk user (TOTP, recovery codes) — ACC-006 · `apps/api/src/auth`, `apps/web` · Verifikasi: e2e
- [ ] **T5.7.2** (P1) Transfer site antar workspace personal — ACC-035 · `apps/api` · Verifikasi: int test
- [ ] **T5.7.3** (P1) Google Safe Browsing / Web Risk check — ACC-243 · `apps/worker` · Verifikasi: int test URL uji
- [ ] **T5.7.4** (P1) Verifikasi nomor HP — ACC-257 · `apps/api` · Verifikasi: int test OTP mock
- [ ] **T5.7.5** (P1) Pemantauan pasca-publish — ACC-258 · `apps/worker` · Verifikasi: int test re-scan terjadwal
- [ ] **T5.7.6** (P1) Email onboarding (drip) — ACC-075 · `apps/worker` · Verifikasi: int test jadwal

#### Epic 5.8 — Admin & metrik bisnis

- [ ] **T5.8.1** Billing records & refund manual di admin — ACC-207 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T5.8.2** Plans & override entitlements lanjutan (P1 bagian) — ACC-205 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T5.8.3** (P1) Dashboard metrik bisnis (MRR, churn, konversi) — ACC-214 · `apps/web/(admin)` · Verifikasi: e2e
- [ ] **T5.8.4** (P1) Funnel aktivasi & retensi — ACC-351 · `apps/api` · Verifikasi: query uji

#### Epic 5.9 — Legal & support berbayar

- [ ] **T5.9.1** (non-kode) Badan usaha final & NPWP; PKP/PPN sesuai keputusan — ACC-310 · owner · Verifikasi: dokumen
- [ ] **T5.9.2** (non-kode) Kebijakan refund terbit — ACC-314 · owner, `apps/web` · Verifikasi: halaman terbit
- [ ] **T5.9.3** (P1) Kanal support per paket — ACC-331 · `apps/web` · Verifikasi: tombol support sesuai paket

### M5.d Exit criteria / demo

- [ ] Demo J8 (PRD): user Free upgrade ke Pro di sandbox → plan aktif → pilih `tokobudi.<domain-situs>` → subdomain acak lama redirect 301 → hubungkan custom domain staging → SSL aktif → badge hilang.
- [ ] Renewal manual, dunning, downgrade otomatis teruji dengan waktu di-mock (integration test).
- [ ] Webhook billing idempoten & terverifikasi signature.
- [ ] Ledger kredit menerima grant bulanan per paket (siap M6).
- [ ] Legal: badan usaha, kebijakan refund, pajak jelas sebelum menagih uang nyata.

### M5.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Recurring payment terbatas di Indonesia (PRD O7) | Model invoice + reminder dulu; auto-debit P1 |
| Custom domain mahal/rumit (A3) | Uji biaya CF for SaaS di staging; Caddy on-demand TLS sebagai cadangan |
| Kesalahan perhitungan uang | Integer IDR, unit test proration, ledger append-only |
| Downgrade merusak situs user | Aturan per resource eksplisit (ACC-172), grace period, notifikasi |

---

## M6 — AI asisten

### M6.a Tujuan & ruang lingkup

Meluncurkan **AI asisten untuk user** — pembeda utama: agent dengan **tools** (Zod) di atas command API, **skills** Markdown, **draft & undo grup**, **kredit/kuota**, observability biaya, eval kualitas, dan trial Free. Mengacu [04 §14](./specs/04-ai-agent.md#14-fase--urutan-implementasi) baris M6.

Termasuk: AI-001–AI-003, AI-007–AI-011, UX §2 (AI-020–AI-034), arsitektur agent (AI-040–AI-051), tools Read/Library/Mutation/Assets/Verification/Meta, skills (AI-080–AI-085), keamanan (AI-100–AI-108), draft (AI-120–AI-124), kredit (AI-140–AI-147), observability (AI-160–AI-164), eval (AI-180–AI-186), bahasa (AI-200–AI-203), failure (AI-210–AI-214), ED-010, DM-070, ACC-094, ACC-150–ACC-152, ACC-242 (P1), ACC-293, CMP-105, CMP-123, CMP-130–CMP-132, CMP-162 (P1).

**Tidak termasuk**: tools data/workflow (M7), tools commerce (M8), sub-agent (AI-050 P2), A/B (AI-184 P2), AI di multiplayer (M9).

### M6.b Prasyarat

- M5 selesai (ledger kredit & entitlement siap). Bila Epic 3.13 dikerjakan, banyak fondasi sudah ada → refinement memangkas task.
- OPEN pemblokir:
  - **PRD O3, O4 / 04 OPEN #1, #9 / 08 OPEN #11, #15** — Starter dapat AI?, trial Free, jumlah kredit per paket, harga top-up.
  - **04 OPEN #2 / OPEN-DM-1** — situs multi-bahasa vs halaman terpisah (mempengaruhi terjemahan AI-008).
  - **04 OPEN #3 / 03 O-7** — embedding untuk `search_components` (pgvector vs layanan).
  - **04 OPEN #4, #5 / 03 O-10** — foto stok & generate gambar AI.
  - **04 OPEN #7** — layanan moderasi gambar.
  - **04 OPEN #8 / 08 OPEN #28** — retensi transkrip & lokasi pemrosesan data (UU PDP) — wajib sebelum rilis AI.

### M6.c Epic & task

#### Epic 6.0 — Refinement

- [ ] **T6.0.1** Rinci ulang M6 (cek apa yang sudah dibangun di Epic 3.13/4.18; putuskan OPEN; perbarui task) — §1.6 · docs · Verifikasi: Lampiran D

#### Epic 6.1 — Fondasi agent (lanjutan/ulang dari Epic 3.13)

- [ ] **T6.1.1** Lifecycle run (`queued → running → waiting_client → succeeded/failed/cancelled`) — AI-040 · `apps/worker/src/ai`, `apps/api` · Verifikasi: unit test transisi
- [ ] **T6.1.2** Agent loop think → tool → observe + budget per run (iterasi, waktu, jumlah perubahan) — AI-041, AI-042, AI-103 · `apps/worker/src/ai` · Verifikasi: unit test batas tercapai → hasil parsial jujur
- [ ] **T6.1.3** Context building & window management (outline, seleksi, theme, ringkasan) — AI-043, AI-044 · `packages/ai-tools/src/context` · Verifikasi: unit test token budget
- [ ] **T6.1.4** Prompt caching (system + skills + outline) — AI-045 · `apps/worker/src/ai` · Verifikasi: int test cache_read_tokens > 0 pada run kedua
- [ ] **T6.1.5** Routing model per tugas (config `AI_MODEL_CONFIG`) — AI-047 · `apps/worker/src/ai` · Verifikasi: unit test pemilihan model
- [ ] **T6.1.6** Konkurensi & antrean (1 run aktif per site, antrean per workspace) — AI-049 · `apps/api`, `apps/worker` · Verifikasi: int test
- [ ] **T6.1.7** Endpoint API AI (create run, stream SSE, cancel, apply, discard, history) — AI-051 · `apps/api/src/modules/ai` · Verifikasi: int test + isolasi tenant
- [ ] **T6.1.8** System prompt berversi — AI-085 · `packages/ai-tools/src/prompts` · Verifikasi: snapshot prompt
- [ ] **T6.1.9** Validasi output AI terhadap document-model (strict) sebelum commit draft — DM-070, AI-102 · `packages/ai-tools` · Verifikasi: unit test output invalid ditolak dengan pesan untuk model
- [ ] **T6.1.10** Retry & fallback model; penanganan penolakan; repair loop terbatas; hasil parsial jujur — AI-210, AI-211, AI-212, AI-213 · `apps/worker/src/ai` · Verifikasi: unit test skenario error
- [ ] **T6.1.11** (P1) Memori percakapan; classifier intent; idempotensi ID tool; eskalasi tier — AI-046, AI-048, AI-062, AI-214 · `apps/worker/src/ai` · Verifikasi: unit test

#### Epic 6.2 — Tools

- [ ] **T6.2.1** Tools Read/inspect (`get_site_overview`, `list_pages`, `get_page_tree`, `get_node`, `find_nodes`, `get_selection`, `get_theme`, `get_site_settings`) — AI-060, AI-102 · `packages/ai-tools/src/tools/read` · Verifikasi: unit test per tool
- [ ] **T6.2.2** Tools Library (`search_components`, `get_component`, `list_component_categories`, `list_templates`, `get_template`, `search_icons`, `list_fonts`) — AI-003 · `packages/ai-tools/src/tools/library` · Verifikasi: unit test
- [ ] **T6.2.3** Tools Mutation page (`create_page`, `update_page`, `duplicate_page`, `delete_page`) + konfirmasi destruktif — AI-026, AI-061 · `packages/ai-tools/src/tools/mutation` · Verifikasi: unit test
- [ ] **T6.2.4** Tools Mutation node (`insert_component`, `create_node`, `update_node_style`, `update_text`, `update_texts_bulk`, `set_prop`, `set_variant`, `swap_component`) — AI-061 · `packages/ai-tools` · Verifikasi: unit test di Y.Doc fixture
- [ ] **T6.2.5** Tools Mutation struktur (`replace_image`, `set_link`, `move_node`, `duplicate_node`, `delete_node`, `rename_node`, `wrap_in_auto_layout`, `set_auto_layout`) — AI-061 · `packages/ai-tools` · Verifikasi: unit test
- [ ] **T6.2.6** Tools responsif & theme (`set_breakpoint_override`, `clear_breakpoint_override`, `detach_instance`, `apply_theme`, `update_site_settings`) — AI-061 · `packages/ai-tools` · Verifikasi: unit test
- [ ] **T6.2.7** Tools Assets (`search_stock_image`, `import_stock_image`, `upload_from_url` via SSRF guard, `list_site_assets`, `generate_alt_text`, `extract_palette_from_image`, `fetch_webpage_content`) — AI-010, AI-104 · `packages/ai-tools/src/tools/assets` · Verifikasi: unit test; SSRF test
- [ ] **T6.2.8** Tools Verification (`render_preview`, `check_accessibility`, `check_responsive`, `check_links`) — AI-186 · `packages/ai-tools/src/tools/verify` · Verifikasi: int test screenshot
- [ ] **T6.2.9** Tools Meta (`read_skill`, `ask_user`, `propose_plan`, `finish`) — AI-023, AI-024, AI-081 · `packages/ai-tools/src/tools/meta` · Verifikasi: unit test
- [ ] **T6.2.10** Gating tool per paket & mode (registry per entitlement) — AI-011 · `packages/ai-tools/src/registry.ts` · Verifikasi: unit test Free tanpa tool premium
- [ ] **T6.2.11** (P1) `generate_image` (tergantung OPEN 04#5) — AI-001 · `packages/ai-tools` · Verifikasi: sesuai keputusan

#### Epic 6.3 — Skills (konten)

- [ ] **T6.3.1** Format & loader skill (frontmatter: name, description, triggers; versioning) — AI-080, AI-081, AI-083 · `packages/ai-tools/src/skills-loader.ts` · Verifikasi: unit test
- [ ] **T6.3.2** Skill dasar desain: `design-principles`, `layout-patterns`, `typography-color`, `responsive-rules`, `accessibility` — AI-082 · `packages/ai-tools/skills` · Verifikasi: eval subset lulus
- [ ] **T6.3.3** Skill library & onboarding: `using-component-library`, `onboarding-site-generation`, `image-selection`, `theme-generation` — AI-082 · `packages/ai-tools/skills` · Verifikasi: eval subset
- [ ] **T6.3.4** Skill konten: `copywriting-id`, `copywriting-en`, `translation-id-en`, `seo-basics`, `content-policy` — AI-082 · `packages/ai-tools/skills` · Verifikasi: eval subset
- [ ] **T6.3.5** Skill jenis situs: `building-landing-page`, `building-company-profile`, `building-portfolio` — AI-082 · `packages/ai-tools/skills` · Verifikasi: eval subset
- [ ] **T6.3.6** Evaluasi skill per perubahan (regression) — AI-084, AI-181 · `packages/ai-tools/evals` · Verifikasi: CI manual `ai-evals.yml`

#### Epic 6.4 — UX AI di editor

- [ ] **T6.4.1** AI panel di editor (dock kanan, riwayat) — ED-010, AI-020 · `apps/editor/src/ai` · Verifikasi: e2e dengan model mock
- [ ] **T6.4.2** Streaming progress per tool call — AI-025 · `apps/editor/src/ai` · Verifikasi: e2e
- [ ] **T6.4.3** Ringkasan perubahan + Preview / Terapkan / Batalkan semua; preview draft di editor — AI-027, AI-124 · `apps/editor/src/ai` · Verifikasi: e2e terapkan → 1 undo
- [ ] **T6.4.4** Undo grup (satu run = satu langkah undo) — AI-028, DM-060 · `apps/editor/src/document` · Verifikasi: e2e
- [ ] **T6.4.5** Prompt di canvas (inline pada seleksi) — AI-021 · `apps/editor` · Verifikasi: e2e
- [ ] **T6.4.6** Quick actions (redesign, perpendek teks, terjemahkan, ganti gaya) — AI-022, AI-002 · `apps/editor` · Verifikasi: e2e
- [ ] **T6.4.7** Pertanyaan klarifikasi & Mode Plan — AI-023, AI-024 · `apps/editor/src/ai` · Verifikasi: e2e
- [ ] **T6.4.8** Riwayat percakapan per site — AI-029 · `apps/api`, `apps/editor` · Verifikasi: e2e
- [ ] **T6.4.9** Indikator kredit & estimasi di UI — AI-031, ACC-151 · `apps/editor` · Verifikasi: e2e
- [ ] **T6.4.10** Konflik dengan edit user bersamaan (lock area / rebase draft) — AI-123 · `apps/editor`, `packages/ai-tools` · Verifikasi: unit test merge draft
- [ ] **T6.4.11** Feedback 👍👎 — AI-185 · `apps/editor`, `apps/api` · Verifikasi: int test `ai_feedback`
- [ ] **T6.4.12** (P1) Status & feedback UI; indikator konflik paralel; lampiran di chat; aksesibilitas panel AI — AI-030, AI-032, AI-033, AI-034 · `apps/editor/src/ai` · Verifikasi: e2e

#### Epic 6.5 — Kemampuan utama

- [ ] **T6.5.1** Asisten desain & konten umum — AI-001 · end-to-end · Verifikasi: eval skenario "ubah hero jadi lebih profesional"
- [ ] **T6.5.2** Redesign seleksi atau halaman — AI-002 · end-to-end · Verifikasi: eval
- [ ] **T6.5.3** Merakit halaman dari library — AI-003 · end-to-end · Verifikasi: eval node bebas < 10%
- [ ] **T6.5.4** Onboarding: generate website dari deskripsi bisnis (alur dashboard → editor) — AI-007, ACC-051, ACC-071 · `apps/web`, `apps/worker` · Verifikasi: e2e J4 dengan model mock + eval nyata
- [ ] **T6.5.5** Copywriting & terjemahan ID↔EN — AI-008 · end-to-end · Verifikasi: eval
- [ ] **T6.5.6** (P1) Generate theme dari logo — AI-009, CMP-123 · end-to-end · Verifikasi: eval
- [ ] **T6.5.7** (P1) Alt text & SEO otomatis — AI-010 · end-to-end · Verifikasi: eval
- [ ] **T6.5.8** (P1) Auto-fill konten template dengan AI — CMP-105 · `apps/web` · Verifikasi: e2e
- [ ] **T6.5.9** Bahasa: respons mengikuti user, konten mengikuti bahasa situs, format lokal — AI-200, AI-201, AI-202, ACC-293 · `packages/ai-tools/src/prompts` · Verifikasi: eval bilingual
- [ ] **T6.5.10** (P1) Istilah teknis untuk non-designer — AI-203 · skills · Verifikasi: review

#### Epic 6.6 — Keamanan AI

- [ ] **T6.6.1** AI hanya lewat tools; tenant isolation (siteId dari server, bukan model) — AI-100, AI-101 · `apps/worker/src/ai` · Verifikasi: unit test tool menolak siteId dari input
- [ ] **T6.6.2** Prompt injection: konten situs/web sebagai data (delimiting, instruksi) — AI-104 · `packages/ai-tools` · Verifikasi: eval adversarial ≥ 10 kasus
- [ ] **T6.6.3** Kebijakan konten & moderasi output (teks & gambar) — AI-105 · `apps/worker` · Verifikasi: eval konten terlarang ditolak
- [ ] **T6.6.4** Tidak ada akses kredensial & PII sensitif — AI-106 · `packages/ai-tools` · Verifikasi: unit test redaksi
- [ ] **T6.6.5** Audit log run & tool call — AI-107, AI-161 · `apps/worker`, `packages/db` · Verifikasi: int test
- [ ] **T6.6.6** Data pengguna & pelatihan (opt-out, retensi transkrip sesuai OPEN) — AI-108 · `apps/api`, docs · Verifikasi: kebijakan diperbarui
- [ ] **T6.6.7** (P1) AI classifier untuk moderasi situs — ACC-242 · `apps/worker` · Verifikasi: eval

#### Epic 6.7 — Kredit & kuota

- [ ] **T6.7.1** Unit kredit & kuota per paket (config) — AI-140, AI-141 · `apps/api/src/modules/billing` · Verifikasi: unit test
- [ ] **T6.7.2** Estimasi sebelum run besar — AI-142 · `apps/api` · Verifikasi: unit test
- [ ] **T6.7.3** Reservasi & pemotongan kredit (reserve → settle) + yang tidak dipotong + refund saat gagal sistem — AI-143, AI-144, AI-145, ACC-150 · `apps/api`, `apps/worker` · Verifikasi: int test ledger seimbang
- [ ] **T6.7.4** Rate limit AI per user/workspace — AI-146 · `apps/api` · Verifikasi: int test 429
- [ ] **T6.7.5** Trial AI untuk Free — AI-147, ACC-094 · `apps/api` · Verifikasi: int test trial habis → 402
- [ ] **T6.7.6** Top-up kredit AI (checkout via billing M5) — ACC-152 · `apps/api`, `apps/web` · Verifikasi: e2e sandbox
- [ ] **T6.7.7** Tampilan kredit di editor & dashboard — ACC-151 · `apps/editor`, `apps/web` · Verifikasi: e2e

#### Epic 6.8 — Observability & biaya

- [ ] **T6.8.1** Logging token & biaya per run (input/output/cache) — AI-160 · `apps/worker` · Verifikasi: int test
- [ ] **T6.8.2** Tracing tool call (durasi, error) — AI-161 · `apps/worker` · Verifikasi: int test
- [ ] **T6.8.3** Budget global (kill switch) — AI-164 · `apps/api`, `apps/worker` · Verifikasi: int test kill switch → run ditolak
- [ ] **T6.8.4** (P1) Dashboard biaya & kualitas admin; alert — AI-162, AI-163 · `apps/web/(admin)/ai` · Verifikasi: e2e

#### Epic 6.9 — Kualitas & evaluasi

- [ ] **T6.9.1** Eval set skenario UMKM (≥ 50) + runner dengan budget — AI-180 · `packages/ai-tools/evals` · Verifikasi: baseline skor tercatat
- [ ] **T6.9.2** Regression test tool & skill di CI (model mock + snapshot) — AI-181 · `packages/ai-tools` · Verifikasi: CI hijau
- [ ] **T6.9.3** Self-check kualitas dalam run (screenshot → periksa → perbaiki terbatas) — AI-186 · `apps/worker/src/ai` · Verifikasi: eval peningkatan skor
- [ ] **T6.9.4** (P1) Golden screenshots; human review internal — AI-182, AI-183 · `packages/ai-tools/evals` · Verifikasi: proses berjalan

#### Epic 6.10 — AI untuk produksi library (admin, P1)

- [ ] **T6.10.1** (P1) Alur "admin buat 1 → AI variasi → kurasi" + skills & tools admin final — CMP-130, CMP-131, CMP-132 · `packages/ai-tools`, `apps/editor` · Verifikasi: 10 variasi dikurasi
- [ ] **T6.10.2** (P1) Semantic search pgvector untuk AI (tergantung OPEN 03 O-7) — CMP-162 · `packages/db`, `apps/api` · Verifikasi: int test relevansi

### M6.d Exit criteria / demo

- [ ] Demo J4 (PRD): "Buatkan website katering rumahan di Bandung, warna hijau" → AI menyusun 4 halaman dari library dengan copy ID → preview → Terapkan → seluruh perubahan undo dalam 1 langkah.
- [ ] Redesign seleksi & terjemahan ID→EN berjalan via quick action.
- [ ] Eval baseline: ≥ 70% skenario lulus rubric; 0 pelanggaran keamanan di eval adversarial.
- [ ] Kredit: reserve/settle/refund seimbang; trial Free; kill switch teruji.
- [ ] Biaya rata-rata per run tercatat & di bawah asumsi spec 08 §7.2.

### M6.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Biaya AI membengkak (PRD R5) | Kredit, routing model, caching, batas iterasi, kill switch |
| Kualitas tidak konsisten (PRD R6) | Component jadi + skills, self-check screenshot, eval set, draft + undo |
| Prompt injection dari konten web | Konten sebagai data, tools terbatas, tanpa kredensial |
| Model/API berubah | Model ID dari config; abstraksi klien |

---

## M7 — Website dinamis

### M7.a Tujuan & ruang lingkup

Website **dinamis lewat AI**: collections (tabel per situs), bindings (repeater, field mapping, detail page, visibility), forms, **login member** situs, access rules, blok **dashboard/table/CRUD**, **workflows** (trigger → steps), runtime API & islands — semuanya dikonfigurasi AI lewat tools dan bisa dilihat/diedit visual oleh user. Hanya untuk paket yang menyertakan AI (DATA-002).

M7 dipecah sesuai [05 §17](./specs/05-dynamic-data.md#17-fase--prioritas):

| Sub-fase | Isi | Dependensi |
|---|---|---|
| **M7.1** Data inti | `records` + scoping, collections & field P0, Data Manager grid, import/export, kuota | M6 |
| **M7.2** Bindings & publish | Repeater, field mapping, detail page, formatter, snapshot + on-demand render, islands core, runtime API read | M7.1 |
| **M7.3** Forms | Form node, mapping, validasi, anti-spam, upload, inbox | M7.2 |
| **M7.4** Member & access | Auth email/password, magic link/OTP, session, roles, halaman terproteksi, komponen auth, access rules | M7.2, M7.3 |
| **M7.5** Dashboard blocks | DataTable, detail view, form modal, stat cards, template admin & member | M7.4 |
| **M7.6** Workflows | Engine, trigger & step P0, sync/async, retry, run history, versioning, editor list | M7.3 |
| **M7.7** AI | Tools data/binding/form/workflow, rencana, validasi, undo | M7.1–M7.6 |
| **M7.8** Hardening | Tenant-escape suite, XSS, secret, audit (baris "Hardening" di 05 §17) | M7.1–M7.7 |
| **M7.9** Commerce ringan | Order via WhatsApp ([06 COM-190](./specs/06-commerce-payments.md#com-190-rencana-fase-commerce) baris M7) | M7.2 |

**Tidak termasuk**: formula field (P2), multi-step form (P2), WhatsApp OTP (P2), kanban/calendar (P2), realtime update (P2), custom code sandbox (P2), payment gateway (M8).

### M7.b Prasyarat

- M6 selesai (agent loop, AI transaction, kredit) — prasyarat M7.7.
- OPEN pemblokir (05 §18 kecuali disebut lain):
  - **#1 / PRD O3** — Starter dapat dinamis terbatas — sebelum M7.1 (gating DATA-002).
  - **#7** — end-user auth: modul sendiri vs Better Auth multi-tenant — sebelum M7.4.
  - **#5** — halaman terproteksi: SSR privat vs shell + client fetch — sebelum M7.4.
  - **#8 / ARCHITECTURE A14 / 07 OPEN #3** — runtime islands Preact vs React — **spike di awal M7.2**.
  - **#6 / ARCHITECTURE A7** — scanning malware upload (ClamAV) — sebelum M7.3 (upload).
  - **#4 / PRD O9 / ARCHITECTURE A13** — provider WhatsApp — sebelum `send_whatsapp` (P1) di M7.6.
  - **#9** — angka kuota final — sebelum T7.1.5.1.
  - **#10** — domain pengirim email kustom (DKIM) Pro — non-pemblokir (P1).
  - **#11** — rule `exists` naik ke P0 — sebelum M7.4 access rules.
  - **#12** — kebijakan data saat downgrade — sebelum M7.1 selesai.
  - **#2 / PRD O12** — form kontak paket statis — mempengaruhi DATA-120 (P1).
  - **OPEN-DM-8** — ekspresi kondisional sederhana di binding — sebelum M7.2.
  - **OPEN-DM-4** — style bagian internal `formField` — sebelum M7.3.
  - **02 OPEN #12 / OPEN-DM-1** — model konten multi-bahasa (harus diputuskan sebelum M7 agar binding kompatibel).
  - **04 OPEN #6** — konfigurasi data AI: pending sampai Terapkan vs langsung + kompensasi — sebelum M7.7.
  - **06 OPEN #3** — Order via WhatsApp di paket mana — sebelum M7.9.

### M7.c Epic & task

#### Epic 7.0 — Refinement & spike

- [ ] **T7.0.1** Rinci ulang M7 per sub-fase; putuskan OPEN pemblokir M7.1 — §1.6 · docs · Verifikasi: Lampiran D
- [ ] **T7.0.2** 🧪 Spike runtime islands: Preact + `preact/compat` vs React; ukur bundle (< 30 KB gz) & hydration — PUB-029, DATA-300 · `packages/renderer/src/islands` · Verifikasi: tabel ukuran & keputusan (tutup A14)

### M7.1 — Data inti

#### Epic 7.1.1 — Konsep & gating

- [ ] **T7.1.1.1** Pemisahan control plane (Platform API) vs data plane (Runtime API) di struktur modul — DATA-001, ARCHITECTURE §12 · `apps/api/src/modules/collections`, `apps/api/src/runtime` · Verifikasi: lint:deps/dir rule
- [ ] **T7.1.1.2** Gating fitur dinamis per paket (entitlement `dynamic.*`) — DATA-002 · `apps/api` · Verifikasi: int test Free → 402
- [ ] **T7.1.1.3** Konfigurasi dinamis sebagai JSON tervalidasi Zod (collection schema, permissions) — DATA-003 · `packages/shared/src/contracts` · Verifikasi: unit test

#### Epic 7.1.2 — Collections & field

- [ ] **T7.1.2.1** ⚑ Tabel `collections` (schema jsonb, schema_version, permissions) — DATA-010 · `packages/db/src/schema/dynamic.ts` · Verifikasi: migration
- [ ] **T7.1.2.2** CRUD collection (control plane) + audit — DATA-010 · `apps/api/src/modules/collections` · Verifikasi: int test + isolasi tenant
- [ ] **T7.1.2.3** Tipe field P0 (text, richText, number, currency, boolean, date, select, image, file, reference, email, phone, url) — DATA-011 · `packages/shared`, `apps/api` · Verifikasi: unit test per tipe
- [ ] **T7.1.2.4** Validasi per field, default value, slug & display field — DATA-014, DATA-015, DATA-016 · `apps/api` · Verifikasi: unit test
- [ ] **T7.1.2.5** Operasi schema dengan migrasi aman (rename, ubah tipe, hapus → job migrasi data) — DATA-018 · `apps/api`, `apps/worker` · Verifikasi: int test 1.000 record dimigrasi
- [ ] **T7.1.2.6** Batas schema per paket — DATA-019 · `apps/api` · Verifikasi: int test
- [ ] **T7.1.2.7** Collection sistem (members, form_submissions, orders kelak) — DATA-020 · `apps/api` · Verifikasi: int test tidak bisa dihapus
- [ ] **T7.1.2.8** (P1) Tipe `multiReference`; index yang bisa dikonfigurasi — DATA-012, DATA-017 · `apps/api` · Verifikasi: int test

#### Epic 7.1.3 — Penyimpanan records

- [ ] **T7.1.3.1** ⚑ Tabel generik `records` (data jsonb, owner_member_id, soft delete) — DATA-040 · `packages/db` · Verifikasi: migration
- [ ] **T7.1.3.2** Scoping `site_id` wajib di repository + RLS defense-in-depth — DATA-041, ARCHITECTURE §6.2 · `packages/db`, `apps/api` · Verifikasi: int test query tanpa scope gagal
- [ ] **T7.1.3.3** Index GIN & expression index (untuk field filter/sort) — DATA-042 · `packages/db` · Verifikasi: EXPLAIN memakai index pada 100k record
- [ ] **T7.1.3.4** Soft delete & trash — DATA-043 · `apps/api` · Verifikasi: int test
- [ ] **T7.1.3.5** Optimistic concurrency (version/updated_at) — DATA-044 · `apps/api` · Verifikasi: int test 409
- [ ] **T7.1.3.6** Audit log record (P0) & revisi (UI P1) — DATA-045 · `apps/api` · Verifikasi: int test
- [ ] **T7.1.3.7** Ukuran record & kuota storage — DATA-046 · `apps/api` · Verifikasi: int test > batas → 413/402
- [ ] **T7.1.3.8** Export CSV — DATA-047 · `apps/api`, `apps/worker` · Verifikasi: int test
- [ ] **T7.1.3.9** Import CSV (mapping kolom, validasi, laporan error) — DATA-048 · `apps/api`, `apps/worker` · Verifikasi: int test file 5.000 baris

#### Epic 7.1.4 — Data Manager UI

- [ ] **T7.1.4.1** Route `(dashboard)/sites/[siteId]/data` + daftar collection — DATA-060 · `apps/web` · Verifikasi: e2e
- [ ] **T7.1.4.2** Grid spreadsheet CRUD (virtualized) — DATA-060 · `apps/web` · Verifikasi: e2e tambah/edit/hapus
- [ ] **T7.1.4.3** Filter, sort, search — DATA-061 · `apps/web`, `apps/api` · Verifikasi: e2e
- [ ] **T7.1.4.4** Kelola kolom/field dari grid — DATA-062 · `apps/web` · Verifikasi: e2e
- [ ] **T7.1.4.5** Bulk edit & bulk delete — DATA-063 · `apps/web` · Verifikasi: e2e
- [ ] **T7.1.4.6** Upload file & image di grid — DATA-064 · `apps/web` · Verifikasi: e2e
- [ ] **T7.1.4.7** Relasi picker — DATA-065 · `apps/web` · Verifikasi: e2e
- [ ] **T7.1.4.8** Member manager (daftar, status, roles) — DATA-066 · `apps/web` · Verifikasi: e2e (aktif penuh setelah M7.4)
- [ ] **T7.1.4.9** Panel Data di editor (lihat collection, buka Data Manager) — ED-008 · `apps/editor/src/panels/data` · Verifikasi: e2e
- [ ] **T7.1.4.10** (P1) Aksesibilitas & i18n Data Manager — DATA-067 · `apps/web` · Verifikasi: axe

#### Epic 7.1.5 — Kuota

- [ ] **T7.1.5.1** Penegakan kuota records/collections/storage per paket — DATA-340 · `apps/api` · Verifikasi: int test

### M7.2 — Bindings & publish

#### Epic 7.2.1 — Document model & renderer

- [ ] **T7.2.1.1** ⚑ Format binding `bindings: { path: { $bind, filters } }` + `$template` — DM-052 · `packages/document-model` · Verifikasi: fixture spec 01 §20.2
- [ ] **T7.2.1.2** Filter/formatter (currency, date, imageVariant, truncate) — DM-053, DATA-087 · `packages/document-model` · Verifikasi: unit test
- [ ] **T7.2.1.3** Keamanan expression (parser sendiri, tanpa eval, allowlist) — DM-054 · `packages/document-model` · Verifikasi: unit test payload jahat
- [ ] **T7.2.1.4** Node `dataList` & `dataTable` (schema + renderer) — DM-023 · `packages/document-model`, `packages/renderer` · Verifikasi: snapshot
- [ ] **T7.2.1.5** Command data (bind/unbind, set data source) — DM-074 · `packages/document-model/src/ops` · Verifikasi: unit test
- [ ] **T7.2.1.6** Interactions M7 (`submitForm`, `runWorkflow`, `logout`) di dokumen — DM-055 · `packages/document-model` · Verifikasi: unit test schema

#### Epic 7.2.2 — Bindings di editor

- [ ] **T7.2.2.1** Repeater/list binding (pilih collection, limit, sort, filter DSL) — DATA-080 · `apps/editor/src/panels/properties/data` · Verifikasi: e2e
- [ ] **T7.2.2.2** Field mapping ke props component — DATA-081 · `apps/editor` · Verifikasi: e2e
- [ ] **T7.2.2.3** Detail page (dynamic route `/produk/[slug]`) — DATA-082 · `apps/editor`, `packages/document-model` · Verifikasi: e2e
- [ ] **T7.2.2.4** Conditional visibility (`visibleWhen`) — DATA-083 · `apps/editor` · Verifikasi: e2e
- [ ] **T7.2.2.5** Current user binding — DATA-084 · `apps/editor` · Verifikasi: e2e (aktif setelah M7.4)
- [ ] **T7.2.2.6** Query params & route params — DATA-085 · `apps/editor` · Verifikasi: e2e
- [ ] **T7.2.2.7** Action binding pada button/link — DATA-086 · `apps/editor` · Verifikasi: e2e
- [ ] **T7.2.2.8** Data contoh & preview di editor — DATA-088 · `apps/editor` · Verifikasi: e2e
- [ ] **T7.2.2.9** Blok dinamis di Insert panel — ED-171 · `apps/editor/src/panels/insert` · Verifikasi: e2e
- [ ] **T7.2.2.10** (P1) Teks dinamis & placeholder — ED-127 · `apps/editor` · Verifikasi: e2e

#### Epic 7.2.3 — Runtime API read, islands & publish

- [ ] **T7.2.3.1** Runtime API v1 kerangka (`/runtime/v1`, token per site dari site-host) — DATA-290 · `apps/api/src/runtime` · Verifikasi: int test
- [ ] **T7.2.3.2** Routing `/_api/v1/*` di site-host → runtime API + signed token — PUB-068 · `apps/site-host/src/runtime-proxy.ts` · Verifikasi: e2e
- [ ] **T7.2.3.3** Caching & invalidasi; CORS; ukuran respons & pagination — DATA-293, DATA-294, DATA-295 · `apps/api/src/runtime` · Verifikasi: int test
- [ ] **T7.2.3.4** Islands runtime JS (data-bound list, hydrate dari snapshot) — DATA-300, PUB-029 · `packages/renderer/src/islands` · Verifikasi: bundle < 30 KB gz
- [ ] **T7.2.3.5** Snapshot publish data + refresh client — DATA-301 · `apps/worker/src/publish` · Verifikasi: e2e data baru muncul tanpa publish ulang
- [ ] **T7.2.3.6** On-demand render detail page — DATA-302 · `apps/api`, `apps/site-host` · Verifikasi: e2e record baru → URL detail 200
- [ ] **T7.2.3.7** Validasi binding saat publish — DATA-089 · `apps/worker/src/publish` · Verifikasi: unit test binding rusak → error publish
- [ ] **T7.2.3.8** Sitemap dinamis (collection pages) & JSON-LD Article (P1) — PUB-124 · `apps/worker` · Verifikasi: snapshot

### M7.3 — Forms

- [ ] **T7.3.1.1** Node `form` & `formField` (schema + renderer, style internal sesuai OPEN-DM-4) — DM-022, DATA-110 · `packages/document-model`, `packages/renderer` · Verifikasi: snapshot
- [ ] **T7.3.1.2** Mapping form ke collection (create/update) — DATA-111 · `apps/editor`, `apps/api` · Verifikasi: e2e
- [ ] **T7.3.1.3** Validasi client & server — DATA-112 · `packages/renderer/src/islands`, `apps/api/src/runtime` · Verifikasi: int test
- [ ] **T7.3.1.4** Anti-spam: honeypot, waktu minimum, rate limit — DATA-113 · `apps/api/src/runtime` · Verifikasi: int test
- [ ] **T7.3.1.5** Cloudflare Turnstile — DATA-114 · `apps/api`, `packages/renderer` · Verifikasi: int test token invalid ditolak
- [ ] **T7.3.1.6** Upload file di form (+ scanning sesuai OPEN 05#6) — DATA-115, DATA-322 · `apps/api/src/runtime`, `apps/worker` · Verifikasi: int test mime terlarang ditolak
- [ ] **T7.3.1.7** Success / redirect / message — DATA-116 · `packages/renderer` · Verifikasi: e2e
- [ ] **T7.3.1.8** Notifikasi submit (via workflow default) — DATA-117 · `apps/api` · Verifikasi: e2e email owner (setelah M7.6; sementara email langsung)
- [ ] **T7.3.1.9** Form standalone (tanpa collection) — DATA-118 · `apps/api` · Verifikasi: int test
- [ ] **T7.3.1.10** Inbox form di dashboard — DATA-119 · `apps/web` · Verifikasi: e2e
- [ ] **T7.3.1.11** Auth & CSRF data plane; rate limit per site — DATA-291, DATA-292 · `apps/api/src/runtime` · Verifikasi: int test
- [ ] **T7.3.1.12** (P1) Form kontak dasar untuk paket statis (jika OPEN disetujui) — DATA-120 · `apps/api` · Verifikasi: int test kuota Free

### M7.4 — Member & access

#### Epic 7.4.1 — End-user auth

- [ ] **T7.4.1.1** ⚑ Tabel `members`, `member_sessions` (per site) — DATA-140, ARCHITECTURE §9.2 · `packages/db` · Verifikasi: migration
- [ ] **T7.4.1.2** Register & login email + password; hash password (argon2id) — DATA-140, DATA-141, DATA-142 · `apps/api/src/runtime/members` · Verifikasi: int test
- [ ] **T7.4.1.3** Magic link / OTP email — DATA-143 · `apps/api/src/runtime/members` · Verifikasi: int test
- [ ] **T7.4.1.4** Forgot password & reset; verifikasi email — DATA-146, DATA-147 · `apps/api/src/runtime/members` · Verifikasi: e2e via Mailpit
- [ ] **T7.4.1.5** Session & cookie per site (host-only, HttpOnly, SameSite) — DATA-148 · `apps/api`, `apps/site-host` · Verifikasi: int test cookie tidak lintas situs
- [ ] **T7.4.1.6** Roles kustom per site; profil member — DATA-149, DATA-150 · `apps/api`, `apps/web` · Verifikasi: int test
- [ ] **T7.4.1.7** Halaman terproteksi (sesuai OPEN 05#5) — DATA-151 · `packages/renderer`, `apps/site-host` · Verifikasi: e2e non-member → redirect login
- [ ] **T7.4.1.8** Node `authBlock` & komponen auth siap pakai — DM-024, DATA-152 · `packages/document-model`, `packages/renderer` · Verifikasi: e2e
- [ ] **T7.4.1.9** Rate limit & lockout; batas member per paket — DATA-153, DATA-154 · `apps/api` · Verifikasi: int test
- [ ] **T7.4.1.10** Hak subjek data (export/hapus data member) — DATA-170 · `apps/api`, `apps/web` · Verifikasi: int test
- [ ] **T7.4.1.11** Katalog auth blocks (konten library) — CMP-091 · library · Verifikasi: ≥ 6 variasi published
- [ ] **T7.4.1.12** (P1) Google login member; field sensitif — DATA-144, DATA-171 · `apps/api` · Verifikasi: int test

#### Epic 7.4.2 — Access rules

- [ ] **T7.4.2.1** Access rules per collection & operasi (public, member, owner-only, role) — DATA-180 · `apps/api/src/runtime` · Verifikasi: int test matriks
- [ ] **T7.4.2.2** Default aman (deny) — DATA-181 · `apps/api` · Verifikasi: int test collection baru → tidak terbaca publik
- [ ] **T7.4.2.3** Access rule pada relasi & agregasi — DATA-183 · `apps/api` · Verifikasi: int test tidak bocor via reference expand
- [ ] **T7.4.2.4** Page access & visibility tidak menggantikan rule — DATA-185 · `apps/api` · Verifikasi: int test
- [ ] **T7.4.2.5** Rule `exists` (relasi) — direkomendasikan naik P0 (OPEN 05#11) — DATA-186 · `apps/api` · Verifikasi: int test pola membership kursus
- [ ] **T7.4.2.6** (P1) Field-level permissions; simulator rule — DATA-182, DATA-184 · `apps/api`, `apps/web` · Verifikasi: int test

### M7.5 — Dashboard blocks

- [ ] **T7.5.1.1** Data Table block (sort, filter, pagination, aksi) — DATA-200 · `packages/renderer/src/islands`, library · Verifikasi: e2e
- [ ] **T7.5.1.2** Detail view block — DATA-202 · library · Verifikasi: e2e
- [ ] **T7.5.1.3** Create/edit form modal — DATA-203 · library · Verifikasi: e2e CRUD lengkap dari situs
- [ ] **T7.5.1.4** Stat cards — DATA-204 · library · Verifikasi: e2e
- [ ] **T7.5.1.5** Katalog dashboard widgets data-bound (konten) — CMP-090 · library · Verifikasi: ≥ 12 variasi
- [ ] **T7.5.1.6** Template "Dashboard admin toko" — DATA-207 · library · Verifikasi: QA
- [ ] **T7.5.1.7** Template "Dashboard member" — DATA-208 · library · Verifikasi: QA
- [ ] **T7.5.1.8** Template dinamis ≥ 4 (booking bengkel/salon, kursus member, listing properti, RSVP) + sample data collections (P1) — CMP-102, CMP-106 · library · Verifikasi: QA
- [ ] **T7.5.1.9** (P1) Inline edit di table; charts — DATA-201, DATA-205 · library · Verifikasi: e2e

### M7.6 — Workflows

- [ ] **T7.6.1.1** ⚑ Tabel `workflows`, `workflow_runs`, `workflow_run_steps` + model JSON — DATA-230 · `packages/db` · Verifikasi: migration
- [ ] **T7.6.1.2** `packages/workflow-blocks`: interpreter + ports (db, email, http) murni — DATA-230, ARCHITECTURE §11.1 · `packages/workflow-blocks` · Verifikasi: unit test ≥ 85% coverage
- [ ] **T7.6.1.3** Expression engine aman — DATA-239 · `packages/workflow-blocks/src/expressions` · Verifikasi: unit test fuzz
- [ ] **T7.6.1.4** Trigger P0 (record.created/updated, form.submitted, member.registered) — DATA-231 · `apps/api`, `apps/worker` · Verifikasi: int test
- [ ] **T7.6.1.5** Schedule (cron, repeatable job) — DATA-232 · `apps/worker` · Verifikasi: int test
- [ ] **T7.6.1.6** Steps P0 (create/update/delete record, condition, loop, set_variable, compute) — DATA-233, DATA-237 · `packages/workflow-blocks/src/blocks` · Verifikasi: unit test per blok
- [ ] **T7.6.1.7** `send_email` (template, variabel, outbound_messages) — DATA-234 · `packages/workflow-blocks`, `apps/worker` · Verifikasi: int test Mailpit
- [ ] **T7.6.1.8** Operasi atomik pada `update_record` (increment, stok) — DATA-247 · `packages/workflow-blocks` · Verifikasi: int test konkurensi
- [ ] **T7.6.1.9** Eksekusi sync vs async — DATA-240 · `apps/api`, `apps/worker` · Verifikasi: int test
- [ ] **T7.6.1.10** Retry & idempotency; batas eksekusi — DATA-241, DATA-242 · `apps/worker` · Verifikasi: int test
- [ ] **T7.6.1.11** Run history & debugging UI — DATA-243 · `apps/web` · Verifikasi: e2e
- [ ] **T7.6.1.12** Versioning workflow — DATA-244 · `apps/api` · Verifikasi: int test run memakai versi saat trigger
- [ ] **T7.6.1.13** Visual workflow editor bentuk list (node graph = P2) — DATA-245 · `apps/web` · Verifikasi: e2e
- [ ] **T7.6.1.14** (P1) `send_whatsapp`, `http_request` (SSRF guard), `delay`, workflow template — DATA-235, DATA-236, DATA-238, DATA-246 · `packages/workflow-blocks` · Verifikasi: int test

### M7.7 — AI untuk website dinamis

- [ ] **T7.7.1.1** Tools Data (`list_collections`, `get_collection`, `list_workflows`, `create_collection`, `add_field`, `update_field`, `remove_field`, `insert_records`, `delete_records`) — AI-004 · `packages/ai-tools/src/tools/data` · Verifikasi: unit test
- [ ] **T7.7.1.2** Tools binding/form/workflow/auth (`bind_list`, `bind_field`, `bind_form`, `create_workflow`, `update_workflow`, `configure_auth`, `set_page_access`, `create_crud_view`, `validate_bindings`) — AI-004 · `packages/ai-tools` · Verifikasi: unit test
- [ ] **T7.7.1.3** Perencanaan data model oleh AI (propose plan) — DATA-350 · `packages/ai-tools` · Verifikasi: eval
- [ ] **T7.7.1.4** Validasi konfigurasi sebelum apply — DATA-351 · `apps/worker/src/ai` · Verifikasi: unit test
- [ ] **T7.7.1.5** Apply transaksional & undo + compensating actions (perubahan non-dokumen) — DATA-352, AI-125 · `apps/worker`, `apps/api` · Verifikasi: int test batal → collection terhapus
- [ ] **T7.7.1.6** Transparansi & edit visual (ringkasan konfigurasi AI di panel Data) — DATA-353 · `apps/editor`, `apps/web` · Verifikasi: e2e
- [ ] **T7.7.1.7** Privasi data dalam konteks AI (sampel terbatas, redaksi PII) — DATA-354 · `packages/ai-tools` · Verifikasi: unit test
- [ ] **T7.7.1.8** Skills dinamis: `forms-best-practices`, `data-modeling-basics`, `membership-login`, `admin-dashboard-crud`, `booking-system`, `order-system` — AI-082 · `packages/ai-tools/skills` · Verifikasi: eval skenario J5 & J6

### M7.8 — Hardening

- [ ] **T7.8.1.1** Tenant-escape suite (runtime & platform API, IDOR, reference expand) — DATA-320 · `apps/api/test` · Verifikasi: suite hijau di CI
- [ ] **T7.8.1.2** Injection (JSONB path, filter DSL, CSV formula injection) — DATA-321 · `apps/api` · Verifikasi: int test payload
- [ ] **T7.8.1.3** XSS dari data user (render escaping, sanitizer) — DATA-323 · `packages/renderer` · Verifikasi: unit test payload
- [ ] **T7.8.1.4** Secret storage (envelope encryption `shared/node`) — DATA-324, ARCHITECTURE §9.4 · `packages/shared/src/node` · Verifikasi: unit test enkripsi/dekripsi + rotasi
- [ ] **T7.8.1.5** Audit log keamanan — DATA-325 · `apps/api` · Verifikasi: int test
- [ ] **T7.8.1.6** DPA & halaman legal untuk website user (P1 generator) — ACC-312, ACC-316 · `apps/web`, library · Verifikasi: halaman terbit
- [ ] **T7.8.1.7** (P1) Abuse & moderasi data dinamis — DATA-326 · `apps/worker` · Verifikasi: int test

### M7.9 — Commerce ringan (Order via WhatsApp)

- [ ] **T7.9.1.1** Tabel produk & kategori (subset M7) — COM-060, COM-063, COM-180 · `packages/db/src/schema/commerce.ts` · Verifikasi: migration
- [ ] **T7.9.1.2** Dashboard produk (CRUD, gambar) — COM-060, COM-065 · `apps/web` · Verifikasi: e2e
- [ ] **T7.9.1.3** Cart lokal (guest, localStorage) — COM-070 · `packages/renderer/src/islands` · Verifikasi: e2e
- [ ] **T7.9.1.4** Order via WhatsApp (pesan terformat dari cart) — COM-003, COM-002 · `packages/renderer` · Verifikasi: e2e link `wa.me` benar
- [ ] **T7.9.1.5** Component commerce ringan (`ProductCard/Grid/Detail`, `CartDrawer`, `MiniCartIcon`, `WhatsAppOrderButton`) — COM-110, CMP-092 · library · Verifikasi: QA
- [ ] **T7.9.1.6** Template toko WA — COM-111 · library · Verifikasi: QA + Lighthouse
- [ ] **T7.9.1.7** Tool AI `configure_whatsapp_order` — AI-005 · `packages/ai-tools` · Verifikasi: unit test

### M7.d Exit criteria / demo

- [ ] Demo J5 (PRD): "Buat sistem pesanan katering" → AI membuat collection `orders` + form + workflow email ke owner + dashboard admin (table) → pengunjung memesan → owner melihat & mengubah status.
- [ ] Demo J6: website membership kursus — register, login, halaman terproteksi, materi hanya untuk member aktif.
- [ ] Demo Order via WhatsApp: katalog → cart → pesan WA terformat.
- [ ] Tenant-escape suite, XSS suite, injection suite hijau.
- [ ] Bundle island < 30 KB gz; halaman statis tetap 0 KB JS.

### M7.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Kebocoran data multi-tenant (PRD R7) | Scope wajib + RLS + default deny + suite tenant-escape (M7.8) |
| Ekspresi/workflow menjadi "kode bebas" | Parser sendiri, blok terbatas, batas eksekusi |
| Performa JSONB pada data besar | Index GIN/expression, pagination, batas per paket |
| Scope M7 sangat besar | Rilis bertahap per sub-fase di balik feature flag |

---

## M8 — E-commerce

### M8.a Tujuan & ruang lingkup

Website user bisa **berjualan dengan payment gateway milik user** (BYOG: Midtrans, Xendit) + manual transfer & COD: produk & varian, stok/reservasi, cart server & member, checkout, ongkir manual, order state machine, dashboard order, resi, notifikasi, akun pembeli, AI setup toko. Mengacu [06 §19](./specs/06-commerce-payments.md#19-fase--rollout) baris M8.

**Tidak termasuk**: voucher, PPN, ongkir API pihak ketiga, invoice PDF, refund via API, import produk (P1 M9), produk digital, aggregator, multi-gateway (P2).

### M8.b Prasyarat

- M7 selesai (collections, workflows, member, secret storage, Order via WA).
- OPEN pemblokir (06 §20 kecuali disebut lain):
  - **#1** — konfirmasi hukum BYOG tanpa izin PJP — **wajib sebelum mulai**.
  - **#4, #5, #6, #7, #8, #10 / PRD O6** — detail API Midtrans & Xendit, metode, test connection, IP allowlist, `clientKey`.
  - **#9 / ARCHITECTURE A6** — KMS vs env KEK.
  - **#11** — dataset wilayah Indonesia.
  - **#14 / 08 OPEN #13 / PRD O8** — batas produk/order per paket, Starter commerce?, fee transaksi (#15).
  - **#16, #17** — PCI SAQ, kewajiban UU PDP pembeli.
  - **#18** — ambang moderasi produk terlarang.
  - **#19** — provider WA notifikasi & domain email.

### M8.c Epic & task

#### Epic 8.0 — Refinement

- [ ] **T8.0.1** Rinci ulang M8 terhadap rencana fase commerce; verifikasi dokumentasi resmi Midtrans/Xendit terbaru (⚠️ VERIFIKASI) — COM-190, §1.6 · docs · Verifikasi: catatan API per gateway

#### Epic 8.1 — Model & provider

- [ ] **T8.1.1** Model BYOG sebagai default (dokumentasi alur dana) — COM-001 · docs, `apps/web` · Verifikasi: teks UI & panduan
- [ ] **T8.1.2** ⚑ Tabel commerce & payments lengkap (`product_variants`, `orders`, `order_items`, `payment_gateway_configs`, `payments`, `payment_events`) — COM-180 · `packages/db` · Verifikasi: migration
- [ ] **T8.1.3** Interface `PaymentProvider` (adapter pattern) — COM-020 · `apps/api/src/modules/commerce/providers` · Verifikasi: unit test kontrak dengan fake provider
- [ ] **T8.1.4** Adapter Midtrans (sandbox) — COM-021 · `apps/api` · Verifikasi: int test sandbox
- [ ] **T8.1.5** Adapter Xendit (sandbox) — COM-022 · `apps/api` · Verifikasi: int test sandbox
- [ ] **T8.1.6** Provider manual: `manual_transfer` (upload bukti) & `cod` — COM-023, COM-002 · `apps/api` · Verifikasi: int test
- [ ] **T8.1.7** Metode pembayaran per gateway & pemilihan provider aktif per site — COM-024, COM-025 · `apps/api`, `apps/web` · Verifikasi: e2e

#### Epic 8.2 — Settings > Payments & kredensial

- [ ] **T8.2.1** Halaman Settings > Payments; mode sandbox/production — COM-030, COM-031 · `apps/web` · Verifikasi: e2e
- [ ] **T8.2.2** Tombol "Test connection" — COM-032 · `apps/api` · Verifikasi: int test sandbox
- [ ] **T8.2.3** URL webhook unik per site & provider — COM-033 · `apps/api` · Verifikasi: int test token unik
- [ ] **T8.2.4** Panduan step-by-step (ID/EN) menghubungkan gateway — COM-034 · `apps/web`, docs · Verifikasi: diverifikasi terhadap dashboard gateway
- [ ] **T8.2.5** Status koneksi & health — COM-035 · `apps/api`, `apps/web` · Verifikasi: e2e
- [ ] **T8.2.6** Enkripsi envelope kredensial; tidak pernah keluar (client, AI, log) — COM-040, COM-041 · `packages/shared/src/node`, `apps/api` · Verifikasi: test "secret tidak bocor ke log"
- [ ] **T8.2.7** Rotasi kredensial & kunci; penghapusan; audit akses — COM-042, COM-043, COM-044 · `apps/api` · Verifikasi: int test

#### Epic 8.3 — Webhook & rekonsiliasi

- [ ] **T8.3.1** Endpoint webhook per site/provider (raw body) — COM-050 · `apps/api/src/webhooks` · Verifikasi: int test
- [ ] **T8.3.2** Verifikasi signature — COM-051 · `apps/api` · Verifikasi: int test signature salah → 401 + log
- [ ] **T8.3.3** Verify-by-refetch ke gateway — COM-052 · `apps/api` · Verifikasi: int test
- [ ] **T8.3.4** Idempotency & urutan event monoton — COM-053, COM-055 · `apps/api` · Verifikasi: int test webhook duplikat & terbalik
- [ ] **T8.3.5** Retry & ketahanan (reconcile job untuk webhook hilang) — COM-054 · `apps/worker` · Verifikasi: int test
- [ ] **T8.3.6** Integrasi workflow (domain events `payment.statusChanged`, `order.*`) — COM-056 · `apps/api`, `packages/workflow-blocks` · Verifikasi: int test

#### Epic 8.4 — Katalog, stok & cart

- [ ] **T8.4.1** Produk lengkap & varian — COM-060, COM-061 · `apps/api`, `apps/web` · Verifikasi: e2e
- [ ] **T8.4.2** Stok & reservasi (konkurensi aman) — COM-062 · `apps/api` · Verifikasi: test konkurensi stok
- [ ] **T8.4.3** Kategori/koleksi & gambar produk lengkap — COM-063, COM-065 · `apps/web` · Verifikasi: e2e
- [ ] **T8.4.4** Guest cart server; cart member; merge saat login — COM-070, COM-071, COM-072 · `apps/api/src/runtime/commerce` · Verifikasi: int test
- [ ] **T8.4.5** Validasi harga & ketersediaan di server — COM-073 · `apps/api` · Verifikasi: int test harga dimanipulasi client ditolak

#### Epic 8.5 — Checkout

- [ ] **T8.5.1** Data pembeli & alamat pengiriman (dataset wilayah) — COM-080, COM-081 · `apps/api`, `packages/renderer` · Verifikasi: e2e
- [ ] **T8.5.2** Ongkos kirim manual (flat, per wilayah) — COM-082 · `apps/api` · Verifikasi: unit test
- [ ] **T8.5.3** Pembuatan order & pembayaran (idempotency key) — COM-085 · `apps/api/src/runtime/commerce` · Verifikasi: int test double submit = 1 order
- [ ] **T8.5.4** Halaman hasil sukses/pending/gagal — COM-086 · library · Verifikasi: e2e
- [ ] **T8.5.5** Checkout sebagai member atau guest — COM-102 · `apps/api` · Verifikasi: e2e

#### Epic 8.6 — Order management

- [ ] **T8.6.1** State machine order — COM-090 · `apps/api` · Verifikasi: unit test transisi
- [ ] **T8.6.2** Daftar & detail order (dashboard) — COM-091 · `apps/web/(dashboard)/sites/[siteId]/orders` · Verifikasi: e2e
- [ ] **T8.6.3** Pengiriman & nomor resi — COM-092 · `apps/web` · Verifikasi: e2e
- [ ] **T8.6.4** Notifikasi email/WA via workflow — COM-093 · `apps/worker` · Verifikasi: int test
- [ ] **T8.6.5** Export CSV order; dashboard penjualan sederhana — COM-095, COM-096 · `apps/web` · Verifikasi: e2e

#### Epic 8.7 — Akun pembeli

- [ ] **T8.7.1** Riwayat pesanan member — COM-100 · library, `apps/api` · Verifikasi: e2e
- [ ] **T8.7.2** Lacak pesanan guest (kode + email) — COM-101 · `apps/api` · Verifikasi: int test IDOR

#### Epic 8.8 — Component & editor commerce

- [ ] **T8.8.1** Daftar component commerce lengkap (checkout, order summary, payment result) — COM-110, CMP-092 · library · Verifikasi: ≥ 12 variasi
- [ ] **T8.8.2** Template toko ≥ 3 (toko online, fashion cart, kue) — COM-111, CMP-102 · library · Verifikasi: QA
- [ ] **T8.8.3** Mode commerce di editor (panel produk, preview data) — COM-112 · `apps/editor` · Verifikasi: e2e
- [ ] **T8.8.4** (P1) Format angka & mata uang di teks bound — ED-128 · `apps/editor` · Verifikasi: unit test

#### Epic 8.9 — AI commerce

- [ ] **T8.9.1** Tools commerce (`get_commerce_overview`, `configure_store`, `create_product_category`, `create_products`, `update_product`, `create_store_pages`, `set_shipping_options`, `get_payment_connection_status`) — AI-005, COM-140 · `packages/ai-tools` · Verifikasi: unit test
- [ ] **T8.9.2** Copywriting produk; skills `building-online-store`, `product-copywriting` — COM-141, AI-082 · `packages/ai-tools` · Verifikasi: eval
- [ ] **T8.9.3** AI tidak pernah membaca kredensial (test) — COM-142, AI-106 · `packages/ai-tools` · Verifikasi: unit test

#### Epic 8.10 — Paket, keamanan & edge cases

- [ ] **T8.10.1** Gating commerce berdasarkan paket; downgrade & berhenti berlangganan ("jangan blok checkout") — COM-150, COM-151, ACC-135 · `apps/api` · Verifikasi: int test
- [ ] **T8.10.2** Fee transaksi platform (0% di awal, configurable) — COM-152 · `apps/api` · Verifikasi: unit test
- [ ] **T8.10.3** PCI DSS: tidak menyimpan data kartu (hosted page) — COM-160 · `apps/api` · Verifikasi: review + grep
- [ ] **T8.10.4** Fraud & abuse dasar; produk terlarang & moderasi — COM-161, COM-164 · `apps/worker` · Verifikasi: int test
- [ ] **T8.10.5** Perlindungan data pembeli (UU PDP) & syarat ketentuan commerce — COM-162, COM-163 · docs, `apps/web` · Verifikasi: teks terbit setelah review hukum
- [ ] **T8.10.6** Keamanan runtime API commerce (rate limit, IDOR, CSP `form-action`) — COM-165 · `apps/api`, `apps/site-host` · Verifikasi: int test IDOR
- [ ] **T8.10.7** Edge: pembayaran expired, webhook terlambat, double payment — COM-170, COM-171, COM-172 · `apps/api` · Verifikasi: int test per kasus
- [ ] **T8.10.8** Edge: stok habis saat bayar & perubahan harga; refund (P0 manual); mata uang & pembulatan; kasus lain — COM-173, COM-174, COM-175, COM-176 · `apps/api` · Verifikasi: int test per kasus
- [ ] **T8.10.9** JSON-LD Product & event `Purchase` — PUB-124 · `packages/renderer` · Verifikasi: validator schema.org

### M8.d Exit criteria / demo

- [ ] Demo J7 (PRD) / contoh 06 §18 "Toko Kue Bu Sari" end-to-end di sandbox Midtrans **dan** Xendit, termasuk webhook duplikat, webhook hilang (reconcile), expiry.
- [ ] Test konkurensi stok, IDOR, "secret tidak bocor ke log" lulus di CI.
- [ ] Panduan koneksi gateway ID/EN terverifikasi.
- [ ] Ketentuan commerce & kebijakan produk terlarang terbit (setelah review hukum).

### M8.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Integrasi gateway rumit (PRD R8) | Adapter pattern, test connection, panduan, opsi WA/manual |
| Regulasi pembayaran (PRD R9) | BYOG, konfirmasi hukum sebelum mulai, platform tidak memegang dana |
| Webhook tidak andal | Verify-by-refetch, reconcile job, idempotency |
| Kebocoran kredensial | Envelope encryption, redaksi log, audit akses |

---

## M9+ — Lanjutan

> Backlog terstruktur. Setiap epic di sini **wajib dirinci ulang** sebelum dikerjakan dan boleh dijadikan sub-fase sendiri (M9.1, M9.2, …) sesuai prioritas bisnis setelah M8.

### M9.a Tujuan & ruang lingkup

Fitur Figma lanjutan, override responsif manual UI penuh (bila belum di M4), paket **Business/Tim** (invite, role) lalu **multiplayer real-time** (cursor, presence, komentar), commerce P1, fitur dinamis P1/P2, marketplace & library pribadi, multi-bahasa situs.

### M9.b Prasyarat

- M8 selesai (atau sebagian epic M9 yang tidak bergantung pada M8 boleh dimulai setelah M4, mis. Epic 9.1).
- OPEN: 08 OPEN #4, #5, #6 (trial Business, seat viewer/billing, transfer data pembeli); 03 O-3, O-8, O-9, O-11 (auto-update, library pribadi, marketplace, font kustom); 02 OPEN #12 & OPEN-DM-1 (multi-bahasa); OPEN-DM-6 (dark mode); OPEN-DM-9 (granularitas Yjs saat multiplayer); OPEN-DM-10 (custom CSS Pro); 06 OPEN #2, #12, #13 (split payment, ongkir API, PPN); ARCHITECTURE A4 (Y.Doc per halaman).

### M9.c Epic & task

#### Epic 9.0 — Refinement

- [ ] **T9.0.1** Prioritaskan epic M9 berdasarkan data penggunaan & pendapatan; tentukan sub-fase — §1.6 · docs · Verifikasi: Lampiran D

#### Epic 9.1 — Editor lanjutan

- [ ] **T9.1.1** Read-only / view mode — ED-005 · `apps/editor` · Verifikasi: e2e
- [ ] **T9.1.2** Override responsif manual UI penuh (sisa P1 ED-176/DM-037) — ED-176, DM-037 · `apps/editor` · Verifikasi: e2e
- [ ] **T9.1.3** Grid layout lanjutan (P2 bagian) — ED-097 · `apps/editor` · Verifikasi: e2e
- [ ] **T9.1.4** (P2) Minimap; suggest auto-layout — ED-030, ED-092 · `apps/editor` · Verifikasi: e2e
- [ ] **T9.1.5** (P2) Pen/vector tool + node `vector` — ED-048, DM-017 · `apps/editor`, `packages/document-model` · Verifikasi: e2e
- [ ] **T9.1.6** (P2) Boolean operations & mask; blend mode — ED-148, ED-149, ED-111 · `apps/editor` · Verifikasi: e2e
- [ ] **T9.1.7** (P2) Mode light/dark token & usage cleanup — ED-133, ED-135, DM-043 · `apps/editor` · Verifikasi: e2e
- [ ] **T9.1.8** (P2) Copy as PNG/SVG/CSS/text — ED-195 · `apps/editor` · Verifikasi: e2e
- [ ] **T9.1.9** (P2) Embed HTML terbatas — DM-021 · `packages/document-model`, `packages/renderer` · Verifikasi: sanitizer test
- [ ] **T9.1.10** Y.Doc per halaman (subdocument) bila data menunjukkan perlu — ARCHITECTURE §7.1 (A4) · `apps/realtime`, `apps/editor` · Verifikasi: bench load

#### Epic 9.2 — Business/Tim

- [ ] **T9.2.1** Membuat team workspace — ACC-031 · `apps/api`, `apps/web` · Verifikasi: e2e
- [ ] **T9.2.2** Undang anggota via email — ACC-032 · `apps/api` · Verifikasi: e2e
- [ ] **T9.2.3** Role & permission matrix penuh — ACC-033 · `apps/api` · Verifikasi: int test matriks
- [ ] **T9.2.4** Kelola anggota; transfer kepemilikan workspace — ACC-034, ACC-036 · `apps/web` · Verifikasi: e2e
- [ ] **T9.2.5** (P1) Transfer site antar workspace (tim); hapus team workspace — ACC-035, ACC-037 · `apps/api` · Verifikasi: int test

#### Epic 9.3 — Multiplayer real-time

- [ ] **T9.3.1** Migrasi rich text ke `y-prosemirror` (bila belum — catatan: sudah `Y.XmlFragment` + y-tiptap sejak M0 T0.8.5; task ini kemungkinan cukup verifikasi multiplayer) — DM-013, ED-125 · `packages/document-model`, `apps/editor` · Verifikasi: migrasi fixture
- [ ] **T9.3.2** Lepas single-editor lock → multi-editor; normalisasi konflik produksi — DM-063, ARCHITECTURE §5.5 · `apps/realtime` · Verifikasi: test 2 klien konkuren
- [ ] **T9.3.3** Presence avatar & multiplayer cursor — ED-232, ED-233 · `apps/editor/src/collaboration` · Verifikasi: e2e 2 browser
- [ ] **T9.3.4** Follow/spotlight & seleksi user lain — ED-234, ED-236 · `apps/editor` · Verifikasi: e2e
- [ ] **T9.3.5** Komentar & comment tool — ED-235, ED-049 · `apps/editor`, `apps/api` · Verifikasi: e2e
- [ ] **T9.3.6** Semantik kolaborasi & undo (origin remote) — ED-237, DM-060 · `apps/editor` · Verifikasi: e2e undo hanya milik sendiri

#### Epic 9.4 — Commerce P1

- [ ] **T9.4.1** Voucher/diskon; PPN — COM-083, COM-084 · `apps/api` · Verifikasi: unit test
- [ ] **T9.4.2** Invoice PDF; refund via API — COM-094, COM-174 · `apps/api` · Verifikasi: int test sandbox
- [ ] **T9.4.3** Import produk (teks/CSV/foto) — COM-143 · `apps/api`, `packages/ai-tools` · Verifikasi: int test
- [ ] **T9.4.4** Ongkir via API pihak ketiga — COM-082 · `apps/api` · Verifikasi: int test

#### Epic 9.5 — Dinamis P1/P2

- [ ] **T9.5.1** Trigger `webhook.incoming`, `manual`, `user.loggedIn`; step `assign_role` — DATA-231 · `packages/workflow-blocks` · Verifikasi: unit test
- [ ] **T9.5.2** (P2) Formula field; multi-step form; WhatsApp OTP — DATA-013, DATA-121, DATA-145 · `apps/api` · Verifikasi: int test
- [ ] **T9.5.3** (P2) Kanban & calendar; realtime update; add-on kuota — DATA-206, DATA-303, DATA-341 · `packages/renderer`, `apps/api` · Verifikasi: e2e

#### Epic 9.6 — Library & marketplace

- [ ] **T9.6.1** (P2) Auto-update minor/patch — CMP-056 · `apps/api` · Verifikasi: int test
- [ ] **T9.6.2** (P2) Library pribadi: simpan component & saved sections/theme — CMP-170, CMP-171 · `apps/api`, `apps/editor` · Verifikasi: e2e
- [ ] **T9.6.3** (P2) Marketplace designer luar (garis besar) — CMP-180, CMP-004 · seluruh · Verifikasi: rinci ulang

#### Epic 9.7 — Multi-bahasa, AI & lainnya

- [ ] **T9.7.1** (P2) Konten website multi-bahasa + hreflang — ED-222, ACC-294, PUB-123 · `packages/document-model`, `packages/renderer` · Verifikasi: e2e
- [ ] **T9.7.2** (P2) Sub-agent AI; A/B & canary — AI-050, AI-184 · `apps/worker/src/ai` · Verifikasi: eval
- [ ] **T9.7.3** (P2) Incremental build publish; animasi lanjutan — PUB-034, PUB-046 · `apps/worker` · Verifikasi: bench
- [ ] **T9.7.4** (P2) Referral; faktur pajak; AI support assistant — ACC-112, ACC-166, ACC-332 · `apps/web`, `apps/api` · Verifikasi: rinci ulang
- [ ] **T9.7.5** (P2) Produk digital; mode aggregator — COM-064, COM-004 · `apps/api` · Verifikasi: rinci ulang

### M9.d Exit criteria

Ditentukan per sub-fase saat refinement (T9.0.1). Minimal: setiap sub-fase punya demo skenario + test yang lulus seperti fase sebelumnya.

### M9.e Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Multiplayer mengubah asumsi dokumen | Yjs sejak hari pertama; normalisasi konflik (DM-063); test konkurensi |
| Marketplace membuka risiko hukum/kualitas | Rinci ulang + konsultasi hukum; mulai dari library pribadi |
| Fitur berlebih tanpa permintaan | Prioritaskan berdasarkan data (T9.0.1) |

---

## Lampiran A — Keputusan OPEN yang memblokir per fase

Kumpulan ❓ OPEN dari semua dokumen yang **harus diputuskan sebelum** fase/epic terkait dimulai. Kolom "Rujukan" memakai penomoran asli dokumen: `PRD O#` ([PRD §15](./PRD.md#15-keputusan-terbuka)), `ARCH A#` ([ARCHITECTURE §19](./ARCHITECTURE.md#19-daftar-keputusan-terbuka)), `01 OPEN-DM-#` ([01 §22](./specs/01-document-model.md#22-daftar-open)), `02 #` ([02 §36.3](./specs/02-editor.md#363-daftar-open)), `03 O-#` ([03 §20](./specs/03-components-templates.md#20-daftar-open)), `04 #` ([04 §15](./specs/04-ai-agent.md#15-ringkasan-open)), `05 #` ([05 §18](./specs/05-dynamic-data.md#18-daftar-open)), `06 #` ([06 §20](./specs/06-commerce-payments.md#20-daftar-open)), `07 #` ([07 §18](./specs/07-publishing-hosting.md#18-daftar-open)), `08 #` ([08 §20](./specs/08-accounts-plans-admin.md#20-daftar-open)).

Cara pakai: saat keputusan diambil, tulis di kolom "Keputusan" (tanggal + pilihan), perbarui dokumen sumber (hapus/ubah tanda ❓), lalu catat di Lampiran D.

### A.1 M0 — diputuskan DI DALAM spike

| Topik | Rujukan | Rekomendasi sementara | Diputuskan di | Keputusan |
|---|---|---|---|---|
| Isolasi style canvas: Shadow DOM vs prefix class | 02 #2, ED-016 | Shadow DOM bila Tiptap OK | T0.8.1 | 2026-10-13: Shadow DOM (ADR-012) |
| Iframe per breakpoint frame vs class-scope | 02 #11, ED-034 | Tanpa iframe (class `.bp-*`) | T0.8.2 | 2026-10-13: tanpa iframe (ADR-013) |
| Rentang zoom | 02 #1, ED-027 | 5%–1600% | T0.8.3 | 2026-10-13: 5%–1600% |
| Deteksi overflow statis untuk `stackRows` | 01 OPEN-DM-5, DM-038 | Hitung statis; alternatif `keepRowOnMobile` | T0.8.4 | 2026-10-13: statis + margin 0,9 |
| Rich text JSON utuh vs `y-prosemirror` | 02 #5, DM-013 | — | Spec 01 | ✅ **Diputuskan:** `Y.XmlFragment` + `y-prosemirror` sejak M2 (spec 01). T0.8.5 hanya memvalidasi di spike. |
| Angka batas node/ukuran state | 02 #13, DM-076 | Dari benchmark | T0.8.6 | 2026-10-13: node/page 2.000/5.000, state 8/16 MB (DM-076 sumber tunggal) |

### A.2 M1 — Fondasi

| Topik | Rujukan | Rekomendasi sementara | Sebelum | Keputusan |
|---|---|---|---|---|
| Better Auth dipertahankan/diganti | 08 #1 | Pertahankan | Epic 1.5 | 2026-10-13: dipertahankan |
| Group: tipe node vs flag `isGroup` | 02 #6, DM-012 | — | Spec 01 | ✅ **Diputuskan:** node type `group` (DM-012), command `groupNodes`/`unwrap`. |
| Urutan layer (DOM order vs Figma order) | 02 #4 | DOM order | Epic 1.8 (semantik `children`) | 2026-10-13: **Figma order** di layers panel; `children` tetap DOM order (semantik data tidak berubah) |
| Granularitas Yjs untuk `layout` | 01 OPEN-DM-9 | Atomik dulu | T1.9.1 (non-pemblokir) | |
| Y.Doc per halaman | ARCH A4 | Tunda | — (non-pemblokir) | |
| Secret manager & remote cache Turborepo | ARCH A12 | Tidak wajib di awal | — (non-pemblokir) | |

### A.3 M2 — Editor inti

| Topik | Rujukan | Rekomendasi | Sebelum | Keputusan |
|---|---|---|---|---|
| Preview width custom per user vs per website | 02 #3 | Per user (UI state) | T2.15.2 | |
| Ikon merek (WA/IG/TikTok) | 01 OPEN-DM-2, 03 O-4 | Set SVG sosial internal + pedoman merek | T2.12.5 / Epic 3.11 | |
| Shortcut layout grid | 02 #10 | Win `Ctrl+Shift+4`, Mac `⌃G` | T4.20.5 (P1) | |
| Stock image | 02 #7, 03 O-10, 04 #4, PRD O10 | Library foto internal dulu | T4.20.13 (P1) | |

### A.4 M3 — Component & mode admin

| Topik | Rujukan | Rekomendasi | Sebelum | Keputusan |
|---|---|---|---|---|
| Override link/interaction target di instance | 01 OPEN-DM-7 | Hanya via prop `link` | Epic 3.1 | |
| Dependensi transitif di `componentDeps` | 01 OPEN-DM-11 | Ya, `transitive: true` | T3.1.6 | |
| Library dikunci per paket (`tier`) | 03 O-1 | Statis gratis semua; dinamis/commerce dikunci | T3.3.2 | |
| Nomor versi rollback dari MAJOR | 03 O-2 | Naik MAJOR baru | T3.5.7 (P1) | |
| Sumber foto contoh berlisensi | 03 O-10, PRD O10 | Kurasi internal | T3.9.1 | |
| Embedding untuk search AI | 03 O-7, 04 #3 | Tunda; evaluasi M6 | Epic 3.13 (opsional) | |

### A.5 M4 — Rilis publik

| Topik | Rujukan | Rekomendasi | Sebelum | Keputusan |
|---|---|---|---|---|
| **Nama produk & domain** | PRD O1, ARCH A1 | — | Epic 4.11, rilis | |
| **Domain terpisah situs user + PSL** | PRD O5, 07 #19, PUB-201 | Ya | Epic 4.11 | |
| Bentuk URL preview | 07 #1 | Host-based `p-<id>` | T4.8.9 | |
| Atomic CSS vs style-signature | 07 #2 | Style-signature | Epic 4.9 (idealnya M1) | |
| Badge dofollow/nofollow | 07 #4 | Dofollow ke homepage | T4.10.9 | |
| Status halaman suspended | 07 #5 | 403 + reasonCode | T4.10.10 | |
| `shop`/`store` reserved | 07 #8 | Reserved | T4.11.2 | |
| noindex untuk Free | 07 #14 | noindex sampai syarat trust | T4.11.7 | |
| Retensi deployment per paket | 07 #20 | Free 3 / Starter 10 / Pro 30 / Business 100 | T4.8.12 | |
| Rate limit publish per paket | 07 #21 | Sesuai PUB-216 | T4.8.18 | |
| Konsistensi KV untuk switch live | 07 #22 | KV + fallback API | T4.8.12 | |
| Angka batas paket Free | PRD O2, 08 #9 | Usulan 08 §6.2 | Epic 4.12 | |
| Site arsip dihitung storage | 08 #7 | — | T4.13.3 | |
| Form kontak untuk paket statis | PRD O12, 05 #2, 08 #12 | Ya, standalone + email owner, kuota kecil | T4.4.4 | |
| Jumlah template final | 03 O-5 | Gate 20, target 24–30 | Epic 4.5 | |
| Stemmer/sinonim search ID | 03 O-6 | Keywords manual + trigram | T4.2.4 | |
| Auto-responsive rules & nilai skala | 02 #8 | Validasi dengan template | T4.6.8 | |
| Retensi version history per paket | 02 #9, 08 §6.2 | Free 7 hari … | T4.7.10 | |
| Origin static editor production | ARCH A2 | Cloudflare Pages | T4.19.2 | |
| Hosting api/worker/realtime | PRD O13, ARCH A9 | VPS Docker vs Railway/Fly | T4.19.1 | |
| Hosting web | ARCH A10 | Vercel atau self-host | T4.19.2 | |
| Postgres & Redis managed | ARCH A11 | Managed Postgres + PITR | T4.19.1 | |
| Metrics/tracing & uptime monitor | ARCH A8 | Free tier memadai | T4.19.5, T4.19.6 | |
| SLA moderasi & kanal notifikasi staff | 08 #24 | < 24 jam (PRD §11) | Epic 4.16 | |
| Kewajiban PSE | 08 #27 | Cek regulasi terbaru | T4.17.2 | |
| Lokasi data (ID vs SG) | 08 #28 | — | T4.17.3 | |
| Badan usaha (PT Perorangan vs PT, KBLI) | PRD O14, 08 #26 | Mulai sejak M2 | T4.17.1 | |
| Tool analytics produk | 08 #30 | Tabel sendiri dulu | T4.17.8 | |
| Lisensi Safe Browsing vs Web Risk | 08 #23 | — | T5.7.3 (P1) | |

### A.6 M5 — Billing

| Topik | Rujukan | Rekomendasi | Sebelum | Keputusan |
|---|---|---|---|---|
| **Harga final semua paket** | PRD O2, 08 #16 | Rentang 08 §7.4 | Epic 5.1 | |
| **Gateway & model perpanjangan langganan** | PRD O7, ARCH A5, 08 #19 | Invoice + reminder | T5.2.1 | |
| **PPN/PKP & badan usaha** | PRD O14, 08 #17, #26 | Konsultasi pajak | sebelum menagih | |
| Starter boleh hapus badge | 08 #10 | Tidak | T5.6.1 | |
| Proration | 08 #20 | — | T5.2.4 | |
| Retensi data frozen setelah downgrade | 08 #21 | 180 hari | T5.2.11 | |
| Kriteria refund | 08 #22 | 7 hari, < 20% kredit | T5.2.13 | |
| Item premium setelah downgrade | 08 #31 | Kunci instance baru | T5.1.5 | |
| Harga add-on | 08 #18 | — | (non-pemblokir) | |
| Aturan subdomain pilihan (panjang, pola acak) | 07 #6, #7 | 3 karakter + blocklist; larang pola acak | T5.4.1 | |
| Rename & downgrade subdomain | PRD O11, 07 #9, #10 | Alias 90/karantina 30; grace 30 | T5.4.4, T5.4.5 | |
| Apex custom domain & grace pemutusan | 07 #11, #12 | Apex → www; grace 14 hari | T5.5.2, T5.5.3 | |
| Biaya Cloudflare for SaaS | ARCH A3 | CF for SaaS; cadangan Caddy | T5.5.1 | |
| Password protect untuk Starter | 07 #13 | Pro+ | T5.6.3 | |
| Verifikasi meta & GA4/Pixel per paket | 07 #15 | Meta semua; GA4 Starter+ | T5.6.7, T5.6.9 | |
| OG image Satori vs Playwright | 07 #16 | Satori | T5.6.5 | |
| Penyimpanan analytics | 07 #17 | Analytics Engine + rollup | T5.6.8 | |
| Image CDN on-the-fly | 07 #18 | Pra-generate dulu | T5.6.11 | |
| Provider OAuth tambahan, passkey, 2FA WA | 08 #2, #3 | Tunda | T5.7.1 | |
| Provider OTP HP | 08 #25 | — | T5.7.4 (P1) | |
| Email onboarding transaksional vs marketing | 08 #8 | — | T5.7.6 (P1) | |
| Tool helpdesk/support | 08 #29 | — | T5.9.3 (P1) | |

### A.7 M6 — AI

| Topik | Rujukan | Rekomendasi | Sebelum | Keputusan |
|---|---|---|---|---|
| **Starter dapat AI?** | PRD O3, 04 #1, 08 #11 | 100 kredit + form saja | Epic 6.7 | |
| **Trial AI Free** | PRD O4, 08 #15 | Beberapa run gratis | T6.7.5 | |
| **Jumlah kredit, harga top-up, hangus?** | 04 #9 | — | Epic 6.7 | |
| Situs multi-bahasa vs halaman terpisah | 04 #2, 01 OPEN-DM-1 | Halaman terpisah dulu | T6.5.5 | |
| Embedding search_components | 04 #3, 03 O-7 | pgvector bila dibutuhkan | T6.10.2 (P1) | |
| Foto stok & generate gambar AI | 04 #4, #5 | Internal dulu; generate P1 | T6.2.7, T6.2.11 | |
| Layanan moderasi gambar | 04 #7 | — | T6.6.3 | |
| **Retensi transkrip & lokasi pemrosesan (UU PDP)** | 04 #8, 08 #28 | — | T6.6.6 (wajib sebelum rilis AI) | |

### A.8 M7 — Dinamis

| Topik | Rujukan | Rekomendasi | Sebelum | Keputusan |
|---|---|---|---|---|
| Starter dinamis terbatas | 05 #1, PRD O3 | Ya, terbatas | M7.1 (T7.1.1.2) | |
| Kebijakan data saat downgrade | 05 #12 | 12 bulan read-only | akhir M7.1 | |
| Angka kuota final | 05 #9 | Tabel 05 §14 | T7.1.5.1 | |
| Runtime islands Preact vs React | 05 #8, 07 #3, ARCH A14 | Preact | T7.0.2 | |
| Ekspresi kondisional sederhana di binding | 01 OPEN-DM-8 | — | M7.2 | |
| Model konten multi-bahasa | 02 #12, 01 OPEN-DM-1 | Putuskan sebelum M7 | T7.0.1 | |
| Style bagian internal `formField` | 01 OPEN-DM-4 | — | T7.3.1.1 | |
| Scanning malware (ClamAV vs eksternal) | 05 #6, ARCH A7 | ClamAV di worker | T7.3.1.6 | |
| End-user auth: modul sendiri vs Better Auth | 05 #7 | Modul sendiri | M7.4 | |
| Halaman terproteksi: SSR privat vs shell | 05 #5 | Shell + client fetch | T7.4.1.7 | |
| Rule `exists` naik P0 | 05 #11 | Ya | T7.4.2.5 | |
| Provider WhatsApp | 05 #4, PRD O9, ARCH A13 | BYO WA Cloud API + BSP | T7.6.1.14 (P1) | |
| Domain pengirim email kustom (DKIM) | 05 #10 | P1 Pro+ | (non-pemblokir) | |
| Formula materialized vs saat baca | 05 #3 | Materialized | M9 (DATA-013) | |
| Konfigurasi data AI: pending vs langsung + kompensasi | 04 #6 | — | M7.7 | |
| Order via WhatsApp di paket mana | 06 #3 | — | M7.9 | |
| Detach component `hardLocked` | 03 O-12 | Ikuti 05 | M7.2 | |

### A.9 M8 — Commerce

| Topik | Rujukan | Rekomendasi | Sebelum | Keputusan |
|---|---|---|---|---|
| **Konfirmasi hukum BYOG tanpa izin PJP** | 06 #1 | — | T8.0.1 | |
| Detail API Midtrans & Xendit | 06 #4, #5, PRD O6 | Verifikasi dokumentasi resmi | T8.1.4, T8.1.5 | |
| Matriks metode pembayaran | 06 #6 | — | T8.1.7 | |
| Test connection & prefix key | 06 #7 | — | T8.2.2 | |
| IP allowlist & retry webhook | 06 #8 | — | Epic 8.3 | |
| KMS vs env KEK | 06 #9, ARCH A6 | Env KEK di awal | T8.2.6 | |
| `clientKey` Midtrans publik | 06 #10 | — | T8.2.6 | |
| Dataset wilayah Indonesia | 06 #11 | — | T8.5.1 | |
| Batas produk/order, Starter commerce, fee | 06 #14, #15, PRD O8, 08 #13 | Fee 0% | T8.10.1, T8.10.2 | |
| PCI SAQ | 06 #16 | — | T8.10.3 | |
| UU PDP pembeli | 06 #17 | — | T8.10.5 | |
| Ambang moderasi produk terlarang | 06 #18 | — | T8.10.4 | |
| Provider WA notifikasi & domain email | 06 #19 | — | T8.6.4 | |

### A.10 M9+

| Topik | Rujukan | Rekomendasi | Sebelum | Keputusan |
|---|---|---|---|---|
| Trial Business, seat viewer/billing, data pembeli saat transfer | 08 #4, #5, #6 | — | Epic 9.2 | |
| Auto-update minor/patch | 03 O-3 | Default off | T9.6.1 | |
| Library pribadi per paket; marketplace; font kustom | 03 O-8, O-9, O-11 | Pro+; putuskan M9+ | Epic 9.6 | |
| Dark mode pengunjung | 01 OPEN-DM-6 | — | T9.1.7 | |
| Custom CSS level site (Pro) | 01 OPEN-DM-10 | — | Epic 9.1 | |
| Node `map` vs embed allowlist | 01 OPEN-DM-3 | — | T9.1.9 | |
| Split payment / aggregator; ongkir API; PPN | 06 #2, #12, #13 | — | Epic 9.4 | |
| Pajak faktur | 08 #17 | — | T9.7.4 | |

---

## Lampiran B — Matriks traceability

### B.1 Requirement P0 per spec → fase

Setiap baris mendaftar requirement P0 yang **pertama kali** diimplementasikan oleh task di fase tersebut (requirement multi-fase dapat muncul lagi di fase berikutnya). Notasi `PREFIX-AAA…BBB` = semua ID yang ada di spec di antara keduanya **menurut urutan dokumen** (ID yang tidak ada tidak dihitung; requirement non-P0 di antaranya memutus rentang). Tabel di-generate dari task di dokumen ini pada 2026-10-12; perbarui bila task berubah.

> Catatan: P0 AI di baris M3 berasal dari Epic 3.13 (opsional). Bila epic itu dilewati, requirement tersebut pindah ke M6.

| Spec | Fase | Requirement P0 yang pertama kali diimplementasikan di fase ini |
|---|---|---|
| 01 Document Model | M1 | DM-001…011, DM-013, DM-014, DM-025…030, DM-032, DM-034…039, DM-041, DM-042, DM-056…062, DM-067…069, DM-071…074, DM-076…078 |
| 01 Document Model | M2 | DM-040, DM-055, DM-075 |
| 01 Document Model | M3 | DM-018, DM-019, DM-044…051 |
| 01 Document Model | M4 | DM-064, DM-065 |
| 01 Document Model | M6 | DM-070 |
| 01 Document Model | M7.2 | DM-023, DM-052…054 |
| 01 Document Model | M7.3 | DM-022 |
| 01 Document Model | M7.4 | DM-024 |
| 02 Editor | M0 | ED-013…016, ED-019, ED-020, ED-023…027, ED-038, ED-047, ED-051, ED-053, ED-060, ED-062, ED-238 |
| 02 Editor | M1 | ED-012, ED-017, ED-018, ED-037, ED-061, ED-197, ED-198, ED-200, ED-201, ED-221, ED-227…231, ED-242 |
| 02 Editor | M2 | ED-004, ED-006…009, ED-022, ED-028, ED-032…034, ED-036, ED-039…042, ED-044…046, ED-050, ED-052, ED-054…056, ED-059, ED-063…066, ED-070…074, ED-076, ED-079…088, ED-090, ED-091, ED-098, ED-099, ED-102, ED-104, ED-106…108, ED-110, ED-112, ED-115…117, ED-119…123, ED-125, ED-129, ED-136…141, ED-143, ED-146, ED-160, ED-161, ED-163, ED-165, ED-173, ED-174, ED-181, ED-190, ED-191, ED-193, ED-202…204, ED-206, ED-207, ED-210, ED-211, ED-218…220, ED-223, ED-224, ED-226, ED-239, ED-240 |
| 02 Editor | M3 | ED-003, ED-058, ED-150…156, ED-158, ED-167, ED-170, ED-183 |
| 02 Editor | M4 | ED-001, ED-002, ED-089, ED-094, ED-100, ED-103, ED-126, ED-130…132, ED-164, ED-168, ED-169, ED-175…178, ED-185, ED-196, ED-199, ED-208, ED-216 |
| 02 Editor | M6 | ED-010 |
| 02 Editor | M7.2 | ED-171 |
| 03 Components | M1 | CMP-140…143 |
| 03 Components | M3 | CMP-001…022, CMP-024, CMP-030…032, CMP-040…045, CMP-050, CMP-051, CMP-054, CMP-057, CMP-073, CMP-080…089, CMP-093, CMP-120, CMP-124, CMP-133, CMP-150…152, CMP-155, CMP-156, CMP-158, CMP-159, CMP-190…192 |
| 03 Components | M4 | CMP-052, CMP-053, CMP-055, CMP-070…072, CMP-074, CMP-075, CMP-090, CMP-100…104, CMP-107, CMP-121, CMP-122, CMP-153, CMP-154, CMP-160, CMP-161, CMP-193 |
| 03 Components | M7.4 | CMP-091 |
| 03 Components | M7.9 | CMP-092 |
| 04 AI Agent | M3 | AI-006, AI-027, AI-040…043, AI-047, AI-051…061, AI-080, AI-084, AI-102, AI-107, AI-120…122, AI-126, AI-160, AI-186, AI-211 |
| 04 AI Agent | M4 | AI-180 |
| 04 AI Agent | M5 | AI-140 |
| 04 AI Agent | M6 | AI-001…003, AI-007, AI-008, AI-011…026, AI-028, AI-029, AI-031, AI-044, AI-045, AI-049, AI-081, AI-083, AI-085…101, AI-103…106, AI-108, AI-123, AI-124, AI-141…147, AI-161, AI-164, AI-181, AI-185, AI-200…202, AI-210, AI-212, AI-213 |
| 04 AI Agent | M7.7 | AI-004, AI-125 |
| 04 AI Agent | M7.9 | AI-005 |
| 05 Dynamic Data | M7.1 | DATA-001…011, DATA-014…016, DATA-018…066, DATA-340 |
| 05 Dynamic Data | M7.2 | DATA-080…089, DATA-290, DATA-293…302 |
| 05 Dynamic Data | M7.3 | DATA-110…119, DATA-291, DATA-292, DATA-322 |
| 05 Dynamic Data | M7.4 | DATA-140…143, DATA-146…170, DATA-180, DATA-181, DATA-183, DATA-185 |
| 05 Dynamic Data | M7.5 | DATA-200, DATA-202…204, DATA-207, DATA-208 |
| 05 Dynamic Data | M7.6 | DATA-230…234, DATA-237, DATA-239…245, DATA-247 |
| 05 Dynamic Data | M7.7 | DATA-350…354 |
| 05 Dynamic Data | M7.8 | DATA-320, DATA-321, DATA-323…325 |
| 06 Commerce | M7.9 | COM-002, COM-003, COM-060, COM-063, COM-065, COM-070, COM-110, COM-111, COM-180 |
| 06 Commerce | M8 | COM-001, COM-020…056, COM-061, COM-062, COM-071…082, COM-085…093, COM-095…102, COM-112…142, COM-150…176, COM-190 |
| 07 Publishing | M1 | PUB-190, PUB-191, PUB-193, PUB-211 |
| 07 Publishing | M4 | PUB-001…033, PUB-040…045, PUB-047…060, PUB-062…066, PUB-070, PUB-071, PUB-080, PUB-082, PUB-120, PUB-121, PUB-125, PUB-126, PUB-150…170, PUB-172…202, PUB-192, PUB-210, PUB-212…217, PUB-230…233 |
| 07 Publishing | M5 | PUB-081, PUB-085, PUB-100, PUB-101, PUB-104, PUB-105 |
| 07 Publishing | M7.2 | PUB-068 |
| 08 Accounts | M1 | ACC-001…005, ACC-007…009, ACC-030, ACC-033, ACC-050, ACC-051, ACC-271, ACC-290, ACC-291, ACC-370 |
| 08 Accounts | M3 | ACC-200, ACC-208, ACC-292 |
| 08 Accounts | M4 | ACC-010…012, ACC-052…072, ACC-074, ACC-090, ACC-092, ACC-130…136, ACC-201…205, ACC-209, ACC-210, ACC-213, ACC-240, ACC-241, ACC-244…247, ACC-255, ACC-256, ACC-270, ACC-272, ACC-273, ACC-310…313, ACC-330, ACC-350, ACC-352, ACC-371, ACC-372 |
| 08 Accounts | M5 | ACC-093, ACC-110, ACC-150, ACC-160…165, ACC-167, ACC-169…174, ACC-207, ACC-314 |
| 08 Accounts | M6 | ACC-094, ACC-151, ACC-152, ACC-293 |
| 08 Accounts | M9+ | ACC-031, ACC-032, ACC-034, ACC-036 |

### B.2 Rujukan tabel fase di spec

| Spec | Tabel fase sumber | Catatan pemetaan |
|---|---|---|
| 01 | per requirement (baris `P0 · Mx`) | DM M1 → Epic 1.8–1.10; DM M3 → Epic 3.1; DM M7 → M7.2–M7.4 |
| 02 | [§36.2](./specs/02-editor.md#362-requirement-per-fase-berdasarkan-fase--prioritas-utama-pada-baris-prioritas) | Baris M0 sebagian diprototipe di M0 lalu difinalkan di M1/M2 |
| 03 | [§21](./specs/03-components-templates.md#21-traceability-per-fase) | Konten library: Epic 3.11 & 4.4; template: Epic 4.5 |
| 04 | [§14](./specs/04-ai-agent.md#14-fase--urutan-implementasi) | Fondasi agent M3 (opsional) → M6 penuh |
| 05 | [§17](./specs/05-dynamic-data.md#17-fase--prioritas) | Sub-fase M7.1–M7.7 + Hardening (M7.8) |
| 06 | [COM-190](./specs/06-commerce-payments.md#com-190-rencana-fase-commerce) | Baris M7 → M7.9; M8 → Epic 8.x; M9 → Epic 9.4 |
| 07 | [§17](./specs/07-publishing-hosting.md#17-ringkasan-fase) | M4 Epic 4.8–4.11; M5 Epic 5.4–5.6 |
| 08 | [§19](./specs/08-accounts-plans-admin.md#19-fase--urutan-implementasi) | Urutan kerja: skema → service+test → route+guard → UI → e2e |

### B.3 Requirement P0 yang belum dipetakan

Tidak ada (per 2026-10-12, semua requirement P0 di spec 01–08 dirujuk minimal satu task). Saat spec menambah requirement P0 baru, tambahkan task dan catat di Lampiran D.

---

## Lampiran C — Backlog P2 & ide (tidak dijadwalkan)

Item di bawah **tidak** dijadwalkan di fase mana pun sampai owner memutuskan (biasanya saat refinement M9). Sebagian sudah punya task kerangka di Epic 9.x.

### C.1 Requirement P2 di spec

| Area | ID | Catatan |
|---|---|---|
| Document model | DM-017 `vector`, DM-021 `embed`, DM-043 light/dark | T9.1.5, T9.1.9, T9.1.7 |
| Editor — Figma lanjutan | ED-030 minimap, ED-048 pen, ED-092 suggest auto-layout, ED-111 blend mode, ED-148 boolean, ED-149 mask, ED-195 copy as | Epic 9.1 |
| Editor — tokens | ED-133 light/dark, ED-135 usage & cleanup | T9.1.7 |
| Editor — kolaborasi | ED-049 comment tool, ED-232 presence, ED-233 cursor, ED-234 follow, ED-235 komentar, ED-236 seleksi lain, ED-237 undo kolaborasi | Epic 9.3 |
| Multi-bahasa | ED-222, ACC-294, PUB-123 | T9.7.1 |
| Library | CMP-056 auto-update, CMP-170 library pribadi, CMP-171 saved sections, CMP-180 marketplace | Epic 9.6 |
| AI | AI-050 sub-agent, AI-184 A/B & canary | T9.7.2 |
| Dinamis | DATA-013 formula, DATA-121 multi-step form, DATA-145 WA OTP, DATA-206 kanban/calendar, DATA-303 realtime, DATA-341 add-on kuota | Epic 9.5 |
| Commerce | COM-004 aggregator, COM-064 produk digital | T9.7.5 |
| Publishing | PUB-034 incremental build | T9.7.3 |
| Akun | ACC-112 referral, ACC-166 faktur pajak, ACC-332 AI support | T9.7.4 |

### C.2 Ide dari spec (belum ber-ID)

- **Workflow/data** (05 §17 P2): `generate_pdf`, API publik dengan CORS, OAuth client milik owner, custom code di sandbox (escape hatch terakhir), node graph workflow editor.
- **Commerce** (06 COM-190 M9+): multi-gateway per site, subscription produk, multi-mata uang, koleksi otomatis, diskon otomatis, paylater, kode unik transfer, alamat tersimpan, klaim pesanan, ProductSearch, inventory movements, COD per wilayah.
- **Publishing** (07 §17 M9+): dashboard CWV, transcoding video, robots.txt kustom, redirect via CSV, hot-update redirect.
- **AI** (04 §14 M9+): apply sebagian, generate gambar, AI terlihat di multiplayer, import website lama penuh.
- **Akun** (08): seat add-on, provider OAuth tambahan (Apple/Facebook/Microsoft), passkey/WebAuthn, 2FA via WA.
- **Platform** (ARCHITECTURE): RLS Postgres penuh (P1), OpenAPI docs (P1), OpenTelemetry tracing (P1), pemisahan Runtime API sebagai deployment sendiri, partisi tabel besar (§17 scalability), CodeQL (P1), Turborepo remote cache.
- **Ide owner** (tambahkan di sini): …

---

## Lampiran D — Log perubahan roadmap

Catat setiap perubahan struktural: task ditambah/dipecah/dipindah/dibatalkan, keputusan OPEN yang diambil, refinement fase, perubahan exit criteria.

| Tanggal | Fase/Task | Perubahan | Alasan | Oleh |
|---|---|---|---|---|
| 2026-10-12 | semua | Roadmap v1 dibuat dari PRD, ARCHITECTURE, spec 01–08 | Awal project | owner + Claude Code |
| 2026-10-13 | T0.8.1 | OPEN 02#2 diputuskan: Shadow DOM (ADR-012) | Isolasi dijamin browser; Tiptap & performa setara prefix | Claude Code (disetujui owner) |
| 2026-10-13 | T0.8.2 | OPEN 02#11 diputuskan: canvas tanpa iframe (ADR-013) | Model Figma; iframe tidak lebih cepat & jauh lebih rumit | Claude Code (disetujui owner) |
| 2026-10-13 | M1.b | 08 OPEN #1: Better Auth dipertahankan; 02 OPEN #4: layers panel Figma order (tampilan saja, `children` tetap DOM order) | Prasyarat M1 | owner |
| 2026-10-13 | T0.8.7 | M0 ditutup: go/no-go = GO bersyarat (T0.7.4 & Safari) | Semua kriteria §M0.e lulus di pengukuran otomatis; keputusan ⚑ lengkap | owner |
| 2026-10-13 | T0.8.6 | OPEN 02#13 diputuskan; DM-076 jadi sumber tunggal batas dokumen, ED-223 diselaraskan | Dua spec bertentangan; angka dari benchmark spike | Claude Code (disetujui owner) |
| 2026-10-13 | T0.8.5 | Rich text: `@tiptap/y-tiptap` menggantikan `y-prosemirror`; konversi JSON ↔ fragment di document-model tanpa ProseMirror | Tiptap 3 memakai fork resmi; aturan dependensi document-model dipertahankan | Claude Code (disetujui owner) |
| 2026-10-13 | T0.8.4 | OPEN-DM-5 diputuskan: `stackRows` statis + margin 0,9, tanpa `keepRowOnMobile` | Akurasi spike ≥ 9/10 di 3 font; baris kecil tetap berjajar | Claude Code (disetujui owner) |
| 2026-10-13 | T0.8.3 | OPEN 02#1 diputuskan: zoom 5%–1600% | 3200% aman tapi tak dibutuhkan; mudah dinaikkan | Claude Code (disetujui owner) |
| | | | | |

Format entri contoh:

```markdown
| 2026-11-03 | T2.4.3 → T2.4.3a, T2.4.3b | Dipecah: resize handle vs modifier | Melebihi 10 file | Claude Code (disetujui owner) |
| 2026-11-10 | A.1 / 02 #2 | Diputuskan: Shadow DOM | Hasil benchmark T0.7.4 | owner |
```

---

*Akhir ROADMAP.md. Saat menambah task, jangan menomori ulang ID yang sudah ada. Saat spec berubah, jalankan ulang pengecekan traceability (Lampiran B).*
