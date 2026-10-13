# 07 — Publishing, Hosting, Domain, SEO & Performa

> **Status:** Draft v1 · **Prefix requirement:** `PUB-` · **Pemilik:** owner (solo developer)
> **Dokumen terkait:** [Document Model](./01-document-model.md) · [Editor](./02-editor.md) · [Components & Templates](./03-components-templates.md) · [Dynamic Data](./05-dynamic-data.md) · [Commerce](./06-commerce-payments.md) · [Accounts, Plans & Admin](./08-accounts-plans-admin.md) · [Architecture](../ARCHITECTURE.md)

Dokumen ini mendefinisikan bagaimana website user berpindah dari **draft** di editor menjadi **website live** yang cepat, aman, dan SEO-friendly: pipeline publish di `apps/worker`, output `packages/renderer`, serving lewat `apps/site-host` (Cloudflare Worker + R2), subdomain, custom domain, SEO, caching, storage, keamanan, observabilitas, dan skema data.

**Konvensi:**
- Prioritas: **P0** = wajib di fase-nya, **P1** = penting, **P2** = nanti.
- Fase: M0..M9 sesuai [ROADMAP](../ROADMAP.md).
- `> ❓ OPEN:` = belum diputuskan, butuh konfirmasi owner.
- `> ⚠️ VERIFIKASI:` = fakta/limit/harga pihak ketiga (terutama Cloudflare) yang **harus dicek ulang di dokumentasi resmi** sebelum implementasi; angka di dokumen ini bukan sumber kebenaran.
- Domain contoh: lokal `localhost` / `platform.test`, production `platformmu.com` (platform) dan — rekomendasi — `platformmu.site` (situs user). Semua kode WAJIB membaca domain dari env var (lihat [§12](#12-production-setup--strategi-domain)), tidak boleh hardcode.

---

## Daftar Isi

1. [Ruang Lingkup & Glosarium](#1-ruang-lingkup--glosarium)
2. [Konsep: Draft → Publish → Deployment → Live](#2-konsep-draft--publish--deployment--live)
3. [Pipeline Publish](#3-pipeline-publish)
4. [Output Renderer (HTML/CSS/JS)](#4-output-renderer-htmlcssjs)
5. [Site-host (Cloudflare Worker)](#5-site-host-cloudflare-worker)
6. [Subdomain](#6-subdomain)
7. [Custom Domain](#7-custom-domain)
8. [SEO & Analytics](#8-seo--analytics)
9. [Custom Code / Script Injection](#9-custom-code--script-injection)
10. [Performa & Caching](#10-performa--caching)
11. [Storage, Media Library & Biaya](#11-storage-media-library--biaya)
12. [Production Setup & Strategi Domain](#12-production-setup--strategi-domain)
13. [Lokal Development](#13-lokal-development)
14. [Keamanan](#14-keamanan)
15. [Observabilitas](#15-observabilitas)
16. [Skema Data & KV](#16-skema-data--kv)
17. [Ringkasan Fase](#17-ringkasan-fase)
18. [Daftar OPEN](#18-daftar-open)

---

## 1. Ruang Lingkup & Glosarium

### 1.1 Dalam scope
- Publish website statis (semua paket) dan bagian dinamis via islands (paket AI, M7+).
- Preview link, rollback, unpublish.
- Hosting di Cloudflare (Worker + R2 + KV), subdomain acak/pilihan, custom domain.
- SEO teknis, analytics ringan, integrasi GA4/Meta Pixel, custom code (Pro+).
- Media library upload pipeline dan optimasi aset.

### 1.2 Di luar scope (dirujuk dokumen lain)
- Struktur node, style, breakpoint, token → [01-document-model.md](./01-document-model.md).
- Tombol Publish, dialog setting di editor → [02-editor.md](./02-editor.md).
- Runtime API (publik `/_api/v1/*` → internal `/runtime/v1/*`), collections, end-user auth → [05-dynamic-data.md](./05-dynamic-data.md).
- Checkout & webhook payment → [06-commerce-payments.md](./06-commerce-payments.md).
- Definisi paket, kuota numerik, billing, moderasi, admin panel → [08-accounts-plans-admin.md](./08-accounts-plans-admin.md). Semua angka batas paket di dokumen ini adalah usulan; **angka final mengikuti 08**.

### 1.3 Glosarium

| Istilah | Arti |
|---|---|
| **Draft** | Working document Yjs milik site (`Y.Doc`) yang terus diedit dan di-autosave. Tidak pernah diserve langsung ke publik. |
| **Snapshot** | Salinan JSON beku dari draft (hasil `Y.Doc` → JSON tervalidasi Zod) pada saat publish/preview dimulai. |
| **Deployment** | Hasil build immutable dari satu snapshot: kumpulan file HTML/CSS/JS/aset + `manifest.json` di R2. Diidentifikasi `deploymentId` (ULID). |
| **Live alias** | Pointer `site → deploymentId` yang menentukan deployment mana yang diserve di hostname produksi site. |
| **Preview deployment** | Deployment ber-`kind = preview`, diakses lewat preview link bertoken, selalu `noindex`. |
| **Hostname** | Nama host yang menuju site: subdomain acak, subdomain pilihan, alias lama (redirect), atau custom domain. |
| **Island** | Potongan UI dinamis yang di-hydrate JS kecil di halaman yang selain itu statis. |
| **Site-host** | `apps/site-host`, Cloudflare Worker yang melayani semua request situs user. |

---

## 2. Konsep: Draft → Publish → Deployment → Live

### 2.1 Model mental

```
 Editor (Yjs draft) ──autosave (Hocuspocus, apps/realtime)──▶ Postgres (draft tersimpan)
        │
        │ klik "Publish"
        ▼
 Snapshot (JSON beku, versi dokumen + hash)
        │  job BullMQ "publish"
        ▼
 Deployment dep_01J... (immutable, di R2)
        │  atomic switch pointer
        ▼
 Live alias: site_123 → dep_01J...   ◀── site-host membaca pointer ini
```

Prinsip:
1. **Draft ≠ live.** Perubahan di editor tidak pernah terlihat publik sampai Publish sukses.
2. **Deployment immutable.** Setelah status `ready`, file deployment tidak pernah diubah. Perubahan = deployment baru.
3. **Live hanyalah pointer.** Publish, rollback, dan unpublish semuanya = mengubah pointer (dan purge cache). Tidak ada copy file saat rollback.
4. **Gagal aman.** Jika build gagal di langkah mana pun, pointer live tidak berubah; website tetap menayangkan deployment sebelumnya.

### PUB-001 Snapshot draft saat publish
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Saat user menekan Publish, API mengambil state draft terbaru (setelah memastikan autosave pending sudah ter-flush), mengonversi `Y.Doc` ke JSON, memvalidasi dengan schema `SiteDocument` dari `packages/document-model`, menghitung `contentHash` (SHA-256 dari JSON kanonik), lalu menyimpan snapshot ke tabel `deployments.snapshot_key` (object di R2 bucket privat, bukan kolom JSONB besar). Snapshot mencatat `documentVersion` (schema version, lihat [01-document-model.md](./01-document-model.md)) dan `yjsStateVector` untuk keperluan audit/diff.
  > Selaras dengan [ARCHITECTURE §7.6](../ARCHITECTURE.md#76-published-snapshot): snapshot publish dicatat sebagai baris `document_snapshots` (`kind = publish`) dan deployment merujuk `snapshot_id`. ❓ OPEN: JSON snapshot disimpan di kolom `document_snapshots.json` (ARCHITECTURE) atau sebagai objek R2 (`snapshot_key`, dokumen ini) untuk site besar — putuskan saat M4; `deployments` menyimpan salah satunya, bukan keduanya.
- **Acceptance criteria:**
  - [ ] Edit yang dilakukan setelah snapshot diambil tidak masuk ke deployment yang sedang dibangun.
  - [ ] Jika `contentHash` sama dengan deployment live saat ini dan setting site tidak berubah, API mengembalikan `409 NO_CHANGES` dengan opsi "Publish ulang tetap" (force) — tidak membuat job baru secara diam-diam.
  - [ ] Snapshot gagal validasi Zod → publish ditolak dengan daftar error per node (lihat PUB-024).

### PUB-002 Deployment immutable & versi
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Setiap publish menghasilkan baris `deployments` baru dengan `id` ULID (`dep_` prefix), nomor urut per site (`seq`: 1, 2, 3...), `kind` (`production` | `preview`), `status` (`queued` → `building` → `uploading` → `ready` | `failed` | `cancelled`), `created_by`, `message` (opsional, catatan publish dari user), statistik (jumlah halaman, total byte, durasi per langkah). File disimpan di prefix `sites/<siteId>/deployments/<deploymentId>/`.
- **Acceptance criteria:**
  - [ ] Tidak ada kode path yang menulis ke prefix deployment berstatus `ready`.
  - [ ] Dashboard menampilkan riwayat deployment: seq, waktu, pembuat, pesan, status, ukuran, durasi, label "Live".
  - [ ] Setiap deployment dapat dibuka via URL immutable internal (preview bertoken) selama belum di-GC.

### PUB-003 Live alias & atomic switch
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Sumber kebenaran pointer live adalah kolom `sites.live_deployment_id` di PostgreSQL. Site-host membaca salinannya dari KV (`host:<hostname>` berisi `deploymentId`). Switch dilakukan **setelah semua file deployment selesai di-upload dan `manifest.json` ditulis terakhir**. Urutan: (1) update DB dalam transaksi (`sites.live_deployment_id`, `deployments.status='ready'`, `promoted_at`), (2) tulis ulang semua key KV `host:*` milik site, (3) purge cache. Karena satu key KV berisi satu `deploymentId`, pembaca selalu melihat deployment lama utuh atau deployment baru utuh — tidak pernah campuran.
- **Acceptance criteria:**
  - [ ] Request selama proses publish tidak pernah mendapat campuran HTML lama dengan CSS baru (CSS/JS ber-hash dan path deployment menjamin ini).
  - [ ] Jika tulis KV gagal, job retry tulis KV hingga 5x dengan backoff; DB tetap sumber kebenaran dan job rekonsiliasi (PUB-246) memperbaiki KV yang tertinggal.
  - [ ] Waktu propagasi KV ke seluruh edge ditampilkan jujur di UI ("Website diperbarui; mungkin butuh hingga ~1 menit di beberapa lokasi").

> ⚠️ VERIFIKASI: Cloudflare KV bersifat *eventually consistent*; waktu propagasi global (historis ±60 detik) dan perilaku cache `cacheTtl` harus dicek di dokumentasi terbaru. Jika konsistensi tidak memadai, alternatif: simpan pointer di Durable Object atau baca pointer dari API origin dengan cache pendek.

### PUB-004 Preview link (unpublished)
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** User dapat membuat preview dari draft tanpa mengubah live. Preview = deployment `kind=preview` yang dibangun dengan pipeline yang sama (agar WYSIWYG identik). URL: `https://preview.<SITES_ROOT_DOMAIN>/<deploymentId>/?t=<token>` atau bentuk host `p-<shortId>.<SITES_ROOT_DOMAIN>` (lihat OPEN). Token = string acak 32 byte base64url, disimpan sebagai hash (SHA-256) di tabel `preview_links` dengan `expires_at` (default 7 hari), `revoked_at`. Setelah token valid pertama kali, Worker memasang cookie `__pv_<deploymentId>` (HttpOnly, Secure, SameSite=Lax, path terbatas) lalu redirect ke URL tanpa token supaya token tidak bocor lewat `Referer`.
- **Acceptance criteria:**
  - [ ] Semua respons preview memiliki header `X-Robots-Tag: noindex, nofollow` dan `<meta name="robots" content="noindex,nofollow">`.
  - [ ] Preview tanpa token/cookie valid → 404 (bukan 403, agar tidak bocor eksistensi).
  - [ ] User bisa mencabut (revoke) link, mengatur masa berlaku (1 hari / 7 hari / 30 hari), dan menyalin link.
  - [ ] Badge Free tetap disuntikkan di preview milik site Free.
  - [ ] Preview tidak menghitung analytics built-in dan tidak memuat GA4/Pixel.

> ❓ OPEN: Bentuk URL preview — path-based (`preview.<domain>/<depId>/`) lebih sederhana untuk DNS/SSL tetapi butuh `<base>`/path prefix di renderer; host-based (`p-<id>.<domain>`) membuat path absolut `/` tetap bekerja. **Rekomendasi: host-based** `p-<deploymentShortId>.<SITES_ROOT_DOMAIN>` karena renderer tidak perlu mode path-prefix, dan wildcard SSL sudah menutupnya.

### PUB-005 Rollback
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Dari riwayat, user memilih deployment `production` berstatus `ready` yang masih tersimpan, lalu "Jadikan live". Operasi = switch pointer (PUB-003) + purge; tidak ada build ulang. Rollback dicatat di `deployment_events` (`type=rollback`, `from`, `to`). Draft TIDAK ikut dikembalikan; opsi terpisah "Pulihkan draft dari versi ini" (memuat snapshot ke draft sebagai transaksi yang bisa di-undo, lihat [02-editor.md](./02-editor.md)).
- **Acceptance criteria:**
  - [ ] Rollback selesai (DB + KV ditulis) < 3 detik di sisi server.
  - [ ] Rollback ke deployment yang dibangun dengan paket lebih tinggi (mis. custom code Pro) saat user sudah downgrade → ditolak atau dibangun ulang dengan aturan paket sekarang (badge disuntikkan runtime oleh Worker, jadi badge selalu mengikuti paket terkini — lihat PUB-070).
  - [ ] Rollback ke deployment yang sudah di-GC tidak ditampilkan sebagai opsi.

### PUB-006 Unpublish
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** User dapat menonaktifkan website. `sites.publish_state = 'unpublished'`, `live_deployment_id` dipertahankan (agar "Publish ulang" instan), KV `host:*` di-update `state=unpublished`. Worker menampilkan halaman netral "Website ini tidak tersedia" dengan status **404** (bukan 503, agar mesin pencari men-deindex) dan `X-Robots-Tag: noindex`. Subdomain tetap direservasi untuk site tersebut.
- **Acceptance criteria:**
  - [ ] Setelah unpublish, semua hostname site (termasuk custom domain) menampilkan halaman unpublished maksimal setelah propagasi KV + purge.
  - [ ] Tombol "Publish lagi" mengembalikan deployment terakhir tanpa build ulang.
  - [ ] Unpublish oleh moderasi berbeda dari unpublish oleh user (lihat PUB-075) dan user tidak bisa membatalkan unpublish moderasi.

### PUB-007 Status publish di editor
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Editor menampilkan indikator: "Belum pernah dipublish", "Ada perubahan belum dipublish" (contentHash draft ≠ contentHash live), "Sedang publish (xx%)", "Live", "Gagal publish". Perbandingan hash dihitung di API secara malas (debounce) — tidak membebani autosave.
- **Acceptance criteria:**
  - [ ] Indikator berubah ke "Ada perubahan" ≤ 5 detik setelah autosave yang mengubah konten.
  - [ ] Undo hingga konten identik dengan live → indikator kembali "Live" (karena berbasis hash).

---

## 3. Pipeline Publish

### 3.1 Gambaran job

Publish dijalankan sebagai job BullMQ di queue `publish` (`apps/worker`). API hanya membuat snapshot + baris `deployments` lalu enqueue.

```ts
// packages/shared/src/jobs/publish.ts (contoh)
export const PublishJobData = z.object({
  deploymentId: z.string(),       // dep_01J...
  siteId: z.string(),
  kind: z.enum(['production', 'preview']),
  snapshotKey: z.string(),        // key object snapshot di bucket privat
  requestedBy: z.string(),        // userId
  planSnapshot: z.object({        // fitur paket saat publish dimulai
    tier: z.enum(['free', 'starter', 'pro', 'business']),
    badge: z.boolean(),
    customCode: z.boolean(),
    dynamic: z.boolean(),
  }),
  force: z.boolean().default(false),
});
```

| # | Langkah | Kode langkah (`step`) | Target waktu (site 10 halaman, ~30 gambar sudah ter-proses) |
|---|---|---|---|
| 1 | Ambil snapshot & lock | `snapshot` | < 0.5 s |
| 2 | Validasi | `validate` | < 0.5 s |
| 3 | Moderasi pre-publish | `moderate` | < 1 s (async eskalasi bila perlu) |
| 4 | Resolve instances/tokens/breakpoints | `resolve` | < 1 s |
| 5 | Render HTML per page (React SSR) | `render` | < 3 s |
| 6 | Generate CSS | `css` | < 2 s |
| 7 | Fonts (download & subset) | `fonts` | < 5 s (cache hit < 0.5 s) |
| 8 | Optimasi aset | `assets` | < 8 s (mayoritas cache hit) |
| 9 | Islands bundle | `islands` | < 3 s (M7) |
| 10 | Meta files (sitemap, robots, manifest, favicon, 404) | `meta` | < 1 s |
| 11 | Upload ke R2 | `upload` | < 5 s |
| 12 | Switch pointer | `promote` | < 1 s |
| 13 | Purge cache | `purge` | < 2 s |
|   | **Total** | | **< 30 s (p95)** |

### PUB-020 Job publish BullMQ
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Queue `publish` dengan concurrency per worker dapat dikonfigurasi (`PUBLISH_CONCURRENCY`, default 2). Hanya **satu publish production aktif per site** (lock Redis `lock:publish:<siteId>` dengan TTL > timeout job). Publish baru saat ada yang berjalan → job lama di-*supersede*: jika belum `upload`, dibatalkan (`cancelled`); jika sudah `upload`, job baru menunggu. Timeout job 5 menit; retry otomatis 2x hanya untuk error kategori `transient` (network/R2 5xx). Job priority: paket berbayar mendapat priority lebih tinggi daripada Free.
- **Acceptance criteria:**
  - [ ] Dua klik Publish cepat berturut-turut menghasilkan satu deployment live final (yang terakhir), tanpa race pointer.
  - [ ] Worker crash di tengah job → job di-retry dari awal dengan `deploymentId` sama; file parsial di prefix ditimpa (aman karena belum `ready`).
  - [ ] Deployment `building` > 10 menit ditandai `failed` oleh sweeper.

### PUB-021 Progress UI real-time
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Worker memanggil `job.updateProgress({ step, pct, message })` dan menulis event ke `deployment_events`. API menyediakan `GET /v1/sites/:siteId/deployments/:deploymentId/events` (Server-Sent Events; fallback polling `GET .../deployments/:id` tiap 2 detik). Editor menampilkan stepper ringkas: "Menyiapkan → Membangun halaman → Mengoptimasi gambar → Mengunggah → Live!" dengan persen dan, saat sukses, tombol "Lihat website" + "Salin link".
- **Acceptance criteria:**
  - [ ] Progress pertama tampil < 1 detik setelah klik Publish.
  - [ ] User boleh menutup dialog/tab; publish tetap berjalan dan notifikasi muncul saat kembali.
  - [ ] Teks progress tersedia dalam ID dan EN (`packages/i18n`).

### PUB-022 Validasi pra-build
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Selain validasi schema, cek semantik: (a) minimal satu page dengan `isHome=true`; (b) slug unik, valid (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, nested `/a/b` diizinkan), tidak bentrok dengan path reserved (`/_api`, `/_assets`, `/_p`, `/_badge`, `/_preview`, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/favicon.ico`, `/404`); (c) semua referensi aset ada di media library; (d) semua instance `componentId@version` dapat di-resolve; (e) link internal mengarah ke page yang ada; (f) fitur yang dipakai sesuai paket (node dinamis di paket non-AI, custom code di bawah Pro); (g) ukuran total di bawah limit paket.
- **Acceptance criteria:**
  - [ ] Error **blocking** (a, b, d, f, g) menghentikan publish. Error **warning** (c gambar hilang → placeholder, e link rusak, alt text kosong, title kosong) tidak menghentikan publish tetapi tampil di laporan.
  - [ ] Setiap issue memiliki `code`, `severity`, `pageId`, `nodeId` (jika ada), pesan i18n, dan aksi "Tunjukkan di editor" yang memilih node tersebut.

### PUB-023 Resolve instances, tokens, breakpoints
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Langkah `resolve` menghasilkan **Resolved Tree**: pohon node tanpa indirection. (1) Instance `componentId@version` di-expand dengan `variant` + `propValues` + `overrides` (field `instance.props` di 01 DM-018) (aturan merge di [01-document-model.md](./01-document-model.md) dan [03-components-templates.md](./03-components-templates.md)); definisi component diambil dari cache berversi (immutable, aman di-cache selamanya). (2) Referensi token (warna, font, spacing, radius, shadow) **tidak** di-inline; diubah menjadi `var(--t-<tokenId>)` dan dikumpulkan ke daftar token terpakai. (3) Style per breakpoint `{ base, tablet, mobile }` dinormalisasi: nilai yang sama dengan breakpoint induk dihapus (agar media query minimal). (4) Node `visible: false` atau `display: "none"` di semua breakpoint dibuang; node hidden di breakpoint tertentu dipertahankan dengan `display:none` di media query terkait. (5) Variabel konten global (nama site, tahun) diisi.
- **Acceptance criteria:**
  - [ ] Fungsi `resolveDocument(snapshot, ctx)` murni (tanpa I/O kecuali lewat `ctx.loadComponent`) dan di-unit-test dengan fixture.
  - [ ] Renderer editor dan pipeline publish memakai fungsi resolve yang **sama** (WYSIWYG).
  - [ ] Instance yang komponennya hilang → error blocking `COMPONENT_NOT_FOUND` dengan nama component.

### PUB-024 Laporan error & warning publish
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Hasil akhir job menyimpan `report` JSON di `deployments.report`:

```json
{
  "status": "failed",
  "failedStep": "validate",
  "issues": [
    { "code": "SLUG_CONFLICT", "severity": "error", "pageId": "pg_2", "message": { "id": "Slug '/kontak' dipakai dua halaman", "en": "Slug '/kontak' used by two pages" } },
    { "code": "IMG_ALT_MISSING", "severity": "warning", "pageId": "pg_1", "nodeId": "n_88" }
  ],
  "stats": { "pages": 10, "bytes": 1843200, "durationMs": { "render": 2100, "assets": 4300 } },
  "errorId": "sentry-event-id-optional"
}
```
- **Acceptance criteria:**
  - [ ] Error internal (bug) tidak menampilkan stack trace ke user; tampil pesan generik + `errorId` untuk support, detail di Sentry.
  - [ ] Warning tampil sebagai checklist "Saran sebelum publish" yang bisa diabaikan.

### PUB-025 Render HTML statis per page
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Worker memanggil `renderPage(resolvedPage, siteContext)` dari `packages/renderer` dengan `react-dom/server` (`renderToString` atau `renderToStaticMarkup` untuk bagian non-island). Output per page: `index.html` di folder slug (`/tentang/index.html`) agar URL tanpa ekstensi dan tanpa trailing-slash dapat dilayani. Detail output di [§4](#4-output-renderer-htmlcssjs).
- **Acceptance criteria:**
  - [ ] Render 10 halaman berukuran sedang (≤ 500 node/halaman) < 3 detik di worker 1 vCPU.
  - [ ] Output deterministik: snapshot sama + versi renderer sama → HTML byte-identik (memungkinkan dedup & cache).
  - [ ] Versi `packages/renderer` dicatat di `deployments.renderer_version`.

### PUB-026 Generate CSS
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Lihat [§4.2](#42-mapping-layout) (PUB-043 token, PUB-044 visual style). Output: `global.<hash>.css` (reset, token custom properties, font-face, utilitas bersama) + CSS per page. Strategi: **class per style-signature**: style node diserialisasi kanonik → hash pendek → class `s-<hash6>`; node dengan style identik berbagi class (dedup). CSS halaman yang total < `CRITICAL_INLINE_LIMIT` (default 14 KB gzip) di-**inline** di `<style>` dalam `<head>`; di atas itu, bagian above-the-fold (section pertama + header) di-inline dan sisanya di file `page-<slug>.<hash>.css` yang dimuat via `<link rel="preload" as="style">` di `<head>` + `<link rel="stylesheet">` di akhir `<body>`. Pola `media="print" onload=...` **tidak dipakai** karena membutuhkan inline event handler yang melanggar CSP (PUB-210).
- **Acceptance criteria:**
  - [ ] Tidak ada rule CSS duplikat (selector+deklarasi identik) dalam satu file.
  - [ ] Class naming stabil antar publish bila style tidak berubah (hash berbasis isi), sehingga cache aset bertahan.
  - [ ] CSS lolos minify (Lightning CSS) dan autoprefix sesuai browserslist platform (`defaults, not dead, iOS >= 14`).

> ❓ OPEN: Atomic CSS penuh (satu class per deklarasi, mis. `.d-flex`, `.gap-16`) vs class per style-signature. **Rekomendasi: style-signature** — lebih mudah di-debug, ukuran cukup kecil untuk situs UMKM, dan mapping 1:1 ke node memudahkan inspector. Evaluasi ulang jika rata-rata CSS per page > 30 KB.

### PUB-027 Fonts: download, subset, self-host
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Font Google yang dipakai (family + weight + style aktual dari Resolved Tree, bukan semua weight) diunduh oleh worker (sumber: Fontsource/Google Fonts API, file `woff2`), di-cache di bucket privat `fonts-cache/<family>/<version>/<weight>-<style>-<subset>.woff2`. Subset: `latin` + `latin-ext` (cukup untuk Bahasa Indonesia & Inggris); P1: subset dinamis berdasarkan glyph yang dipakai (via `subset-font`/HarfBuzz) untuk heading dengan font display besar. File font di-upload sebagai aset content-addressed. `@font-face` memakai `font-display: swap` dan `unicode-range`. Font utama (body + heading pertama) di-`<link rel="preload" as="font" type="font/woff2" crossorigin>` maksimal 2 file.
- **Acceptance criteria:**
  - [ ] Website publish tidak memuat request ke `fonts.googleapis.com`/`fonts.gstatic.com` (privasi & performa).
  - [ ] Font cache hit → langkah `fonts` < 500 ms.
  - [ ] Font custom upload user (P1, Pro+) diproses sama: validasi `woff2/woff/ttf/otf`, konversi ke `woff2`, user mencentang pernyataan lisensi.

> ⚠️ VERIFIKASI: lisensi redistribusi Google Fonts (umumnya OFL/Apache) mengizinkan self-host; cek ulang untuk family tertentu yang non-OFL.

### PUB-028 Optimasi aset gambar
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Gambar di media library sudah diproses saat upload (lihat PUB-180). Saat publish, worker hanya **memilih varian** yang dibutuhkan berdasarkan ukuran render node per breakpoint: menghasilkan `srcset` dengan lebar standar `[320, 640, 960, 1280, 1920, 2560]` (dibatasi lebar asli) dalam format **AVIF** dan **WebP** + fallback **JPEG/PNG** via `<picture>`, serta atribut `sizes` dari lebar node di tiap breakpoint (mis. `(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 600px`). Varian yang belum ada (mis. lebar baru) dibuat on-demand oleh worker dan disimpan permanen. `width`/`height` selalu diisi (mencegah CLS). Gambar di bawah fold: `loading="lazy" decoding="async"`; gambar LCP (gambar terbesar di viewport pertama, heuristik: image/background pertama di section pertama) : `fetchpriority="high"`, tanpa lazy, dan `<link rel="preload" as="image" imagesrcset=... imagesizes=...>`. SVG di-sanitasi (SVGO + hapus script/event handler) dan di-inline bila < 4 KB.
- **Acceptance criteria:**
  - [ ] Tidak ada gambar yang dikirim > 2x lebar render efektif pada DPR 2.
  - [ ] Background image CSS juga mendapat varian via `image-set()` dengan AVIF/WebP.
  - [ ] Placeholder blur (LQIP base64 ≤ 300 byte atau dominant color) untuk gambar besar (P1).

### PUB-029 Islands JS bundle
- **Prioritas:** P0 (M7) / P1 (interaksi ringan M4) · **Fase:** M4 (micro-runtime interaksi), M7 (islands data)
- **Deskripsi / Perilaku:** Halaman statis **tanpa framework runtime**. JS hanya dikirim bila halaman memiliki: (a) interaksi yang tidak bisa murni CSS (menu mobile toggle, accordion, tabs, carousel, modal, scroll-triggered animation) → **micro-runtime** vanilla `pf-runtime.<hash>.js` modular (setiap behavior modul terpisah, hanya yang dipakai dibundel; target total < 5 KB gzip); (b) node data-bound/dinamis (M7: list collection, form, login, table, cart) → **island** yang di-hydrate dengan runtime kecil (Preact atau React-compatible ringan — lihat OPEN) dan memanggil `/_api/v1/*` (lihat [05-dynamic-data.md](./05-dynamic-data.md)). Bundling via esbuild di worker, dari entry yang di-generate per page; chunk bersama di-hash dan di-cache lintas deployment.
- **Markup island:**

```html
<div data-pf-island="collection-list" data-pf-props="isl_7f3a" id="n_42">
  <!-- SSR fallback: skeleton atau data snapshot saat publish -->
</div>
<script type="application/json" id="isl_7f3a">{"collectionId":"col_1","limit":12,"bindings":{...}}</script>
<script type="module" src="/_assets/js/islands-pg_home.4c1d9e.js"></script>
```
- **Acceptance criteria:**
  - [ ] Halaman tanpa interaksi/island = 0 byte JS milik platform (kecuali badge Free yang murni HTML/CSS, dan beacon analytics opsional < 1 KB).
  - [ ] Island menghormati `prefers-reduced-motion` dan tetap menampilkan konten SSR bila JS gagal (progressive enhancement) untuk list/tabel publik.
  - [ ] Ukuran JS island per halaman dilaporkan di `report.stats`.

> ❓ OPEN: Runtime island — **Preact** (+ `preact/compat`, ~4 KB gzip) vs React penuh. Rekomendasi: Preact untuk output publish, dengan `packages/renderer` menulis komponen island yang kompatibel keduanya (editor tetap React). Perlu spike M7.

### PUB-030 Meta files
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Worker menghasilkan:
  - `sitemap.xml` — semua page yang `seo.indexable=true` dan bukan password/draft, dengan `<lastmod>` = waktu konten page terakhir berubah (bukan waktu publish). Jika > 45.000 URL (dynamic pages M7) → sitemap index.
  - `robots.txt` — default `User-agent: *\nAllow: /\nSitemap: https://<primaryHost>/sitemap.xml`; jika site noindex → `Disallow: /`. Preview host selalu `Disallow: /`.
  - `manifest.webmanifest` — nama site, warna tema, ikon (P1 untuk PWA ringan; P0 cukup ikon & nama).
  - **Favicon set** dari 1 gambar upload (min 512×512, PNG/SVG): `favicon.ico` (16/32/48), `icon.svg` (jika sumber SVG), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`. Default: favicon generik platform.
  - **404 page** — page khusus site (jika user mendesain page `404`) atau template 404 default yang memakai header/footer & token site.
- **Acceptance criteria:**
  - [ ] `sitemap.xml` valid terhadap schema sitemaps.org dan memakai hostname primary (custom domain jika aktif).
  - [ ] Karena sitemap/robots bergantung pada hostname primary, keduanya **di-generate oleh Worker saat request** dari `manifest.json` (bukan file statis), agar mengganti primary domain tidak butuh publish ulang.

### PUB-031 Upload ke R2
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Struktur object (detail [§11.1](#111-struktur-bucket)):

```
sites/<siteId>/deployments/<deploymentId>/
  manifest.json                # ditulis TERAKHIR
  pages/index.html
  pages/tentang/index.html
  pages/404.html
  css/global.<hash>.css
  css/page-tentang.<hash>.css
sites/<siteId>/assets/<sha256-16>.<ext>   # content-addressed, dibagi lintas deployment
```

Aset ber-hash diunggah hanya jika belum ada (`HEAD` atau cek tabel `site_assets`). Upload paralel (concurrency 16) via S3-compatible API (`@aws-sdk/client-s3` dengan endpoint R2/MinIO). Setiap object diberi `Content-Type` yang benar. Tidak menyimpan versi pra-kompresi (`.br`/`.gz`); kompresi diserahkan ke Cloudflare edge (lihat PUB-064).
- **Acceptance criteria:**
  - [ ] Publish ulang tanpa perubahan gambar tidak mengunggah ulang aset gambar.
  - [ ] `manifest.json` berisi daftar route → file, header per route, redirect user, metadata SEO global, daftar hostname tidak diperlukan (dibaca dari KV).
  - [ ] Kegagalan upload satu file → retry 3x; tetap gagal → deployment `failed`, live tidak berubah.

```json
// manifest.json (contoh ringkas)
{
  "schema": 1,
  "deploymentId": "dep_01JABC...",
  "siteId": "site_123",
  "rendererVersion": "1.4.0",
  "createdAt": "2026-10-12T09:00:00Z",
  "routes": {
    "/": { "file": "pages/index.html", "pageId": "pg_home" },
    "/tentang": { "file": "pages/tentang/index.html", "pageId": "pg_2" }
  },
  "notFound": "pages/404.html",
  "redirects": [{ "from": "/promo-lama", "to": "/promo", "status": 301 }],
  "seo": { "indexable": true, "sitemapPages": ["/", "/tentang"] },
  "features": { "islands": false, "analytics": true, "passwordProtected": false },
  "trailingSlash": "never"
}
```

### PUB-032 Promote & purge
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Setelah upload: promote (PUB-003) lalu purge. Karena kunci cache HTML di Worker memasukkan `deploymentId` (lihat PUB-150), deployment baru otomatis memakai kunci cache baru — purge hanya diperlukan untuk (a) respons yang di-cache oleh Cloudflare CDN berdasarkan URL (jika memakai cache rules di depan Worker) dan (b) cache in-Worker pointer KV (`cacheTtl`). Purge memakai API purge by hostname/prefix/tag untuk zone terkait.
- **Acceptance criteria:**
  - [ ] Setelah status "Live", request ke homepage dari lokasi edge yang sama mengembalikan deployment baru (diukur di test e2e dengan header `X-Pf-Deployment`).
  - [ ] Purge gagal tidak menggagalkan publish (deployment tetap live); dicatat warning dan di-retry.

> ⚠️ VERIFIKASI: ketersediaan purge by tag/prefix/hostname per paket Cloudflare dan rate limit API purge.

### PUB-033 Target performa publish
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Target p95 **< 30 detik** dari klik Publish hingga "Live" untuk site 10 halaman, 30 gambar (gambar sudah diproses saat upload), 2 family font, tanpa islands, dengan worker 1 vCPU/2 GB. p50 target < 15 detik. Publish site besar (≥ 50 halaman) boleh lebih lama tapi wajib progress jujur.
- **Acceptance criteria:**
  - [ ] Benchmark otomatis (`pnpm bench:publish` dengan fixture 10 halaman) di CI malam; gagal jika p95 > 30 detik.
  - [ ] Metrik durasi per langkah diekspor (lihat [§15](#15-observabilitas)).

### PUB-034 Incremental build (optimasi)
- **Prioritas:** P2 · **Fase:** M9
- **Deskripsi / Perilaku:** Cache hasil render per page berbasis hash input (resolved page + global settings + renderer version). Page yang tidak berubah: salin referensi object (R2 server-side copy) alih-alih render ulang.
- **Acceptance criteria:**
  - [ ] Publish yang hanya mengubah 1 dari 50 halaman < 10 detik.

---

## 4. Output Renderer (HTML/CSS/JS)

`packages/renderer` adalah satu-satunya sumber kebenaran mapping document → DOM. Editor merender node dengan komponen yang sama dalam **mode editor** (menambah atribut `data-node-id`, handler seleksi, tanpa lazy-load) sedangkan publish memakai **mode publish** (markup bersih). Lihat juga [../ARCHITECTURE.md](../ARCHITECTURE.md).

### 4.1 Kerangka HTML halaman

```html
<!doctype html>
<html lang="id" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tentang Kami — Toko Budi</title>
  <meta name="description" content="...">
  <link rel="canonical" href="https://tokobudi.com/tentang">
  <meta property="og:title" content="..."> <!-- + og:description, og:image, og:url, og:type, twitter:card -->
  <link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#0F766E">
  <link rel="preload" as="font" type="font/woff2" href="/_assets/f/3a9c1e.woff2" crossorigin>
  <link rel="preload" as="image" imagesrcset="..." imagesizes="..." fetchpriority="high">
  <link rel="stylesheet" href="/_assets/css/global.91ab2c.css">
  <style>/* critical CSS halaman */</style>
  <script type="application/ld+json">{ ... }</script>
  <!-- generator meta: <meta name="generator" content="Platform"> -->
</head>
<body class="pf-page pf-page--tentang">
  <a class="pf-skip" href="#main">Lewati ke konten</a>
  <header>...</header>
  <main id="main">...</main>
  <footer>...</footer>
  <!-- badge Free disuntikkan oleh site-host di sini -->
</body>
</html>
```

### PUB-040 HTML semantic
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Setiap node punya `semanticTag` (lihat [01-document-model.md](./01-document-model.md)) dengan default cerdas: section → `<section>`, navbar → `<nav>` dalam `<header>`, footer → `<footer>`, teks heading → `<h1>`..`<h6>` sesuai `textRole`, paragraf → `<p>`, list → `<ul>/<li>`, button dengan link → `<a class>`; button aksi → `<button type="button">`, image → `<img>`/`<picture>`, frame generik → `<div>`. Konten utama dibungkus `<main>`. Wrapper div yang tidak membawa style/semantik (frame tanpa style, satu anak) di-*flatten* bila aman.
- **Acceptance criteria:**
  - [ ] Validator memberi warning jika halaman tidak punya tepat satu `<h1>` atau ada lompatan level heading.
  - [ ] Output lolos validator HTML (Nu/`html-validate`) tanpa error di fixture template resmi.
  - [ ] Tidak ada `<a>` di dalam `<a>` atau `<button>` di dalam `<a>` (renderer menurunkan anak menjadi `<span>`).

### 4.2 Mapping layout

| Konsep document model | Output CSS |
|---|---|
| Frame dengan auto-layout `direction: horizontal/vertical` | `display:flex; flex-direction:row/column` |
| `gap` | `gap: <n>px` atau `var(--t-space-x)` |
| `padding` | `padding` (4 sisi) |
| `alignItems` (start/center/end/stretch/baseline) | `align-items` |
| `justify` (start/center/end/space-between) | `justify-content` |
| `wrap: true` | `flex-wrap: wrap` + `row-gap` |
| Grid (M9) | `display:grid; grid-template-columns: ...` |
| Anak **Fixed** width | `width:<n>px; flex-shrink:0` |
| Anak **Hug** | `width:auto` / `width:fit-content` (untuk frame), `flex: 0 0 auto` |
| Anak **Fill** (di sumbu utama) | `flex: 1 1 0; min-width: 0` |
| Anak **Fill** (sumbu silang) | `align-self: stretch` |
| `minWidth/maxWidth/minHeight/maxHeight` | properti CSS terkait |
| Frame **tanpa** auto-layout (posisi bebas) | parent `position:relative`; anak `position:absolute` + constraints |
| Constraint horizontal `left` | `left:<x>px` |
| `right` | `right:<parentW - x - w>px` |
| `left+right` | `left:..; right:..; width:auto` |
| `center` | `left:calc(50% + <offset>px); transform:translateX(-50%)` |
| `scale` | `left:<x/parentW*100>%; width:<w/parentW*100>%` |
| (Vertikal analog: `top`, `bottom`, `top+bottom`, `center`, `scale`) | |
| `absolutePosition: true` di dalam auto-layout | `position:absolute` (dikeluarkan dari flow) |
| Rotation | `transform: rotate(<deg>)` |
| Clip content | `overflow:hidden` |
| Section full-width + content max width | outer `width:100%`, inner `max-width: var(--site-max-width); margin-inline:auto` |

### PUB-041 Auto-layout → flexbox & sizing
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Implementasikan tabel di atas sebagai fungsi murni `styleToCss(node, parent, breakpoint)`. Untuk responsif otomatis (default), renderer menerapkan heuristik yang sama dengan editor (didefinisikan di [01-document-model.md](./01-document-model.md)): misalnya row auto-layout dengan `responsiveStack: true` menjadi `flex-direction: column` di mobile; frame posisi bebas di mobile di-*fallback* menjadi stack vertikal bila `mobileFallback = 'stack'`.
- **Acceptance criteria:**
  - [ ] Test visual (Playwright screenshot) membandingkan canvas editor vs halaman publish untuk 20 fixture di 3 lebar (1440, 834, 390); diff piksel ≤ 0.5%.
  - [ ] Teks `Fill` di dalam row tidak overflow (selalu ada `min-width:0`).

### PUB-042 Breakpoints → media queries
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** `base` = desktop; override `tablet` dan `mobile` menjadi media query **desktop-first** `max-width`. Nilai breakpoint dibaca dari setting site (default didefinisikan di [01-document-model.md](./01-document-model.md); contoh: tablet `≤ 1023px`, mobile `≤ 767px`). Urutan CSS: base → tablet → mobile agar cascade benar. Media query dikelompokkan (satu blok `@media` per breakpoint per file, bukan per rule).
- **Acceptance criteria:**
  - [ ] Override mobile tidak bocor ke tablet; override tablet berlaku di mobile kecuali ditimpa mobile (pewarisan sesuai document model).
  - [ ] Custom width preview di editor (mis. 600px) = hasil browser di 600px.

### PUB-043 Tokens → CSS custom properties
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Semua token site (color, typography, spacing, radius, shadow) dirender di `:root` dalam `global.css`, hanya token yang terpakai (tree-shake). Nama: `--t-<kategori>-<slug>` dengan fallback id (`--t-color-primary`, `--t-space-4`). Mode tema (light/dark, P2) → `[data-theme="dark"]` atau `@media (prefers-color-scheme: dark)` sesuai setting site. Typography token menjadi class `.ty-<slug>` yang menggabungkan family/size/line-height/letter-spacing/weight, dengan ukuran per breakpoint.
- **Acceptance criteria:**
  - [ ] Mengubah nilai token lalu publish ulang hanya mengubah `global.<hash>.css` (CSS halaman tetap byte-identik).
  - [ ] Ukuran font fluid opsional (P1): `clamp(min, preferred vw, max)` bila token bertipe fluid.

### PUB-044 Visual style → CSS
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Fill solid/gradient (linear, radial, conic) → `background`; banyak fill → multiple backgrounds (urutan dibalik sesuai stacking Figma); image fill (cover/contain/tile/crop) → `background-image: image-set(...)` atau `<img>` dengan `object-fit`/`object-position` untuk node image; stroke → `border` (inside) atau `outline`/`box-shadow` (outside/center, sesuai aturan document model); radius per sudut → `border-radius`; effects: drop shadow → `box-shadow`, inner shadow → `box-shadow inset`, layer blur → `filter: blur()`, background blur → `backdrop-filter` (dengan `-webkit-` prefix); opacity; blend mode → `mix-blend-mode`. Teks (Tiptap JSON) → HTML inline (`<strong>`, `<em>`, `<a>`, `<span class>`), dengan sanitasi whitelist.
- **Acceptance criteria:**
  - [ ] Tiptap JSON tidak pernah dirender sebagai HTML mentah; semua mark/node melalui whitelist.
  - [ ] Link eksternal yang ditandai "buka di tab baru" memiliki `rel="noopener noreferrer"`.

### PUB-045 Interactions & hover states → CSS
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** State `hover`, `focus`, `active`, `pressed` (dari variants/interactions di [03-components-templates.md](./03-components-templates.md)) → pseudo-class `:hover`, `:focus-visible`, `:active`. Hover dibungkus `@media (hover:hover)` agar tidak "nempel" di layar sentuh. Transisi → `transition` dengan durasi/easing dari interaction. Interaksi yang butuh state (open/close menu, tabs, accordion, modal, swap variant on click) → atribut `data-pf-action` + micro-runtime (PUB-029); accordion sederhana boleh memakai `<details>/<summary>` tanpa JS.
- **Acceptance criteria:**
  - [ ] Navbar mobile (hamburger) bekerja dengan JS ≤ 1 KB dan dapat dioperasikan keyboard (Esc menutup, fokus terjebak di menu terbuka).
  - [ ] Semua elemen interaktif punya style `:focus-visible` yang terlihat (default platform jika user tidak mendesain).

### PUB-046 Animasi
- **Prioritas:** P1 · **Fase:** M4 (dasar), M9 (lanjutan)
- **Deskripsi / Perilaku:** Animasi entrance (fade, slide, scale) dan scroll-reveal → CSS `@keyframes` + class yang ditambahkan oleh `IntersectionObserver` di micro-runtime (`pf-reveal`, < 1 KB). Jika browser mendukung `animation-timeline: view()`, gunakan CSS murni dengan `@supports` dan JS sebagai fallback. Semua animasi dinonaktifkan di `@media (prefers-reduced-motion: reduce)`. Konten **tidak boleh** tersembunyi permanen bila JS gagal: state awal tersembunyi hanya diterapkan setelah runtime menambahkan class `pf-js` di `<html>`.
- **Acceptance criteria:**
  - [ ] Animasi tidak menyebabkan CLS (hanya `transform`/`opacity`).
  - [ ] Dengan JS dimatikan, seluruh konten terlihat.

### PUB-047 Aksesibilitas output
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** `lang` dari setting bahasa site; skip link; `alt` dari field image (kosong `alt=""` jika ditandai dekoratif); landmark (`header/nav/main/footer`); label form (M7) terhubung `for/id`; icon-only button wajib `aria-label`; kontras warna dicek saat validasi (warning bila < 4.5:1 untuk teks normal); `focus-visible` default; ukuran target sentuh minimal 44×44 px untuk button di mobile (warning).
- **Acceptance criteria:**
  - [ ] Template resmi mencapai skor Lighthouse Accessibility ≥ 95 dan 0 pelanggaran `axe-core` kategori serious/critical.
  - [ ] Warning aksesibilitas muncul di laporan publish (PUB-024).

### PUB-048 Target ukuran & Lighthouse
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Budget per halaman statis tipikal (template resmi): HTML ≤ 60 KB gzip, CSS total ≤ 40 KB gzip (critical inline ≤ 14 KB), JS platform ≤ 5 KB gzip (0 jika tidak ada interaksi), font ≤ 2 file preload, gambar LCP ≤ 200 KB pada mobile. Target **Lighthouse Performance ≥ 90 (mobile, emulasi default)**, SEO ≥ 95, Best Practices ≥ 95, Accessibility ≥ 95.
- **Acceptance criteria:**
  - [ ] CI menjalankan Lighthouse CI terhadap 5 template resmi yang dipublish ke environment staging; gagal jika di bawah target.
  - [ ] Laporan publish menampilkan peringatan budget terlampaui (mis. "Halaman Beranda 3,2 MB — gambar terlalu banyak").

### PUB-049 Tanpa framework runtime untuk halaman statis
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** React hanya dipakai di **build time** (SSR ke string). Output tidak mengandung React runtime, hydration markers, atau `__NEXT_DATA__`-sejenisnya. Atribut internal (`data-node-id`, `data-reactroot`) dibuang di mode publish; atribut yang dipertahankan hanya `id` anchor (untuk link `#section`) dan `data-pf-*` yang dibutuhkan runtime.
- **Acceptance criteria:**
  - [ ] Test snapshot memastikan tidak ada string `react` atau `data-node-id` di HTML output halaman statis.

---

## 5. Site-host (Cloudflare Worker)

### 5.1 Alur request

```
Request https://tokobudi.platformmu.site/tentang
  │
  ├─ 1. Normalisasi host (lowercase, buang port, buang trailing dot)
  ├─ 2. Lookup KV host:<hostname>  (cacheTtl pendek) ──miss──▶ fallback API /internal/v1/hosts/:hostname (PUB-061)
  ├─ 3. Cek state: active | unpublished | suspended | maintenance | redirect | password
  ├─ 4. Jika path /_api/v1/* → proxy ke runtime API /runtime/v1/* (PUB-068)
  ├─ 5. Load manifest.json deployment (cache in-memory + Cache API)
  ├─ 6. Redirect: kanonikalisasi host (www/apex, alias lama), trailing slash, redirect user
  ├─ 7. Resolve route → file R2 (atau aset /_assets/*)
  ├─ 8. Cek Cache API (key menyertakan deploymentId) → hit? kembalikan
  ├─ 9. Ambil object R2, set header, ETag, (HTMLRewriter: badge, analytics, preview noindex)
  └─ 10. Simpan ke Cache API, kembalikan respons
```

### PUB-060 Resolusi host → site
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Semua hostname yang valid (subdomain acak, subdomain pilihan, alias lama, preview host, custom domain dan `www.` variannya) memiliki key KV `host:<hostname>`. Nilai:

```json
{
  "siteId": "site_123",
  "deploymentId": "dep_01JABC...",
  "state": "active",
  "kind": "primary",
  "redirectTo": null,
  "plan": { "tier": "free", "badge": true },
  "password": null,
  "updatedAt": "2026-10-12T09:00:00Z"
}
```
  `kind`: `primary` (host kanonik), `alias` (serve konten tapi redirect 301 ke primary), `preview`. `redirectTo` diisi untuk alias. Hostname tidak dikenal → halaman 404 platform netral ("Website tidak ditemukan") dengan link ke landing page platform.
- **Acceptance criteria:**
  - [ ] Lookup host p50 < 5 ms di edge (KV cache hit).
  - [ ] Host header palsu/aneh (IP, port, karakter ilegal) → 400/404 tanpa error 500.
  - [ ] Hanya satu host `primary` per site; semua host lain alias/redirect.

### PUB-061 Fallback resolusi ke API origin
- **Prioritas:** P1 · **Fase:** M4
- **Deskripsi / Perilaku:** Jika KV miss (mis. propagasi belum selesai, key hilang), Worker memanggil `GET ${RUNTIME_API_ORIGIN}/internal/v1/hosts/:hostname` dengan header `Authorization: Bearer <SITE_HOST_INTERNAL_TOKEN>` (shared secret, lihat [ARCHITECTURE §9.3](../ARCHITECTURE.md#93-service-to-service)) dan meng-cache hasil negatif singkat (30 detik) di Cache API untuk mencegah stampede. API yang sama dipakai di lokal development (lihat [§13](#13-lokal-development)).
- **Acceptance criteria:**
  - [ ] Site yang baru dipublish pertama kali dapat diakses segera (tidak menunggu propagasi KV) melalui fallback.
  - [ ] Endpoint internal di-rate-limit dan tidak dapat diakses publik tanpa token.

### PUB-062 Serve file dari R2
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Route halaman diambil dari `manifest.routes`; path `/tentang`, `/tentang/`, `/tentang/index.html` dinormalisasi ke kanonik (default `trailingSlash: never` → 301 ke `/tentang`). Aset di `/_assets/*` dipetakan ke `sites/<siteId>/assets/*` (content-addressed) atau ke prefix deployment untuk CSS/JS. Binding R2 di Worker (`env.SITES_BUCKET.get(key, { onlyIf, range })`) mendukung conditional request dan Range (untuk video).
- **Acceptance criteria:**
  - [ ] Range request ke video MP4 mengembalikan 206.
  - [ ] Path traversal (`/..%2f`) ditolak.
  - [ ] Request ke file yang tidak ada di manifest → 404 site (PUB-066), tanpa memanggil R2 untuk route halaman.

### PUB-063 Header cache & ETag
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:**

| Jenis | Cache-Control | ETag |
|---|---|---|
| Aset ber-hash (`/_assets/*` dengan hash di nama) | `public, max-age=31536000, immutable` | hash konten |
| HTML | `public, max-age=0, must-revalidate` + edge cache via Cache API (s-maxage internal, mis. 1 jam, invalidasi otomatis via deploymentId) | `"<deploymentId>-<fileHash>"` |
| `sitemap.xml`, `robots.txt` | `public, max-age=3600` | berbasis deploymentId + host |
| `favicon.ico`, `manifest.webmanifest` (nama tetap) | `public, max-age=86400` | hash |
| Preview, halaman password, halaman error | `private, no-store` | – |
| `/_api/*` | ditentukan runtime API | – |

  Worker mendukung `If-None-Match` → 304.
- **Acceptance criteria:**
  - [ ] Header `X-Pf-Deployment: <deploymentId>` dan `X-Pf-Cache: HIT|MISS` di setiap respons HTML (berguna untuk debugging; tidak mengandung data sensitif).
  - [ ] Revalidasi browser untuk HTML yang tidak berubah menghasilkan 304.

### PUB-064 Kompresi
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Andalkan kompresi otomatis Cloudflare (gzip/brotli, dan zstd bila tersedia) berdasarkan `Accept-Encoding` untuk `text/html`, `text/css`, `application/javascript`, `application/json`, `image/svg+xml`, `application/xml`. Gambar/font/video tidak dikompres ulang.
- **Acceptance criteria:**
  - [ ] Respons HTML ke klien yang mengirim `Accept-Encoding: br` ter-kompresi brotli (dicek di staging).

> ⚠️ VERIFIKASI: perilaku kompresi otomatis untuk respons yang dibuat Worker dari body R2 (apakah perlu `encodeBody: 'automatic'`/header tertentu) dan dukungan zstd.

### PUB-065 Redirect sistem
- **Prioritas:** P0 · **Fase:** M4/M5
- **Deskripsi / Perilaku:** Urutan evaluasi: (1) HTTP → HTTPS (dilakukan Cloudflare "Always Use HTTPS"); (2) host alias → primary host, 301, path & query dipertahankan (mencakup subdomain acak lama setelah upgrade, nama subdomain lama setelah rename, `www`↔apex, subdomain platform → custom domain bila custom domain primary); (3) normalisasi trailing slash/`index.html`, 301; (4) redirect user (PUB-067); (5) route.
- **Acceptance criteria:**
  - [ ] Upgrade Free → Starter dan memilih `tokobudi`: `x7k2p9mq.<SITES_ROOT_DOMAIN>/produk?a=1` → 301 ke `tokobudi.<SITES_ROOT_DOMAIN>/produk?a=1`.
  - [ ] Tidak ada redirect chain > 1 hop untuk kasus umum (alias + trailing slash digabung dalam satu 301).

### PUB-066 Halaman 404 & error
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Route tidak dikenal di site aktif → `manifest.notFound` dengan status 404. Error origin (R2 gagal) → halaman 5xx statis bawaan Worker (di-bundle di Worker, tanpa dependency R2) dengan status 503 + `Retry-After: 30`.
- **Acceptance criteria:**
  - [ ] Halaman 404 site memakai branding site; halaman error platform netral dan bilingual.

### PUB-067 Redirect rules buatan user
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Di Site Settings → Redirects, user menambah aturan `from` (path, wildcard `*` di akhir atau parameter `:slug`), `to` (path internal atau URL absolut), `status` (301/302/307/308). Disimpan di tabel `site_redirects`, ikut dibekukan ke `manifest.redirects` saat publish (perubahan redirect butuh publish ulang; P2: hot-update tanpa publish). Batas jumlah per paket — **angka final mengikuti [08](./08-accounts-plans-admin.md)**: redirect manual termasuk `seo.advanced` yang di 08 hanya Pro+ (usulan Free 0, Starter 0, Pro 200; ❓ OPEN bila Starter ingin diberi kuota kecil).
- **Acceptance criteria:**
  - [ ] Validasi mencegah loop (`/a → /b → /a`) dan redirect ke path reserved.
  - [ ] Saat user mengubah slug page, editor menawarkan otomatis membuat redirect 301 dari slug lama.
  - [ ] Import CSV redirect (P2).

### PUB-068 Routing `/_api/v1/*` ke runtime API
- **Prioritas:** P0 · **Fase:** M7
- **Deskripsi / Perilaku:** Request publik `https://<host>/_api/v1/<path>` di-proxy oleh Worker ke api internal `${RUNTIME_API_ORIGIN}/runtime/v1/<path>` dengan header `X-Site-Token` (HMAC-SHA256 atas `siteId.deploymentId.timestamp.method.path` dengan `SITE_HOST_SIGNING_SECRET`, toleransi ±60 detik — format persis di [ARCHITECTURE §9.3](../ARCHITECTURE.md#93-service-to-service)), `X-Forwarded-Host`, dan `X-Forwarded-For` (dari `CF-Connecting-IP`) agar runtime API hanya menerima request dari Worker dan mengambil `siteId` hanya dari token. Same-origin dengan situs sehingga cookie end-user (session member website) first-party per host. Detail endpoint, auth, dan rate limit di [05-dynamic-data.md](./05-dynamic-data.md). Site tanpa fitur dinamis → `/_api/*` 404.
- **Acceptance criteria:**
  - [ ] Runtime API menolak request tanpa `X-Site-Token` valid.
  - [ ] Respons `/_api/*` tidak pernah di-cache oleh Worker kecuali header eksplisit dari runtime API mengizinkan.

### PUB-069 Password-protected site
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Pro+ (OPEN: Starter?) dapat mengunci seluruh site atau page tertentu dengan password. Hash password (argon2id/bcrypt dihitung di API; Worker hanya memverifikasi via `PBKDF2` WebCrypto dengan hash khusus Worker — lihat catatan) disimpan di KV host record (`password: { hash, salt, iter, scope, version }`). Worker menampilkan form password (halaman bawaan bilingual, branding minimal site); sukses → cookie `__pf_pw_<siteIdShort>` = HMAC(siteId + passwordVersion + expiry) dengan secret Worker, HttpOnly, Secure, SameSite=Lax, 7 hari. Mengganti password menaikkan `version` → semua cookie lama invalid. Halaman terkunci selalu `noindex` dan dikeluarkan dari sitemap; `Cache-Control: private`.
- **Acceptance criteria:**
  - [ ] Brute force dibatasi: 10 percobaan / 10 menit / IP / site (Rate Limiting binding atau Durable Object counter).
  - [ ] Aset ber-hash boleh tetap publik (tidak sensitif), tetapi HTML terkunci tidak pernah di-cache publik.

> Catatan: Worker punya batas CPU per request, jadi hindari argon2 di Worker; gunakan PBKDF2-SHA256 WebCrypto dengan iterasi yang cukup tapi di bawah budget CPU. ⚠️ VERIFIKASI batas CPU time Worker per paket.

### PUB-070 Badge "Made with Platform" (Free)
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Badge **tidak** dirender oleh renderer ke HTML deployment; badge **disuntikkan oleh Worker saat serve** memakai `HTMLRewriter` (`onDocument end` / append ke `body`) bila `plan.badge = true` pada record host. Keuntungan: upgrade/downgrade langsung berlaku tanpa publish ulang; rollback tidak bisa "membawa" deployment tanpa badge.
  Markup badge: custom element `<pf-badge>` dengan **declarative shadow DOM** (`<template shadowrootmode="closed">`) berisi style sendiri, posisi `fixed` pojok kanan bawah, link ke landing page platform dengan `?ref=badge&site=<siteId>` (rel `nofollow`? → OPEN). Anti-penghapusan:
  1. Paket Free **tidak bisa** menambahkan custom CSS/JS/code (PUB-140), jadi tidak ada vektor selector global untuk menyembunyikan.
  2. Style badge berada di shadow root (closed) → CSS halaman tidak menembus.
  3. Style host element memakai inline `style` dengan `!important` untuk `display`, `visibility`, `opacity`, `position`, `z-index: 2147483647`, `transform: none`, `clip-path: none`.
  4. Validator publish meng-*clamp* `z-index` node user di site Free (maks 1000) agar node `position: fixed` tidak bisa menimpa badge.
  5. Badge murni HTML/CSS (tidak bergantung JS) dan juga ditandai `<meta name="generator" content="Platform">`.
- **Acceptance criteria:**
  - [ ] Badge tampil di semua halaman HTML site Free (termasuk 404 dan preview), tidak di aset.
  - [ ] Badge tidak menutupi konten penting di mobile: ukuran kecil (≤ 32px tinggi), safe-area aware (`env(safe-area-inset-bottom)`).
  - [ ] Upgrade ke paket tanpa badge → badge hilang setelah KV ter-update (≤ ~1 menit), tanpa publish ulang.
  - [ ] Badge tidak menambah JS dan tidak mengurangi skor Lighthouse > 1 poin.

> ❓ OPEN: Link badge `dofollow` (manfaat SEO platform) vs `nofollow` (lebih "etis"/aman dari penalti link scheme). Rekomendasi: **dofollow ke homepage platform** dengan anchor tetap ("Made with Platform"), evaluasi ulang bila ada sinyal penalti.

### PUB-071 Maintenance & suspended page
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** State host:
  - `maintenance` (diset user, P1): halaman "Sedang dalam perbaikan" bergaya site, status 503 + `Retry-After`.
  - `suspended` (diset moderasi/admin atau billing, lihat [08-accounts-plans-admin.md](./08-accounts-plans-admin.md)): halaman platform netral "Website ini dinonaktifkan" status 451/403 (moderasi konten) atau 402-sejenis → gunakan **403** untuk semua (OPEN) dengan `reasonCode` internal; `/_api/*` juga ditolak.
  - `phishing_block`: halaman peringatan keras (interstitial) tanpa tombol lanjut, status 403.
- **Acceptance criteria:**
  - [ ] Suspend oleh admin berlaku global ≤ propagasi KV + purge; admin dapat melihat timestamp propagasi.
  - [ ] Halaman suspended tidak menampilkan konten site sama sekali (tidak di-cache konten lama).

### PUB-072 Injeksi runtime lain oleh Worker
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** `HTMLRewriter` juga dipakai untuk: menambah `<meta name="robots" content="noindex">` pada host preview & subdomain Free (jika keputusan PUB-125), menyisipkan beacon analytics built-in (PUB-130) bila aktif, dan menyisipkan `<link rel="canonical">` yang mengikuti primary host terkini (sehingga mengganti custom domain tidak butuh publish ulang). Renderer menulis placeholder `<!--pf:head-->`/`<!--pf:body-end-->` untuk titik injeksi yang stabil.
- **Acceptance criteria:**
  - [ ] Overhead HTMLRewriter < 2 ms CPU per request HTML tipikal.

---

## 6. Subdomain

### 6.1 Ringkasan aturan

| Aspek | Free | Starter+ |
|---|---|---|
| Bentuk | acak, mis. `x7k2p9mq.<SITES_ROOT_DOMAIN>` | nama pilihan, mis. `tokobudi.<SITES_ROOT_DOMAIN>` |
| Bisa diganti | Tidak (bisa "regenerate" P2) | Ya, dengan cooldown |
| Alias lama | – | redirect 301 selama N hari |
| Custom domain | Tidak | Pro+ |

### PUB-080 Generator subdomain acak (Free)
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Dibuat saat site dibuat (bukan saat publish), agar link preview & share stabil.
  - Panjang default **8** karakter (`RANDOM_SUBDOMAIN_LENGTH`, boleh 6–10; contoh di brief `x7k2p9` adalah ilustrasi).
  - Charset: huruf kecil + angka **tanpa karakter ambigu**: buang `0 o 1 l i` → `abcdefghjkmnpqrstuvwxyz23456789` (31 karakter). 31^8 ≈ 8,5 × 10^11 kombinasi.
  - Karakter pertama selalu huruf (hindari kesan IP/numeric dan masalah beberapa validator).
  - Tidak mengandung **pola terlarang**: daftar kata kasar/sensitif (ID & EN, termasuk leetspeak sederhana, mis. `4nj`, `b4b1`), kata terkait judi/porno, nama brand reserved (PUB-082), dan substring `xn`, `www`, `api`. Daftar disimpan di `packages/config/subdomain-blocklist.json`.
  - Generator memakai `crypto.randomInt` (CSPRNG). Collision: insert ke tabel `site_domains` dengan unique index `hostname`; konflik → retry hingga 5x; masih gagal → error 500 + alert (indikasi bug).
- **Acceptance criteria:**
  - [ ] Unit test: 1 juta generate tidak menghasilkan karakter ambigu/terlarang; distribusi karakter seragam (chi-square).
  - [ ] Subdomain acak tidak pernah sama dengan nama yang sedang di-reserve/dipakai.

### PUB-081 Aturan subdomain nama pilihan (Starter+)
- **Prioritas:** P0 · **Fase:** M5
- **Deskripsi / Perilaku:**
  - Panjang **3–40** karakter (OPEN: minimal 3 vs 4; nama 3 huruf sangat "premium").
  - Karakter: `a-z`, `0-9`, `-`; tidak diawali/diakhiri `-`; tidak mengandung `--` (mencegah punycode `xn--` dan kebingungan). Regex: `^(?!.*--)[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$`.
  - Input dinormalisasi (lowercase, trim, spasi → `-`); IDN/emoji ditolak.
  - Tidak boleh berada di reserved list (PUB-082) atau blocklist kata kasar; tidak boleh terlalu mirip brand (PUB-083).
  - Tidak boleh berbentuk seperti subdomain acak (8 karakter dari charset acak dengan ≥ 2 digit) agar tidak bentrok/terlihat seperti situs Free (OPEN, rekomendasi ya).
  - **First-come, first-served**; cek ketersediaan real-time di UI (debounce 300 ms, endpoint `GET /v1/subdomains/check?name=`) dengan saran alternatif (`tokobudi-id`, `tokobudijakarta`).
- **Acceptance criteria:**
  - [ ] Endpoint check di-rate-limit (30/menit/user) untuk mencegah enumerasi/squatting massal.
  - [ ] Race dua user memilih nama sama → hanya satu sukses (unique index), yang lain mendapat pesan "baru saja diambil".

### PUB-082 Reserved list
- **Prioritas:** P0 · **Fase:** M4 (berlaku juga untuk generator acak)
- **Deskripsi / Perilaku:** File `packages/config/reserved-subdomains.json` dengan kategori:
  - **Infrastruktur platform:** `www`, `app`, `api`, `admin`, `dashboard`, `editor`, `auth`, `login`, `signin`, `signup`, `account`, `billing`, `pay`, `payment`, `checkout`, `mail`, `email`, `smtp`, `imap`, `pop`, `mx`, `ns`, `ns1`, `ns2`, `dns`, `cdn`, `static`, `assets`, `media`, `img`, `images`, `files`, `upload`, `uploads`, `preview`, `p`, `staging`, `dev`, `test`, `demo`, `sandbox`, `internal`, `status`, `help`, `support`, `docs`, `blog`, `community`, `forum`, `news`, `about`, `legal`, `terms`, `privacy`, `security`, `abuse`, `report`, `partners`, `affiliate`, `marketplace`, `templates`, `store`, `shop` (OPEN: `shop`/`store` boleh untuk user?), `ws`, `realtime`, `webhook`, `webhooks`, `oauth`, `sso`, `id`, `en`.
  - **Brand & institusi (anti-phishing):** bank & fintech besar Indonesia dan global, e-wallet, marketplace, ekspedisi, pemerintah (`bca`, `bri`, `bni`, `mandiri`, `btn`, `bsi`, `cimb`, `danamon`, `permata`, `jenius`, `ovo`, `gopay`, `dana`, `linkaja`, `shopeepay`, `shopee`, `tokopedia`, `lazada`, `bukalapak`, `blibli`, `gojek`, `grab`, `jne`, `jnt`, `sicepat`, `pos`, `bpjs`, `pajak`, `djp`, `kemenkeu`, `polri`, `kpk`, `bi`, `ojk`, `google`, `facebook`, `instagram`, `whatsapp`, `apple`, `microsoft`, `paypal`, `netflix`, dst.). Daftar dapat diperluas admin dari admin panel tanpa deploy (tabel `reserved_subdomains`, sinkron dengan file seed).
  - **Kata kasar/SARA/judi/porno** (ID & EN).
- **Acceptance criteria:**
  - [ ] Admin dapat menambah/menghapus entri reserved dengan alasan; perubahan tidak mencabut subdomain yang sudah dipakai (perlu aksi moderasi terpisah).
  - [ ] Admin dapat meng-assign nama reserved ke akun terverifikasi (mis. brand asli yang mendaftar) secara manual.

### PUB-083 Deteksi kemiripan brand (anti-phishing)
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Nama yang **mengandung** token brand (`bca-login`, `klikbca-promo`, `bri-hadiah`) atau berjarak edit ≤ 1 dari brand (`mandlri`, `g0pay` setelah normalisasi leetspeak `0→o, 1→i/l, 3→e, 4→a, 5→s, 7→t`) → ditolak otomatis atau masuk antrean review (`pending_review`) sesuai skor. Kata pemicu tambahan: `login`, `verifikasi`, `verify`, `secure`, `update`, `hadiah`, `undian`, `promo`, `cs`, `official` bila digabung dengan brand.
- **Acceptance criteria:**
  - [ ] Test set 200 nama phishing nyata (dikurasi) → ≥ 95% tertolak/ter-review; false positive di test set 500 nama UMKM wajar ≤ 2%.

### PUB-084 Ganti nama subdomain (rename)
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Starter+ dapat mengganti nama. Cooldown **30 hari** antar rename (konfigurasi `SUBDOMAIN_RENAME_COOLDOWN_DAYS`), maksimal 3 kali/tahun. Nama lama menjadi **alias redirect 301** selama **90 hari** (`SUBDOMAIN_ALIAS_TTL_DAYS`), setelah itu masuk **karantina 30 hari** (tidak bisa diambil siapa pun, mencegah pengambil-alihan link lama untuk phishing), lalu dilepas.
- **Acceptance criteria:**
  - [ ] Selama periode alias, `namalama.<domain>/*` → 301 ke `namabaru.<domain>/*`.
  - [ ] UI menampilkan tanggal berakhirnya redirect dan tanggal nama lama dilepas.
  - [ ] Pemilik asli dapat mengklaim kembali nama lamanya selama periode alias/karantina.

> ❓ OPEN: N hari alias (usulan 90) dan masa karantina (usulan 30).

### PUB-085 Upgrade Free → nama pilihan
- **Prioritas:** P0 · **Fase:** M5
- **Deskripsi / Perilaku:** Setelah upgrade, user memilih nama; subdomain acak lama menjadi alias 301 ke nama baru **selama paket berbayar aktif** (tanpa batas waktu, karena link lama mungkin sudah tersebar), dan tetap terikat ke site.
- **Acceptance criteria:**
  - [ ] Hostname acak tidak dilepas ke site lain selama site masih ada.
  - [ ] Sitemap/canonical langsung memakai nama baru (berkat injeksi runtime, PUB-072).

### PUB-086 Release saat downgrade / hapus site
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku (usulan):**
  - **Downgrade ke Free:** nama pilihan **dibekukan 30 hari (grace)** — site tetap dilayani di nama pilihan + badge muncul kembali; setelah grace, primary kembali ke subdomain acak lama (yang dihidupkan lagi), nama pilihan menjadi alias 301 selama 30 hari, lalu karantina 30 hari, lalu dilepas. Upgrade lagi dalam masa itu mengembalikan nama.
  - **Hapus site:** semua hostname masuk karantina 30 hari (nama pilihan) / permanen-retired (subdomain acak tidak pernah dipakai ulang).
  - **Suspend karena abuse:** nama **tidak pernah dilepas** (retired) untuk mencegah reuse oleh pelaku.
- **Acceptance criteria:**
  - [ ] Job harian `hostname-lifecycle` menjalankan transisi state dan menulis audit log.

> ❓ OPEN: Aturan downgrade final (grace period, apakah nama pilihan langsung dilepas atau ditahan). Rekomendasi di atas.

---

## 7. Custom Domain

### 7.1 State machine domain

```
 pending_verification ──TXT ok──▶ pending_dns ──CNAME/A ok──▶ provisioning_ssl ──▶ active
        │                              │                            │                │
        └──── timeout 7 hari ──────────┴──────▶ failed ◀────────────┘                │
                                                                                     ▼
                                   disconnected ◀── downgrade / user remove / DNS dicabut > 72 jam
```

### PUB-100 Alur connect custom domain
- **Prioritas:** P0 · **Fase:** M5
- **Deskripsi / Perilaku:** (Pro+) Wizard di Site Settings → Domain:
  1. **Input domain** (`tokobudi.com` atau `shop.tokobudi.com`). Normalisasi: lowercase, buang `http(s)://`, path, trailing dot; IDN dikonversi ke punycode (tampilkan Unicode); validasi via Public Suffix List (tolak TLD saja, tolak domain milik platform, tolak domain yang sudah terhubung ke site lain → tampilkan proses "klaim" via verifikasi TXT).
  2. **Verifikasi kepemilikan** via TXT: `_platform-verify.tokobudi.com TXT "pf-verify=<token>"` (token per domain per site). Tujuannya mencegah domain hijacking (orang lain menghubungkan domain milik korban yang DNS-nya kebetulan menunjuk ke platform).
  3. **Instruksi DNS** sesuai jenis:
     - Subdomain (`www.tokobudi.com`, `shop.tokobudi.com`): `CNAME` → `cname.<SITES_ROOT_DOMAIN>` (target fallback origin custom hostname).
     - Apex (`tokobudi.com`): `A` → IP anycast yang disediakan (atau `CNAME`/ALIAS/ANAME bila DNS provider mendukung CNAME flattening).
  4. **Provisioning SSL** lewat **Cloudflare for SaaS — Custom Hostnames**: API `POST /zones/:zone/custom_hostnames` dengan `ssl.method` (HTTP DCV atau TXT DCV) dan `ssl.type=dv`. Worker yang sama melayani custom hostname (route fallback origin).
  5. **Status** dipoll oleh job `domain-check` (queue `domains`, ARCHITECTURE §5.4; tiap 1 menit selama 30 menit pertama, lalu tiap 15 menit hingga 7 hari) dan ditampilkan real-time di UI.
- **Acceptance criteria:**
  - [ ] Instruksi DNS menampilkan nilai siap salin (tombol copy) dan panduan untuk registrar populer di Indonesia (tautan bantuan generik, bukan integrasi).
  - [ ] Setelah `active`, domain menjadi primary host (opsional, default ya) dan host KV dibuat.
  - [ ] Domain yang sama tidak bisa aktif di dua site; klaim ulang memerlukan TXT baru dan memutus koneksi lama dengan notifikasi email ke pemilik lama.

> ⚠️ VERIFIKASI: (a) cara resmi Cloudflare for SaaS untuk apex domain (A record ke IP tertentu vs "apex proxying"/BYOIP — fitur ini dapat bergantung paket Enterprise), (b) metode DCV yang didukung dan perilaku pre-validation TXT dari Cloudflare sendiri (`_cf-custom-hostname`), (c) kuota custom hostname gratis/berbayar dan harga per hostname, (d) batas rate API. Semua angka harus dicek sebelum M5.

> ❓ OPEN: Jika apex proxying tidak tersedia di paket Cloudflare yang dipakai, strategi apex: (a) wajibkan user memakai DNS provider dengan CNAME flattening (mis. memindahkan nameserver ke Cloudflare milik user sendiri), (b) arahkan apex A record ke layanan redirect apex → `www` (kita host redirect di IP tetap), atau (c) upgrade paket. **Rekomendasi: (b) + dokumentasi (a)** untuk MVP: apex hanya me-redirect ke `www.` dan `www.` sebagai primary.

### PUB-101 www vs apex
- **Prioritas:** P0 · **Fase:** M5
- **Deskripsi / Perilaku:** Saat menambah `tokobudi.com`, wizard menawarkan sekaligus `www.tokobudi.com` dan memilih **primary** (default: `www` jika apex tidak didukung penuh; jika didukung, user pilih). Host non-primary → 301 ke primary, path & query dipertahankan.
- **Acceptance criteria:**
  - [ ] Kedua host memiliki sertifikat valid sebelum redirect diaktifkan (tidak ada peringatan SSL di salah satunya).

### PUB-102 Banyak domain per site
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Satu site boleh punya beberapa custom domain (limit per paket mengikuti [08](./08-accounts-plans-admin.md) `domain.customMax`: Pro 1 per site (+ www), Business 3 per site). Tepat satu primary; sisanya alias 301. Subdomain platform tetap ada sebagai alias 301 ke custom domain primary.
- **Acceptance criteria:**
  - [ ] Mengganti primary memperbarui canonical, sitemap, dan redirect tanpa publish ulang.

### PUB-103 Troubleshooting UI
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Panel diagnosis menjalankan cek DNS dari server (DNS-over-HTTPS ke resolver publik) dan menampilkan: record yang ditemukan vs yang diharapkan, record konflik (A lama ke hosting lain, AAAA yang tertinggal, CAA yang memblokir CA penerbit, proxy oranye Cloudflare milik user yang menyebabkan error), status SSL, propagasi, dan pesan manusiawi bilingual ("Kami masih melihat A record ke 103.x.x.x. Hapus record ini di panel DNS Anda.").
- **Acceptance criteria:**
  - [ ] Minimal mendeteksi: TXT tidak ada/salah, CNAME salah target, AAAA konflik, CAA memblokir, domain kedaluwarsa (NXDOMAIN).
  - [ ] Tombol "Cek ulang sekarang" (rate limit 1/30 detik).

### PUB-104 Pemutusan otomatis saat downgrade
- **Prioritas:** P0 · **Fase:** M5
- **Deskripsi / Perilaku:** Downgrade di bawah Pro → email peringatan + banner; **grace 14 hari** (OPEN) di mana domain tetap aktif dengan badge muncul (jika paket baru punya badge); setelah grace: custom hostname dihapus dari Cloudflare, state `disconnected`, primary kembali ke subdomain platform. Data domain disimpan agar re-connect setelah upgrade cukup satu klik (TXT tetap valid jika belum dihapus user). Juga: job `domain-check` mendeteksi DNS dicabut > 72 jam → `disconnected` + email.
- **Acceptance criteria:**
  - [ ] Tidak ada custom hostname "yatim" di Cloudflare tanpa domain aktif di DB (rekonsiliasi harian, PUB-246).

### PUB-105 Email & DNS lain milik user tidak terganggu
- **Prioritas:** P0 · **Fase:** M5
- **Deskripsi / Perilaku:** Platform tidak pernah meminta user mengganti nameserver (kecuali opsi lanjutan di masa depan). Wizard memperingatkan untuk tidak menghapus record MX/TXT SPF yang ada.
- **Acceptance criteria:**
  - [ ] Teks bantuan mencakup peringatan MX/SPF/DKIM.

---

## 8. SEO & Analytics

### PUB-120 SEO per page
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Field per page (`page.seo` di [01-document-model.md](./01-document-model.md)): `title` (default: `<Nama Page> — <Nama Site>`, template judul dapat diatur di level site `%s | Toko Budi`), `description` (≤ 160 karakter, counter di UI), `ogImage` (upload atau pilih dari media; fallback: OG default site → auto-generate P1), `ogTitle`/`ogDescription` opsional, `indexable` (default true), `canonicalOverride` (opsional, URL absolut). Preview tampilan Google & kartu sosial di panel SEO editor.
- **Acceptance criteria:**
  - [ ] Setiap halaman output punya `<title>`, `meta description` (jika diisi), `og:*`, `twitter:card=summary_large_image`, dan `og:image` absolut dengan ukuran 1200×630 (di-crop otomatis dari sumber).
  - [ ] Warning publish untuk title duplikat antar page atau description kosong.

### PUB-121 Canonical
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Canonical = `https://<primaryHost><path kanonik>` disuntikkan Worker (PUB-072) kecuali `canonicalOverride`. Query string dibuang dari canonical.
- **Acceptance criteria:**
  - [ ] Akses via alias host tetap dialihkan 301 sehingga Google hanya melihat primary.

### PUB-122 Auto-generate OG image
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Worker (BullMQ, job `og-image`) membuat gambar 1200×630 dari template (judul page + nama site + logo + warna primary + gambar hero opsional) via Satori + resvg (atau screenshot Playwright section pertama — OPEN). Disimpan sebagai aset content-addressed.
- **Acceptance criteria:**
  - [ ] Dibuat ulang hanya jika title/logo/warna berubah (hash input).

### PUB-123 hreflang & site multibahasa
- **Prioritas:** P2 · **Fase:** M9
- **Deskripsi / Perilaku:** Site dengan versi ID/EN (struktur `/en/...` atau page varian bahasa, didefinisikan di [01-document-model.md](./01-document-model.md)) menghasilkan `<link rel="alternate" hreflang="id">`, `hreflang="en"`, `x-default`, dan entri sitemap `xhtml:link`.
- **Acceptance criteria:**
  - [ ] Pasangan hreflang selalu timbal balik (validator).

### PUB-124 Structured data JSON-LD
- **Prioritas:** P1 · **Fase:** M5 (LocalBusiness, Organization, WebSite), M7/M8 (Article, Product)
- **Deskripsi / Perilaku:** Dari Site Settings → Bisnis (nama, alamat, telepon/WhatsApp, jam buka, koordinat, logo, sosial media) → `LocalBusiness` (atau subtipe: `Restaurant`, `Store`, dll) + `Organization` + `WebSite`. `BreadcrumbList` otomatis untuk page nested. `Article` untuk page blog (collection posts, M7), `Product` + `Offer` untuk produk (M8, lihat [06-commerce-payments.md](./06-commerce-payments.md)). JSON-LD di-serialize aman (escape `</script>`).
- **Acceptance criteria:**
  - [ ] Output lolos Rich Results Test / Schema Markup Validator untuk fixture.

### PUB-125 noindex untuk subdomain acak Free
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Opsi: (a) index semua (UMKM Free bisa ditemukan di Google — nilai besar bagi user); (b) noindex Free (mengurangi insentif spam SEO/judi online di domain platform, menjaga reputasi domain).
- **Acceptance criteria:**
  - [ ] Kebijakan diimplementasikan sebagai flag per host di KV (`robotsPolicy`), bisa diubah admin per site (mis. memberi index ke site Free terverifikasi) tanpa publish ulang.

> ❓ OPEN: **Rekomendasi:** site Free **di-index secara default** HANYA setelah lolos syarat kualitas/trust: akun email terverifikasi + umur akun ≥ 7 hari + lolos moderasi otomatis; sebelum itu `noindex`. Dengan domain situs user terpisah (`platformmu.site`, PUB-201), risiko reputasi ke domain utama lebih kecil. Owner perlu memutuskan.

### PUB-126 Sitemap & robots
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Lihat PUB-030. Site Settings → SEO: toggle "Sembunyikan dari mesin pencari" (noindex seluruh site), daftar page yang dikecualikan. Editor robots.txt custom (P2, Pro+) dengan validasi.
- **Acceptance criteria:**
  - [ ] Toggle noindex seluruh site menghasilkan `Disallow: /` + `X-Robots-Tag: noindex` setelah publish (atau langsung jika berbasis KV flag).

### PUB-127 Verifikasi Google Search Console & lainnya
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Field khusus (bukan custom code bebas): `googleSiteVerification`, `bingSiteVerification`, `facebookDomainVerification`, `pinterestVerification` → `<meta name="..." content="...">`. Validasi format token (alfanumerik, `-`, `_`, panjang ≤ 100). Tersedia untuk semua paket (OPEN: Free?) karena tidak mengeksekusi script. Untuk subdomain platform, verifikasi meta tag cukup (properti URL-prefix); DNS TXT hanya untuk custom domain.
- **Acceptance criteria:**
  - [ ] Nilai di-escape; input berisi `<`, `"` ditolak.

### PUB-130 Analytics built-in (privacy-friendly)
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Metrik: pageviews, unique visitors (estimasi), top pages, referrer (domain), UTM source/medium/campaign, device (mobile/tablet/desktop), browser/OS (kelas besar), negara/kota (dari header Cloudflare `cf.country`/`cf.city`), durasi 1 hari s/d 12 bulan (retensi per paket). **Tanpa cookie, tanpa fingerprint persisten:** visitor hash = `SHA-256(dailySalt + siteId + IP + UA)` dan `dailySalt` dirotasi harian & dibuang → tidak bisa melacak lintas hari. IP tidak pernah disimpan.
  Pengumpulan: beacon kecil `/_p/a.js` (< 1 KB, disuntikkan Worker) mengirim `navigator.sendBeacon('/_p/e', {p, r, w})`; Worker menambah konteks (country, UA class) dan menulis ke **Workers Analytics Engine** (OPEN) atau mengantre ke API → Postgres rollup harian (`analytics_daily`). Bot difilter (UA bot + `cf.botManagement` bila tersedia). Dashboard di `apps/web`.
- **Acceptance criteria:**
  - [ ] Tidak memasang cookie apa pun; tidak butuh banner cookie untuk analytics built-in.
  - [ ] Pageview dari preview, editor, dan pemilik yang login (opsional toggle) tidak dihitung.
  - [ ] Overhead halaman ≤ 1 KB, tidak memblokir render.

> ❓ OPEN: Penyimpanan analytics — Workers Analytics Engine (murah, skala besar, query SQL API, retensi terbatas — ⚠️ VERIFIKASI) vs Postgres/ClickHouse sendiri. Rekomendasi: Analytics Engine untuk ingest + job harian me-rollup ke Postgres `analytics_daily` untuk retensi panjang.

### PUB-131 Integrasi GA4 & Meta Pixel
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Site Settings → Integrasi: field `ga4MeasurementId` (regex `^G-[A-Z0-9]{4,20}$`), `metaPixelId` (`^\d{10,20}$`), P2: `gtmContainerId` (`^GTM-[A-Z0-9]{4,12}$`, Pro+ saja karena GTM = eksekusi script bebas), TikTok Pixel (P2). Snippet resmi di-generate oleh platform (template tetap, ID di-escape), dimuat `async` setelah konten. CSP otomatis menambah domain yang dibutuhkan. Event standar otomatis (P2): klik tombol WhatsApp, submit form (M7), `Purchase` (M8). Opsi banner persetujuan cookie (P2) — integrasi pihak ketiga dinonaktifkan sampai consent jika diaktifkan.
- **Acceptance criteria:**
  - [ ] Tersedia untuk paket sesuai [08-accounts-plans-admin.md](./08-accounts-plans-admin.md) (usulan: Starter+; Free OPEN).
  - [ ] Input selain format ID valid ditolak — tidak ada jalur menyisipkan script arbitrer lewat field integrasi.

---

## 9. Custom Code / Script Injection

### PUB-140 Custom code per paket
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** **Free & Starter: tidak tersedia** (field tidak muncul; API menolak). **Pro+**: tiga slot per site — `headEnd` (sebelum `</head>`), `bodyStart` (setelah `<body>`), `bodyEnd` (sebelum `</body>`) — dan per page (P2). Batas 50 KB per slot. Disimpan di `site_settings.custom_code` dengan riwayat versi. Diinjeksi saat render (bukan oleh Worker), sehingga ikut immutable per deployment; namun Worker **menghapus** custom code (via `HTMLRewriter` pada marker `<!--pf:custom-start-->...<!--pf:custom-end-->`) bila paket host saat ini tidak mengizinkannya (proteksi downgrade/rollback).
  Elemen node "Embed HTML" (iframe YouTube/Maps/form pihak ketiga) adalah fitur terpisah: Free/Starter hanya boleh **embed whitelist** (YouTube, Vimeo, Google Maps, Spotify, dsb.) yang dirender sebagai `<iframe>` dengan `sandbox` & `loading=lazy`; Pro+ boleh HTML bebas di dalam `<iframe srcdoc sandbox="allow-scripts">` (terisolasi dari halaman).
- **Acceptance criteria:**
  - [ ] UI menampilkan peringatan keamanan yang harus dicentang: "Kode yang Anda tambahkan berjalan di website Anda dan dapat merusak tampilan, memperlambat, atau membahayakan pengunjung. Platform tidak bertanggung jawab atas kode pihak ketiga." (ID/EN).
  - [ ] Custom code tidak pernah dijalankan di editor (canvas) maupun preview AI screenshot kecuali user menyalakan "Jalankan custom code di preview".
  - [ ] Custom code ikut dipindai moderasi (PUB-215) untuk pola berbahaya (crypto miner, redirect ke domain terlarang, form pencuri kredensial).
  - [ ] Badge tetap tidak bisa dihapus (paket dengan custom code memang tidak ber-badge; bila suatu saat paket ber-badge mendapat custom code, aturan PUB-070 tetap berlaku).

---

## 10. Performa & Caching

### PUB-150 Strategi cache berlapis
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:**
  1. **Browser:** aset ber-hash `immutable` 1 tahun; HTML revalidate (ETag).
  2. **Edge (Cache API di Worker):** HTML disimpan dengan cache key sintetis `https://cache.internal/<siteId>/<deploymentId><path>?host=<variant>` — publish/rollback otomatis memakai key baru sehingga **tidak perlu purge HTML**. Hanya key host→deployment (KV) yang perlu propagasi.
  3. **KV `cacheTtl`:** pembacaan KV di-cache di edge (usulan 30–60 detik); trade-off kecepatan switch vs biaya baca.
  4. **R2:** origin terakhir.
- **Acceptance criteria:**
  - [ ] Cache hit ratio HTML di edge ≥ 90% untuk site dengan traffic stabil (diukur via `X-Pf-Cache`).
  - [ ] Waktu switch live yang terlihat user ≤ `KV cacheTtl` + propagasi KV.

> ⚠️ VERIFIKASI: Cache API bersifat per-data-center (tidak global) dan tidak berlaku di domain `*.workers.dev`; batas minimum/maksimum `cacheTtl` KV.

### PUB-151 Image CDN / resizing
- **Prioritas:** P0 (varian pra-generate) / P1 (on-the-fly) · **Fase:** M4 / M5
- **Deskripsi / Perilaku:** M4: semua varian dibuat oleh worker (`sharp`) saat upload/publish dan disajikan statis dari R2 (paling murah & dapat diprediksi). Opsi on-the-fly untuk M5+: (a) **Cloudflare Images** (transformasi via URL `/cdn-cgi/image/...` atau binding Images), (b) resizing di Worker dengan `cf.image` (Image Resizing), (c) **imgproxy** self-hosted di VPS di belakang Cloudflare cache.
- **Acceptance criteria:**
  - [ ] Abstraksi `ImageUrlBuilder` di `packages/renderer` sehingga mengganti strategi tidak mengubah document model.

> ❓ OPEN: Strategi image CDN. **Rekomendasi:** M4 pra-generate dengan `sharp` (tanpa biaya per transformasi, kontrol penuh), evaluasi Cloudflare Images saat volume & kebutuhan crop dinamis meningkat. ⚠️ VERIFIKASI model harga Cloudflare Images/Image Resizing (per transformasi unik/per gambar tersimpan) sebelum memilih.

### PUB-152 Resource hints & font loading
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Karena font & aset self-host di origin yang sama, preconnect hanya dibutuhkan untuk origin pihak ketiga (GA4, Pixel, embed YouTube → `preconnect` hanya bila dipakai di viewport pertama; YouTube memakai *facade* "lite embed" P1: thumbnail + klik untuk memuat iframe). `font-display: swap` + `size-adjust`/`ascent-override` fallback metrics (P1, dihitung otomatis via `@capsizecss/metrics` atau Fontaine) untuk mengurangi CLS.
- **Acceptance criteria:**
  - [ ] Tidak ada `preconnect` ke origin yang tidak dipakai.
  - [ ] Embed YouTube tidak memuat JS YouTube sebelum interaksi (P1).

### PUB-153 Target Core Web Vitals
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Target pada field data (p75, mobile) untuk template resmi: **LCP ≤ 2,5 s**, **INP ≤ 200 ms**, **CLS ≤ 0,1**; TTFB edge (cache hit) ≤ 200 ms dari Indonesia. Pengukuran lab via Lighthouse CI (PUB-048); field via beacon analytics built-in yang (P2) mengirim web-vitals ringkas.
- **Acceptance criteria:**
  - [ ] Dashboard admin menampilkan p75 CWV agregat per template (P2).

### PUB-154 Lazy loading & prioritas
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Lihat PUB-028: lazy untuk gambar/iframe di bawah fold, eager + `fetchpriority=high` untuk kandidat LCP, `content-visibility: auto` + `contain-intrinsic-size` untuk section jauh di bawah fold (P1, setelah diuji tidak merusak anchor link).
- **Acceptance criteria:**
  - [ ] Tidak ada gambar LCP yang ber-`loading=lazy` di template resmi.

---

## 11. Storage, Media Library & Biaya

### 11.1 Struktur bucket

| Bucket | Akses | Isi |
|---|---|---|
| `pf-sites` | dibaca Worker (binding), ditulis worker publish | `sites/<siteId>/deployments/<deploymentId>/...`, `sites/<siteId>/assets/<hash>.<ext>` (aset hasil publish: CSS/JS/font/varian gambar) |
| `pf-media` | privat; disajikan via Worker/presigned | `media/<workspaceId>/<sha256>/original.<ext>`, `media/<workspaceId>/<sha256>/w<width>.<fmt>` (varian), metadata di DB |
| `pf-private` | privat | `snapshots/<siteId>/<deploymentId>.json.gz`, `fonts-cache/...`, `backups/...` |
| `pf-library` | dibaca publik via CDN platform | aset template/component resmi (thumbnail, gambar contoh) — dibagi semua user, tidak dihitung kuota user |

> Catatan: varian gambar dapat langsung ditulis ke `pf-sites/sites/<siteId>/assets/` saat publish (copy dari `pf-media`), atau Worker membaca dari `pf-media` via path `/_media/<hash>/w640.avif` agar satu varian dipakai banyak site milik workspace yang sama. **Rekomendasi:** varian disimpan sekali di `pf-media` dan disajikan via `/_assets/m/<hash>/<variant>` oleh Worker dengan cek bahwa hash tersebut terdaftar di `deployment_assets` milik site (mencegah hotlink lintas site). Ini menghemat storage dan waktu publish.

### PUB-170 Retensi deployment
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Simpan **N deployment production terakhir** per site (usulan Free 3, Starter 10, Pro 30, Business 100 — angka final di [08-accounts-plans-admin.md](./08-accounts-plans-admin.md)) + deployment yang sedang live + deployment yang di-*pin* user (P2). Preview: hapus 7 hari setelah `expires_at` link terakhir. Deployment `failed`: hapus file setelah 24 jam, simpan baris & report 30 hari. Snapshot JSON dipertahankan lebih lama dari file build (usulan 2x N) karena kecil dan memungkinkan "Pulihkan draft".
- **Acceptance criteria:**
  - [ ] Job harian `deployment-gc` menghapus prefix R2 deployment kedaluwarsa dan menandai `deployments.gc_at`.
  - [ ] Deployment live tidak pernah dihapus apa pun hasil hitungan.

### PUB-171 Garbage collection aset yatim
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Aset content-addressed (`sites/<siteId>/assets/*`, varian media) direferensikan lewat tabel `deployment_assets (deployment_id, asset_hash)`. GC mingguan: aset tanpa referensi dari deployment yang masih ada **dan** tidak direferensikan oleh draft/media library → tandai `orphaned_at`; hapus fisik setelah 7 hari (grace untuk race publish). Media library: file yang dihapus user masuk "Sampah" 30 hari.
- **Acceptance criteria:**
  - [ ] GC idempotent dan dapat dijalankan `--dry-run` yang melaporkan byte yang akan dibebaskan.
  - [ ] Tidak ada 404 aset pada deployment yang masih live (test e2e setelah GC).

### PUB-172 Kuota storage
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Kuota dihitung per **workspace/akun**: total byte original media library (varian & deployment tidak dihitung ke user agar mudah dipahami, tetapi dipantau internal). Angka per paket di [08-accounts-plans-admin.md](./08-accounts-plans-admin.md). Saat 80% → banner; 100% → upload ditolak (publish tetap boleh).
- **Acceptance criteria:**
  - [ ] Pemakaian storage tampil di dashboard dengan breakdown per site.
  - [ ] Counter `workspace_usage.storage_bytes` diperbarui transaksional saat upload/hapus, direkonsiliasi harian.

### PUB-180 Media upload pipeline
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:**
  1. Client meminta `POST /v1/media/uploads` (nama, ukuran, MIME, sha256 opsional) → API cek kuota, tipe, ukuran → kembalikan **presigned PUT URL** ke `pf-media/tmp/<uploadId>` (TTL 15 menit). Jika sha256 klien sudah ada di workspace → **dedup**, langsung kembalikan media yang ada.
  2. Client upload langsung ke R2/MinIO, lalu `POST /v1/media/uploads/:id/complete`.
  3. Job `media-process` (BullMQ queue `image-processing`, ARCHITECTURE §5.4): baca file, **validasi tipe berdasarkan magic bytes** (bukan ekstensi/MIME klien), hitung sha256 (dedup final per workspace), **strip EXIF/metadata** (kecuali orientasi → diterapkan lalu dibuang; ICC profile dikonversi ke sRGB), batasi dimensi maks (mis. 6000 px sisi terpanjang; lebih besar → di-downscale, original asli tidak disimpan), buat varian standar (AVIF/WebP/JPEG di lebar [320, 640, 960, 1280, 1920, 2560] yang ≤ lebar asli), thumbnail editor (256 px WebP), dominant color & LQIP, simpan `width/height/blurhash` di tabel `assets`.
  4. SVG: sanitasi ketat (DOMPurify SVG profile / SVGO tanpa script, `foreignObject`, event handler, external href). GIF animasi: konversi ke video MP4/WebM loop (P1) atau dibiarkan bila < 2 MB. Video (P1, Pro+): ukuran maks per paket, tanpa transcoding di M4 (P2: transcoding HLS).
  5. Pindahkan ke key final, hapus `tmp/`.
- **Tipe & ukuran (usulan default, final di 08):**

| Tipe | MIME | Maks per file |
|---|---|---|
| Gambar raster | `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`, `image/heic` (konversi) | 20 MB (Free 10 MB) |
| Vektor | `image/svg+xml` | 2 MB |
| Font (P1) | `font/woff2`, `font/woff`, `font/ttf`, `font/otf` | 5 MB |
| Dokumen (P1) | `application/pdf` | 20 MB |
| Video (P1, Pro+) | `video/mp4`, `video/webm` | 100 MB |

- **Acceptance criteria:**
  - [ ] File `.jpg` yang sebenarnya HTML/script ditolak.
  - [ ] Foto dari HP dengan GPS EXIF: setelah diproses, tidak ada tag GPS (diuji dengan `exiftool` di test).
  - [ ] Upload foto 12 MP diproses (semua varian) < 10 detik; thumbnail tersedia < 3 detik (job prioritas tinggi untuk thumbnail).
  - [ ] Upload file identik kedua kali tidak menambah pemakaian storage.

### 11.2 Catatan biaya

> ⚠️ VERIFIKASI semua harga/limit berikut di halaman pricing Cloudflare terbaru; dokumen ini sengaja tidak menyebut angka:
> - R2: biaya storage per GB-bulan, operasi Class A (tulis/list) & Class B (baca), egress (umumnya bebas egress — verifikasi), free tier.
> - Workers: request/bulan termasuk paket, CPU time per request, biaya tambahan.
> - KV: biaya baca/tulis/list/hapus & free tier; batas tulis per key per detik.
> - Cloudflare for SaaS: jumlah custom hostname gratis & biaya per hostname tambahan.
> - Cloudflare Images / Image Resizing: model harga.
> - Workers Analytics Engine: harga & retensi.
>
> Prinsip desain hemat biaya: (1) aset content-addressed → upload & storage minimal; (2) Cache API di Worker → mengurangi baca R2 (Class B); (3) KV `cacheTtl` → mengurangi baca KV; (4) varian gambar pra-generate → tanpa biaya transformasi per request; (5) GC deployment & aset yatim.

---

## 12. Production Setup & Strategi Domain

### 12.1 Peta domain (rekomendasi)

| Domain | Fungsi | Host |
|---|---|---|
| `platformmu.com` | marketing/landing, blog, docs | `apps/web` (Next.js) |
| `app.platformmu.com` | dashboard, auth, billing, admin, editor (`/editor/...`) | `apps/web` + `apps/editor` |
| `api.platformmu.com` | API platform (`apps/api`) | VPS/container di belakang Cloudflare |
| `realtime.platformmu.com` | Hocuspocus (autosave sejak M1, multiplayer nanti) | `apps/realtime` |
| `assets.platformmu.site` | aset upload user, thumbnail & library resmi (domain tanpa cookie) | R2 custom domain / site-host |
| `*.platformmu.site` | **situs user** (subdomain acak & pilihan) | `apps/site-host` |
| `p-<id>.platformmu.site` | preview link | `apps/site-host` |
| `cname.platformmu.site` | target CNAME custom domain (fallback origin Cloudflare for SaaS) | `apps/site-host` |
| `api.platformmu.com/runtime/v1/*` (internal, hanya dari Worker) | runtime API; publik diakses sebagai `<site-host>/_api/v1/*` | `apps/api` (modul runtime) |

### PUB-200 Wildcard DNS & SSL
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Zone domain situs user di Cloudflare: record wildcard `*` (proxied) → Worker route `*.<SITES_ROOT_DOMAIN>/*` ke `apps/site-host`. Sertifikat wildcard edge (`*.platformmu.site` + apex) via Cloudflare (Universal SSL mencakup satu level wildcard; ⚠️ VERIFIKASI — level lebih dalam seperti `a.b.platformmu.site` butuh Advanced Certificate). SSL mode **Full (strict)** untuk origin API; Worker tidak butuh origin.
- **Acceptance criteria:**
  - [ ] Subdomain apa pun (terdaftar atau tidak) mendapat sertifikat valid; yang tidak terdaftar → 404 platform.
  - [ ] Semua env var domain dibaca dari konfigurasi (lihat 12.2).

### PUB-201 Domain terpisah untuk situs user
- **Prioritas:** P0 · **Fase:** M4 (harus diputuskan sebelum rilis publik — mengubahnya setelah ada ribuan site sangat mahal)
- **Deskripsi / Perilaku:** **Rekomendasi kuat:** situs user dilayani di domain registrable terpisah (mis. `platformmu.site`), BUKAN `*.platformmu.com`. Alasan:
  1. **Isolasi cookie:** cookie sesi platform (`app.platformmu.com`) dengan `Domain=.platformmu.com` tidak akan pernah terkirim ke/terbaca dari situs user; situs user berbahaya tidak bisa melakukan *cookie tossing* ke domain platform. Pola sama dengan `github.io` vs `github.com`.
  2. **Reputasi domain:** jika situs phishing/judi di subdomain terdeteksi Google Safe Browsing atau masuk blocklist (email/ISP/Kominfo), dampaknya ke domain utama (login, email transaksional dari `platformmu.com`) jauh lebih kecil.
  3. **Same-site semantics:** dengan mendaftarkan `platformmu.site` ke **Public Suffix List (PSL)**, browser memperlakukan tiap `x.platformmu.site` sebagai site berbeda → cookie end-user satu situs tidak bisa diset untuk situs lain, dan `SameSite` bekerja per situs user.
  4. **CSP/kebijakan berbeda:** header keamanan editor ketat tidak berbenturan dengan kebutuhan situs user.
  Konsekuensi: brief menyebut contoh `x7k2p9.platformmu.com`; semua dokumen kini memakai `<acak>.platformmu.site` sebagai default, dan seluruh kode memakai env `SITES_ROOT_DOMAIN` sehingga nilai final tinggal konfigurasi.
- **Acceptance criteria:**
  - [ ] Tidak ada cookie platform yang di-set dengan `Domain=` parent yang mencakup situs user.
  - [ ] Pengajuan PSL dilakukan sebelum/sesaat setelah rilis publik (proses review PSL dapat memakan waktu — ⚠️ VERIFIKASI persyaratan PSL, termasuk record `_psl` TXT).

> ❓ OPEN (keputusan direkomendasikan, butuh konfirmasi owner): Pakai domain terpisah `platformmu.site` (atau TLD lain: `.site`, `.page`, `.web.id`, `.my.id`) untuk situs user. Pertimbangkan juga: TLD `.page` HSTS-preloaded (wajib HTTPS — sudah kita lakukan), TLD `.id`-family untuk kesan lokal. Nama domain final menunggu nama produk.

### 12.2 Environment variables domain

Nama env var mengikuti [ARCHITECTURE §15.4 `.env.example`](../ARCHITECTURE.md#154-envexample) (sumber kebenaran nama); tabel ini hanya merangkum yang relevan untuk publishing/hosting.

| Env | Lokal | Production | Dipakai oleh |
|---|---|---|---|
| `PUBLIC_MARKETING_URL` | `http://localhost:3000` | `https://platformmu.com` | web |
| `PUBLIC_APP_URL` | `http://app.localhost:3000` | `https://app.platformmu.com` | semua |
| `PUBLIC_API_URL` | `http://api.localhost:4000` | `https://api.platformmu.com` | web, editor, worker |
| `API_INTERNAL_URL` | `http://localhost:4000` | (private) | web (server-side) |
| `RUNTIME_API_ORIGIN` | `http://localhost:4000` | `https://api.platformmu.com` (atau private) | site-host |
| `SITES_ROOT_DOMAIN` | `localhost` (port 8787) | `platformmu.site` (rekomendasi) | api, worker, site-host |
| `SITES_PORT` | `8787` | (kosong) | api (membentuk URL site lokal) |
| `SITES_PROTOCOL` | `http` | `https` | api, worker |
| `RANDOM_SUBDOMAIN_LENGTH` | `8` | `8` | api (PUB-080) |
| `CUSTOM_DOMAIN_CNAME_TARGET` | `cname.localhost` | `cname.platformmu.site` | api (wizard DNS) |
| `CUSTOM_DOMAIN_APEX_IPS` | – | (dari Cloudflare, ⚠️ VERIFIKASI) | api |
| `PUBLIC_ASSETS_URL` | `http://localhost:9000/assets` | `https://assets.platformmu.site` | semua |
| `S3_ENDPOINT` | `http://localhost:9000` | `https://<accountId>.r2.cloudflarestorage.com` | api, worker |
| `S3_REGION` | `auto` | `auto` | api, worker |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | `minioadmin` / `minioadmin` | secret | api, worker |
| `S3_BUCKET_SITES` / `S3_BUCKET_ASSETS` / `S3_BUCKET_UPLOADS` | `sites` / `assets` / `uploads` | sama | api, worker |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_ZONE_ID_SITES` | – | secret | worker (KV write, purge, custom hostnames) |
| `CLOUDFLARE_KV_HOSTS_NAMESPACE_ID` | – | id | worker, site-host |
| `KV_WRITE_MODE` | `noop` | `cloudflare` | worker |
| `HOST_RESOLVER` | `api` | `kv` | site-host |
| `STORAGE_MODE` | `s3` | `r2` | site-host |
| `SITE_HOST_INTERNAL_TOKEN` / `SITE_HOST_SIGNING_SECRET` | dev value | secret | api, site-host |

### PUB-202 Deploy site-host
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** `apps/site-host/wrangler.toml` dengan environment `staging` dan `production`; binding: `SITES_BUCKET` (R2), `MEDIA_BUCKET` (R2), `HOSTS` (KV), rate limiter (bila tersedia), secrets via `wrangler secret`. Deploy via GitHub Actions (`wrangler deploy --env production`) setelah test lulus. Versi Worker dicatat di header `X-Pf-Host-Version`. Rollback Worker via `wrangler rollback`/versions.
- **Acceptance criteria:**
  - [ ] Staging memakai domain terpisah (`*.staging-platformmu.site`) dan bucket terpisah.
  - [ ] Smoke test pasca-deploy: request ke 3 site canary (Free, Starter, custom domain) harus 200.

---

## 13. Lokal Development

### PUB-190 Domain lokal `*.localhost`
- **Prioritas:** P0 · **Fase:** M1 (dasar) / M4 (site-host)
- **Deskripsi / Perilaku:** Browser modern (Chrome, Edge, Firefox) me-resolve `*.localhost` ke loopback tanpa konfigurasi hosts file. Peta lokal:

| URL | Service |
|---|---|
| `http://localhost:3000` / `http://app.localhost:3000` | `apps/web` (dashboard) |
| `http://app.localhost:5173/editor/...` (atau di-proxy oleh web) | `apps/editor` |
| `http://api.localhost:4000` | `apps/api` |
| `http://<subdomain>.localhost:8787` | `apps/site-host` via `wrangler dev` |
| `http://p-<id>.localhost:8787` | preview |
| `http://localhost:9001` | MinIO console |

  Alternatif `platform.test` (seperti di brief) memerlukan DNS wildcard lokal (dnsmasq/Acrylic DNS di Windows) karena hosts file tidak mendukung wildcard; **default tetap `*.localhost`**.
- **Acceptance criteria:**
  - [ ] `pnpm dev` menjalankan semua app; publish site di lokal menghasilkan URL `http://<sub>.localhost:8787` yang bisa dibuka di browser Windows (WSL2).

### PUB-191 MinIO sebagai pengganti R2
- **Prioritas:** P0 · **Fase:** M1
- **Deskripsi / Perilaku:** Semua akses storage dari Node (api, worker) melalui `@aws-sdk/client-s3` dengan `forcePathStyle: true` saat lokal. Bucket dibuat otomatis oleh service `minio-init`.

Definisi lengkap: `docker/docker-compose.yml` (ARCHITECTURE §15.2) — `postgres:17` (DB `platform_dev`), `postgres-test` (tmpfs), `redis:7`, MinIO (`pgsty/minio`, build komunitas karena image resmi `minio/minio` tidak lagi diterbitkan), `minio-init` (`mc`) yang membuat bucket `sites`, `assets` (public-read), `uploads`, `backups`, dan Mailpit. Nama bucket mengikuti variabel `S3_BUCKET_*` di `.env` (§15.4).
- **Acceptance criteria:**
  - [ ] Tidak ada kode yang memanggil API khusus R2 dari Node; semua S3-compatible.

### PUB-192 `wrangler dev` untuk site-host
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** `wrangler dev` (Miniflare) menjalankan Worker di `localhost:8787`. Karena binding R2/KV lokal milik Miniflare terpisah dari MinIO/DB, site-host memakai **abstraksi**:

```ts
// apps/site-host/src/storage.ts
export interface SiteStorage {
  get(key: string, opts?: { range?: Range; etag?: string }): Promise<StoredObject | null>;
}
// STORAGE_MODE=r2  → R2Storage(env.SITES_BUCKET)
// STORAGE_MODE=s3  → S3HttpStorage(endpoint MinIO, aws4fetch signed GET)

export interface HostResolver {
  resolve(hostname: string): Promise<HostRecord | null>;
}
// HOST_RESOLVER=kv  → KvHostResolver(env.HOSTS) + fallback ApiHostResolver
// HOST_RESOLVER=api → ApiHostResolver(RUNTIME_API_ORIGIN)  // lokal
```
  Dengan demikian lokal tidak perlu menyinkronkan KV; API membaca langsung dari Postgres. Test integrasi CI menjalankan kedua mode.
- **Acceptance criteria:**
  - [ ] `pnpm --filter site-host dev` berjalan tanpa akun Cloudflare.
  - [ ] Custom domain bisa diuji lokal dengan `curl -H "Host: tokobudi.test" http://localhost:8787/` (host record dibuat via seed).

### PUB-193 Catatan WSL2
- **Prioritas:** P0 · **Fase:** M1
- **Deskripsi / Perilaku:**
  - Simpan repo di filesystem Linux (`/home/...`), bukan `/mnt/c/...`, agar file watcher (Vite, Next, wrangler) cepat & andal.
  - Akses dari browser Windows ke `*.localhost:<port>` bekerja lewat localhost forwarding WSL2; jika tidak, aktifkan `networkingMode=mirrored` di `%UserProfile%\.wslconfig` (⚠️ VERIFIKASI ketersediaan per versi Windows/WSL).
  - `wrangler dev` dan server Node harus bind ke `0.0.0.0` atau `localhost` sesuai mode jaringan; dokumentasikan di README dev.
  - Docker Desktop (WSL2 backend) atau Docker Engine native di WSL2; jangan dua-duanya.
  - Batasi memori WSL2 (`.wslconfig` `memory=`) bila worker `sharp`/Playwright berat.
- **Acceptance criteria:**
  - [ ] README dev berisi langkah troubleshooting di atas.

---

## 14. Keamanan

### PUB-210 Header keamanan situs user
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Worker menambahkan header ke semua respons HTML situs user:

```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' data: blob: https:;
  media-src 'self' https:;
  font-src 'self' data:;
  style-src 'self' 'unsafe-inline';
  script-src 'self' <origin integrasi yang aktif: googletagmanager.com, connect.facebook.net, ...>;
  connect-src 'self' <origin integrasi>;
  frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com <embed whitelist>;
  frame-ancestors 'self' <APP_URL>;
  base-uri 'self'; form-action 'self' <origin payment gateway M8>; object-src 'none';
  upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000            (subdomain platform: + includeSubDomains di level zone)
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin-allow-popups
```
  - CSP dibangun dari `manifest.features` + integrasi aktif; site Pro+ dengan custom code mendapat CSP longgar (`script-src * 'unsafe-inline'` atau CSP dinonaktifkan opsional) — dengan peringatan PUB-140.
  - `frame-ancestors` mengizinkan `APP_URL` agar dashboard bisa menampilkan preview iframe.
  - HSTS untuk **custom domain**: hanya `max-age` tanpa `includeSubDomains`/`preload` (subdomain lain milik user bukan urusan platform).
- **Acceptance criteria:**
  - [ ] Template resmi tanpa custom code tidak menghasilkan pelanggaran CSP di console (test Playwright).
  - [ ] Inline script yang dibutuhkan platform (jika ada) memakai hash/nonce, bukan `'unsafe-inline'` di `script-src`.

### PUB-211 Header keamanan platform (editor/dashboard)
- **Prioritas:** P0 · **Fase:** M1
- **Deskripsi / Perilaku:** `app.` & `api.`: `X-Frame-Options: DENY` + `frame-ancestors 'none'` (anti-clickjacking editor), CSP ketat dengan nonce, HSTS `includeSubDomains; preload` untuk `platformmu.com` (setelah semua subdomain HTTPS), cookie sesi `__Host-` prefix (Secure, Path=/, tanpa Domain) bila memungkinkan dengan Better Auth.
- **Acceptance criteria:**
  - [ ] Editor tidak bisa di-iframe oleh origin mana pun.
  - [ ] Canvas editor yang merender konten user (embed, custom code tidak dijalankan) memakai iframe `sandbox` untuk embed pihak ketiga.

### PUB-212 Isolasi cookie
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Lihat PUB-201. Selain itu: cookie Worker (preview, password) di-scope ke host persis (tanpa `Domain`), nama ber-prefix `__Host-` jika path `/`. Cookie end-user (member website, M7) di-set oleh runtime API via Worker dengan `__Host-` dan tidak pernah dibagi antar site.
- **Acceptance criteria:**
  - [ ] Test: cookie yang diset `a.<SITES_ROOT_DOMAIN>` tidak terkirim ke `b.<SITES_ROOT_DOMAIN>`.

### PUB-215 Abuse & moderasi hook
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Interface `ModerationService` (implementasi & kebijakan di [08-accounts-plans-admin.md](./08-accounts-plans-admin.md)):

```ts
interface PrePublishCheckInput {
  siteId: string; workspaceId: string; planTier: PlanTier;
  hostnames: string[];
  text: string[];            // teks yang diekstrak dari resolved tree (heading, paragraf, button, alt, meta)
  links: string[];           // href eksternal
  forms: { action?: string; fields: string[] }[]; // M7: deteksi field password/OTP/PIN/nomor kartu
  imageHashes: string[];     // untuk perceptual hash brand logo (P2)
  customCode?: string;
}
type ModerationVerdict =
  | { action: 'allow'; score: number }
  | { action: 'hold'; score: number; reasons: string[] }      // publish ditahan → antrean review admin
  | { action: 'block'; score: number; reasons: string[] };    // publish ditolak + flag akun
```
  Sinyal awal: kata kunci judi online (ID: "slot gacor", "maxwin", "deposit pulsa", "togel", dll — daftar dikelola admin), phishing (brand + "login/verifikasi", form meminta PIN/OTP/password di paket statis, link ke domain mirip brand), URL reputasi (Google Safe Browsing / Web Risk API — ⚠️ VERIFIKASI lisensi komersial), akun baru + publish masif. **Pemeriksaan berkala:** job `moderation-rescan` harian untuk site yang berubah + sampling acak; laporan abuse publik via link "Laporkan" di halaman platform & form `abuse@`.
- **Acceptance criteria:**
  - [ ] Publish berstatus `hold` menampilkan pesan netral ke user ("Website sedang ditinjau, biasanya < 24 jam") dan tidak mengubah live.
  - [ ] Admin dapat suspend site → state host `suspended` dalam ≤ 1 menit (PUB-071).
  - [ ] Semua keputusan moderasi tercatat di audit log.

### PUB-216 Rate limit publish
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Batas usulan (konfigurasi per paket di 08): Free 20 publish/jam/site & 100/hari/akun; Starter 60/jam; Pro+ 120/jam. Preview: 30/jam/site. Upload media: 200 file/jam (Free 50). Implementasi Redis sliding window di API. Respons `429` dengan `Retry-After` dan pesan i18n.
- **Acceptance criteria:**
  - [ ] Melebihi limit tidak membuat baris deployment.

### PUB-217 DDoS & bot
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Semua traffic situs user lewat proxy Cloudflare (DDoS L3/L4/L7 bawaan). Tambahan: WAF rule rate limit per IP untuk `/_api/*` dan form; Bot Fight Mode/Turnstile untuk form publik (M7). Origin API tidak terekspos publik untuk runtime (hanya menerima dari Worker via HMAC + allowlist IP Cloudflare bila memungkinkan).
- **Acceptance criteria:**
  - [ ] Site viral (lonjakan 100x) tetap dilayani dari cache tanpa menaikkan beban origin API (HTML & aset dari edge/R2).

> ⚠️ VERIFIKASI: fitur WAF/rate limiting/bot yang tersedia di paket Cloudflare yang dipilih.

### PUB-218 Integritas deployment & rahasia
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Kredensial (CF token, S3 keys) hanya di worker/api, scope minimal (token CF khusus: KV write namespace hosts, purge zone sites, custom hostnames zone sites). Snapshot & deployment tidak pernah berisi secret (mis. kredensial payment gateway user — itu di runtime API, terenkripsi; lihat [06-commerce-payments.md](./06-commerce-payments.md)). Lint pipeline: scan output HTML untuk pola secret (`sk_`, `-----BEGIN`) → blocking error.
- **Acceptance criteria:**
  - [ ] Test: memasukkan string mirip secret ke teks konten menghasilkan warning, ke custom code menghasilkan blocking error.

---

## 15. Observabilitas

### PUB-230 Log & metrik publish
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Log JSON terstruktur (pino) di worker dengan `deploymentId`, `siteId`, `step`, `durationMs`, `bytes`, `result`. Metrik: `publish_total{result, tier}`, `publish_duration_seconds{step}` (histogram), `publish_queue_wait_seconds`, `publish_queue_depth`, `media_process_duration_seconds`. Error ke Sentry dengan tag `deploymentId`. Event bisnis ke `deployment_events`.
- **Acceptance criteria:**
  - [ ] Dari satu `deploymentId`, owner bisa menemukan log, event Sentry, dan file R2 dalam < 1 menit (runbook di ARCHITECTURE).

### PUB-231 Observabilitas site-host
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Workers Logs / Logpush (⚠️ VERIFIKASI ketersediaan per paket) dengan sampling; Sentry untuk exception Worker (toucan-js atau SDK resmi). Metrik: request count, 4xx/5xx rate per status, latency p50/p95, cache hit ratio, KV miss & fallback API rate, R2 error rate, CPU time.
- **Acceptance criteria:**
  - [ ] Dashboard ringkas (Cloudflare analytics + Grafana/Sentry) memperlihatkan 5xx rate site-host per 5 menit.

### PUB-232 Uptime & synthetic check
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Monitor eksternal (layanan uptime pihak ketiga atau Cron Trigger Worker terpisah) memeriksa tiap 1 menit: 3 site canary (Free subdomain, Starter subdomain, custom domain), `app.`, `api.`/health, dan latency publish canary (publish sintetis tiap 30 menit di staging, tiap 6 jam di production).
- **Acceptance criteria:**
  - [ ] Halaman status publik (`status.platformmu.com`, P1).

### PUB-233 Alert
- **Prioritas:** P0 · **Fase:** M4
- **Deskripsi / Perilaku:** Alert (email + Telegram/WhatsApp ke owner) jika: 5xx site-host > 1% selama 5 menit; canary down 2 cek berturut-turut; publish failure rate > 10% per 15 menit; queue depth `publish` > 50 atau wait p95 > 2 menit; custom hostname SSL gagal massal; KV write error berulang; R2 error rate > 0,5%.
- **Acceptance criteria:**
  - [ ] Setiap alert memiliki tautan runbook.

---

## 16. Skema Data & KV

Skema Drizzle (ringkas; nama kolom snake_case, tipe PostgreSQL) di `packages/db/src/schema/hosting.ts` (`@platform/db`). Tabel `sites`, `workspaces`, `users` utama didefinisikan bersama dokumen lain; di sini kolom yang relevan publishing. **Nama tabel, tipe PK, dan konvensi kolom mengikuti [ARCHITECTURE §6](../ARCHITECTURE.md#6-data-architecture)** (sumber kebenaran); spec ini menambah kolom/tabel detail perilaku publishing.

> ❓ OPEN: rekonsiliasi detail dengan ARCHITECTURE §6.3 — tipe PK (`text` ULID ber-prefix di sini vs UUIDv7 di ARCHITECTURE), tabel detail `domains` (di ARCHITECTURE dilipat ke kolom `site_domains.verification`/`cf_custom_hostname_id`/`ssl_status`), dan `site_settings` (di ARCHITECTURE: `sites.settings jsonb`). Putuskan saat menulis migration M4; sampai saat itu nama tabel ARCHITECTURE yang dipakai.

### PUB-240 Tabel `sites` (kolom publishing)

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `text` PK | `site_<ulid>` |
| `workspace_id` | `text` FK | |
| `name` | `text` | |
| `publish_state` | `text` enum | `never_published` \| `published` \| `unpublished` \| `maintenance` \| `suspended` |
| `live_deployment_id` | `text` FK null | pointer live (sumber kebenaran) |
| `primary_hostname_id` | `text` FK null | |
| `draft_content_hash` | `text` | diperbarui lazily |
| `suspended_reason` | `text` null | kode moderasi |
| `robots_policy` | `text` enum | `index` \| `noindex` \| `auto` (PUB-125) |
| `created_at` / `updated_at` | `timestamptz` | |

### PUB-241 Tabel `site_domains`
Menggabungkan subdomain dan custom domain agar resolusi seragam.

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `text` PK | `hn_<ulid>` |
| `site_id` | `text` FK | |
| `hostname` | `text` UNIQUE | lowercase, punycode; unik global (partial index `WHERE status NOT IN ('released')`) |
| `type` | `text` enum | `random_subdomain` \| `chosen_subdomain` \| `custom_domain` \| `preview` |
| `role` | `text` enum | `primary` \| `alias` |
| `status` | `text` enum | `active` \| `alias_redirect` \| `quarantined` \| `released` \| `retired` \| (custom: lihat `domains`) |
| `redirect_until` | `timestamptz` null | akhir periode alias |
| `quarantine_until` | `timestamptz` null | |
| `created_at` / `updated_at` | | |

### PUB-242 Tabel `domains` (detail custom domain)

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `text` PK | `dom_<ulid>` |
| `hostname_id` | `text` FK UNIQUE | 1:1 ke `site_domains` |
| `apex` | `text` | `tokobudi.com` (registrable domain via PSL) |
| `state` | `text` enum | `pending_verification` \| `pending_dns` \| `provisioning_ssl` \| `active` \| `failed` \| `disconnected` |
| `verification_token` | `text` | untuk TXT `_platform-verify` |
| `verified_at` | `timestamptz` null | |
| `cf_custom_hostname_id` | `text` null | id di Cloudflare for SaaS |
| `ssl_status` | `text` null | mirror status Cloudflare |
| `dns_check` | `jsonb` | hasil diagnosis terakhir (PUB-103) |
| `last_checked_at` | `timestamptz` | |
| `failure_reason` | `text` null | |
| `disconnect_at` | `timestamptz` null | jadwal pemutusan (downgrade) |

### PUB-243 Tabel `deployments`, `deployment_events`, `deployment_assets`, `preview_links`

```ts
// packages/db/src/schema/hosting.ts (cuplikan Drizzle)
export const deployments = pgTable('deployments', {
  id: text('id').primaryKey(),                       // dep_<ulid>
  siteId: text('site_id').notNull().references(() => sites.id),
  seq: integer('seq').notNull(),                     // unik per site
  kind: text('kind', { enum: ['production', 'preview'] }).notNull(),
  status: text('status', { enum: ['queued','building','uploading','ready','failed','cancelled'] }).notNull(),
  snapshotKey: text('snapshot_key').notNull(),
  contentHash: text('content_hash').notNull(),
  documentVersion: integer('document_version').notNull(),
  rendererVersion: text('renderer_version'),
  planTier: text('plan_tier').notNull(),
  message: text('message'),
  report: jsonb('report'),                           // PUB-024
  stats: jsonb('stats'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  promotedAt: timestamp('promoted_at', { withTimezone: true }),
  gcAt: timestamp('gc_at', { withTimezone: true }),
}, (t) => ({ siteSeq: uniqueIndex('deployments_site_seq').on(t.siteId, t.seq) }));

export const deploymentEvents = pgTable('deployment_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  deploymentId: text('deployment_id').notNull(),
  siteId: text('site_id').notNull(),
  type: text('type').notNull(),     // step_started | step_done | promoted | rollback | unpublished | failed | purge_failed
  data: jsonb('data'),
  actorId: text('actor_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deploymentAssets = pgTable('deployment_assets', {
  deploymentId: text('deployment_id').notNull(),
  assetHash: text('asset_hash').notNull(),           // sha256 prefix + varian
  bytes: integer('bytes').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.deploymentId, t.assetHash] }) }));

export const previewLinks = pgTable('preview_links', {
  id: text('id').primaryKey(),
  deploymentId: text('deployment_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdBy: text('created_by').notNull(),
});
```

### PUB-244 Tabel `site_redirects` & `site_settings` (SEO/integrasi)

| Tabel | Kolom penting |
|---|---|
| `site_redirects` | `id`, `site_id`, `from_path`, `to`, `status_code` (301/302/307/308), `position` (urutan), `created_at` |
| `site_settings` | `site_id` PK, `seo` jsonb (`titleTemplate`, `defaultDescription`, `defaultOgImageId`, `indexable`, `excludedPageIds`), `favicon_media_id`, `language` (`id`/`en`), `business` jsonb (untuk JSON-LD), `integrations` jsonb (`ga4MeasurementId`, `metaPixelId`, `gtmContainerId`, verifikasi meta), `custom_code` jsonb (`headEnd`, `bodyStart`, `bodyEnd`, `acknowledgedAt`), `password` jsonb (hash, scope, version), `analytics_enabled` bool, `trailing_slash` enum, `breakpoints` (rujuk 01) |
| `assets` | `id`, `workspace_id`, `sha256`, `mime`, `bytes`, `width`, `height`, `dominant_color`, `lqip`, `variants` jsonb, `status` (`processing`/`ready`/`failed`), `deleted_at` |
| `reserved_subdomains` | `name` PK, `category` (`infra`/`brand`/`profanity`/`gambling`), `reason`, `assignable_to_workspace_id` null |
| `analytics_daily` (P1) | `site_id`, `date`, `path`, `views`, `visitors`, `referrers` jsonb, `devices` jsonb, `countries` jsonb |

Zod schema untuk semua field `jsonb` didefinisikan di `packages/document-model` atau `apps/api/src/modules/sites/*.schema.ts` dan di-reuse lewat drizzle-zod.

### PUB-245 Format KV

| Key | Value | Ditulis oleh | Catatan |
|---|---|---|---|
| `host:<hostname>` | `HostRecord` JSON (PUB-060) | worker (promote, domain, plan change, moderasi) | key utama; satu per hostname |
| `site:<siteId>:hosts` | `string[]` hostname | worker | untuk menulis ulang semua host site dengan cepat |
| `blk:<hostname>` | `{ reason, at }` | admin/moderasi | override darurat (dicek sebelum `host:`) — opsional, bisa digabung ke `host:` |

```ts
export const HostRecord = z.object({
  v: z.literal(1),
  siteId: z.string(),
  deploymentId: z.string().nullable(),
  state: z.enum(['active', 'unpublished', 'maintenance', 'suspended', 'phishing_block']),
  kind: z.enum(['primary', 'alias', 'preview']),
  redirectTo: z.string().nullable(),          // hostname primary untuk alias
  plan: z.object({ tier: z.enum(['free','starter','pro','business']), badge: z.boolean(), customCode: z.boolean() }),
  robots: z.enum(['index', 'noindex']),
  password: z.object({ algo: z.literal('pbkdf2-sha256'), hash: z.string(), salt: z.string(), iter: z.number(), version: z.number(), scope: z.enum(['site','pages']), pages: z.array(z.string()).optional() }).nullable(),
  analytics: z.boolean(),
  updatedAt: z.string(),
});
```
- **Acceptance criteria (PUB-245):**
  - [ ] Nilai KV divalidasi Zod saat ditulis (worker) dan saat dibaca (site-host, dengan fallback aman bila `v` tidak dikenal → treat sebagai miss dan pakai API).
  - [ ] Ukuran nilai < 2 KB.

### PUB-246 Rekonsiliasi DB ↔ KV ↔ Cloudflare
- **Prioritas:** P1 · **Fase:** M5
- **Deskripsi / Perilaku:** Job `reconcile-hosts` (tiap 15 menit untuk host yang berubah 24 jam terakhir, harian untuk semua): bandingkan DB (`sites`, `site_domains`, `domains`) dengan KV `host:*` dan daftar custom hostnames Cloudflare; perbaiki selisih (DB menang), hapus key/hostname yatim, laporkan metrik `reconcile_fixed_total`.
- **Acceptance criteria:**
  - [ ] Mengubah KV secara manual menjadi salah → diperbaiki otomatis pada siklus berikutnya.

---

## 17. Ringkasan Fase

| Fase | Requirement utama |
|---|---|
| **M1** | PUB-190, PUB-191, PUB-193 (dev env), PUB-211 (header platform) |
| **M4** 🚀 | Konsep publish: PUB-001..007 · Pipeline: PUB-020..033 · Renderer: PUB-040..049 · Site-host: PUB-060, 062..066, 070, 071 · Subdomain acak: PUB-080, 082 · SEO dasar: PUB-120, 121, 125, 126 · Performa: PUB-150, 151 (pra-generate), 152..154 · Storage: PUB-170, 172, 180 · Domain & prod: PUB-200..202, PUB-192 · Keamanan: PUB-210, 212, 215..217 · Observabilitas: PUB-230..233 · Skema: PUB-240..245 |
| **M5** | Subdomain pilihan & lifecycle: PUB-081, 083..086 · Custom domain: PUB-100..105 · Badge removal (berbasis paket via KV, PUB-070) · Redirect user PUB-067 · Password PUB-069 · Injeksi runtime PUB-072 · OG image PUB-122 · JSON-LD dasar PUB-124 · Verifikasi GSC PUB-127 · Analytics PUB-130 · GA4/Pixel PUB-131 · Custom code PUB-140 · GC aset PUB-171 · PUB-061 hardening · PUB-218 · PUB-246 |
| **M6** | (AI) — AI memakai pipeline preview (PUB-004) untuk screenshot hasil; tidak ada requirement PUB baru |
| **M7** | Islands data PUB-029 · `/_api/*` PUB-068 · JSON-LD Article · sitemap dinamis (collection pages) |
| **M8** | JSON-LD Product, CSP `form-action` payment, event `Purchase` |
| **M9+** | Incremental build PUB-034 · hreflang PUB-123 · Animasi lanjutan PUB-046 · CWV dashboard · video transcoding · robots.txt custom · redirect CSV · hot-update redirect |

---

## 18. Daftar OPEN

| # | Topik | Rekomendasi | Ref |
|---|---|---|---|
| 1 | Bentuk URL preview (path vs host) | Host-based `p-<id>.<SITES_ROOT_DOMAIN>` | PUB-004 |
| 2 | Atomic CSS vs class per style-signature | Style-signature | PUB-026 |
| 3 | Runtime islands (Preact vs React) | Preact, spike M7 | PUB-029 |
| 4 | Badge link dofollow vs nofollow | Dofollow ke homepage | PUB-070 |
| 5 | Status HTTP halaman suspended (403 vs 451) | 403 + reasonCode internal | PUB-071 |
| 6 | Panjang minimum subdomain pilihan (3 vs 4) | 3, dengan blocklist ketat | PUB-081 |
| 7 | Larang nama pilihan berpola acak | Ya | PUB-081 |
| 8 | `shop`/`store` reserved? | Reserved (dipakai platform kelak) | PUB-082 |
| 9 | Durasi alias rename & karantina | Alias 90 hari, karantina 30 hari | PUB-084 |
| 10 | Aturan downgrade subdomain pilihan | Grace 30 hari → alias 30 hari → karantina 30 hari | PUB-086 |
| 11 | Strategi apex custom domain | Apex redirect ke `www` (MVP) + dokumentasi CNAME flattening | PUB-100 |
| 12 | Grace pemutusan custom domain saat downgrade | 14 hari | PUB-104 |
| 13 | Password-protected untuk Starter? | Pro+ saja | PUB-069 |
| 14 | noindex untuk site Free | Index setelah syarat trust; sebelum itu noindex | PUB-125 |
| 15 | Verifikasi meta & GA4/Pixel untuk Free? | Meta verifikasi: semua paket; GA4/Pixel: Starter+ | PUB-127, PUB-131 |
| 16 | OG image: Satori vs Playwright screenshot | Satori (ringan), Playwright fallback | PUB-122 |
| 17 | Penyimpanan analytics | Analytics Engine + rollup Postgres | PUB-130 |
| 18 | Image CDN on-the-fly | Pra-generate `sharp` dulu; evaluasi Cloudflare Images | PUB-151 |
| 19 | **Domain terpisah untuk situs user** (`platformmu.site` + PSL) | **Ya — sangat direkomendasikan, putuskan sebelum M4** | PUB-201 |
| 20 | Retensi deployment per paket (N) | Free 3 / Starter 10 / Pro 30 / Business 100 | PUB-170 |
| 21 | Rate limit publish per paket | Lihat PUB-216 | PUB-216 |
| 22 | Konsistensi KV cukup untuk switch live? | Ya + fallback API; evaluasi Durable Object jika tidak | PUB-003 |

Semua item ⚠️ VERIFIKASI (harga & limit Cloudflare R2/Workers/KV/for SaaS/Images/Analytics Engine, apex proxying, PSL, WSL mirrored networking, Safe Browsing lisensi) harus dicek di dokumentasi resmi sebelum fase terkait dimulai.
