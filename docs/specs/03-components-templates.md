# 03 — Components, Templates, Themes & Library

> **Status:** Draft v0.1 · **Prefix requirement:** `CMP-` · **Fase utama:** M3 (sistem component & mode admin), M4 (template, mode user, rilis publik)
> **Pembaca:** owner (solo developer) & AI coding agent (Claude Code).
> **Dokumen terkait:**
> - [01 — Document Model](./01-document-model.md) — format JSON node, `ComponentDefinition`, `InstanceNode`, props schema, style per breakpoint, token. **Dokumen ini TIDAK mendefinisikan ulang format data**; semua contoh JSON di sini bersifat ilustratif dan tunduk pada skema Zod di `packages/document-model`.
> - [02 — Editor](./02-editor.md) — canvas, layer panel, properties panel, Simple vs Design mode, keyboard shortcut.
> - [04 — AI Agent](./04-ai-agent.md) — tools, skills, loop, kredit.
> - [05 — Dynamic Data](./05-dynamic-data.md) — collections, bindings, forms, end-user auth.
> - [06 — Commerce & Payments](./06-commerce-payments.md) — produk, keranjang, checkout.
> - [07 — Publishing & Hosting](./07-publishing-hosting.md) — renderer output & publish.
> - [08 — Accounts, Plans & Admin](./08-accounts-plans-admin.md) — role platform, paket, kuota.
> - [../ARCHITECTURE.md](../ARCHITECTURE.md) — monorepo, modul API, worker, storage.

---

## Daftar Isi

1. [Ringkasan & Ruang Lingkup](#1-ringkasan--ruang-lingkup)
2. [Konsep & Terminologi](#2-konsep--terminologi)
3. [Mode Admin di Editor](#3-mode-admin-di-editor)
4. [Props, Binding & Editable/Locked Node](#4-props-binding--editablelocked-node)
5. [Variants](#5-variants)
6. [Lifecycle & Versioning](#6-lifecycle--versioning)
7. [Propagasi Update ke Website User](#7-propagasi-update-ke-website-user)
8. [Instance di Sisi User](#8-instance-di-sisi-user)
9. [Katalog Component Awal (Library v1)](#9-katalog-component-awal-library-v1)
10. [Template](#10-template)
11. [Theme System](#11-theme-system)
12. [Workflow Produksi Library dengan AI](#12-workflow-produksi-library-dengan-ai)
13. [Seed Library (sebelum editor siap)](#13-seed-library-sebelum-editor-siap)
14. [Penyimpanan Database](#14-penyimpanan-database)
15. [API Library](#15-api-library)
16. [Search & Discovery](#16-search--discovery)
17. [Library Pribadi User (P2)](#17-library-pribadi-user-p2)
18. [Marketplace (P2)](#18-marketplace-p2)
19. [Lisensi & Aset](#19-lisensi--aset)
20. [Daftar OPEN](#20-daftar-open)
21. [Traceability per Fase](#21-traceability-per-fase)

---

## 1. Ringkasan & Ruang Lingkup

Platform menyediakan **library component & template jadi** yang dibuat oleh tim internal (dibantu AI) **langsung di editor milik Platform** dalam **Mode Admin**. Tidak ada import dari Figma asli. Website user memakai library ini dengan dua cara:

1. **Memilih template** → seluruh halaman, theme, dan instance di-copy ke situs user (instance tetap terhubung ke component asalnya).
2. **Menyisipkan component** dari panel Insert/Library ke canvas → menjadi **instance**.

Prinsip inti (dari BRIEF, wajib dipatuhi):

| # | Prinsip | Konsekuensi teknis |
|---|---------|--------------------|
| P-1 | Component = JSON **berversi** dan **immutable per versi** | Tabel `component_versions` tidak pernah di-UPDATE setelah `published`. Perubahan = versi baru. |
| P-2 | Instance di website user = `componentId@version` + `props` + `overrides` | Lihat [01 — Instance Node](./01-document-model.md). Renderer me-resolve definisi versi yang di-pin. |
| P-3 | Update component **tidak** otomatis mengubah website user | User memilih update (notifikasi + preview diff). Auto-update minor = OPEN. |
| P-4 | Ada aksi **Detach** | Instance dikonversi menjadi node biasa (frame) — tidak lagi terhubung. |
| P-5 | Semua cara membuat website memanipulasi **satu document model** | Component, template, AI, dan canvas bebas menghasilkan node yang sama. |
| P-6 | Library bisa di-seed via JSON sebelum editor matang | `packages/library-seed/` + script import + validasi Zod. |
| P-7 | Marketplace & library pribadi = P2 | Skema DB sekarang sudah menyiapkan `owner_type`/`owner_id` agar tidak perlu migrasi besar nanti. |

**Di luar lingkup dokumen ini:** format JSON node (→ [01](./01-document-model.md)), interaksi canvas detail (→ [02](./02-editor.md)), definisi tools AI (→ [04](./04-ai-agent.md)), binding data (→ [05](./05-dynamic-data.md)), logika checkout (→ [06](./06-commerce-payments.md)).

---

## 2. Konsep & Terminologi

### CMP-001 Glosarium entitas library
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Istilah berikut dipakai konsisten di kode, DB, UI, dan dokumen.

| Istilah (UI ID / EN) | Identifier kode | Definisi |
|---|---|---|
| Komponen utama / Main component | `ComponentDefinition` | Definisi master sebuah component: tree node, props schema, variants, slot, metadata. Disimpan per versi di `component_versions.definition`. Hanya bisa diedit di Mode Admin (atau oleh pemilik untuk library pribadi P2). |
| Instance | `InstanceNode` (`type: "instance"`) | Pemakaian component di dokumen situs: `componentId`, `version`, `variant`, `props`, `overrides`. Tidak menyalin tree; tree di-resolve saat render. |
| Varian / Variant | `VariantSet`, `variant` | Kombinasi nilai variant property (mis. `size=md, style=primary`). Satu component dapat punya banyak varian. |
| Slot | `SlotDefinition`, node `slot` | Area di dalam component yang boleh diisi node bebas oleh user (mis. isi card, isi modal). |
| Section template | `kind: "section"` | Component berukuran section (full-width, mis. Hero, Pricing) yang muncul di panel "Add Section". Secara teknis = component dengan `kind = "section"`. |
| Block / Element | `kind: "element"` | Component kecil (button, badge, input, card). |
| Template | `TemplateDefinition` | Paket website lengkap: pages, theme, instances, sample content, (opsional) sample data collections. Berversi. |
| Theme | `ThemeDefinition` | Kumpulan token desain: palet warna, font pairing, skala tipografi, radius, shadow, spacing. Lihat [01 — Tokens](./01-document-model.md). |
| Theme preset | `themes` (owner platform) | Theme siap pakai yang dipilih user. |
| Library global | `owner_type = 'platform'` | Library resmi Platform, dibuat tim internal. Tersedia untuk semua user (beberapa item bisa dibatasi paket — OPEN). |
| Library pribadi | `owner_type = 'user'` | (P2) Component milik user, reuse antar situs miliknya. |
| Marketplace | `owner_type = 'vendor'` | (P2) Component/template dari designer luar, bisa berbayar. |
| Override | `overrides` | Perubahan style/konten pada node tertentu di dalam instance, di-key oleh **ID node** definisi yang stabil antar versi (NodePath, [01 DM-049](./01-document-model.md#dm-049-instance-overrides--addressing)). Istilah "nodeKey" tidak dipakai; nama resmi = ID node (01). |

- **Acceptance criteria:**
  - [ ] Semua istilah di atas dipakai sama di `packages/document-model`, kolom DB, dan string i18n (`packages/i18n`).
  - [ ] UI menampilkan istilah Indonesia saat locale `id`, Inggris saat `en`.

### CMP-002 Hubungan component, instance, template, theme
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Diagram relasi konseptual:

```
platform library
 ├── components ──< component_versions (immutable, v1, v2, ...)
 │                      ▲
 │                      │ componentId@version
 │      site document ──┴── InstanceNode { props, overrides, variant }
 ├── templates ──< template_versions ──(snapshot)──> pages + theme + instances + sample data
 └── themes (presets) ──(copy)──> site.theme (token milik situs)
```

- Template **mereferensikan** component via instance (bukan menyalin tree). Saat user memilih template, dokumen template di-copy ke situs; instance-instance di dalamnya tetap menunjuk `componentId@version` yang sama → tetap "terhubung" dan bisa menerima update.
- Theme preset **di-copy** ke situs (bukan referensi) karena user hampir pasti mengubah warna/font; update theme preset tidak dipropagasi otomatis.
- Component memakai **token** (`color.primary`, `radius.md`, dll), bukan nilai literal → saat theme situs diganti, seluruh instance ikut berubah tanpa update versi component.
- **Acceptance criteria:**
  - [ ] Mengganti theme situs mengubah tampilan semua instance tanpa mengubah `version` instance.
  - [ ] Menghapus (archive) component dari library tidak merusak situs yang memakainya (versi tetap dapat di-resolve).

### CMP-003 Jenis component (`kind`)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Setiap component memiliki `kind` yang menentukan tempat ia muncul di UI dan aturan validasinya.

| `kind` | Contoh | Muncul di | Aturan |
|---|---|---|---|
| `element` | Button, Badge, Input, Icon wrapper | Panel Insert → Elements | Tidak wajib full-width. |
| `block` | Card, Testimonial item, Pricing card, Stat card | Panel Insert → Blocks | Bisa dipakai dalam section mana pun. |
| `section` | Hero, Feature grid, Pricing table, Footer | Panel "Add Section" (antar section di halaman) | Root wajib width `fill`, punya padding vertikal dari token `space.section`. |
| `page` | Halaman Login, Halaman 404, Halaman Blog list | Panel "Add Page" | Root = page node; berisi beberapa section instance. |
| `layout` | Navbar, Footer, Sidebar app-shell | Panel Insert → Navigation | Bisa ditandai "global" (dipakai di semua halaman, lihat [02](./02-editor.md)). |

- **Acceptance criteria:**
  - [ ] Validator Zod menolak component `section` yang root-nya tidak `width: fill`.
  - [ ] Panel Insert memfilter berdasarkan `kind`.

### CMP-004 Kepemilikan & visibilitas library
- **Prioritas · Fase:** P0 (platform) · M3; P2 (user, vendor) · M9+
- **Deskripsi:** Semua entitas library (components, templates, themes) punya kolom `owner_type` (`platform` | `user` | `vendor`) dan `owner_id` (nullable untuk platform). Visibilitas:
  - `platform` + `status = published` → terlihat semua user.
  - `user` → hanya pemilik (dan tim, saat Business/Tim).
  - `vendor` → terlihat publik di marketplace bila disetujui moderasi.
- Item platform dapat diberi `min_plan` (mis. template e-commerce hanya Pro). Lihat [08](./08-accounts-plans-admin.md).

> ❓ OPEN: Apakah ada component/template platform yang dikunci per paket (`min_plan`), atau semua library gratis dan pembatasan hanya pada fitur (dinamis/e-commerce)? Usulan: library statis gratis untuk semua; template dinamis/e-commerce terlihat oleh semua tapi butuh paket Pro untuk publish fitur dinamisnya.

- **Acceptance criteria:**
  - [ ] Query library publik hanya mengembalikan `owner_type='platform' AND status='published' AND archived_at IS NULL` (sampai P2).
  - [ ] Skema DB sudah memuat `owner_type`, `owner_id`, `min_plan` sejak M3.

---

## 3. Mode Admin di Editor

### CMP-010 Akses Mode Admin
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Mode Admin adalah editor yang sama (`apps/editor`) dengan kemampuan tambahan, dipakai untuk membuat & memelihara library global. Akses dibatasi role platform internal `users.staff_role` (daftar final di [08 §10.1](./08-accounts-plans-admin.md#101-role-staff); `vendor` = P2 marketplace, bukan staff role):

| Role platform | Hak di library |
|---|---|
| `super_admin` | Semua, termasuk publish, deprecate, archive, rollback, hapus draft orang lain. |
| `library_admin` | Buat/edit draft, submit review, approve review, publish. |
| `designer` (internal) | Buat/edit draft milik sendiri, submit review. Tidak bisa publish. |
| `staff` (support/moderasi) | Lihat saja (read-only), tidak bisa membuat/publish. |
| `user` biasa | Tidak ada akses Mode Admin. |

- Mode Admin dibuka lewat Admin Panel (`apps/web` → `/admin/library`) → "Buka di editor". URL editor: `app.platform.test/editor/library/components/:componentId/draft`.
- Workspace admin = "library workspace" (bukan situs user). Dokumen yang diedit adalah `ComponentDefinition` draft, bukan site document.
- Header editor menampilkan badge **ADMIN · Library** berwarna mencolok agar tidak tertukar dengan editor situs.
- **Acceptance criteria:**
  - [ ] Endpoint `/api/admin/library/*` mengembalikan 404 untuk non-staff (aturan 08 ACC-200) dan 403 untuk staff tanpa role `designer`/`library_admin`/`super_admin` yang mencoba mutasi.
  - [ ] Editor menampilkan badge Mode Admin dan panel tambahan (Props, Variants, Metadata, QA) hanya dalam Mode Admin.
  - [ ] Semua aksi admin tercatat di `audit_logs` (lihat [08](./08-accounts-plans-admin.md)).

### CMP-011 Create component dari seleksi
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Admin memilih satu atau beberapa node di canvas → `Ctrl/Cmd+Alt+K` atau menu konteks "Create component".
  - Jika lebih dari satu node dipilih, sistem membungkus seleksi dalam frame auto-layout baru terlebih dahulu.
  - Tree seleksi dipindah menjadi `ComponentDefinition` draft baru (`v0-draft`), dan posisi asal diganti dengan instance-nya (perilaku seperti Figma).
  - Dialog awal meminta: `name` (EN, PascalCase, mis. `HeroSplitImage`), `displayName` (ID + EN), `kind`, `category`.
  - Setiap node dalam definisi punya **ID node** (`n_…`) yang stabil antar versi ([01 DM-045](./01-document-model.md#dm-045-componentdefinition)) dan dipakai untuk binding props & overrides; ID tidak berubah walau node di-rename.
  - Di editor situs user (non-admin), "Create component" tidak tersedia sampai library pribadi P2 ([CMP-170](#cmp-170-library-pribadi-simpan-component-sendiri)).
- **Acceptance criteria:**
  - [ ] Seleksi 1 frame → component dengan root frame tersebut; seleksi >1 → dibungkus frame auto-layout.
  - [ ] Setelah create, posisi asal berisi instance yang render identik (pixel-diff 0 di Playwright).
  - [ ] Setiap node di definisi memiliki ID node unik dalam component.
  - [ ] Undo (`Ctrl+Z`) mengembalikan kondisi sebelum create dalam satu langkah.

### CMP-012 Panel Component (Mode Admin)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Saat mengedit main component, sidebar kanan memiliki tab tambahan:

| Tab | Isi |
|---|---|
| **Props** | Daftar props, tipe, default, binding ke node ([CMP-020](#cmp-020-tipe-props)). |
| **Variants** | Variant properties & matriks varian ([CMP-030](#cmp-030-variant-properties-ala-figma)). |
| **Access** | Editable/locked per node untuk Simple mode ([CMP-024](#cmp-024-editable-vs-locked-node)). |
| **Metadata** | Nama, kategori, tag, deskripsi, keywords, `aiHints`, thumbnail ([CMP-013](#cmp-013-metadata-kategori-tag-deskripsi-keywords)). |
| **QA** | Checklist QA otomatis + manual ([CMP-133](#cmp-133-qa-checklist-library)). |
| **Versions** | Riwayat versi, changelog, status, tombol Submit review / Publish. |
| **Usage** | Jumlah situs & instance per versi (dari `site_component_usage`). |

- **Acceptance criteria:**
  - [ ] Tab hanya muncul di Mode Admin.
  - [ ] Tab Usage menampilkan agregat per versi dengan latensi < 1 s untuk 100k baris usage.

### CMP-013 Metadata: kategori, tag, deskripsi, keywords
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Metadata dipakai untuk panel Insert, pencarian ([§16](#16-search--discovery)), dan **AI** (agen memilih component berdasarkan deskripsi & `aiHints`, lihat [04](./04-ai-agent.md)).

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `name` | string PascalCase EN | ✔ | Unik per owner. Dipakai AI & kode. |
| `displayName` | `{ id, en }` | ✔ | Ditampilkan di UI. |
| `description` | `{ id, en }` | ✔ | 1–3 kalimat, kapan dipakai. Min 30 karakter. |
| `categorySlug` | string | ✔ | Dari `library_categories`. |
| `tags` | string[] | ✔ min 2 | lowercase-kebab, mis. `hero`, `split-layout`, `with-image`. |
| `keywords` | `{ id: string[], en: string[] }` | ✔ | Sinonim pencarian: "banner", "header besar", "pembuka". |
| `industries` | string[] | – | Cocok untuk industri apa (`kuliner`, `klinik`, ...). |
| `aiHints` | string | ✔ | Instruksi singkat untuk AI: kapan memakai, props penting, kombinasi yang baik. Max 500 char. |
| `requiresFeatures` | (`dynamic` \| `auth` \| `commerce`)[] | – | Component yang butuh fitur paket tertentu (lihat [05](./05-dynamic-data.md), [06](./06-commerce-payments.md)). |
| `thumbnail` | URL R2 (otomatis) | ✔ | [CMP-014](#cmp-014-thumbnail-otomatis-playwright). |

- **Acceptance criteria:**
  - [ ] Submit review ditolak bila field wajib kosong.
  - [ ] `keywords` dan `description` terindeks ke kolom `search_vector` ([CMP-160](#cmp-160-full-text-search-postgres)).

### CMP-014 Thumbnail otomatis (Playwright)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Setiap kali draft disimpan (debounce 30 s) dan saat publish, `apps/worker` menjalankan job `library.renderThumbnail` (queue `thumbnails`, [ARCHITECTURE §5.4](../ARCHITECTURE.md#54-appsworker--bullmq)):
  1. Render component (varian default + default content + theme default platform) memakai `packages/renderer` ke halaman HTML sementara.
  2. Playwright (Chromium headless) screenshot pada 3 lebar: **1280** (desktop), **768** (tablet), **375** (mobile).
  3. Hasil dikonversi ke WebP (lebar 640 untuk card, 1280 untuk preview besar), disimpan di R2: `library/components/{componentId}/{version}/thumb-{bp}.webp`.
  4. Untuk varian lain (opsional): thumbnail per varian `thumb-{variantKey}-desktop.webp` (maks 12 varian pertama).
- Admin dapat meng-upload thumbnail manual (override) tetapi thumbnail otomatis tetap dibuat untuk QA.
- Screenshot yang sama dipakai AI untuk "melihat" component ([04](./04-ai-agent.md)).
- **Acceptance criteria:**
  - [ ] Thumbnail tersedia ≤ 60 s setelah publish.
  - [ ] Thumbnail versi published immutable (path mengandung versi).
  - [ ] Gagal render → status QA "thumbnail failed" dan publish diblok.

### CMP-015 Aturan desain wajib (design rules)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Setiap component library global wajib memenuhi aturan berikut. Sebagian dicek otomatis oleh linter `library-lint` (paket `packages/library-seed` mengekspor fungsi lint yang juga dipakai editor).

| Kode | Aturan | Cek otomatis |
|---|---|---|
| R-TOKEN | Warna, font family, font size, radius, shadow, spacing memakai **token** theme, bukan nilai literal. Pengecualian: `transparent`, `currentColor`, nilai 0. | ✔ (scan style) |
| R-AUTOLAYOUT | Semua frame container memakai auto-layout (flex). Posisi absolut hanya untuk dekorasi/overlay dan wajib ditandai `decorative: true`. | ✔ |
| R-RESPONSIVE | Diuji di 3 breakpoint (desktop 1280, tablet 768, mobile 375): tidak ada overflow horizontal, teks tidak terpotong. | ✔ (Playwright: `scrollWidth <= clientWidth`) |
| R-SEMANTIC | Tag semantik benar: `header/nav/main/section/footer/h1–h6/button/a/ul`. Section hanya 1 `h2` utama; `h1` hanya pada hero (prop `headingLevel`). | ✔ sebagian |
| R-A11Y | Kontras teks ≥ 4.5:1 (≥ 3:1 untuk teks besar) pada theme default **dan** dark preset; image punya prop `alt`; tombol ikon punya `ariaLabel`. | ✔ (axe-core via Playwright) |
| R-NAMING | Layer diberi nama bermakna EN (`Title`, `Subtitle`, `CtaPrimary`), bukan `Frame 12`. | ✔ (regex `^(Frame|Group|Rectangle) \d+$` ditolak) |
| R-PROPS | Konten yang wajar diubah user diekspos sebagai props dengan label jelas ID+EN. | Manual |
| R-SIZE | Definisi JSON ≤ 200 KB; jumlah node ≤ 300 per component. | ✔ |
| R-ASSET | Gambar contoh dari sumber berlisensi bebas komersial ([§19](#19-lisensi--aset)). | Manual + field `license` |

- **Acceptance criteria:**
  - [ ] `library-lint` menghasilkan daftar pelanggaran dengan ID node dan kode aturan.
  - [ ] Pelanggaran otomatis (✔) memblok transisi ke `in_review`.
  - [ ] Klik pelanggaran di panel QA memilih node terkait di canvas.

### CMP-016 Default content
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Setiap prop memiliki nilai `default` yang realistis (bukan "Lorem ipsum"), dalam **Bahasa Indonesia** sebagai default dan terjemahan EN di `defaultI18n.en`. Saat user menyisipkan component, bahasa default content mengikuti bahasa situs (`site.locale`).
  - Contoh hero: judul "Solusi Katering Sehat untuk Kantor Anda", bukan "Lorem ipsum dolor".
  - Gambar default memakai aset library platform (R2, lisensi tercatat) dengan rasio sesuai desain.
- **Acceptance criteria:**
  - [ ] Linter menolak teks default yang mengandung "lorem ipsum" (case-insensitive).
  - [ ] Setiap prop `text`/`richText` punya default `id` dan `en`.

### CMP-017 Slot area
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Admin dapat menandai frame di dalam component sebagai **slot** (prop bertipe `slot`, lihat [CMP-020](#cmp-020-tipe-props)). Slot:
  - Memiliki `allowedKinds` (mis. `["element","block"]`) dan opsional `allowedComponents` (whitelist `componentId`) serta `maxChildren`.
  - Memiliki **default children** (isi awal) yang di-copy ke instance sebagai node milik situs (bukan bagian definisi) saat instance dibuat.
  - Isi slot milik user **tidak tersentuh** saat update versi component (kecuali slot dihapus — breaking change, lihat [CMP-054](#cmp-054-migrasi-props-saat-breaking-change)).
  - Di Simple mode, slot menampilkan tombol "+ Tambah" yang hanya menawarkan component yang diizinkan.
- **Acceptance criteria:**
  - [ ] Drag node ke slot yang tidak mengizinkan `kind`-nya ditolak dengan indikator merah.
  - [ ] Update versi component mempertahankan isi slot selama `slot.key` sama.

---

## 4. Props, Binding & Editable/Locked Node

### CMP-020 Tipe props
- **Prioritas · Fase:** P0 · M3 (kecuali ditandai)
- **Deskripsi:** Props adalah antarmuka publik component. Skema formal `PropDefinition` ada di [01 — Document Model](./01-document-model.md); tabel ini menjelaskan semantik & UI kontrolnya.

| `type` | Nilai | Kontrol UI (Simple mode) | Bind ke | Fase |
|---|---|---|---|---|
| `text` | string satu baris (`maxLength`) | Input teks / edit inline di canvas | `content` node text | M3 |
| `richText` | Tiptap JSON (subset: bold, italic, link, list) | Edit inline Tiptap | `content` node richText | M3 |
| `number` | number (`min`,`max`,`step`) | Number input / slider | properti numerik (mis. jumlah kolom, rating) | M3 |
| `boolean` | true/false | Toggle | `visible` node, atau kondisi varian | M3 |
| `enum` | salah satu `options[]` | Select / segmented | properti style terpilih (align, layout), atau variant property | M3 |
| `image` | `{ assetId, alt, focalPoint }` | Picker gambar + alt + focal point | `src`/`alt` node image, atau background frame | M3 |
| `link` | `LinkValue` 01 DM-056 (`type`: `page`/`url`/`anchor`/`email`/`phone`/`whatsapp`/`asset`) | Link picker | `href` node link/button | M3 |
| `color` | token ref `{ "$token": "color.primary" }` atau hex (bila `allowCustom`) | Swatch palet theme | fill/stroke/text color | M3 |
| `icon` | nama ikon Lucide | Icon picker (search) | node icon | M3 |
| `slot` | children (node milik situs) | Area "+ Tambah" | frame slot | M3 |
| `list` | array item berskema (mis. menu items, FAQ items) | Repeater (tambah/hapus/urutkan) | template child yang diulang | M3 |
| `collectionBinding` | sumber data collection (`{ collectionId, filter?, sort?, limit? }`, format [01 DM-079](./01-document-model.md#dm-079-metadata-library-pada-componentdefinition)) | Lihat [05](./05-dynamic-data.md) | `dataList.props.source` di dalam component | M7 |

> Catatan: `list` ditambahkan karena banyak section (FAQ, menu navbar, testimonial) berisi item berulang yang harus bisa ditambah user awam tanpa Design mode.

- Setiap prop memiliki: `key` (camelCase, stabil antar versi), `label {id,en}`, `description?`, `group` (mis. "Konten", "Tampilan"), `default`, `required`, `hiddenInSimple?`, `semanticRole?` — skema formal `PropDef` di [01 DM-046](./01-document-model.md#dm-046-props-schema) + [DM-079](./01-document-model.md#dm-079-metadata-library-pada-componentdefinition).
- **Acceptance criteria:**
  - [ ] Setiap tipe prop memiliki kontrol UI di Properties panel Simple mode dan validasi Zod.
  - [ ] Nilai prop tidak valid (mis. enum di luar options) ditolak saat load dan di-fallback ke default dengan warning di console editor.

### CMP-021 Binding prop → node
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Di Mode Admin, admin memilih node lalu pada Properties panel klik ikon "⊕ Bind to prop" di samping properti yang bisa di-bind (teks, src gambar, visible, fill, href, icon, dll). Hasil: nilai properti node tersebut diganti referensi `{ "$prop": "<propKey>" }` (format [01 DM-047](./01-document-model.md#dm-047-binding-node-ke-props-prop)).
  - Satu prop boleh di-bind ke beberapa node (mis. `brandColor` → fill tombol + border card).
  - Satu properti node hanya boleh di-bind ke satu prop.
  - Binding `boolean` → `visible` memungkinkan "tampilkan subtitle?"; binding `enum` → `style.textAlign`, dsb.
  - Node yang di-bind ditandai ikon ungu kecil di layer panel (Mode Admin).
- **Acceptance criteria:**
  - [ ] Mengubah nilai prop di instance memperbarui semua node yang di-bind dalam < 16 ms (1 frame) untuk component ≤ 300 node.
  - [ ] Menghapus node yang memiliki binding menampilkan peringatan "prop X kehilangan target".
  - [ ] Prop tanpa binding (yatim) ditandai di QA sebagai warning.

### CMP-022 Props `list` (repeater)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Prop `list` memiliki `itemSchema` (kumpulan sub-props: text/image/link/icon/boolean); node yang diulang per item = frame dengan `props.repeatProp: "<key>"` ([01 DM-047](./01-document-model.md#dm-047-binding-node-ke-props-prop)). `minItems`, `maxItems` dapat diatur. Contoh pemakaian: menu navbar, item FAQ, logo cloud, pricing features.
- **Acceptance criteria:**
  - [ ] User dapat menambah, menghapus, menduplikasi, dan mengurutkan item (drag) di Simple mode.
  - [ ] Override style yang dilakukan pada node item ke-n di Design mode tersimpan per index item (lihat [01](./01-document-model.md) untuk path override).

### CMP-023 Validasi & batas props
- **Prioritas · Fase:** P1 · M3
- **Deskripsi:** Admin dapat mengatur constraint: `maxLength` (text), `min/max` (number), `aspectRatio` rekomendasi (image), `allowedLinkKinds` (link), `allowCustom` (color). UI Simple mode menampilkan counter karakter dan peringatan lembut (tidak memblok) bila teks melebihi rekomendasi desain (`softMaxLength`).
- **Acceptance criteria:**
  - [ ] `maxLength` keras memblok input; `softMaxLength` hanya memberi warning kuning.
  - [ ] Gambar dengan rasio sangat berbeda menampilkan saran crop dengan focal point.

### CMP-024 Editable vs locked node
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Admin menentukan apa yang boleh diubah user awam di **Simple mode**. Default: semua node **locked** di Simple mode kecuali yang di-bind ke prop. Admin bisa menambah izin per node:

| Izin (`simpleAccess`, disimpan di `ComponentDefinition.nodeAccess` — [01 DM-079](./01-document-model.md#dm-079-metadata-library-pada-componentdefinition)) | Arti di Simple mode |
|---|---|
| `locked` (default) | Tidak bisa dipilih langsung; klik memilih instance root. |
| `content` | Konten bisa diedit inline (teks/gambar) walau tidak di-bind prop — dibuat sebagai prop implisit. |
| `visibility` | User boleh menyembunyikan/menampilkan node (toggle mata). |
| `style-basic` | User boleh ganti warna (dari palet theme) dan alignment saja. |

- Di **Design mode** ([CMP-071](#cmp-071-design-mode-override-style--nested)) semua node bisa di-override kecuali node yang ditandai `hardLocked: true` (mis. watermark legal, struktur form yang terikat collection).
- **Acceptance criteria:**
  - [ ] Dalam Simple mode, klik node `locked` memilih instance root, bukan node anak.
  - [ ] `hardLocked` tidak bisa di-override bahkan di Design mode; Detach tetap memungkinkan (kecuali `requiresFeatures` mencegah — OPEN di [05](./05-dynamic-data.md)).
  - [ ] Panel Access menampilkan pratinjau "lihat sebagai user Simple mode".

### CMP-025 Prop groups & urutan
- **Prioritas · Fase:** P1 · M3
- **Deskripsi:** Props dikelompokkan (`group`) dan diurutkan (`order`). Group standar: `content` (Konten), `media` (Gambar & Media), `links` (Tautan), `appearance` (Tampilan), `advanced` (Lanjutan, collapsed default). Variant properties ditampilkan di group `appearance` di atas props lain.
- **Acceptance criteria:**
  - [ ] Properties panel Simple mode merender group sesuai urutan; `advanced` tertutup secara default.

---

## 5. Variants

### CMP-030 Variant properties ala Figma
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Variants bersifat **property-based** seperti Figma. Admin mendefinisikan variant properties, mis.:

| Property | Nilai | Contoh pada Button |
|---|---|---|
| `size` | `sm`, `md`, `lg` | padding & font size |
| `style` | `primary`, `secondary`, `outline`, `ghost`, `link` | fill, stroke, text color |
| `state` | `default`, `hover`, `pressed`, `focus`, `disabled` | interaksi (lihat CMP-032) |
| `iconPosition` | `none`, `left`, `right`, `only` | visibilitas icon |

  - Satu component memiliki **satu base tree**; setiap varian disimpan sebagai **delta** (`VariantRule.overrides` = patch style/visibility per ID node, [01 DM-048](./01-document-model.md#dm-048-variants)) terhadap base, bukan tree terpisah. Ini menjaga ID node konsisten sehingga override user tetap berlaku saat ganti varian. (Format delta → [01](./01-document-model.md).)
  - Admin mengedit varian dengan memilih kombinasi di tab Variants; canvas menampilkan **variant matrix** (grid semua kombinasi) seperti component set Figma.
  - Kombinasi yang tidak valid dapat ditandai `disabled` (mis. `style=link` + `size=lg`).
  - `defaultVariant` wajib ditentukan.
- **Acceptance criteria:**
  - [ ] Canvas Mode Admin dapat menampilkan matriks hingga 5×5×5 kombinasi tanpa drop frame signifikan (> 30 fps saat pan).
  - [ ] Mengganti varian pada instance mempertahankan props dan override konten user.
  - [ ] Varian disimpan sebagai delta; ukuran JSON tidak tumbuh linear dengan jumlah node × varian.

### CMP-031 Variant sebagai prop di sisi user
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Di instance, variant properties tampil sebagai kontrol `enum` (segmented/select) di group Tampilan. Admin dapat menyembunyikan variant property tertentu dari Simple mode (mis. `state`).
- **Acceptance criteria:**
  - [ ] Variant property `state` tidak muncul di Simple mode secara default.
  - [ ] Thumbnail mini varian tampil di dropdown pemilihan varian (dari [CMP-014](#cmp-014-thumbnail-otomatis-playwright)).

### CMP-032 State interaktif (hover/focus/pressed/disabled)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Varian `state` khusus: renderer mengonversinya menjadi pseudo-class CSS (`:hover`, `:focus-visible`, `:active`, `[aria-disabled]`) di output publish, bukan varian yang dipilih manual. `disabled` boleh dipilih manual (prop boolean `disabled`).
  - Mode Admin menyediakan toggle "Preview state" untuk melihat tiap state di canvas.
- **Acceptance criteria:**
  - [ ] HTML hasil publish memakai CSS pseudo-class; tidak ada JS untuk hover.
  - [ ] Focus ring (dari token `focus.ring`) selalu ada untuk elemen interaktif (R-A11Y).

### CMP-033 Varian responsif vs breakpoint
- **Prioritas · Fase:** P1 · M3
- **Deskripsi:** Varian **tidak** dipakai untuk responsif. Responsif ditangani oleh style per breakpoint `{ base, tablet, mobile }` ([01](./01-document-model.md)). Namun prop/variant boleh memiliki nilai berbeda per breakpoint bila admin mengizinkan (`responsiveProp: true`), mis. `layout = row` di desktop dan `stack` di mobile.
- **Acceptance criteria:**
  - [ ] Prop dengan `responsiveProp: true` menampilkan ikon device di Properties panel dan nilai per breakpoint tersimpan sesuai format breakpoint.

---

## 6. Lifecycle & Versioning

### CMP-040 State machine status component
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Status disimpan per **versi** (`component_versions.status`) dan ringkasan di `components.status`.

```
            submit              approve+publish
  draft ───────────▶ in_review ───────────────▶ published
    ▲                  │ reject (catatan)          │
    └──────────────────┘                           │ deprecate
                                                   ▼
                                               deprecated ──archive──▶ archived
```

| Status versi | Dapat diedit | Terlihat di library user | Dipakai situs |
|---|---|---|---|
| `draft` | ✔ (admin/designer pemilik) | ✗ | ✗ |
| `in_review` | ✗ (read-only, hanya komentar) | ✗ | ✗ |
| `published` | ✗ (immutable) | ✔ (versi terbaru) | ✔ |
| `deprecated` | ✗ | ✗ untuk insert baru; badge "Usang" di situs pemakai | ✔ tetap render |
| `archived` | ✗ | ✗ | ✔ tetap render (read-only resolve) |

  - Hanya ada **satu draft aktif** per component pada satu waktu (`components.draft_version_id`).
  - Membuat draft baru dari versi published = copy `definition` versi terbaru ke draft baru.
- **Acceptance criteria:**
  - [ ] Transisi status hanya melalui endpoint khusus (`submit`, `approve`, `reject`, `publish`, `deprecate`, `archive`, `restore`), divalidasi server.
  - [ ] Percobaan `UPDATE` pada `definition` versi `published` ditolak (constraint/trigger DB + cek service).
  - [ ] Versi `archived` tetap dapat di-resolve renderer untuk situs lama.

### CMP-041 Review & checklist QA
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Submit review menjalankan QA otomatis ([CMP-133](#cmp-133-qa-checklist-library)). Bila lulus, status → `in_review` dan reviewer (`library_admin`, tidak boleh sama dengan pembuat kecuali `super_admin` dalam mode solo) mengisi checklist manual. Hasil disimpan di `component_versions.qa_report` (JSON: hasil otomatis + centang manual + catatan).
  - Mode solo-developer: karena owner bekerja sendiri, `super_admin` boleh self-approve, tetapi checklist manual tetap wajib dicentang.
- **Acceptance criteria:**
  - [ ] Publish tidak mungkin bila `qa_report.automated.passed = false` atau checklist manual belum lengkap.
  - [ ] Reject mengembalikan versi ke `draft` dengan catatan yang tampil di tab Versions.

### CMP-042 Nomor versi (semver-ish)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Versi berbentuk `MAJOR.MINOR.PATCH` (string) + `version_seq` integer naik monoton untuk sorting. **Referensi di dokumen** (`componentId@version`, `instance.props.version`, `componentDeps`) dan kolom `version int` di ARCHITECTURE memakai **integer = `version_seq`** ([01 DM-018](./01-document-model.md#dm-018-instance)); string semver hanya label tampilan & penentu jenis bump (`ComponentDefinition.semver`, 01 DM-079). Saat publish, sistem **menghitung jenis perubahan otomatis** dengan membandingkan props schema & struktur terhadap versi published sebelumnya, lalu menyarankan bump:

| Bump | Kapan (dideteksi otomatis) | Contoh |
|---|---|---|
| **MAJOR** (breaking) | Prop dihapus; prop di-rename (`key` berubah); tipe prop berubah; nilai enum dihapus; variant property/nilai dihapus; slot dihapus; ID node yang punya override di situs mana pun dihapus; `required` baru tanpa default. | `title` → `heading`; hapus `style=ghost` |
| **MINOR** | Prop baru (dengan default); nilai enum/varian baru; slot baru; node baru; perubahan layout yang signifikan. | Tambah prop `showBadge` |
| **PATCH** | Perubahan style/token kecil, perbaikan a11y, teks default, tanpa perubahan schema. | Perbaiki kontras, padding |

  - Admin boleh menaikkan bump (patch → minor) tetapi **tidak boleh menurunkan** bump yang dideteksi (breaking tidak bisa dipublish sebagai minor).
  - Versi pertama yang dipublish = `1.0.0`.
- **Acceptance criteria:**
  - [ ] Fungsi `diffComponentSchemas(prev, next) → { bump, changes[] }` di `packages/document-model` ber-unit test untuk setiap baris tabel di atas.
  - [ ] UI publish menampilkan daftar perubahan terdeteksi dan bump yang diwajibkan.

### CMP-043 Changelog
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Setiap versi published wajib punya changelog `{ id, en }` (Markdown singkat) + daftar perubahan otomatis (`changes[]` dari diff). Changelog ditampilkan ke user di dialog "Update tersedia".
- **Acceptance criteria:**
  - [ ] Publish ditolak bila changelog kosong.
  - [ ] Changelog breaking menampilkan bagian "Yang perlu Anda periksa" yang di-generate dari `changes[]`.

### CMP-044 Immutability & integritas versi
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Saat publish, server menghitung `content_hash` (SHA-256 dari JSON kanonik definisi). Renderer & publish pipeline dapat memverifikasi hash. Aset yang direferensikan (gambar default) juga disalin ke path versi agar tidak berubah.
- **Acceptance criteria:**
  - [ ] `content_hash` unik per (`component_id`, `version`) dan dihitung dari JSON kanonik (key terurut).
  - [ ] Trigger DB `prevent_update_published_component_version` aktif.

### CMP-045 Deprecate & archive
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:**
  - **Deprecate** (per component atau per versi): tidak muncul di panel Insert; instance yang ada tetap jalan dan menampilkan badge "Usang" + saran pengganti (`replacedBy: componentId`) di Properties panel.
  - **Archive**: disembunyikan total dari admin list default; tetap dapat di-resolve. Archive hanya boleh bila component sudah deprecated ≥ 30 hari **atau** usage = 0.
  - **Hard delete** hanya untuk component yang tidak pernah dipublish.
- **Acceptance criteria:**
  - [ ] Deprecated component dengan `replacedBy` menampilkan tombol "Ganti ke X" (memakai swap, [CMP-074](#cmp-074-swap-component)).
  - [ ] Hard delete versi published diblok di level service dan FK.

### CMP-046 Rollback
- **Prioritas · Fase:** P1 · M3
- **Deskripsi:** Rollback **tidak mengubah** versi lama; rollback = "republish": membuat versi baru yang `definition`-nya disalin dari versi target (mis. `1.3.0` bermasalah → publish `1.3.1` berisi definisi `1.2.0`), dengan changelog otomatis "Rollback ke 1.2.0". Situs yang sudah update ke `1.3.0` mendapat notifikasi update ke `1.3.1`.
  - Dalam kondisi darurat (bug kritis), `super_admin` dapat menandai versi `yanked`: versi tidak ditawarkan sebagai target update, dan situs yang memakainya mendapat notifikasi prioritas.
- **Acceptance criteria:**
  - [x] Rollback menghasilkan versi baru, tidak pernah menimpa.
  - [ ] Versi `yanked` tidak muncul sebagai target update; tetap dapat di-render.

> ❓ OPEN: Apakah rollback dari versi MAJOR ke versi sebelumnya (mis. `2.0.0` → isi `1.4.0`) dipublish sebagai `2.0.1` (schema lama di bawah major baru — membingungkan) atau `3.0.0`? Usulan: wajib `3.0.0` karena dari sudut pandang situs yang sudah di 2.x itu breaking.

---

## 7. Propagasi Update ke Website User

### CMP-050 Pinned version
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Setiap instance menyimpan `version` eksak (mis. `1.2.0`). Renderer selalu memakai versi tersebut — tidak ada resolusi "latest" saat render/publish. Ini menjamin situs publish tidak berubah tanpa tindakan user.
- **Acceptance criteria:**
  - [ ] Publish situs dengan instance `@1.2.0` menghasilkan HTML identik walaupun `1.3.0` sudah terbit.
  - [ ] Editor memuat definisi versi yang di-pin (cache di IndexedDB per `componentId@version`, immutable → cache selamanya).

### CMP-051 Pencatatan pemakaian (`site_component_usage`)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Setiap autosave/snapshot dokumen situs, `apps/api` (atau worker `site.indexUsage`) menghitung ulang daftar `(componentId, version, instanceCount)` per situs dan upsert ke `site_component_usage` ([CMP-156](#cmp-156-tabel-site_component_usage)). Dipakai untuk:
  - Notifikasi update tersedia ([CMP-052](#cmp-052-notifikasi-update-tersedia)).
  - Tab Usage admin (berapa situs memakai versi apa).
  - Keputusan archive/hapus.
- **Acceptance criteria:**
  - [ ] Usage terupdate ≤ 2 menit setelah perubahan dokumen.
  - [ ] Indeks usage tidak memblok autosave (dikerjakan async via BullMQ, debounce per situs).

### CMP-052 Notifikasi "update tersedia"
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Saat component publish versi baru:
  1. Worker `library.notifyUpdate` mencari situs dari `site_component_usage` dengan versi lebih rendah.
  2. Membuat entri `site_update_notices` (per situs, per component; satu notice aktif yang menunjuk versi terbaru).
  3. Di editor: badge di panel Layers pada instance (ikon panah ↑), dan panel "Pembaruan" (Updates) di sidebar kiri berisi daftar component yang punya update, dikelompokkan: **Aman (minor/patch)** dan **Perlu ditinjau (major)**.
  4. Dashboard situs (apps/web) menampilkan ringkasan "3 component punya pembaruan".
  - Tidak mengirim email untuk setiap update (spam); email ringkasan mingguan opsional (P2).
- **Acceptance criteria:**
  - [ ] Notice muncul di editor ≤ 5 menit setelah publish versi baru.
  - [ ] User dapat "Abaikan versi ini" → notice disembunyikan sampai versi berikutnya.
  - [ ] Versi `yanked` di pakai situs → notice prioritas (merah).

### CMP-053 Preview diff sebelum update
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Dialog update menampilkan:
  - **Visual diff**: render instance user (dengan props & overrides miliknya) di versi lama vs baru, side-by-side, dengan toggle device (desktop/tablet/mobile) dan mode slider "before/after". Render dilakukan di client memakai `packages/renderer` (tanpa server).
  - **Changelog** versi-versi di antaranya (mis. 1.2.0 → 1.5.0 menampilkan 1.3, 1.4, 1.5).
  - **Daftar konflik override** ([CMP-055](#cmp-055-konflik-overrides)) & **migrasi props** ([CMP-054](#cmp-054-migrasi-props-saat-breaking-change)).
  - Pilihan cakupan: "Update instance ini saja" / "Update semua instance component ini di situs" (default) / per halaman.
  - Tombol **Update** menerapkan perubahan sebagai **satu transaksi Yjs** (satu langkah undo).
- **Acceptance criteria:**
  - [ ] Preview dirender ≤ 1 s untuk section rata-rata.
  - [ ] Setelah update, `Ctrl+Z` mengembalikan seluruh instance ke versi lama dalam satu langkah.
  - [ ] Update tidak mempublish situs; user tetap harus Publish ([07](./07-publishing-hosting.md)).

### CMP-054 Migrasi props saat breaking change
- **Prioritas · Fase:** P0 · M3 (definisi) · M4 (UI user)
- **Deskripsi:** Versi MAJOR **wajib** menyertakan `migration` (mapping) dari versi major sebelumnya. Dibuat admin di dialog publish, dibantu saran otomatis (prop dengan tipe sama & label mirip).

```jsonc
// ilustratif — skema formal `ComponentMigration` ada di 01 DM-079
{
  "from": "1.x",
  "to": "2.0.0",
  "props": {
    "title":    { "rename": "heading" },
    "subtitle": { "rename": "description" },
    "ctaText":  { "moveInto": "primaryCta.label" },
    "style":    { "mapValues": { "ghost": "outline" } },
    "showIcon": { "drop": true, "note": { "id": "Ikon kini selalu tampil", "en": "Icon is now always shown" } }
  },
  "nodeIds":  { "n_subtitle01": "n_descrip001" },     // remap target override (ID node lama → baru)
  "slots":    { "extra": "footer" }
}
```

  - Operasi yang didukung: `rename`, `mapValues`, `moveInto` (ke sub-field list/object), `setDefault`, `drop`, `transform` (fungsi terdaftar bernama, mis. `stringToRichText` — bukan kode bebas).
  - Migrasi berantai: 1.x → 2.0 → 3.0 dijalankan berurutan.
  - Fungsi `migrateInstance(instance, fromDef, toDef, migrations) → { instance, warnings[] }` di `packages/document-model`, pure & ber-unit test.
- **Acceptance criteria:**
  - [ ] Publish MAJOR ditolak bila ada prop/variant/slot/ID node yang hilang tanpa entri di `migration`.
  - [ ] Data user (teks, gambar) pada prop yang di-rename tidak hilang setelah update.
  - [ ] Prop yang di-`drop` menampilkan warning dengan nilai lama agar user bisa menyalin manual.

### CMP-055 Konflik overrides
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Override user di-key oleh ID node (NodePath) + properti style. Saat update:

| Situasi | Perilaku default | Pilihan user |
|---|---|---|
| Node target masih ada, properti sama | Override **dipertahankan** (override menang atas nilai baru definisi) | "Pakai nilai baru" per item |
| Node target dihapus (dan tidak di-remap) | Override **dibuang**; dicatat di warnings | — |
| Node target di-remap via `migration.nodeIds` | Override dipindah | — |
| Definisi mengubah properti yang sama (mis. padding baru) & user punya override | **Konflik** ditandai kuning | "Pertahankan milik saya" (default) / "Pakai desain baru" |
| Override pada node yang kini `hardLocked` | Override dibuang | — |

  - Tombol global "Reset semua override & pakai desain baru" tersedia.
- **Acceptance criteria:**
  - [ ] Dialog menampilkan jumlah override dipertahankan, dibuang, konflik.
  - [ ] Pilihan per konflik diterapkan dalam transaksi yang sama.

### CMP-056 Auto-update minor/patch (opsional)
- **Prioritas · Fase:** P2 · M9+
- **Deskripsi:** Setting per situs `libraryAutoUpdate: "off" | "patch" | "minor"` (default `off`). Bila aktif, worker menerapkan update non-breaking ke **dokumen draft** situs (bukan langsung live) dan mencatat di riwayat versi situs; user tetap memutuskan publish.

> ❓ OPEN: Apakah auto-update minor/patch disediakan? Risiko: perubahan visual minor tetap dapat mengejutkan user UMKM. Alternatif: hanya "patch keamanan/aksesibilitas" yang auto, ditandai `autoApplicable: true` oleh admin. Juga perlu diputuskan: apakah auto-update boleh langsung re-publish situs live.

- **Acceptance criteria (bila disetujui):**
  - [ ] Auto-update tidak pernah menerapkan versi MAJOR.
  - [ ] Auto-update yang menimbulkan konflik override dibatalkan dan diubah menjadi notice manual.

### CMP-057 Detach instance
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Menu konteks / Properties panel "Lepaskan dari komponen" (Detach) — tersedia di Design mode dan Simple mode (dengan konfirmasi). Proses:
  1. Resolve definisi versi yang di-pin + varian + props + overrides → tree node biasa.
  2. Ganti instance dengan tree tersebut (node ID baru, nama layer dipertahankan).
  3. Instance bersarang di dalamnya **tetap instance** (detach tidak rekursif); ada opsi "Detach semua (rekursif)".
  4. Entri usage situs diperbarui.
- Detach tidak dapat dibatalkan kecuali lewat Undo.
- **Acceptance criteria:**
  - [ ] Hasil detach render pixel-identik dengan instance sebelum detach.
  - [ ] Setelah detach, node tidak lagi menerima notifikasi update.
  - [ ] Component dengan binding data/commerce aktif menampilkan peringatan bahwa binding tetap dipertahankan pada node hasil detach (perilaku binding → [05](./05-dynamic-data.md)).

---

## 8. Instance di Sisi User

### CMP-070 Simple mode (edit konten)
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Simple mode adalah default untuk user baru ([02](./02-editor.md) mendefinisikan toggle mode). Pada instance, user dapat:
  - Edit teks inline (double-click) untuk prop `text`/`richText` dan node `simpleAccess=content`.
  - Ganti gambar (klik → picker: upload, library foto platform, Unsplash-like stock bila tersedia — OPEN di [§19](#19-lisensi--aset)).
  - Ganti link (picker halaman/section/URL/WhatsApp).
  - Toggle props boolean, pilih enum/varian, kelola `list` (tambah item FAQ, menu).
  - Pilih warna dari palet theme (bila prop `color`).
  - Isi slot dengan component yang diizinkan.
  - Pindah urutan section (naik/turun), duplikat, hapus section.
- Tidak bisa: geser posisi bebas, ubah padding/ukuran, pilih node `locked`.
- **Acceptance criteria:**
  - [ ] Semua tipe prop M3 dapat diedit tanpa membuka Design mode.
  - [ ] User non-designer dapat mengganti judul, gambar, dan tombol WA pada hero dalam < 60 detik (diuji usability test 5 orang).

### CMP-071 Design mode (override style & nested)
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Di Design mode user dapat memilih node mana pun di dalam instance (kecuali `hardLocked`) — termasuk menembus nested instance (`Ctrl/Cmd+klik` deep select seperti Figma) — dan mengubah style apa pun (fill, typography, spacing, layout, size, effects, visibility, per breakpoint). Perubahan tersimpan sebagai `overrides` di instance terluar dengan NodePath ID node bertingkat (format [01 DM-049](./01-document-model.md#dm-049-instance-overrides--addressing)).
  - Node yang memiliki override ditandai titik biru di layer panel; properti yang di-override diberi indikator di Properties panel.
  - Menambah node baru di dalam instance **hanya** via slot. Di luar slot, user harus Detach.
- **Acceptance criteria:**
  - [ ] Override pada nested instance (instance di dalam instance) tersimpan dan ter-render benar.
  - [ ] Override per breakpoint (`tablet`/`mobile`) didukung bila manual responsive override aktif ([02](./02-editor.md)).

### CMP-072 Reset override
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Tersedia pada tiga tingkat: per properti (klik kanan label properti → "Reset"), per node ("Reset overrides node ini"), dan seluruh instance ("Reset semua perubahan"). Reset props konten (teks/gambar) dipisah dari reset style: "Reset style" tidak menghapus konten user.
- **Acceptance criteria:**
  - [ ] "Reset style" mempertahankan nilai props konten.
  - [ ] Setiap reset satu langkah undo.

### CMP-073 Edit main component (admin only)
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Menu "Edit komponen utama" hanya tampil untuk user dengan role admin library, dan membuka component di Mode Admin (tab baru) sebagai **draft baru** — tidak pernah mengedit versi published di tempat. User biasa melihat menu "Lihat info komponen" (nama, versi, changelog, deskripsi).
- **Acceptance criteria:**
  - [x] User non-admin tidak pernah melihat menu edit main component; API menolak.
  - [x] Admin yang membuka dari situs user mendapat draft; situs user tidak berubah sampai ia memilih update.

### CMP-074 Swap component
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** "Ganti komponen" membuka picker component dengan `kind` sama (mis. Hero A → Hero B). Pemetaan:
  1. Props dengan `key` sama dan tipe kompatibel → nilai dipindah.
  2. Props dengan **`semanticRole`** sama (mis. `heading`, `subheading`, `primaryCtaLabel`, `primaryCtaLink`, `heroImage`, `items`) → dipindah walau key berbeda. Admin wajib mengisi `semanticRole` untuk props konten utama agar swap & AI bekerja baik.
  3. Sisa props → default component tujuan; nilai lama yang tak terpakai ditampilkan di panel "Konten tidak terpakai" agar bisa disalin.
  4. Overrides style **dibuang** (tidak bisa dipetakan andal) — kecuali override pada node dengan `semanticRole` sama (opsional, P1).
  - Picker menampilkan preview langsung dengan konten user (live preview hover).
- **Acceptance criteria:**
  - [ ] Swap Hero dengan 5 props berperan semantik sama mempertahankan seluruh konten utama.
  - [ ] Swap satu langkah undo.
  - [ ] Daftar standar `semanticRole` didefinisikan sebagai enum di `packages/document-model` dan dipakai juga oleh AI ([04](./04-ai-agent.md)).

### CMP-075 Insert component dari panel library
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Panel Insert (kiri) berisi tab **Sections**, **Elements/Blocks**, **Pages**, **Icons**, **Images**. Fitur: pencarian ([§16](#16-search--discovery)), filter kategori/industri, preview besar saat hover, drag ke canvas atau klik "Tambah" (masuk ke posisi setelah section terpilih). Instance yang disisipkan selalu memakai **versi published terbaru**.
  - Component dengan `requiresFeatures` yang tidak termasuk paket user tampil dengan gembok + CTA upgrade.
- **Acceptance criteria:**
  - [ ] Panel memuat ≤ 500 ms (data katalog di-cache, thumbnail lazy-load).
  - [ ] Drag-drop section ke antara dua section menampilkan indikator sisip.

### CMP-076 Informasi instance di Properties panel
- **Prioritas · Fase:** P1 · M4
- **Deskripsi:** Header Properties panel untuk instance menampilkan: thumbnail, nama component, versi (`v1.2.0`), badge status (Terbaru / Update tersedia / Usang), tombol Update, Swap, Detach, Reset, "Lihat info".
- **Acceptance criteria:**
  - [ ] Semua aksi di atas dapat dicapai dalam 1 klik dari header.

---

## 9. Katalog Component Awal (Library v1)

### CMP-080 Target library v1 untuk rilis M4
- **Prioritas · Fase:** P0 · M3–M4
- **Deskripsi:** Target **~200 component variant** (hitungan = kombinasi desain berbeda yang tampil sebagai item terpisah di panel Insert, bukan setiap kombinasi `size×state`). Library harus cukup untuk membangun 20–30 template ([§10](#10-template)) tanpa canvas bebas.
  - "Item" di tabel = satu `ComponentDefinition`. "Variasi" = layout/desain berbeda (bisa berupa varian `layout` di component yang sama, atau component terpisah — keputusan per item oleh admin; aturan praktis: bila tree berbeda > 30%, buat component terpisah).
  - Kolom **Fase**: M3 = harus ada untuk dogfooding template; M4 = rilis publik; M7/M8 = bersama fitur dinamis/commerce.

### CMP-081 Katalog — Navigation & Layout
- **Prioritas · Fase:** P0 · M3/M4

| # | Item | Variasi / varian | Prioritas | Fase |
|---|---|---|---|---|
| 1 | Navbar simple | logo kiri + menu kanan; logo tengah; menu + CTA button; transparan di atas hero; sticky | P0 | M3 |
| 2 | Navbar dengan WA CTA | tombol "Chat WhatsApp" menonjol (khas UMKM ID) | P0 | M3 |
| 3 | Navbar mobile drawer | hamburger → drawer kiri/kanan; fullscreen overlay | P0 | M3 |
| 4 | Navbar e-commerce | search, ikon cart + badge jumlah, akun (rujuk [06](./06-commerce-payments.md)) | P1 | M8 |
| 5 | Mega menu | 2–4 kolom dengan ikon/deskripsi | P1 | M4+ |
| 6 | Announcement bar | teks + link, dismissible | P1 | M4 |
| 7 | Sidebar app-shell | collapsible; dengan grup menu; dengan profil user | P0 | M4 (dipakai penuh M7) |
| 8 | Breadcrumb | separator chevron/slash | P1 | M4 |
| 9 | Tabs | underline; pills; vertical | P0 | M4 |
| 10 | Pagination | numbered; prev/next; load more | P1 | M4 (fungsi data M7) |
| 11 | Footer | 4 kolom link + sosial; simple 1 baris; dengan newsletter; dengan alamat & jam buka + map mini | P0 | M3 |
| 12 | Floating WhatsApp button | kanan bawah, dengan/ tanpa teks bubble | P0 | M3 |
| 13 | Back-to-top | ikon bulat | P2 | M9+ |

  **Target:** ~22 variasi.

### CMP-082 Katalog — Hero
- **Prioritas · Fase:** P0 · M3

| # | Item | Variasi | Prioritas |
|---|---|---|---|
| 1 | Hero centered | teks tengah + 2 CTA; dengan badge di atas judul; dengan background gradient token | P0 |
| 2 | Hero split image | gambar kanan; gambar kiri; gambar dengan bentuk rounded/blob mask | P0 |
| 3 | Hero background image | overlay gelap + teks kiri/tengah; tinggi full-screen | P0 |
| 4 | Hero video background | video mute loop + fallback poster | P1 |
| 5 | Hero with form | form lead/registrasi singkat di kanan (submit → [05](./05-dynamic-data.md)) | P1 |
| 6 | Hero product showcase | gambar produk + harga + CTA beli | P1 |
| 7 | Hero with stats | judul + 3 angka statistik | P1 |
| 8 | Hero carousel/slider | 2–5 slide (island JS kecil) | P1 |
| 9 | Hero app/screenshot | mockup perangkat | P2 |

  **Target:** ~18 variasi.

### CMP-083 Katalog — Feature / Benefit
- **Prioritas · Fase:** P0 · M3

| # | Item | Variasi | Prioritas |
|---|---|---|---|
| 1 | Feature grid ikon | 3 kolom; 4 kolom; 2×3; dengan card border | P0 |
| 2 | Feature alternating | gambar–teks bergantian kiri/kanan | P0 |
| 3 | Feature list dengan checklist | ikon centang + teks | P0 |
| 4 | Feature bento grid | ukuran tile campur | P1 |
| 5 | Steps / process | 3–5 langkah bernomor horizontal; vertikal timeline | P0 |
| 6 | Why choose us | ikon + angka + teks | P1 |
| 7 | Comparison table | kami vs mereka | P2 |

  **Target:** ~15 variasi.

### CMP-084 Katalog — Content
- **Prioritas · Fase:** P0 · M3

| # | Item | Variasi | Prioritas |
|---|---|---|---|
| 1 | Text block | heading + paragraf; 2 kolom teks; dengan quote besar | P0 |
| 2 | Image + text | gambar kiri/kanan; gambar penuh atas | P0 |
| 3 | Gallery | grid 3/4 kolom; masonry; lightbox (island); carousel | P0 (grid), P1 (masonry, lightbox) |
| 4 | Video embed | YouTube/Vimeo (lite embed, klik baru load iframe); dengan judul | P0 |
| 5 | About / story | teks + foto pendiri + tahun berdiri | P0 |
| 6 | Timeline / history | vertikal | P1 |
| 7 | Menu restoran / daftar harga | 2 kolom dengan harga; dengan foto; kategori tab | P0 |
| 8 | Jadwal / jam operasional | tabel hari + jam | P0 |
| 9 | Rich article body | untuk blog post (heading, list, quote, image) | P1 |

  **Target:** ~20 variasi.

### CMP-085 Katalog — Social proof
- **Prioritas · Fase:** P0 · M3

| # | Item | Variasi | Prioritas |
|---|---|---|---|
| 1 | Testimonial cards | grid 3; carousel; single besar dengan foto | P0 |
| 2 | Testimonial bintang/rating | rating ala marketplace + nama + kota | P0 |
| 3 | Logo cloud | grid grayscale; marquee (CSS animation) | P0 |
| 4 | Stats / counter | 3–4 angka; dengan ikon; dengan background brand | P0 |
| 5 | Review embed (Google review style card) | statis (input manual) | P1 |
| 6 | Press / "Diliput oleh" | logo media | P2 |

  **Target:** ~12 variasi.

### CMP-086 Katalog — Pricing, FAQ, CTA
- **Prioritas · Fase:** P0 · M3

| # | Item | Variasi | Prioritas |
|---|---|---|---|
| 1 | Pricing cards | 2/3/4 paket; paket unggulan (highlight); dengan toggle bulanan/tahunan (island) | P0 (toggle P1) |
| 2 | Pricing table perbandingan | fitur × paket | P1 |
| 3 | Price list jasa | daftar layanan + harga (salon, bengkel) | P0 |
| 4 | FAQ accordion | 1 kolom; 2 kolom; dengan kategori | P0 |
| 5 | CTA banner | full-width brand color; dengan gambar; card terpusat | P0 |
| 6 | CTA WhatsApp | teks + tombol WA besar + nomor | P0 |
| 7 | Newsletter signup | inline email + tombol (form → [05](./05-dynamic-data.md)) | P1 |

  **Target:** ~16 variasi.

### CMP-087 Katalog — Team, Contact, Blog
- **Prioritas · Fase:** P0 · M3/M4

| # | Item | Variasi | Prioritas | Fase |
|---|---|---|---|---|
| 1 | Team grid | foto bulat; foto kotak + sosial; dengan bio | P0 | M3 |
| 2 | Doctor/instructor profile | foto + spesialisasi + jadwal (klinik/kursus) | P1 | M4 |
| 3 | Contact form | nama/email/WA/pesan; split dengan info kontak | P0 (statis kirim email) | M4 (collection M7) |
| 4 | Contact info | alamat, telepon, WA, email, jam buka | P0 | M3 |
| 5 | Map embed | Google Maps iframe (input alamat/URL embed); dengan card alamat | P0 | M3 |
| 6 | Booking/reservation form | tanggal, jam, jumlah orang | P1 | M7 |
| 7 | Blog card | vertikal; horizontal; minimal (judul+tanggal) | P0 | M4 |
| 8 | Blog list section | grid 3; list; featured + list | P0 | M4 (data M7) |
| 9 | Article header | judul, penulis, tanggal, cover | P1 | M7 |

  **Target:** ~20 variasi.

### CMP-088 Katalog — Product & Cards umum
- **Prioritas · Fase:** P0 · M3/M4

| # | Item | Variasi | Prioritas | Fase |
|---|---|---|---|---|
| 1 | Product card | gambar + nama + harga; dengan harga coret & badge diskon; dengan tombol "Pesan via WA"; dengan tombol "Tambah ke keranjang" (M8) | P0 | M3 (WA), M8 (cart) |
| 2 | Product grid | 2/3/4 kolom; dengan filter kategori tab | P0 | M4 (data M7) |
| 3 | Product detail section | galeri + info + varian + CTA | P1 | M8 |
| 4 | Card umum | image card; icon card; horizontal card; overlay text card; link card | P0 | M3 |
| 5 | Listing card properti/kos | foto, harga/bulan, fasilitas ikon, lokasi | P1 | M4 |
| 6 | Event card | tanggal besar, judul, lokasi | P1 | M4 |
| 7 | Course card | thumbnail, durasi, level, harga | P1 | M4 |

  **Target:** ~20 variasi.

### CMP-089 Katalog — Elements (Buttons, Badges, Inputs, Modal, Icons, Media, Dividers)
- **Prioritas · Fase:** P0 · M3

| # | Item | Varian (property-based) | Prioritas |
|---|---|---|---|
| 1 | Button | `style`: primary/secondary/outline/ghost/link × `size`: sm/md/lg × `iconPosition` × `state` | P0 |
| 2 | WhatsApp button | solid hijau / outline; dengan ikon | P0 |
| 3 | Button group / store badges | 2 tombol; App Store / Play Store style (generik, tanpa logo merek) | P1 |
| 4 | Badge / tag | `tone`: neutral/brand/success/warning/danger × `variant`: solid/soft/outline | P0 |
| 5 | Input fields | text, email, phone (+62), textarea, select, checkbox, radio, switch, date, file upload — `size`, `state` (error/disabled) | P0 (statis visual), fungsi form M7 |
| 6 | Form layout | 1 kolom; 2 kolom; dengan label atas/samping | P0 |
| 7 | Modal / dialog | konfirmasi; form; gambar (island) | P1 |
| 8 | Alert / callout | info/success/warning/error | P1 |
| 9 | Avatar | gambar/inisial; group | P1 |
| 10 | Rating stars | read-only | P0 |
| 11 | Social icons row | Lucide + label (ikon merek → OPEN [§19](#19-lisensi--aset)) | P0 |
| 12 | Icon (Lucide) | `size`, `strokeWidth`, `color` token; ±1.500 ikon via icon picker (bukan item library terpisah) | P0 |
| 13 | Icon in shape | ikon dalam lingkaran/kotak soft | P0 |
| 14 | Image placeholder | rasio 1:1, 4:3, 16:9, 3:4; dengan caption; rounded | P0 |
| 15 | Divider / spacer | garis, garis dengan teks, wave/curve SVG section divider, spacer token `space.*` | P0 |
| 16 | Countdown | untuk event/promo (island) | P1 |

  **Target:** ~30 item (varian property-based dihitung per item).

### CMP-090 Katalog — Dashboard widgets (website dinamis)
- **Prioritas · Fase:** P0 (visual M4) · M7 (data)
- **Deskripsi:** Visual tersedia sejak M4 (dengan data contoh statis) agar template dashboard bisa ditampilkan; binding data aktif di M7 ([05](./05-dynamic-data.md)).

| # | Item | Variasi | Prioritas | Fase |
|---|---|---|---|---|
| 1 | Stat card | angka + label; dengan delta ↑↓; dengan ikon; dengan sparkline (P1) | P0 | M4/M7 |
| 2 | Data table | basic; dengan search & filter; dengan aksi baris (edit/hapus); dengan pagination | P0 | M7 |
| 3 | List / feed | daftar item dengan avatar; activity feed | P0 | M7 |
| 4 | Detail view | key-value record | P0 | M7 |
| 5 | Record form (CRUD) | create/edit dari schema collection | P0 | M7 |
| 6 | Chart | bar, line, pie/donut (library chart OPEN di [05](./05-dynamic-data.md)) | P1 | M7+ |
| 7 | Empty state | ilustrasi + CTA | P0 | M7 |
| 8 | Kanban board | kolom status | P2 | M9+ |
| 9 | Calendar view | booking/event | P2 | M9+ |

  **Target:** ~16 variasi.

### CMP-091 Katalog — Auth blocks
- **Prioritas · Fase:** P0 · M7
- **Deskripsi:** Component untuk end-user auth situs (perilaku & keamanan didefinisikan di [05 — End-user auth](./05-dynamic-data.md)). Di dokumen ini hanya visual & props.

| # | Item | Variasi |
|---|---|---|
| 1 | Login form | card terpusat; split dengan gambar; dengan login WA OTP (bila didukung [05](./05-dynamic-data.md)) |
| 2 | Register form | basic; dengan field tambahan dari collection members |
| 3 | Forgot / reset password | – |
| 4 | Member profile / account menu | dropdown avatar; halaman profil |
| 5 | Auth page templates (`kind: page`) | /login, /register, /akun |

  **Target:** ~10 variasi. `requiresFeatures: ["dynamic","auth"]`.

### CMP-092 Katalog — Commerce blocks
- **Prioritas · Fase:** P0 · M8
- **Deskripsi:** Perilaku keranjang, checkout, dan pembayaran di [06 — Commerce](./06-commerce-payments.md).

| # | Item | Variasi |
|---|---|---|
| 1 | Cart drawer / cart page | drawer kanan; halaman penuh |
| 2 | Checkout form | 1 halaman; multi-step (alamat → pengiriman → pembayaran) |
| 3 | Order summary | ringkas; detail |
| 4 | Order status / thank-you | sukses; menunggu pembayaran (instruksi VA/QRIS) |
| 5 | Order history (member) | tabel/list |
| 6 | Product variant picker | ukuran/warna chip |
| 7 | Quantity stepper | – |

  **Target:** ~12 variasi. `requiresFeatures: ["commerce"]`.

### CMP-093 Ringkasan jumlah target
- **Prioritas · Fase:** P0 · M4

| Kategori | Target variasi | P0 di M4 (minimal) | Fase |
|---|---|---|---|
| Navigation & Layout | 22 | 14 | M3–M4 |
| Hero | 18 | 10 | M3 |
| Feature/Benefit | 15 | 9 | M3 |
| Content | 20 | 14 | M3 |
| Social proof | 12 | 8 | M3 |
| Pricing/FAQ/CTA | 16 | 11 | M3 |
| Team/Contact/Blog | 20 | 12 | M3–M4 |
| Product & Cards | 20 | 10 | M3–M4 |
| Elements | 30 | 22 | M3 |
| Dashboard widgets | 16 | 4 (visual) | M4/M7 |
| Auth blocks | 10 | 0 | M7 |
| Commerce blocks | 12 | 0 | M8 |
| **Total** | **~211** | **~114** | |

- **Acceptance criteria (gate rilis M4):**
  - [ ] ≥ 110 variasi P0 published & lulus QA.
  - [ ] Setiap template M4 hanya memakai component published (tidak ada node bebas > 10% dari total node template, kecuali dekorasi).
  - [ ] Setiap kategori P0 memiliki minimal 1 variasi yang lulus uji kontras pada **semua** theme preset.

> ❓ OPEN: Kebijakan ikon merek (WhatsApp, Instagram, TikTok, Shopee, Tokopedia) — Lucide tidak memuat semua logo merek (dan sebagian dihapus dari Lucide). Opsi: set SVG ikon sosial sendiri dengan aturan penggunaan merek, atau Simple Icons (CC0, tapi tetap tunduk pedoman merek masing-masing). Lihat [§19](#19-lisensi--aset).

---

## 10. Template

### CMP-100 Struktur template
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Template = snapshot website lengkap, disimpan per versi di `template_versions.document` (format site document di [01](./01-document-model.md)) + manifest:

| Bagian | Isi | Catatan |
|---|---|---|
| `pages[]` | Halaman (Home, Tentang, Layanan, Kontak, ...), urutan, slug, SEO default | Root section = instance component library |
| `theme` | Salinan theme preset atau theme khusus template | Di-copy ke situs |
| `globals` | Navbar, footer, floating WA (global layout) | Lihat [02](./02-editor.md) |
| `sampleContent` | Teks & gambar contoh realistis per industri | Ditandai `isSample: true` agar onboarding bisa mengganti |
| `sampleData` | (template dinamis) definisi collections + baris contoh | Format collection di [05](./05-dynamic-data.md); `requiresFeatures: ["dynamic"]` |
| `onboardingFields` | Field yang ditanyakan saat onboarding & peta ke props/token ([CMP-104](#cmp-104-onboarding-data-bisnis)) | |
| `componentRefs` | Daftar `componentId@version` yang dipakai (derived, untuk indeks & validasi) | Dihitung saat publish |
| metadata | `name`, `displayName {id,en}`, `description`, `industries[]`, `tags[]`, `keywords`, `pagesCount`, `features` (`static`/`dynamic`/`commerce`), `previewUrl`, thumbnails | |

- Template dibuat di Mode Admin sebagai "template workspace" (sebuah situs internal dengan flag `is_template_source`). Publish template = snapshot dokumen situs tersebut → `template_versions`.
- **Acceptance criteria:**
  - [ ] Publish template gagal bila ada instance yang merujuk component versi `draft`/`in_review`.
  - [ ] Template memiliki preview live di `tpl-{templateSlug}.platformmu.site` (domain situs, `SITES_ROOT_DOMAIN`; nama host final mengikuti [07](./07-publishing-hosting.md)) (statis, dipublish oleh pipeline [07](./07-publishing-hosting.md)).

### CMP-101 Versioning template
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Template berversi seperti component (`MAJOR.MINOR.PATCH`, immutable, status sama dengan [CMP-040](#cmp-040-state-machine-status-component)). **Berbeda dengan component, situs yang sudah dibuat dari template TIDAK menerima update template** — setelah di-copy, situs mandiri. Yang tetap terhubung adalah instance-instance component di dalamnya (menerima update component via [§7](#7-propagasi-update-ke-website-user)).
  - Situs menyimpan `created_from_template_id` + `template_version` untuk analitik.
- **Acceptance criteria:**
  - [ ] Publish versi template baru tidak mengubah situs mana pun.
  - [ ] Kolom `sites.created_from_template_version_id` terisi.

### CMP-102 Kategori industri template (Indonesia)
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Target rilis M4: **24 template** (min 20). Setiap template 3–6 halaman. Template dinamis/commerce menyusul di M7/M8.

| # | Industri (slug) | Contoh template | Halaman inti | Fitur | Prioritas | Fase |
|---|---|---|---|---|---|---|
| 1 | Kuliner / F&B (`kuliner`) | "Warung Nusantara", "Kopi Senja" | Home, Menu, Tentang, Lokasi | statis + WA order | P0 (2 template) | M4 |
| 2 | Restoran menu (`restoran`) | "Menu Digital QR" (1 halaman menu untuk QR meja) | Menu | statis | P0 | M4 |
| 3 | Fashion (`fashion`) | "Butik Hijab", "Streetwear Lokal" | Home, Koleksi, Lookbook, Kontak | statis katalog + WA | P0 | M4 (cart M8) |
| 4 | UMKM produk rumahan (`umkm-produk`) | "Kue Kering Bunda", "Sambal Rumahan" | Home, Produk, Testimoni, Cara Pesan | statis + WA | P0 (2 template) | M4 |
| 5 | Jasa / servis (`jasa`) | "Jasa Kebersihan", "Tukang AC" | Home, Layanan, Harga, Kontak | statis | P0 | M4 |
| 6 | Bengkel (`bengkel`) | "Bengkel Motor Jaya" | Home, Layanan & Harga, Booking, Lokasi | statis (booking M7) | P0 | M4 |
| 7 | Salon / barbershop (`salon`) | "Barbershop Klasik", "Salon Muslimah" | Home, Layanan, Galeri, Booking | statis (booking M7) | P0 | M4 |
| 8 | Klinik / kesehatan (`klinik`) | "Klinik Pratama", "Klinik Gigi" | Home, Layanan, Dokter, Jadwal, Kontak | statis | P0 | M4 |
| 9 | Pendidikan / kursus (`pendidikan`) | "Bimbel Prestasi", "Kursus Bahasa" | Home, Program, Pengajar, Daftar | statis + form | P0 | M4 |
| 10 | Properti (`properti`) | "Perumahan Asri", "Agen Properti" | Home, Unit/Listing, Fasilitas, Kontak | statis (listing dinamis M7) | P1 | M4 |
| 11 | Kos / kontrakan (`kos`) | "Kos Putri Melati" | Home, Kamar & Harga, Fasilitas, Lokasi | statis + WA | P0 | M4 |
| 12 | Travel (`travel`) | "Open Trip Nusantara", "Umrah & Haji" | Home, Paket, Galeri, Kontak | statis | P1 | M4 |
| 13 | Portfolio (`portfolio`) | "Fotografer", "Desainer/Freelancer" | Home, Karya, Tentang, Kontak | statis | P0 (2 template) | M4 |
| 14 | Company profile (`company-profile`) | "Kontraktor", "Konsultan", "Pabrik/Manufaktur" | Home, Tentang, Layanan, Proyek, Karir, Kontak | statis | P0 (3 template) | M4 |
| 15 | Event / undangan (`event`) | "Undangan Pernikahan", "Seminar/Webinar" | 1 halaman panjang (countdown, galeri, lokasi, RSVP) | statis (RSVP M7) | P0 (2 template) | M4 |
| 16 | Komunitas / organisasi (`komunitas`) | "Masjid/Yayasan", "Komunitas Hobi" | Home, Kegiatan, Pengurus, Donasi/Kontak | statis | P1 | M4 |
| 17 | Toko online (`toko-online`) | "Toko Serba Ada" | Home, Katalog, Produk, Keranjang, Checkout | commerce | P0 | M8 |
| 18 | Landing page generik (`landing`) | "Produk Digital", "Launching" | 1 halaman | statis | P0 | M4 |
| 19 | Dashboard member (`member-area`) | "Portal Member Kursus" | Login, Dashboard, Profil | dinamis | P1 | M7 |
| 20 | Link-in-bio (`link-in-bio`) | "Link Bio UMKM" | 1 halaman tombol | statis | P0 | M4 |

  **Jumlah M4:** 24 template statis (hitungan P0/P1 baris berfase M4 dengan jumlah template per baris). Template M7: ≥ 4 dinamis; M8: ≥ 3 commerce.
- **Acceptance criteria:**
  - [ ] ≥ 20 template statis published sebelum rilis M4, mencakup minimal 12 industri berbeda.
  - [ ] Setiap template lulus QA ([CMP-133](#cmp-133-qa-checklist-library)) di 3 breakpoint & Lighthouse mobile ≥ 90 (performance, accessibility) pada preview publish.
  - [ ] Setiap template memiliki `displayName`, `description` ID+EN, dan sample content Bahasa Indonesia.

> ❓ OPEN: Jumlah template final M4 (20 vs 30) — tergantung kecepatan produksi dengan AI ([§12](#12-workflow-produksi-library-dengan-ai)). Usulan: gate rilis = 20, target = 24–30.

### CMP-103 Alur user memilih template
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:**
  1. **Galeri template** (`apps/web` → `/templates` publik & `/dashboard/new`): filter industri, fitur (statis/dinamis/commerce), jumlah halaman, warna; pencarian; preview live (iframe dengan toggle device).
  2. Klik **"Pakai template ini"** → (bila belum login: daftar/masuk dulu, pilihan template diingat).
  3. API `POST /api/sites` dengan `{ templateId, templateVersion }` → service men-**clone** dokumen template: generate ID node baru, pertahankan `componentId@version` instance (tetap terhubung), copy theme, copy aset (referensi aset library platform tetap dipakai bersama — tidak diduplikasi, kecuali user mengganti), buat collections contoh bila dinamis (dan paket mendukung).
  4. Masuk ke **onboarding** ([CMP-104](#cmp-104-onboarding-data-bisnis)), lalu editor (Simple mode).
  - Alternatif: "Mulai dari kosong" & "Buat dengan AI" ([04](./04-ai-agent.md)).
- **Acceptance criteria:**
  - [ ] Pembuatan situs dari template ≤ 3 s (p95).
  - [ ] Situs baru memiliki subdomain sesuai paket ([08](./08-accounts-plans-admin.md)); Free = acak.
  - [ ] Template dinamis untuk user tanpa paket AI: situs tetap dibuat; blok dinamis tampil dengan data contoh statis + banner upgrade.

### CMP-104 Onboarding data bisnis
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Wizard 3–4 langkah setelah memilih template (bisa dilewati):

| Langkah | Field | Diterapkan ke |
|---|---|---|
| 1. Identitas | Nama bisnis, tagline (opsional), kategori industri | Props `semanticRole = brandName`/`tagline` di seluruh instance; `site.name`; SEO title |
| 2. Logo & warna | Upload logo; pilih warna utama (picker atau "ambil dari logo" — ekstraksi warna dominan sederhana tanpa AI, P1) | Prop `logo` navbar/footer; token `color.primary` (+ shade otomatis) |
| 3. Kontak | Nomor WhatsApp (+62, validasi), email, alamat, kota, link Instagram/TikTok/marketplace | Semua link `kind: whatsapp`, contact info, map embed, social icons |
| 4. Jam buka (opsional per industri) | Jam operasional | Component jadwal |

  - Pemetaan memakai `template.onboardingFields` → daftar target (`semanticRole` props, token, `site.settings`). Penggantian hanya untuk nilai yang masih `isSample: true` (tidak menimpa yang sudah diedit).
  - Data bisnis disimpan juga di `sites.business_profile` (JSONB) agar AI dan template lain dapat memakai ulang.
- **Acceptance criteria:**
  - [ ] Setelah onboarding, nama bisnis & nomor WA tampil di navbar, hero, footer, dan tombol WA tanpa edit manual.
  - [ ] Nomor WA dinormalisasi ke format `62xxxxxxxxxx` dan link `https://wa.me/62...`.
  - [ ] Warna utama yang kontrasnya buruk terhadap putih/teks memicu saran penyesuaian otomatis (shade lebih gelap).

### CMP-105 Auto-fill konten dengan AI
- **Prioritas · Fase:** P1 · M6
- **Deskripsi:** Opsi di onboarding: "Isi konten otomatis dengan AI" — AI membaca `business_profile` + deskripsi singkat bisnis, lalu mengganti semua teks `isSample` (hero, layanan, tentang, FAQ) dan memilih foto dari library stok sesuai industri. Memakai kredit AI; berjalan sebagai satu transaksi yang bisa di-undo. Detail tool & skill di [04](./04-ai-agent.md) (skill `onboarding-site-generation`, tool `update_texts_bulk`, `search_stock_image`/`import_stock_image`).
- **Acceptance criteria:**
  - [ ] Hasil AI hanya mengubah props konten (tidak mengubah struktur/desain).
  - [ ] Pengguna Free melihat penawaran trial/upgrade sesuai kuota ([08](./08-accounts-plans-admin.md)).

### CMP-106 Sample data collections (template dinamis)
- **Prioritas · Fase:** P1 · M7
- **Deskripsi:** Template dinamis menyertakan `sampleData`: definisi collections (mis. `products`, `bookings`, `members`) + 5–20 baris contoh, plus bindings di instance. Saat clone: collections dibuat di situs user, baris contoh ditandai `is_sample = true` dan ada tombol "Hapus semua data contoh". Format & perilaku di [05](./05-dynamic-data.md).
- **Acceptance criteria:**
  - [ ] Clone template dinamis membuat collections & bindings yang langsung berfungsi di preview.
  - [ ] "Hapus data contoh" menghapus hanya baris `is_sample`.

### CMP-107 Page templates & section templates
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Selain template situs penuh, tersedia:
  - **Page template** (`kind: page` component atau page snapshot): "Tambah halaman → Tentang Kami / Kontak / FAQ / 404 / Kebijakan Privasi / Syarat & Ketentuan". Halaman legal berisi teks template generik + disclaimer "bukan nasihat hukum".
  - **Section template**: = component `kind: section` ([CMP-003](#cmp-003-jenis-component-kind)).
- **Acceptance criteria:**
  - [ ] Minimal 8 page template di M4: Tentang, Layanan, Kontak, FAQ, Galeri, 404, Kebijakan Privasi, Syarat & Ketentuan.

---

## 11. Theme System

### CMP-120 Struktur theme preset
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Theme = kumpulan token (skema di [01 — Design tokens](./01-document-model.md)). Isi minimal:

| Grup token | Isi |
|---|---|
| `color` | `primary`, `primaryForeground`, `secondary`, `accent`, `background`, `surface`, `muted`, `border`, `text`, `textMuted`, `success`, `warning`, `danger` + shade otomatis 50–950 untuk `primary`/`secondary` |
| `font` | `heading` (family, weight), `body` (family, weight) — font pairing dari Google Fonts |
| `typeScale` | `xs`…`6xl` (size, lineHeight, letterSpacing) per breakpoint |
| `radius` | `none`, `sm`, `md`, `lg`, `xl`, `full` |
| `shadow` | `none`, `sm`, `md`, `lg` |
| `space` | skala spacing + `section` (padding vertikal section per breakpoint) |
| `container` | max width konten |
| `mode` | `light` / `dark` (dark preset = theme terpisah, bukan toggle runtime di P0) |

- **Acceptance criteria:**
  - [ ] Setiap preset lulus cek kontras otomatis untuk pasangan `text/background`, `primaryForeground/primary`, `textMuted/surface`.

### CMP-121 Katalog theme preset awal
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Target 16 preset di M4, contoh:

| Preset | Karakter | Font pairing (heading / body) | Radius |
|---|---|---|---|
| Modern Biru | profesional, company profile | Plus Jakarta Sans / Inter | md |
| Hangat Kuliner | oranye-merah, F&B | Poppins / Nunito | lg |
| Elegan Emas | gelap + emas, undangan/salon | Playfair Display / Lato | sm |
| Segar Hijau | kesehatan/organik | Manrope / Inter | lg |
| Pastel Lembut | fashion/hijab | DM Serif Display / DM Sans | xl |
| Minimal Mono | portfolio | Space Grotesk / Inter | none |
| Ceria Anak | pendidikan | Baloo 2 / Nunito | full |
| Industrial | bengkel/kontraktor | Oswald / Roboto | sm |
| Dark Tech | produk digital | Sora / Inter | md |
| Batik Klasik | nuansa tradisional | Cormorant Garamond / Source Sans 3 | sm |
| ... 6 lainnya | | | |

- **Acceptance criteria:**
  - [ ] Semua font tersedia di Google Fonts (lisensi OFL/Apache) dan di-self-host via Fontsource saat publish ([07](./07-publishing-hosting.md)).

### CMP-122 Ganti theme global satu klik
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Panel "Theme" (sidebar kiri) menampilkan preset dengan preview mini; klik = mengganti `site.theme` (satu transaksi undo). Karena component memakai token, seluruh situs berubah instan. Override user yang memakai **nilai literal** tidak berubah; editor menampilkan info "N elemen memakai warna kustom" + tombol "Ubah ke warna theme".
  - User dapat mengkustom token individual (warna primer, font) setelah memilih preset → tersimpan sebagai theme situs (bukan preset).
- **Acceptance criteria:**
  - [ ] Ganti theme pada situs 10 halaman ter-render ulang ≤ 300 ms di canvas.
  - [ ] Undo mengembalikan theme sebelumnya dalam satu langkah.

### CMP-123 Generate theme dari logo (AI)
- **Prioritas · Fase:** P1 · M6
- **Deskripsi:** User upload logo → (1) ekstraksi palet deterministik (k-means di worker, tanpa AI, tersedia untuk semua — P1 M4) → (2) AI (paket AI) memilih peran warna, font pairing, radius, mood sesuai industri & logo, menghasilkan 3 opsi theme dengan preview. Detail di [04](./04-ai-agent.md) (AI-009, skill `theme-generation`, tool `extract_palette_from_image` + `apply_theme`).
- **Acceptance criteria:**
  - [ ] Semua opsi yang dihasilkan lulus cek kontras (AI output divalidasi & dikoreksi otomatis).
  - [ ] Opsi diterapkan sebagai preview sebelum user konfirmasi.

### CMP-124 Theme di Mode Admin
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Admin mengedit preset di Admin Panel (form token + preview grid component kunci: hero, card, button, form, pricing). Preset berversi sederhana (`themes.version` integer); karena di-copy ke situs, perubahan preset tidak menyentuh situs lama. Admin dapat menguji setiap component library terhadap semua preset via halaman "Theme matrix" (Playwright screenshot grid).
- **Acceptance criteria:**
  - [ ] Theme matrix menampilkan component × preset dengan flag kontras gagal.

---

## 12. Workflow Produksi Library dengan AI

### CMP-130 Alur produksi "admin buat 1 → AI buat variasi → kurasi"
- **Prioritas · Fase:** P1 · M6 (sebelumnya manual/seed di M3–M4)
- **Deskripsi:**

```
1. Admin mendesain 1 component "anchor" (mis. HeroSplitImage) di Mode Admin, lengkap props/variants/metadata, lulus QA.
2. Admin meminta AI (panel AI Mode Admin): "Buat 6 variasi hero untuk industri klinik, kuliner, fashion".
3. AI (agent loop, tools library) membaca anchor + design rules + katalog, menghasilkan N draft component baru
   (status draft, owner = admin peminta, flag generated_by_ai = true).
4. Worker merender thumbnail & menjalankan library-lint + axe untuk setiap draft.
5. Admin melihat "Kurasi" grid: terima → masuk draft normal; tolak (dengan alasan → feedback untuk skill); edit manual.
6. Draft yang diterima melalui review & publish biasa (CMP-040/041).
```

  - AI juga dipakai untuk: menulis `description`/`keywords`/`aiHints` ID+EN, default content per industri, menyusun template dari component yang ada, membuat sample content.
- **Acceptance criteria:**
  - [ ] Draft hasil AI tidak pernah langsung published; selalu melalui QA & review manusia.
  - [ ] Setiap draft AI menyimpan `generation_meta` (prompt, model, skill versi, kredit) untuk audit.
  - [ ] Pemakaian AI admin tidak memotong kredit user, tapi dicatat di biaya internal.

### CMP-131 Skills AI untuk produksi library
- **Prioritas · Fase:** P1 · M6
- **Deskripsi:** Skills (file Markdown, dimuat sesuai kebutuhan, didefinisikan di [04 — Skills](./04-ai-agent.md)) yang dibutuhkan:

Nama skill **mengikuti daftar resmi [04 AI-082](./04-ai-agent.md#ai-082-daftar-skill-awal)**; kolom kanan = isi yang wajib dicakup skill tersebut untuk kebutuhan library.

| Skill (04) | Isi yang wajib dicakup untuk library |
|---|---|
| `admin-component-authoring` | Aturan R-TOKEN, R-AUTOLAYOUT, R-RESPONSIVE, R-SEMANTIC, R-A11Y, R-NAMING (CMP-015); cara membuat `ComponentDefinition`: props, `$prop`, variants delta, slot, `semanticRole`; menulis description/tags/keywords/`aiHints` untuk search & AI |
| `admin-variation-generation` | Cara membuat variasi dari anchor tanpa menyalin mentah: ubah layout, hierarki, dekorasi |
| `admin-template-authoring` | Menyusun template dari section library: urutan halaman, ritme visual, CTA; pola section & konten per industri (klinik, kuliner, dst. — file pendukung `admin-template-authoring/industries/<industri>.md`) |
| `copywriting-id` | Gaya bahasa default konten: sopan, jelas, ajakan WA, konteks lokal UMKM |
| `theme-generation` | Membuat preset theme dengan kontras aman |

- **Acceptance criteria:**
  - [ ] Skill tersimpan di `packages/ai-tools/skills/<name>/SKILL.md` (format 04 AI-080) dan diversi bersama kode.

### CMP-132 Tools AI khusus library (admin)
- **Prioritas · Fase:** P1 · M6
- **Deskripsi:** Tools (nama & kontrak resmi di [04 §4](./04-ai-agent.md#4-tools); definisi Zod di `packages/ai-tools`). Khusus Mode Admin ([04 §4.10](./04-ai-agent.md#410-meta--admin)): `admin_create_component_draft`, `admin_add_variant`, `admin_save_template_draft`, `admin_update_library_metadata`. Dipakai bersama tools umum: `search_components`, `get_component`, `render_preview` (Playwright screenshot → image ke model), `check_accessibility`, `check_responsive`. Mengedit draft component memakai tools mutasi dokumen biasa (04 §4.5) pada dokumen draft.
  > ❓ OPEN: tool QA library otomatis (`admin_run_qa`, menjalankan CMP-133 bagian A) belum ada di 04; sementara QA dijalankan pipeline worker, bukan oleh AI.
- **Acceptance criteria:**
  - [ ] Tools library tidak dapat dipanggil dari sesi AI user biasa (cek role server-side).

### CMP-133 QA checklist library
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Checklist berlaku untuk component dan template. Otomatis (A) dijalankan worker `library.qa`; manual (M) dicentang reviewer.

| # | Item | Jenis | Alat |
|---|---|---|---|
| Q1 | Render tanpa error di renderer editor & publish (hasil identik) | A | renderer + Playwright pixel diff |
| Q2 | Responsif: tidak overflow horizontal di 375/768/1280 dan lebar kustom 320 & 1920 | A | Playwright |
| Q3 | Token-only (R-TOKEN) | A | library-lint |
| Q4 | Auto-layout (R-AUTOLAYOUT) | A | library-lint |
| Q5 | Kontras teks AA pada semua theme preset | A | axe-core + kalkulasi token |
| Q6 | Aksesibilitas: alt, label form, aria tombol ikon, urutan heading, focus visible, target sentuh ≥ 44px di mobile | A + M | axe-core + review |
| Q7 | Semantic tag benar (R-SEMANTIC) | A + M | lint + review |
| Q8 | Nama layer bermakna (R-NAMING) | A | lint |
| Q9 | Props jelas: label ID+EN, group, default realistis, `semanticRole` untuk konten utama | M | review |
| Q10 | Editable/locked masuk akal untuk Simple mode | M | "lihat sebagai user" |
| Q11 | Variants lengkap, `defaultVariant` ada, kombinasi invalid ditandai | A + M | |
| Q12 | Metadata lengkap (desc, tags, keywords, aiHints) | A | |
| Q13 | Aset berlisensi tercatat (`license`, `source`) | A | cek field |
| Q14 | Performa: ≤ 300 node, gambar default ≤ 200 KB WebP, tanpa island JS kecuali perlu | A | |
| Q15 | Teks panjang (2× default) & teks kosong tidak merusak layout | A | Playwright stress-render |
| Q16 | Visual estetis & konsisten dengan library (review mata manusia) | M | |

  Template tambahan: Q17 semua link internal valid, Q18 SEO default (title/description per halaman), Q19 Lighthouse mobile ≥ 90 performance & accessibility, Q20 sample content tanpa typo & dalam Bahasa Indonesia baku-santai.
- **Acceptance criteria:**
  - [ ] Laporan QA tersimpan di `qa_report` dan dapat dilihat di tab QA.
  - [ ] Stress-render Q15 memakai prop teks yang dilipatgandakan otomatis.

---

## 13. Seed Library (sebelum editor siap)

### CMP-140 Struktur paket `packages/library-seed/`
- **Prioritas · Fase:** P0 · M1–M3
- **Deskripsi:** Sebelum Mode Admin matang (M3), library diisi dari file JSON/TS di repo. Paket ini juga menjadi **sumber kebenaran untuk fixture test** dan dapat dipakai AI coding agent untuk menambah component lewat kode.

```
packages/library-seed/
  package.json                # name: @platform/library-seed
  src/
    schema.ts                 # Zod: SeedComponentFile, SeedTemplateFile, SeedThemeFile (membungkus schema dari @platform/document-model)
    lint.ts                   # library-lint (dipakai juga oleh editor & worker)
    import.ts                 # logic import (dipanggil oleh CLI)
    cli.ts                    # `pnpm seed:library [--dry-run] [--only=components/hero-*] [--publish]`
  data/
    categories.json
    themes/
      modern-biru.theme.json
    components/
      navigation/navbar-simple.component.json
      hero/hero-split-image.component.json
      ...
    templates/
      kuliner-warung-nusantara/
        template.json         # manifest + document (pages, theme, globals)
        sample-data.json      # opsional (template dinamis)
    assets/
      images/...              # gambar contoh + assets.manifest.json (license, source, author)
  test/
    seed.test.ts              # semua file valid, lint lolos
```

- **Acceptance criteria:**
  - [ ] `pnpm --filter @platform/library-seed test` memvalidasi semua file seed di CI.
  - [ ] Seed tidak menduplikasi schema; `schema.ts` meng-import Zod schema dari `packages/document-model`.

### CMP-141 Format file seed component
- **Prioritas · Fase:** P0 · M1–M3
- **Deskripsi:** Satu file = satu component dengan satu atau lebih versi. Field `definition` mengikuti `ComponentDefinition` dari [01](./01-document-model.md) (tidak didefinisikan ulang di sini).

```jsonc
// data/components/hero/hero-split-image.component.json  (ilustratif)
{
  "$schema": "../../../schema/component-seed.schema.json",
  "seedVersion": 1,
  "id": "cmp_hero_split_image",          // stabil; dipakai sebagai components.id (atau slug unik → UUID deterministik)
  "slug": "hero-split-image",
  "kind": "section",
  "categorySlug": "hero",
  "meta": {
    "name": "HeroSplitImage",
    "displayName": { "id": "Hero Gambar Samping", "en": "Hero Split Image" },
    "description": { "id": "Hero dengan judul, deskripsi, dua tombol, dan gambar di samping.", "en": "Hero with heading, description, two buttons, and side image." },
    "tags": ["hero", "split-layout", "with-image"],
    "keywords": { "id": ["banner", "header besar", "pembuka"], "en": ["banner", "header"] },
    "industries": ["umum", "jasa", "klinik"],
    "aiHints": "Gunakan sebagai section pertama halaman Home bila user punya foto produk/tempat usaha."
  },
  "versions": [
    {
      "version": "1.0.0",
      "status": "published",
      "changelog": { "id": "Rilis awal.", "en": "Initial release." },
      "definition": { /* ComponentDefinition — lihat 01-document-model.md */ }
    }
  ]
}
```

- Aturan:
  - `id` seed → di-import ke `components.id` sebagai **UUID v5 deterministik** dari `slug` (namespace tetap), sehingga import ulang idempoten dan template seed dapat merujuk `slug@version`.
  - Template seed merujuk component via `"componentRef": "hero-split-image@1.0.0"`; script mengubahnya ke `componentId@version`.
  - Versi yang sudah ada di DB dengan `content_hash` berbeda → **error** (immutability), harus naik versi.
- **Acceptance criteria:**
  - [ ] Import dua kali berturut-turut tidak membuat duplikat (idempoten).
  - [ ] Mengubah definisi versi published di file seed tanpa naik versi → CLI gagal dengan pesan jelas.

### CMP-142 Script import
- **Prioritas · Fase:** P0 · M1–M3
- **Deskripsi:** `pnpm seed:library` (root script → `@platform/library-seed` CLI):
  1. Baca semua file `data/**`; parse JSON; validasi Zod (laporkan semua error, bukan berhenti di error pertama).
  2. Jalankan `library-lint` (aturan CMP-015) — `--strict` di CI.
  3. Upload aset ke storage (MinIO lokal / R2) dengan path berbasis hash; catat lisensi.
  4. Upsert `library_categories`, `themes`, `components`, `component_versions` (insert-only untuk versi), `templates`, `template_versions` dalam **satu transaksi DB** per entitas.
  5. Enqueue job thumbnail ([CMP-014](#cmp-014-thumbnail-otomatis-playwright)) & indeks search.
  6. Cetak ringkasan: dibuat / tidak berubah / gagal.
  - Flag: `--dry-run`, `--only=<glob>`, `--env=local|staging|production` (production butuh konfirmasi `--yes` + env `SEED_ALLOW_PROD=1`).
  - Juga tersedia **export**: `pnpm seed:export --component=<slug>` menulis component dari DB (dibuat di Mode Admin) kembali ke file seed → library bisa di-review via Git.
- **Acceptance criteria:**
  - [ ] Seed lokal dari nol (Docker Compose) selesai ≤ 60 s untuk 200 component.
  - [ ] Export → import menghasilkan `content_hash` identik (round-trip).

### CMP-143 Validasi Zod seed
- **Prioritas · Fase:** P0 · M1
- **Deskripsi:** `SeedComponentFile = z.object({ seedVersion: z.literal(1), id, slug, kind, categorySlug, meta: ComponentMetaSchema, versions: z.array(SeedVersionSchema).min(1) })` dengan `definition: ComponentDefinitionSchema` (import). Refinements:
  - versi terurut naik & unik; tepat satu bump semantik valid antar versi (pakai `diffComponentSchemas`, [CMP-042](#cmp-042-nomor-versi-semver-ish));
  - semua ID node unik; semua binding menunjuk prop & node yang ada;
  - semua aset yang dirujuk ada di `assets.manifest.json` dengan `license`.
  - JSON Schema dihasilkan dari Zod (`zod-to-json-schema`) ke `packages/library-seed/schema/*.json` untuk autocomplete di VS Code.
- **Acceptance criteria:**
  - [ ] Pesan error menyertakan path file + JSON path (`versions[0].definition.props[2].key`).

---

## 14. Penyimpanan Database

> Konvensi umum (UUID v7 PK, `created_at/updated_at timestamptz`, soft-delete, Drizzle schema **hanya** di `packages/db/src/schema/library.ts` (`@platform/db`); `*.schema.ts` di modul API hanya untuk Zod request/response) mengikuti [../ARCHITECTURE.md](../ARCHITECTURE.md). Tabel `users`, `sites`, `assets`, `audit_logs` didefinisikan di sana / [08](./08-accounts-plans-admin.md). Kolom JSONB berisi data yang divalidasi Zod dari `packages/document-model`.

### CMP-150 Tabel `library_categories`
- **Prioritas · Fase:** P0 · M3

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | uuid PK | | |
| `slug` | text UNIQUE | | `hero`, `navigation`, `kuliner` |
| `scope` | text | | `component` \| `template` \| `both` |
| `type` | text | | `functional` (hero, pricing) \| `industry` (kuliner, klinik) |
| `parent_id` | uuid FK → library_categories | ✔ | hierarki 2 level |
| `name` | jsonb | | `{ id, en }` |
| `description` | jsonb | ✔ | `{ id, en }` |
| `icon` | text | ✔ | nama ikon Lucide |
| `sort_order` | int | | default 0 |
| `created_at`, `updated_at` | timestamptz | | |

- **Acceptance criteria:**
  - [ ] Seed kategori fungsional (§9) dan industri (§10) tersedia setelah `pnpm seed:library`.

### CMP-151 Tabel `components`
- **Prioritas · Fase:** P0 · M3

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | uuid PK | | UUID v5 dari slug untuk seed; v7 untuk yang dibuat di editor |
| `slug` | text | | unik per owner (`UNIQUE(owner_type, owner_id, slug)`) |
| `owner_type` | text | | `platform` \| `user` \| `vendor` |
| `owner_id` | uuid | ✔ | null untuk platform; user/vendor id |
| `kind` | text | | `element` \| `block` \| `section` \| `page` \| `layout` |
| `category_id` | uuid FK → library_categories | | |
| `name` | text | | PascalCase EN |
| `display_name` | jsonb | | `{ id, en }` |
| `description` | jsonb | | `{ id, en }` |
| `tags` | text[] | | GIN index |
| `keywords` | jsonb | | `{ id: [], en: [] }` |
| `industries` | text[] | | GIN index |
| `ai_hints` | text | ✔ | |
| `requires_features` | text[] | | `dynamic`, `auth`, `commerce` |
| `min_plan` | text | ✔ | OPEN ([CMP-004](#cmp-004-kepemilikan--visibilitas-library)) |
| `status` | text | | ringkasan: `draft` \| `in_review` \| `published` \| `deprecated` \| `archived` |
| `latest_version_id` | uuid FK → component_versions | ✔ | versi published terbaru |
| `latest_version` | text | ✔ | denormalisasi `"1.4.0"` |
| `draft_version_id` | uuid FK → component_versions | ✔ | draft aktif |
| `replaced_by_component_id` | uuid FK → components | ✔ | saran pengganti saat deprecated |
| `thumbnail_url` | text | ✔ | thumbnail versi terbaru |
| `search_vector` | tsvector | | generated/trigger ([CMP-160](#cmp-160-full-text-search-postgres)) |
| `embedding` | vector(1024) | ✔ | P1, pgvector — OPEN |
| `usage_site_count` | int | | denormalisasi untuk sort "populer" |
| `generated_by_ai` | boolean | | default false |
| `created_by` | uuid FK → users | | |
| `deprecated_at`, `archived_at` | timestamptz | ✔ | |
| `created_at`, `updated_at` | timestamptz | | |

  Index: `(owner_type, status)`, `(category_id)`, GIN `tags`, GIN `industries`, GIN `search_vector`, `UNIQUE(owner_type, owner_id, slug)` (pakai `NULLS NOT DISTINCT` untuk platform).

### CMP-152 Tabel `component_versions`
- **Prioritas · Fase:** P0 · M3

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | uuid PK | | |
| `component_id` | uuid FK → components | | |
| `version` | text | ✔ | `"1.2.0"`; null selama draft |
| `version_seq` | int | ✔ | urutan monoton untuk sort; null selama draft |
| `bump` | text | ✔ | `major` \| `minor` \| `patch` |
| `status` | text | | `draft` \| `in_review` \| `published` \| `deprecated` \| `archived` |
| `yanked` | boolean | | default false ([CMP-046](#cmp-046-rollback)) |
| `definition` | jsonb | | `ComponentDefinition` ([01](./01-document-model.md)) |
| `props_schema_hash` | text | ✔ | hash props schema untuk deteksi breaking cepat |
| `content_hash` | text | ✔ | SHA-256 JSON kanonik (diisi saat publish) |
| `migration` | jsonb | ✔ | wajib bila `bump = major` ([CMP-054](#cmp-054-migrasi-props-saat-breaking-change)) |
| `changelog` | jsonb | ✔ | `{ id, en }` |
| `changes` | jsonb | ✔ | output `diffComponentSchemas` |
| `qa_report` | jsonb | ✔ | hasil QA otomatis + manual |
| `thumbnails` | jsonb | ✔ | `{ desktop, tablet, mobile, variants: {} }` URL R2 |
| `generation_meta` | jsonb | ✔ | info AI ([CMP-130](#cmp-130-alur-produksi-admin-buat-1--ai-buat-variasi--kurasi)) |
| `rolled_back_from_version_id` | uuid | ✔ | |
| `created_by`, `reviewed_by`, `published_by` | uuid FK → users | ✔ | |
| `submitted_at`, `reviewed_at`, `published_at` | timestamptz | ✔ | |
| `created_at`, `updated_at` | timestamptz | | |

  Constraint: `UNIQUE(component_id, version)`, `UNIQUE(component_id, version_seq)`, partial unique `(component_id) WHERE status='draft'` (satu draft aktif). Trigger `prevent_update_published_component_version`: tolak UPDATE kolom `definition`, `version`, `content_hash`, `migration` bila `OLD.status <> 'draft'` dan `OLD.status <> 'in_review'`.
- **Acceptance criteria:**
  - [ ] Migrasi drizzle-kit membuat trigger via SQL kustom; test integrasi membuktikan UPDATE ditolak.

### CMP-153 Tabel `templates`
- **Prioritas · Fase:** P0 · M4

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | uuid PK | | |
| `slug` | text | | unik per owner |
| `owner_type`, `owner_id` | text, uuid | owner_id ✔ | sama seperti components |
| `display_name`, `description` | jsonb | | `{ id, en }` |
| `industries` | text[] | | |
| `category_ids` | uuid[] | | kategori industri |
| `tags` | text[] | | |
| `keywords` | jsonb | | |
| `features` | text[] | | `static`, `dynamic`, `commerce`, `auth` |
| `pages_count` | int | | |
| `default_theme_id` | uuid FK → themes | ✔ | |
| `source_site_id` | uuid FK → sites | ✔ | template workspace di Mode Admin |
| `status`, `latest_version_id`, `latest_version`, `draft_version_id` | | | sama seperti components |
| `preview_url` | text | ✔ | |
| `thumbnail_url` | text | ✔ | |
| `min_plan` | text | ✔ | OPEN |
| `search_vector` | tsvector | | |
| `embedding` | vector | ✔ | P1 |
| `usage_site_count` | int | | jumlah situs dibuat dari template |
| `sort_weight` | int | | kurasi urutan galeri |
| `created_by`, timestamps, `deprecated_at`, `archived_at` | | | |

### CMP-154 Tabel `template_versions`
- **Prioritas · Fase:** P0 · M4

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | uuid PK | | |
| `template_id` | uuid FK → templates | | |
| `version`, `version_seq`, `status`, `content_hash`, `changelog` | | | seperti component_versions |
| `document` | jsonb | | snapshot site document (pages, globals, theme) — [01](./01-document-model.md) |
| `sample_data` | jsonb | ✔ | collections + rows contoh ([05](./05-dynamic-data.md)) |
| `onboarding_fields` | jsonb | | [CMP-104](#cmp-104-onboarding-data-bisnis) |
| `component_refs` | jsonb | | `[{ componentId, version, count }]` |
| `qa_report`, `thumbnails` | jsonb | ✔ | |
| `published_at`, `published_by` | | ✔ | |
| timestamps | | | |

  Catatan ukuran: `document` dapat 0.5–3 MB. Bila > 1 MB, simpan di R2 (`storage_key`) dan JSONB hanya manifest — keputusan ambang di [../ARCHITECTURE.md](../ARCHITECTURE.md).

### CMP-155 Tabel `themes`
- **Prioritas · Fase:** P0 · M3

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | uuid PK | | |
| `slug` | text | | |
| `owner_type`, `owner_id` | | owner_id ✔ | platform preset / user theme tersimpan (P2) |
| `display_name` | jsonb | | |
| `tokens` | jsonb | | `ThemeDefinition` ([01](./01-document-model.md)) |
| `mode` | text | | `light` \| `dark` |
| `tags` | text[] | | `elegan`, `ceria`, ... |
| `industries` | text[] | | |
| `version` | int | | naik setiap edit preset (situs menyimpan salinan) |
| `status` | text | | `draft` \| `published` \| `archived` |
| `preview_url` | text | ✔ | |
| `sort_order` | int | | |
| timestamps | | | |

  Theme situs sendiri disimpan di dokumen situs (`site.theme`), bukan di tabel ini; kolom `sites.theme_source_id` mencatat asal preset.

### CMP-156 Tabel `site_component_usage`
- **Prioritas · Fase:** P0 · M3

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `site_id` | uuid FK → sites | | PK komposit (`site_id`, `component_id`, `version`, `doc_state`) |
| `component_id` | uuid FK → components | | |
| `component_version_id` | uuid FK → component_versions | | |
| `version` | text | | denormalisasi |
| `doc_state` | text | | `draft` (dokumen editor) \| `published` (versi live) |
| `instance_count` | int | | |
| `page_ids` | text[] | | halaman yang memakai |
| `has_overrides` | boolean | | untuk estimasi risiko update |
| `last_indexed_at` | timestamptz | | |

  Index: `(component_id, version)`, `(site_id)`.
  Tabel pendukung **`site_update_notices`**: `id`, `site_id`, `component_id`, `from_version`, `to_version`, `severity` (`minor` \| `major` \| `security`), `status` (`open` \| `dismissed` \| `applied`), `dismissed_version`, `created_at`, `resolved_at`.
- **Acceptance criteria:**
  - [ ] Query "berapa situs memakai component X versi < 2.0.0" berjalan ≤ 100 ms untuk 1 juta baris (index).
  - [ ] Hapus situs → usage terhapus (FK `ON DELETE CASCADE`).

### CMP-157 Tabel pendukung lain
- **Prioritas · Fase:** P1 · M3–M4
- **Deskripsi:**
  - `library_assets` — aset bawaan library: `id`, `storage_key`, `mime`, `width`, `height`, `bytes`, `blurhash`, `license` (`unsplash`, `pexels`, `cc0`, `own`, `ai-generated`), `source_url`, `author`, `attribution_required` bool, `tags[]`, `industries[]`.
  - `library_reviews` — riwayat review: `id`, `entity_type` (`component_version`/`template_version`), `entity_id`, `reviewer_id`, `decision` (`approve`/`reject`), `notes`, `checklist` jsonb, `created_at`.
  - `library_favorites` (P1) — user menandai component/template favorit: `user_id`, `entity_type`, `entity_id`.
  - `library_events` (P1) — analitik: insert, swap, detach, update applied, search query tanpa hasil (untuk kurasi library).

---

## 15. API Library

### CMP-158 Endpoint publik/user
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Modul `apps/api/src/modules/library/` (`library.routes.ts`, `library.controller.ts`, `library.service.ts`, `library.repository.ts`, `library.schema.ts`).

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/library/categories` | Daftar kategori |
| GET | `/api/library/components?q=&category=&kind=&industry=&tags=&cursor=` | Katalog (versi terbaru, metadata ringan + thumbnail) |
| GET | `/api/library/components/:id/versions/:version` | Definisi versi (immutable → `Cache-Control: public, max-age=31536000, immutable`) |
| POST | `/api/library/components/resolve` | Batch resolve `[{componentId, version}]` → definisi (untuk load editor/publish) |
| GET | `/api/library/components/:id/changelog?from=&to=` | Changelog rentang versi + migrations |
| GET | `/api/library/templates?...` | Galeri template |
| GET | `/api/library/templates/:id` | Detail + versi terbaru (tanpa dokumen penuh) |
| GET | `/api/library/themes` | Preset theme |
| GET | `/api/sites/:siteId/library-updates` | Notice update untuk situs |
| POST | `/api/sites/:siteId/library-updates/:noticeId/dismiss` | Abaikan versi |
| POST | `/api/sites` | Buat situs (opsional `templateId`, `templateVersion`) — [CMP-103](#cmp-103-alur-user-memilih-template) |

- Catatan: penerapan update instance terjadi **di client** (Yjs transaction) memakai `migrateInstance`; server hanya menyediakan data & mencatat event.
- **Acceptance criteria:**
  - [ ] Semua response divalidasi Zod & ber-type shared ke editor.
  - [ ] Endpoint definisi versi dapat di-cache CDN.

### CMP-159 Endpoint admin
- **Prioritas · Fase:** P0 · M3

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/admin/library/components` | Buat component (+ draft) |
| PUT | `/api/admin/library/components/:id/draft` | Simpan draft (definisi + metadata) |
| POST | `/api/admin/library/components/:id/draft/qa` | Jalankan QA (enqueue) |
| POST | `/api/admin/library/components/:id/draft/submit` | → `in_review` |
| POST | `/api/admin/library/components/:id/draft/review` | `{ decision, notes, checklist }` |
| POST | `/api/admin/library/components/:id/draft/publish` | `{ bump, changelog, migration? }` |
| POST | `/api/admin/library/components/:id/versions/:version/rollback` | Republish dari versi lama |
| POST | `/api/admin/library/components/:id/versions/:version/yank` | Yank |
| POST | `/api/admin/library/components/:id/deprecate` | `{ replacedBy? }` |
| POST | `/api/admin/library/components/:id/archive` | Archive |
| GET | `/api/admin/library/components/:id/usage` | Usage per versi |
| (sama) | `/api/admin/library/templates/...` | Ekuivalen untuk template |
| (sama) | `/api/admin/library/themes/...` | CRUD preset |

- **Acceptance criteria:**
  - [ ] Setiap endpoint admin memeriksa role ([CMP-010](#cmp-010-akses-mode-admin)) dan menulis `audit_logs`.
  - [ ] Publish berjalan dalam transaksi DB: insert versi, update `components.latest_*`, enqueue thumbnail & notify.

---

## 16. Search & Discovery

### CMP-160 Full-text search Postgres
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Kolom `search_vector` (tsvector) di `components` & `templates`, di-update trigger dari: `name` (bobot A), `display_name.id/en` (A), `tags` (B), `keywords.id/en` (B), `description.id/en` (C), `industries` (C).
  - Konfigurasi bahasa: Postgres tidak punya stemmer Bahasa Indonesia bawaan → pakai konfigurasi `simple` + `unaccent` untuk teks ID, dan `english` untuk teks EN (dua tsvector digabung).
  - Pencarian prefix (`to_tsquery('her:*')`) untuk search-as-you-type; fallback trigram (`pg_trgm`) untuk typo ("testimoni" vs "testimonial").
  - Ranking: `ts_rank_cd` × boost (`usage_site_count` log-scale, `sort_weight`) — status deprecated dikecualikan.
- **Acceptance criteria:**
  - [ ] Query "harga" mengembalikan Pricing & Price list; "wa" mengembalikan WhatsApp button/CTA.
  - [ ] p95 latensi search ≤ 150 ms untuk 5.000 item.

> ❓ OPEN: Perlu stemmer/sinonim Bahasa Indonesia (mis. kamus sinonim `ts` custom atau ekstensi pihak ketiga)? Usulan awal: andalkan `keywords` manual + trigram; evaluasi setelah data query nyata (`library_events`).

### CMP-161 Filter & facet
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Filter: kategori (fungsional), `kind`, industri, tag, fitur (`static`/`dynamic`/`commerce`), mode warna theme (template), jumlah halaman (template), "Hanya yang bisa saya pakai" (sesuai paket). Facet count ditampilkan di samping filter (P1). Sort: Relevan, Populer, Terbaru.
- **Acceptance criteria:**
  - [ ] Kombinasi filter + query teks bekerja bersamaan dan state tersimpan di URL (galeri template web).

### CMP-162 Semantic search untuk AI (pgvector)
- **Prioritas · Fase:** P1 · M6
- **Deskripsi:** Embedding dari `name + description + aiHints + keywords + semanticRole props` disimpan di kolom `embedding` (pgvector, index HNSW). Dipakai oleh tool AI `search_components` ([04](./04-ai-agent.md)) dengan query natural ("section untuk menampilkan jadwal dokter"), digabung (hybrid) dengan full-text: `score = 0.6*semantic + 0.4*fts`.
  - Dihitung ulang oleh worker saat publish versi baru.

> ❓ OPEN: (1) Apakah pgvector diperlukan, atau katalog (≤ 500 item) cukup dikirim ringkas ke konteks AI / dipilih via full-text? (2) Provider embedding (Claude API tidak menyediakan embedding — perlu provider lain, mis. model open-source self-host atau API pihak ketiga) dan dimensi vektor.

- **Acceptance criteria (bila disetujui):**
  - [ ] Evaluasi 50 query uji: top-5 recall ≥ 85%.

### CMP-163 Discovery & kurasi
- **Prioritas · Fase:** P1 · M4
- **Deskripsi:** Panel Insert & galeri menampilkan: "Direkomendasikan untuk {industri situs}" (berdasarkan `business_profile.industry`), "Sering dipakai", "Baru". Admin dapat menyusun koleksi kurasi (`library_collections`: nama, item berurutan) mis. "Paket Lengkap Kuliner".
- **Acceptance criteria:**
  - [ ] Rekomendasi industri muncul bila `business_profile.industry` terisi.

---

## 17. Library Pribadi User (P2)

### CMP-170 Library pribadi: simpan component sendiri
- **Prioritas · Fase:** P2 · M9+
- **Deskripsi:** User (paket berbayar, OPEN) dapat memilih node/section → "Simpan ke Library Saya". Hasil: `components` dengan `owner_type='user'`, `owner_id=user.id`, versi otomatis (`1.0.0`, lalu minor tiap simpan ulang). Alur review/QA otomatis dilewati (hanya validasi Zod & lint ringan, non-blocking).
  - Props: user dapat menandai teks/gambar sebagai "bisa diubah" (props sederhana `text`/`image`/`link`) lewat UI sederhana; variants & migration tingkat lanjut tidak tersedia untuk user (P2+).
  - Reuse antar situs milik user (dan antar anggota tim di paket Business/Tim).
  - Update library pribadi mengikuti mekanisme pinned + notifikasi yang sama ([§7](#7-propagasi-update-ke-website-user)).
- **Desain sekarang (agar tidak migrasi besar):** kolom `owner_type/owner_id` sudah ada; resolver tidak mengasumsikan semua component milik platform; izin akses dicek per owner.
- **Acceptance criteria:**
  - [ ] Component pribadi tidak pernah muncul di library user lain.
  - [ ] Menghapus component pribadi yang masih dipakai → hanya archive (instance tetap render).

> ❓ OPEN: Paket mana yang mendapat library pribadi dan berapa batasnya (jumlah component)?

### CMP-171 Saved sections & theme pribadi
- **Prioritas · Fase:** P2 · M9+
- **Deskripsi:** Varian ringan: "Simpan section" tanpa props (snapshot detached) dan "Simpan theme saya" untuk dipakai di situs lain.
- **Acceptance criteria:**
  - [ ] Theme pribadi muncul di panel Theme pada semua situs user.

---

## 18. Marketplace (P2)

### CMP-180 Garis besar marketplace
- **Prioritas · Fase:** P2 · M9+
- **Deskripsi:** Designer luar (vendor terverifikasi) dapat menjual/membagikan template & component.
  - **Onboarding vendor:** verifikasi identitas & rekening (KYC ringan), persetujuan syarat.
  - **Authoring:** vendor memakai Mode Admin terbatas (`vendor` role) — fitur sama dengan admin internal untuk entitas miliknya; wajib lulus QA otomatis yang sama ([CMP-133](#cmp-133-qa-checklist-library)).
  - **Review:** moderasi oleh tim Platform (kualitas, lisensi aset, konten terlarang) sebelum tayang; rating & ulasan dari pembeli.
  - **Monetisasi:** gratis atau berbayar (sekali bayar per situs/per akun); **revenue share** (OPEN, mis. 70/30 untuk designer); payout via payment platform ([08](./08-accounts-plans-admin.md)).
  - **Lisensi:** pembeli mendapat lisensi pakai di situs; vendor menjamin hak atas aset.
- **Dampak desain sekarang:**
  - `owner_type = 'vendor'` + `owner_id` di components/templates/themes.
  - Instance & template clone sudah berbasis `componentId@version` → pembelian cukup mencatat hak (`library_entitlements`: `user_id`, `entity_id`, `scope`), resolver mengecek entitlement saat insert (bukan saat render situs publish — situs yang sudah memakai tetap jalan walau refund? → OPEN).
  - QA, thumbnail, versioning, migration sudah generik untuk semua owner.
  - Namespace slug per owner mencegah tabrakan nama.
- **Acceptance criteria (desain sekarang):**
  - [ ] Tidak ada query/kode yang hardcode "semua component milik platform" — resolver memakai owner-aware repository.

> ❓ OPEN: Persentase revenue share, model harga (per situs vs per akun), kebijakan refund & nasib situs yang memakai item yang di-refund/ditarik vendor, pajak (PPN/PPh) untuk payout designer.

---

## 19. Lisensi & Aset

### CMP-190 Gambar contoh
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Semua gambar default/sample di library wajib **bebas dipakai komersial** tanpa kewajiban atribusi bagi user akhir (karena user tidak akan menulis atribusi):
  - Sumber diizinkan: foto milik sendiri/tim, CC0 (mis. koleksi domain publik), lisensi foto stok yang mengizinkan penggunaan komersial dan redistribusi dalam produk template (wajib dicek per sumber — beberapa lisensi stok gratis **melarang** menjual ulang foto tanpa modifikasi atau mengompilasi untuk layanan serupa), ilustrasi buatan sendiri, gambar generatif AI dari layanan yang mengizinkan penggunaan komersial.
  - Setiap aset tercatat di `library_assets` dengan `license`, `source_url`, `author`, `attribution_required` (harus `false` untuk default content).
  - Hindari wajah orang yang dapat dikenali tanpa model release untuk konteks sensitif (klinik, keuangan).
  - Gambar dikompres WebP/AVIF, varian ukuran dibuat oleh worker image processing ([07](./07-publishing-hosting.md)).

> ❓ OPEN: Sumber foto stok utama dan apakah Platform menyediakan pencarian stok terintegrasi untuk user (butuh perjanjian API + kepatuhan lisensi/hotlinking sumber). Usulan: library foto internal terkurasi (~1.000 foto per industri) dulu, integrasi stok P1.

- **Acceptance criteria:**
  - [ ] QA (Q13) gagal bila aset tidak punya entri lisensi.
  - [ ] Halaman internal admin "Aset tanpa lisensi" = 0 sebelum rilis M4.

### CMP-191 Font
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Hanya font **Google Fonts** (lisensi SIL OFL / Apache 2.0) yang dipakai di library & theme preset. Font di-self-host (Fontsource) pada situs publish untuk performa dan privasi; subset latin + latin-ext. Upload font kustom user = di luar lingkup library (lihat [02](./02-editor.md); lisensi tanggung jawab user — OPEN).
- **Acceptance criteria:**
  - [ ] Daftar font yang diizinkan berasal dari metadata Google Fonts/Fontsource dan menyimpan lisensinya.

### CMP-192 Ikon
- **Prioritas · Fase:** P0 · M3
- **Deskripsi:** Ikon dari **Lucide** (lisensi ISC, bebas komersial). Ikon disimpan di dokumen sebagai nama (`"icon": "phone"`) dan di-inline sebagai SVG saat publish (hanya ikon yang dipakai → tree-shaken). Versi paket `lucide` di-pin; ikon yang di-rename/dihapus di versi Lucide baru ditangani tabel alias.
  - Ikon merek (WhatsApp, Instagram, dll) → lihat OPEN di [CMP-093](#cmp-093-ringkasan-jumlah-target). Logo merek tunduk pada pedoman merek masing-masing (hanya untuk menautkan ke akun, tidak dimodifikasi).
- **Acceptance criteria:**
  - [ ] Upgrade versi Lucide tidak membuat ikon hilang di situs lama (alias atau fallback ikon `circle-help` + warning di editor).

### CMP-193 Lisensi template & component untuk user
- **Prioritas · Fase:** P0 · M4
- **Deskripsi:** Syarat layanan ([08](./08-accounts-plans-admin.md)) menyatakan: user boleh memakai library untuk situs yang di-host di Platform; tidak boleh mengekstrak dan mendistribusikan ulang library sebagai template/kit terpisah. Aset gambar contoh boleh tetap dipakai di situs user.
- **Acceptance criteria:**
  - [ ] Teks lisensi library tersedia di halaman legal (ID + EN).

---

## 20. Daftar OPEN

| # | Topik | Ref | Usulan sementara |
|---|---|---|---|
| O-1 | Library/template dikunci per paket (`min_plan`)? | [CMP-004](#cmp-004-kepemilikan--visibilitas-library) | Library statis gratis semua; fitur dinamis/commerce yang dikunci |
| O-2 | Nomor versi rollback dari MAJOR | [CMP-046](#cmp-046-rollback) | Naik MAJOR baru |
| O-3 | Auto-update minor/patch (dan apakah boleh auto re-publish) | [CMP-056](#cmp-056-auto-update-minorpatch-opsional) | Default off; hanya patch `autoApplicable`; tidak auto re-publish |
| O-4 | Kebijakan ikon merek (WA, IG, TikTok, marketplace) | [CMP-093](#cmp-093-ringkasan-jumlah-target), [CMP-192](#cmp-192-ikon) | Set SVG sosial internal + pedoman merek |
| O-5 | Jumlah template final M4 | [CMP-102](#cmp-102-kategori-industri-template-indonesia) | Gate 20, target 24–30 |
| O-6 | Stemmer/sinonim Bahasa Indonesia untuk search | [CMP-160](#cmp-160-full-text-search-postgres) | `keywords` manual + trigram dulu |
| O-7 | pgvector & provider embedding | [CMP-162](#cmp-162-semantic-search-untuk-ai-pgvector) | Tunda; evaluasi saat M6 |
| O-8 | Paket & batas library pribadi | [CMP-170](#cmp-170-library-pribadi-simpan-component-sendiri) | Pro ke atas |
| O-9 | Revenue share, harga, refund, pajak marketplace | [CMP-180](#cmp-180-garis-besar-marketplace) | Putuskan di M9+ |
| O-10 | Sumber foto stok & integrasi pencarian stok | [CMP-190](#cmp-190-gambar-contoh) | Library foto internal terkurasi dulu |
| O-11 | Font kustom upload user (lisensi) | [CMP-191](#cmp-191-font) | Tanggung jawab user, P2 |
| O-12 | Detach component yang `hardLocked`/terikat fitur dinamis | [CMP-024](#cmp-024-editable-vs-locked-node) | Ikuti keputusan di [05](./05-dynamic-data.md) |

---

## 21. Traceability per Fase

| Fase | Requirement CMP |
|---|---|
| M1 | CMP-140, CMP-141, CMP-142, CMP-143 (seed & validasi; data minimal untuk uji renderer) |
| M3 | CMP-001–004, CMP-010–017, CMP-020–025, CMP-030–033, CMP-040–046, CMP-050, CMP-051, CMP-054 (definisi), CMP-057, CMP-073, CMP-081–089 (mayoritas P0), CMP-120, CMP-124, CMP-133, CMP-150–157, CMP-159, CMP-190–192 |
| M4 🚀 | CMP-052, CMP-053, CMP-054 (UI), CMP-055, CMP-070–072, CMP-074–076, CMP-080, CMP-093, CMP-100–104, CMP-107, CMP-121, CMP-122, CMP-158, CMP-160, CMP-161, CMP-163, CMP-193 |
| M6 | CMP-105, CMP-123, CMP-130–132, CMP-162 |
| M7 | CMP-090 (data), CMP-091, CMP-106 |
| M8 | CMP-092, template toko online |
| M9+ | CMP-056, CMP-170, CMP-171, CMP-180 |
