# 02 — Editor (Canvas ala Figma)

> Status: Draft v1 · Pemilik: owner · Prefix requirement: `ED-`
> Dokumen terkait: [PRD](../PRD.md) · [ARCHITECTURE](../ARCHITECTURE.md) · [ROADMAP](../ROADMAP.md) · [01 Document Model](./01-document-model.md) · [03 Components & Templates](./03-components-templates.md) · [04 AI Agent](./04-ai-agent.md) · [05 Dynamic Data](./05-dynamic-data.md) · [06 Commerce](./06-commerce-payments.md) · [07 Publishing & Hosting](./07-publishing-hosting.md) · [08 Accounts, Plans, Admin](./08-accounts-plans-admin.md)

Dokumen ini adalah spesifikasi **paling detail** di project. Ia mendeskripsikan seluruh perilaku editor canvas `apps/editor`: tata letak UI, arsitektur canvas DOM, tools, seleksi, transformasi, auto-layout, properti visual, typography, token, layers, components, assets, responsif, interaksi, clipboard, undo, shortcut, aksesibilitas, performa, recovery, kolaborasi, dan strategi testing.

Cara membaca:

- Setiap requirement punya ID `ED-NNN`, prioritas (P0/P1/P2), dan fase (M0..M9). ROADMAP merujuk ID ini.
- **P0** = wajib ada saat fase yang disebut selesai. **P1** = penting, boleh menyusul di fase berikutnya. **P2** = nanti (umumnya M9+).
- Bagian "Edge case" dan "Acceptance criteria" ditulis agar bisa langsung diubah jadi test (Vitest/Playwright).
- Struktur data node, style, token, dan breakpoint **tidak** didefinisikan ulang di sini — sumber kebenaran ada di [01-document-model.md](./01-document-model.md). Dokumen ini hanya menyebut nama field secara konseptual (mis. `node.style.<bp>.layout`, `node.style.base`, `node.states`, `node.bindings` — nama persis mengikuti 01; nilai referensi selalu objek `{ "$token" }`, `{ "$prop" }`, `{ "$bind" }`/`{ "$template" }`).
- Hal yang belum diputuskan ditandai `> ❓ OPEN:`.
- Notasi shortcut: `Mod` = `Ctrl` di Windows/Linux, `Cmd` di Mac. `Alt` = `Option` di Mac.

## Daftar Isi

1. [Tujuan & Ruang Lingkup](#1-tujuan--ruang-lingkup)
2. [Prinsip UX & Mode Editor](#2-prinsip-ux--mode-editor)
3. [Layout UI Editor](#3-layout-ui-editor)
4. [Arsitektur Canvas DOM](#4-arsitektur-canvas-dom)
5. [Navigasi Canvas](#5-navigasi-canvas)
6. [Pages, Frames & Breakpoint Frames](#6-pages-frames--breakpoint-frames)
7. [Tools](#7-tools)
8. [Selection](#8-selection)
9. [Transformasi](#9-transformasi)
10. [Smart Guides, Snapping & Pengukuran](#10-smart-guides-snapping--pengukuran)
11. [Auto-layout & Grid Layout](#11-auto-layout--grid-layout)
12. [Constraints (Frame Non-Auto-layout)](#12-constraints-frame-non-auto-layout)
13. [Properti Visual](#13-properti-visual)
14. [Typography](#14-typography)
15. [Design Tokens, Variables & Styles](#15-design-tokens-variables--styles)
16. [Layers Panel](#16-layers-panel)
17. [Group, Frame, Boolean & Mask](#17-group-frame-boolean--mask)
18. [Components & Instances di Editor](#18-components--instances-di-editor)
19. [Assets & Media](#19-assets--media)
20. [Insert Panel](#20-insert-panel)
21. [Responsif & Breakpoint](#21-responsif--breakpoint)
22. [Prototype & Interactions](#22-prototype--interactions)
23. [Clipboard](#23-clipboard)
24. [Undo/Redo, History & Autosave](#24-undoredo-history--autosave)
25. [Keyboard Shortcuts & Command Palette](#25-keyboard-shortcuts--command-palette)
26. [Context Menu](#26-context-menu)
27. [Preview & Publish Entry Point](#27-preview--publish-entry-point)
28. [Accessibility & SEO](#28-accessibility--seo)
29. [Semantic HTML](#29-semantic-html)
30. [Internationalization](#30-internationalization)
31. [Performa & Batasan](#31-performa--batasan)
32. [Error Handling & Recovery](#32-error-handling--recovery)
33. [Kolaborasi di Editor](#33-kolaborasi-di-editor)
34. [Testing Strategy Editor](#34-testing-strategy-editor)
35. [Lampiran A — Perbandingan Fitur Figma vs Editor](#35-lampiran-a--perbandingan-fitur-figma-vs-editor)
36. [Lampiran B — Ringkasan ID per Fase & Daftar OPEN](#36-lampiran-b--ringkasan-id-per-fase--daftar-open)

---

## 1. Tujuan & Ruang Lingkup

### 1.1 Tujuan

Editor adalah **jantung pengalaman produk**. Ia harus:

1. Terasa seperti Figma bagi designer (canvas tak terbatas, pan/zoom mulus, layers, auto-layout, components, shortcut yang familiar).
2. Tetap ramah bagi UMKM non-designer (Simple mode: klik teks → ketik, klik gambar → ganti, tambah section dari library).
3. Menghasilkan **website nyata** (HTML/CSS semantik, responsif) — bukan gambar, bukan kode export. Apa yang terlihat di canvas = apa yang tayang (WYSIWYG) karena editor dan publish memakai `packages/renderer` yang sama (lihat [07-publishing-hosting.md](./07-publishing-hosting.md)).
4. Menjadi permukaan kerja bersama antara manusia dan AI: setiap aksi AI ([04-ai-agent.md](./04-ai-agent.md)) terlihat di canvas, bisa di-undo, dan bisa diedit manual.
5. Menjadi alat produksi internal: tim membuat template & component di editor yang sama dalam **Admin mode** ([03-components-templates.md](./03-components-templates.md)).

### 1.2 Bukan tujuan (non-goals)

- Bukan tool ilustrasi vektor penuh (Pen tool hanya P2, boolean P2).
- Bukan tool prototyping aplikasi mobile (tidak ada smart animate antar frame, tidak ada device mockup).
- Tidak ada import file Figma (`.fig`) maupun plugin Figma.
- Tidak ada export kode React/HTML sebagai fitur produk (output = website live).
- Canvas **tidak** memakai WebGL/Canvas2D untuk konten. Semua node dirender sebagai DOM asli.

### 1.3 Istilah

| Istilah | Arti |
|---|---|
| Node | Elemen dalam document tree (frame, text, image, shape, icon, instance, section, dsb). Lihat [01](./01-document-model.md). |
| Frame | Node container (setara `div`). Bisa auto-layout (flex/grid) atau freeform (absolute + constraints). |
| Section | Frame level teratas di bawah root page; unit yang di-insert dari library ("Hero", "Footer"). |
| Page (website) | Halaman website dengan route (`/`, `/tentang`). Satu page = satu canvas. |
| Breakpoint frame | Tampilan page yang sama pada lebar tertentu (Desktop/Tablet/Mobile) yang ditampilkan berdampingan di canvas. |
| World / canvas space | Sistem koordinat canvas tak terbatas, satuan = CSS px pada zoom 100%. |
| Overlay | Layer DOM/SVG terpisah di atas world untuk handles, guides, outline, cursor kolaborator. |
| Instance | Node `instance`: `props.componentId` + `props.version` (integer) + `props.variant` + `props.propValues` + `props.overrides` + `props.slots` ([01 DM-018](./01-document-model.md#dm-018-instance)). Lifecycle di [03](./03-components-templates.md). |
| Token | Design variable (warna, font, spacing, radius, shadow) milik website; direferensikan sebagai `{ "$token": "color.primary" }` dengan path `<group>.<name>` ([01 DM-025](./01-document-model.md#dm-025-literal-vs-reference)). |
| Transaction | Sekumpulan perubahan Yjs yang dicatat sebagai satu langkah undo; selalu membawa origin `TxOrigin` ([01 DM-060](./01-document-model.md#dm-060-transaction-origin--undo-grouping)). |

---

## 2. Prinsip UX & Mode Editor

### 2.1 Prinsip UX

1. **Familiar bagi pengguna Figma**: shortcut, nama panel, dan perilaku drag sama kecuali ada alasan web-spesifik. Jika berbeda, tampilkan tooltip penjelas.
2. **Web-first**: setiap kontrol harus punya arti CSS yang jelas. Kontrol yang tidak bisa dirender di web (mis. stroke "outside" pada teks) disembunyikan atau diberi peringatan.
3. **Aman untuk awam**: Simple mode menyembunyikan kontrol yang bisa "merusak" layout. Default selalu auto-layout & responsif.
4. **Tidak ada aksi destruktif tanpa undo**: semua perubahan dokumen lewat transaction yang bisa di-undo; aksi berat (hapus page, detach massal) memakai konfirmasi + undo.
5. **Instan**: input apa pun direfleksikan < 16 ms di canvas (lihat [§31](#31-performa--batasan)).
6. **Satu dokumen**: template, library, canvas manual, dan AI semuanya mengedit Yjs document yang sama.
7. **Bahasa**: UI dwibahasa (ID/EN). Istilah desain (Auto layout, Fill, Stroke, Hug) tetap English di kedua bahasa, dengan tooltip penjelas Bahasa Indonesia.

### ED-001 Dua level UI: Simple mode dan Design mode
- Prioritas: P0 · Fase: M4 (Design mode sudah ada sejak M2; Simple mode dirilis M4)
- Deskripsi: Editor memiliki dua level UI di atas dokumen yang sama. **Simple mode** untuk user awam (edit konten template), **Design mode** untuk kontrol penuh ala Figma.
- Perilaku:
  - **Simple mode** menampilkan:
    - Toolbar atas ringkas: Pages dropdown, Undo/Redo, device switcher, Preview, Publish, tombol AI, toggle mode.
    - Left sidebar hanya tab **Pages**, **Insert** (section & block jadi), **Theme** (warna brand, font, logo — memetakan ke token, lihat [§15](#15-design-tokens-variables--styles)).
    - Right sidebar **Content panel**: field form berdasarkan `props` instance yang terseleksi (teks, gambar, link, list item) — bukan properti CSS.
    - Canvas: hover menampilkan outline section; klik teks → langsung edit inline; klik gambar → popover "Ganti gambar"; klik section → toolbar mengambang (Naik, Turun, Duplikat, Hapus, Ganti variant, "Edit dengan AI").
    - Tidak ada resize handles, rotate, freeform positioning, constraints, effects, atau layers tree.
  - **Design mode** menampilkan semua fitur di dokumen ini.
  - Mode adalah **preferensi UI per user per website** (disimpan di user settings, bukan di dokumen). Perubahan dokumen yang dibuat di Design mode tetap tampil benar di Simple mode.
  - Default: website dibuat dari template → Simple mode; website kosong/dari canvas → Design mode. User baru ditanya sekali saat onboarding ("Saya ingin edit konten" / "Saya ingin mendesain bebas").
- Edge case:
  - Node di dalam instance library mengikuti `ComponentDefinition.nodeAccess[nodeId].simpleAccess` (`locked`/`content`/`visibility`/`style-basic`, [01 DM-079](./01-document-model.md#dm-079-metadata-library-pada-componentdefinition)); default `locked` kecuali node yang ber-`$prop`.
  - Node yang bukan instance (dibuat manual di Design mode) tetap bisa diedit di Simple mode: text → edit inline; image → ganti; lainnya → hanya bisa dipilih di level section.
  - Instance yang sudah di-detach diperlakukan seperti node manual.
  - Jika seleksi aktif saat pindah mode berisi node yang tidak bisa dipilih di Simple mode, seleksi dinaikkan ke section induknya.
- Shortcut: `Mod+Shift+M` toggle Simple/Design mode.
- Acceptance criteria:
  - [ ] Toggle mode tidak mengubah Yjs document (tidak ada update yang terkirim).
  - [ ] Di Simple mode, user bisa: ganti teks, ganti gambar, tambah section dari Insert, reorder section, hapus section, ganti warna brand — tanpa melihat satu pun input CSS.
  - [ ] Preferensi mode bertahan setelah reload.
  - [ ] Seleksi dipertahankan/di-promote dengan benar saat pindah mode.

### ED-002 Perpindahan mode & discoverability
- Prioritas: P0 · Fase: M4
- Deskripsi: Cara berpindah antar mode harus jelas dan tidak menakutkan.
- Perilaku:
  - Toggle segmented control "Simple | Design" di toolbar atas (kanan, sebelum Preview).
  - Saat pertama kali masuk Design mode, tampilkan coach-mark 3 langkah (Layers, Design panel, Auto layout) yang bisa di-skip.
  - Di Simple mode, double-click pada elemen non-editable menampilkan hint "Butuh kontrol lebih? Buka Design mode" dengan tombol.
  - Command palette: perintah "Switch to Design mode" / "Switch to Simple mode".
- Edge case: Saat dalam text editing, toggle mode menyelesaikan (commit) edit teks terlebih dahulu.
- Acceptance criteria:
  - [ ] Toggle tersedia di toolbar, command palette, dan shortcut.
  - [ ] Coach-mark hanya muncul sekali per user (flag di user settings).

### ED-003 Admin mode
- Prioritas: P0 · Fase: M3
- Deskripsi: Mode khusus tim internal (`users.staff_role` = `designer`/`library_admin`/`super_admin`, daftar final di [08 §10.1](./08-accounts-plans-admin.md#101-role-staff)) untuk membuat & mempublikasikan component dan template di editor yang sama. Detail alur ada di [03-components-templates.md](./03-components-templates.md).
- Perilaku (ringkas, bagian editor saja):
  - Dibuka melalui admin panel (`apps/web`) → "Buka di editor (Admin)". Dokumen yang diedit adalah **library document** (bukan website user).
  - Tambahan UI: tab **Component** di right sidebar (definisi props schema, variant properties, slot, metadata kategori/tag, thumbnail), tombol **Publish version** di toolbar, badge "ADMIN" berwarna mencolok di toolbar.
  - Semua fitur Design mode tersedia. Simple mode bisa dipakai untuk "preview sebagai user".
- Edge case: Non-staff yang membuka URL admin mode → 404 (aturan 08 ACC-200); staff tanpa role library (`staff`) → read-only, mutasi ditolak 403.
- Acceptance criteria:
  - [ ] Badge ADMIN selalu terlihat saat Admin mode aktif.
  - [ ] Hak akses diverifikasi di server (API), bukan hanya disembunyikan di UI.

### ED-004 Preview mode di dalam editor
- Prioritas: P0 · Fase: M2
- Deskripsi: Mode interaktif tanpa chrome editor untuk mencoba link, hover state, animasi. Detail di [§27](#27-preview--publish-entry-point).
- Acceptance criteria:
  - [ ] Masuk/keluar preview dengan `Mod+Enter`/`Esc` tanpa kehilangan seleksi dan posisi kamera.

### ED-005 Read-only / view mode
- Prioritas: P1 · Fase: M9
- Deskripsi: Membuka editor tanpa izin edit (role viewer di paket Tim, atau saat website terkunci karena billing). Semua panel tampil read-only, input disabled, tools hanya Move (select, tanpa transform) dan Hand.
- Edge case: Downgrade paket membuat fitur tertentu terkunci (mis. halaman dinamis) — editor menampilkan banner, bukan read-only total. Aturan di [08-accounts-plans-admin.md](./08-accounts-plans-admin.md).
- Acceptance criteria:
  - [ ] Tidak ada Yjs update yang dikirim dari klien read-only (diblokir juga di server).

---

## 3. Layout UI Editor

### 3.1 Diagram (Design mode, desktop ≥ 1280px)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡ Logo] [Page: Home ▾]  │ ▸Move ▢Frame ▭Rect ◯Ellipse ╱Line T Text 🖼 Image ✦Icon ✋Hand │
│  Website: Toko Budi      │                      [↶][↷]  ● Tersimpan  [🖥 💻 📱 ▾ 1440]   │
│                          │          [Simple|Design]  [✨ AI]  [▶ Preview]  [Publish ▾]  👤 │
├──────────────┬───────────┴──────────────────────────────────────────────┬────────────────┤
│ Pages│Layers│ │  ┌ ruler horizontal ─────────────────────────────────┐  │ Design│Proto│  │
│ Assets│Insert│ │  │                                                   │  │ Data│Settings │
│──────────────│ │r │  Desktop 1440        Tablet 768     Mobile 390     │  │───────────────│
│ 🔍 Cari layer │ │u │ ┌──────────────┐   ┌──────────┐    ┌──────┐        │  │ Frame ▾  ⋯     │
│ ▾ ▢ Home      │ │l │ │ Navbar       │   │ Navbar   │    │ Nav  │        │  │ X 0   Y 0      │
│   ▾ ▢ Hero    │ │e │ │──────────────│   │──────────│    │──────│        │  │ W 1440 H 720   │
│     T Judul   │ │r │ │ Hero         │   │ Hero     │    │ Hero │        │  │ ⟲ 0°  ⊡ clip   │
│     T Sub     │ │  │ │  [Button]    │   │          │    │      │        │  │ Auto layout ▾  │
│     ◆ Button  │ │v │ │──────────────│   │──────────│    │      │        │  │ ↓ → ⤶  gap 24  │
│   ▸ ▢ Fitur   │ │e │ │ Fitur        │   │ Fitur    │    │      │        │  │ pad 64 / 120   │
│   ▸ ◆ Footer  │ │r │ └──────────────┘   └──────────┘    └──────┘        │  │ Fill  #FFFFFF  │
│              │ │t │                                                   │  │ Stroke  +      │
│              │ │  │                        [minimap P2]               │  │ Effects +      │
│              │ │  └───────────────────────────────────────────────────┘  │ Typography     │
│              │ │                                                         │ Export/Code ❌ │
├──────────────┴─┴──────────────────────────────────────────────────────────┴────────────────┤
│ Bottom bar: [− 100% +] [Fit] │ Seleksi: Frame "Hero" · 1440×720 │ Grid ▢ │ Node: 184/2000 │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                         ┌─────────────────────┐
                                         │ ✨ AI panel (dock    │  ← panel mengambang/dock kanan,
                                         │ kanan / floating)    │    lihat 04-ai-agent.md
                                         └─────────────────────┘
```

### 3.2 Diagram (Simple mode)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [≡] [Page: Home ▾]   [↶][↷] ● Tersimpan  [🖥 📱]  [Simple|Design] [✨AI] [▶] [Publish]│
├──────────────┬──────────────────────────────────────────────┬────────────────┤
│ Pages        │                                              │ Konten         │
│ Insert       │   ┌──────────────────────────────────┐       │ ───────────    │
│ Theme        │   │ Navbar                            │       │ Judul          │
│──────────────│   │──────────────────────────────────│       │ [Selamat ...]  │
│ + Tambah     │   │ Hero  ┌──────────────────────┐   │       │ Gambar         │
│   section    │   │       │ ↑ ↓ ⧉ 🗑 Variant ✨AI│   │       │ [🖼 Ganti]      │
│              │   │       └──────────────────────┘   │       │ Tombol: teks   │
│              │   │──────────────────────────────────│       │ Tombol: link   │
│              │   │ [+ Tambah section di sini]        │       │                │
└──────────────┴──────────────────────────────────────────────┴────────────────┘
```

### ED-006 Toolbar atas
- Prioritas: P0 · Fase: M2
- Deskripsi: Toolbar atas setinggi 48px berisi navigasi, tools, status, dan aksi utama.
- Perilaku (kiri → kanan):
  - **Menu utama (≡)**: Kembali ke dashboard, File (Rename website, Version history, Duplicate website), Edit (Undo, Redo, Copy, Paste, Select all), View (Rulers, Layout grids, Pixel grid, Outline mode P2, Zoom), Preferences (bahasa UI, nudge amount, snap), Help (shortcut sheet `Mod+Shift+/`, lihat [§25](#25-keyboard-shortcuts--command-palette)).
  - **Page switcher**: dropdown daftar page + "Tambah page".
  - **Tools**: Move (V), Frame (F/A), Section (Shift+S), Rectangle (R), Ellipse (O), Line (L), Text (T), Image (Shift+Mod+K), Icon (I... lihat tabel), Icon (Shift+I), Hand (H), Comment (C, P2), Pen (P, P2). Tool dengan sub-tool memakai dropdown kecil (mis. Rectangle/Ellipse/Line dikelompokkan sebagai "Shape").
  - **Undo/Redo** dengan tooltip nama aksi ("Undo: Ubah fill").
  - **Status autosave** (lihat [ED-200](#ed-200-autosave--status-indicator)).
  - **Breakpoint switcher** (lihat [§21](#21-responsif--breakpoint)).
  - **Mode toggle**, **AI**, **Preview**, **Publish** (dropdown: Publish, Lihat situs, Pengaturan domain).
  - Avatar user (dan avatar kolaborator P2).
- Edge case: Lebar < 1280px → tools dikelompokkan ke overflow menu "⋯"; < 1024px → tampilkan banner "Editor paling optimal di layar ≥ 1280px" (tetap bisa dipakai).
- Acceptance criteria:
  - [ ] Semua tombol punya tooltip dengan nama + shortcut.
  - [ ] Tool aktif ditandai jelas (state pressed + `aria-pressed`).

### ED-007 Left sidebar
- Prioritas: P0 · Fase: M2
- Deskripsi: Sidebar kiri (default 260px, resizable 200–480px, bisa di-collapse `Mod+\`) dengan tab:
  - **Pages** — daftar page website (lihat [§6](#6-pages-frames--breakpoint-frames)).
  - **Layers** — tree node page aktif (lihat [§16](#16-layers-panel)).
  - **Assets** — media library, components milik website, token/styles (lihat [§19](#19-assets--media), [§18](#18-components--instances-di-editor)).
  - **Insert** — component library jadi, section templates, blok dinamis (lihat [§20](#20-insert-panel)).
- Perilaku:
  - Pages dan Layers bisa ditampilkan bersamaan (Pages di atas, collapsible; Layers di bawah) seperti Figma. Assets & Insert adalah tab terpisah.
  - Lebar dan tab aktif disimpan di localStorage per user.
  - Shortcut: `Alt+1` Layers, `Alt+2` Assets, `Alt+3` Insert, `Alt+4` Pages (lihat tabel [§25](#25-keyboard-shortcuts--command-palette)).
- Acceptance criteria:
  - [ ] Resize sidebar tidak menyebabkan canvas "lompat" (kamera dipertahankan relatif ke pusat viewport).

### ED-008 Right sidebar (Inspector)
- Prioritas: P0 · Fase: M2 (tab Design & Settings), M3 (Component), P1 M4 (Prototype), M7 (Data)
- Deskripsi: Sidebar kanan (default 280px, resizable 240–400px) dengan tab:
  - **Design** — properti layout, posisi, ukuran, auto-layout, fill, stroke, effects, typography, layout grid. Isi tab berubah sesuai tipe seleksi.
  - **Prototype / Interactions** — link, hover/pressed state, animasi, scroll behavior (lihat [§22](#22-prototype--interactions)).
  - **Data** — binding ke collection, repeat list, form → collection (hanya untuk website dengan paket AI/dinamis; detail di [05-dynamic-data.md](./05-dynamic-data.md)). Tab terlihat dengan ikon gembok + CTA upgrade di paket yang tidak mendukung.
  - **Settings** — tag semantik HTML, id/anchor, alt text, aria-label, visibility per breakpoint, custom attributes terbatas, SEO page (jika root page terseleksi) (lihat [§28](#28-accessibility--seo), [§29](#29-semantic-html)).
  - (Admin mode) **Component** — lihat [ED-003](#ed-003-admin-mode).
- Perilaku:
  - Tanpa seleksi: tab Design menampilkan properti **page** (background page, layout grid page, token/Theme ringkas) dan daftar "Local styles".
  - Multi-seleksi: hanya properti bersama yang ditampilkan; nilai berbeda ditampilkan sebagai "Mixed" (placeholder italic). Mengubah nilai "Mixed" menerapkan ke semua.
  - Setiap section panel collapsible; status collapse disimpan.
  - Input numerik mendukung ekspresi matematika, scrub (drag label horizontal untuk ubah nilai), `↑/↓` ±1, `Shift+↑/↓` ±10 (lihat [ED-070](#ed-070-numeric-input--ekspresi-matematika)).
- Acceptance criteria:
  - [ ] Perubahan di inspector tercermin di canvas pada frame berikutnya (< 16 ms untuk seleksi ≤ 50 node).
  - [ ] Nilai "Mixed" ditampilkan benar untuk multi-seleksi dengan nilai berbeda.

### ED-009 Bottom bar & zoom control
- Prioritas: P0 · Fase: M2
- Deskripsi: Bar bawah 28px: kontrol zoom (−, persentase editable, +, dropdown: Zoom to fit `Shift+1`, Zoom to selection `Shift+2`, 50%, 100% `Shift+0`, 200%), info seleksi (tipe, nama, W×H), toggle Layout grid, indikator jumlah node page vs batas, indikator koneksi (online/offline).
- Perilaku: Bottom bar bisa disembunyikan via View menu. Zoom control boleh juga ditempatkan di toolbar atas jika ruang cukup (diputuskan saat implementasi UI).
- Acceptance criteria:
  - [ ] Mengetik "150" + Enter di kolom zoom → zoom 150% berpusat di tengah viewport.

### ED-010 AI panel
- Prioritas: P0 · Fase: M6
- Deskripsi: Panel AI (chat + aksi cepat) yang bisa di-dock di kanan (menggantikan/menumpuk right sidebar) atau floating. Perilaku agent, tools, skills, kredit: lihat [04-ai-agent.md](./04-ai-agent.md).
- Perilaku khusus editor:
  - Shortcut buka/tutup: `Mod+J` (bukan `Mod+I` karena `Mod+I` = italic saat text editing).
  - Konteks otomatis: seleksi saat ini, page aktif, breakpoint aktif dikirim sebagai konteks.
  - Model draft mengikuti [04 §7](./04-ai-agent.md#7-draft--transaction-model): agent bekerja di fork Y.Doc per run (origin `ai:<runId>`); editor menerima event SSE `draft.updated` (update Yjs + `touchedNodeIds`) dan memelihara `previewDoc` = dokumen utama + draft. Dokumen utama **tidak** berubah selama run.
  - Saat run selesai: kartu ringkasan dengan **Preview** (canvas me-render `previewDoc` read-only, node di `touchedNodeIds` di-highlight ungu, toggle Sebelum/Sesudah `\`), **Terapkan**, **Batalkan semua** ([04 AI-027](./04-ai-agent.md#ai-027-ringkasan-perubahan--preview--terapkan--batalkan-semua)).
  - **Terapkan** = `POST /v1/ai/runs/:runId/apply` → `undoManager.stopCapturing()`; seluruh update draft diterapkan dalam **satu** `doc.transact(…, ai:<runId>)`; `stopCapturing()` → satu item undo berlabel "AI: {judul run}".
  - Konflik: sebelum Terapkan, editor mengiris node yang diubah user sejak fork dengan `touchedNodeIds`; ada irisan → dialog konflik ([04 AI-123](./04-ai-agent.md#ai-123-konflik-dengan-edit-user-bersamaan)). User tetap bebas mengedit selama run (tidak ada lock).
  - Editor dibuka saat ada **pending draft** (run selesai ketika editor tertutup) → kartu ringkasan run ditampilkan lagi.
  - Perubahan non-dokumen (collection, workflow) dibatalkan lewat compensating actions ([04 AI-125](./04-ai-agent.md#ai-125-compensating-actions-perubahan-non-dokumen)).
  - Label progres di panel memakai `progressLabel` tool dengan nama tool resmi [04 §4](./04-ai-agent.md#4-tools) (mis. `insert_component`, `update_node_style`, `render_preview`); quick action mengikuti [04 AI-022](./04-ai-agent.md#ai-022-quick-actions).
  - Floating "✨" button di toolbar seleksi (Simple mode) dan di context menu: "Edit dengan AI…", "Buat variasi", "Tulis ulang teks".
- Acceptance criteria:
  - [ ] Satu `Mod+Z` setelah **Terapkan** membatalkan seluruh perubahan run tersebut.
  - [ ] Panel AI tidak menutupi selection handles node terseleksi (canvas otomatis menggeser kamera jika perlu).

### ED-011 Panel layout responsif & state UI
- Prioritas: P1 · Fase: M4
- Deskripsi: State UI (lebar sidebar, tab aktif, panel collapse, rulers on/off, zoom terakhir per page) disimpan di Zustand + localStorage per `websiteId`. Kamera (pan/zoom) per page dipulihkan saat kembali ke page tersebut.
- Edge case: localStorage penuh/tidak tersedia (Safari private) → fallback in-memory tanpa error.
- Acceptance criteria:
  - [ ] Reload editor mengembalikan page aktif, posisi kamera, dan tab sidebar.

### ED-012 UI Kit & theming editor
- Prioritas: P0 · Fase: M1
- Deskripsi: Chrome editor dibangun dengan shadcn/ui + Radix + Tailwind (`packages/ui`). Tema editor: light dan dark (ikuti OS, bisa dipaksa). Style editor TIDAK boleh bocor ke konten canvas dan sebaliknya (lihat [ED-016](#ed-016-isolasi-style-canvas-vs-chrome-editor)).
- Acceptance criteria:
  - [ ] Semua komponen UI editor memenuhi kontras WCAG AA di light dan dark.

---

## 4. Arsitektur Canvas DOM

### 4.1 Gambaran lapisan

```
#editor-viewport (position:relative; overflow:hidden; pointer events ditangkap di sini)
├── #world (position:absolute; transform: translate(tx,ty) scale(z); transform-origin: 0 0)
│   ├── [data-page-root] breakpoint frame "Desktop" (left: 0, top: 0, width: 1440)
│   │     └── node DOM hasil packages/renderer (mode: "editor")
│   ├── [data-page-root] breakpoint frame "Tablet"  (left: 1540, width: 768)
│   ├── [data-page-root] breakpoint frame "Mobile"  (left: 2408, width: 390)
│   └── [data-free-node] node bebas di area draft (P1, `page.props.drafts`)
├── #overlay (position:absolute; inset:0; pointer-events:none; SVG + div)
│   ├── hover outline, selection box, resize/rotate handles (pointer-events:auto pada handle)
│   ├── smart guides, distance labels, spacing indicators, auto-layout insertion marker
│   ├── marquee rectangle, frame labels (nama breakpoint frame)
│   └── kursor & seleksi kolaborator (P2)
├── #rulers (horizontal & vertical, canvas 2D kecil atau div)
└── #text-editor-host (Tiptap editor aktif ditempel di posisi node teks yang sedang diedit)
```

Prinsip: **world** berisi DOM yang sama dengan yang akan dipublish (dirender oleh `packages/renderer` dengan flag `mode: "editor"`), **overlay** digambar dalam koordinat **screen** (tidak ikut di-scale) sehingga garis 1px dan handle tetap tajam di zoom berapa pun.

### ED-013 World container dengan CSS transform
- Prioritas: P0 · Fase: M0
- Deskripsi: Pan/zoom diimplementasikan dengan satu `transform: translate3d(tx, ty, 0) scale(z)` pada `#world`. Node tidak pernah di-re-render karena pan/zoom.
- Perilaku:
  - State kamera `{ x, y, zoom }` disimpan di Zustand store terpisah (`cameraStore`) dan diterapkan ke DOM via `ref.style.transform` di `requestAnimationFrame` (bypass React render).
  - Selama gesture pan/zoom aktif: `will-change: transform` di `#world`. Setelah idle 150 ms: hapus `will-change` agar browser merasterisasi ulang teks dengan tajam pada zoom baru.
  - Batas zoom P0: **5% – 1600%** (DOM dengan scale ekstrem menimbulkan masalah presisi dan rasterisasi; Figma mendukung 2%–25600% tetapi berbasis WebGL).
  - Rumus konversi (`viewportRect` = bounding rect `#editor-viewport`):
    - `screenToWorld(sx, sy) = ((sx - viewportRect.left - cam.x) / cam.zoom, (sy - viewportRect.top - cam.y) / cam.zoom)`
    - `worldToScreen(wx, wy) = (wx * cam.zoom + cam.x + viewportRect.left, wy * cam.zoom + cam.y + viewportRect.top)`
- Edge case:
  - `devicePixelRatio` berubah (pindah monitor) → overlay dan rulers digambar ulang.
  - Safari: `will-change` berlebihan menyebabkan blur; implementasi harus diuji di Safari.
- Acceptance criteria:
  - [ ] Pan/zoom tidak memicu React commit pada komponen node (diverifikasi dengan React Profiler / counter render di test).
  - [ ] Teks tajam (tidak blur) 200 ms setelah zoom berhenti.
  - [ ] Fungsi `screenToWorld`/`worldToScreen` saling invers (unit test dengan property-based test, error < 1e-6).

> ✅ Diputuskan (M0 spike, T0.8.3, 2026-10-13): rentang zoom **5%–1600%**. 3200% lolos uji Chromium (60 fps, teks tajam) tetapi tidak dibutuhkan; bisa dinaikkan nanti lewat konstanta `MAX_ZOOM`.

### ED-014 Overlay layer
- Prioritas: P0 · Fase: M0
- Deskripsi: Semua elemen bantu editor (hover outline, selection box, handles, guides, label ukuran, marker insertion, marquee) digambar di `#overlay` dalam koordinat screen.
- Perilaku:
  - Overlay dirender oleh React tapi berlangganan ke `cameraStore` + `geometryStore` dengan selector sempit; update posisi via `transform` per elemen.
  - Handles memakai `pointer-events: auto`; sisanya `none`.
  - Ketebalan garis selalu 1px (selection) / 1px (guides) di screen space, warna aksen editor (biru) dan merah untuk spacing/distance.
  - Untuk node yang dirotasi, selection box digambar sebagai poligon (SVG) mengikuti rotasi.
- Acceptance criteria:
  - [ ] Overlay tetap sinkron dengan world saat pan cepat (tidak tertinggal > 1 frame).
  - [ ] Handles memiliki hit area minimal 8×8 px screen walau terlihat 6×6.

### ED-015 Koordinat: screen, world, node-local
- Prioritas: P0 · Fase: M0
- Deskripsi: Editor mengenal tiga sistem koordinat; semua fungsi geometri wajib menyebut sistem koordinatnya di nama/tipe.
- Perilaku:
  - **Screen**: `clientX/clientY` dari pointer event.
  - **World (canvas)**: satuan CSS px pada zoom 100%, origin = pojok kiri atas breakpoint frame Desktop page aktif.
  - **Node-local / parent-relative**: posisi node relatif ke content box parent (yang disimpan di dokumen untuk node absolute: `x`, `y`). Untuk node di dalam auto-layout, posisi dihitung oleh browser (flexbox) dan **tidak** disimpan.
  - Tipe branded TS: `type ScreenPoint = { x: number; y: number; __space: "screen" }`, `WorldPoint`, `LocalPoint`. Fungsi `worldToLocal(nodeId, p)` memperhitungkan transform rotasi semua ancestor.
  - Nilai yang ditampilkan di inspector (X, Y) = posisi relatif ke **parent frame** (seperti Figma), bukan world.
- Edge case: Node di dalam breakpoint frame Tablet: geometri diukur dari DOM breakpoint frame yang sedang **aktif** (lihat [§21](#21-responsif--breakpoint)).
- Acceptance criteria:
  - [ ] Unit test konversi bolak-balik untuk node bersarang 5 level dengan rotasi berbeda.

### ED-016 Isolasi style canvas vs chrome editor
- Prioritas: P0 · Fase: M0
- Deskripsi: CSS website user (reset, token, font) tidak boleh mempengaruhi UI editor, dan Tailwind editor tidak boleh mempengaruhi konten.
- Perilaku:
  - Opsi A (direkomendasikan untuk M0 spike): konten canvas di dalam **Shadow DOM** (`#world` attach shadow root) berisi stylesheet renderer + token CSS variables website.
  - Opsi B: semua class renderer di-prefix (`.pf-…`) dan Tailwind preflight editor di-scope ke `#editor-chrome`.
  - Font website dimuat via `FontFace` API (berlaku document-wide, aman).
- Acceptance criteria:
  - [ ] Website dengan `* { box-sizing: content-box; font-family: serif }` di custom CSS (jika ada) tidak merusak UI editor.

> ✅ Diputuskan (M0 spike, T0.8.1, 2026-10-13): **Opsi A Shadow DOM** — [ADR-012](../ARCHITECTURE.md#adr-012-isolasi-style-canvas-dengan-shadow-dom). Tiptap berjalan setara di shadow & prefix (Chromium/Firefox); uji manual Safari menyusul.

### ED-017 Renderer mode "editor"
- Prioritas: P0 · Fase: M1
- Deskripsi: `packages/renderer` merender node ke DOM yang sama dengan output publish, plus atribut tambahan untuk editor.
- Perilaku:
  - Setiap elemen node mendapat `data-node-id="<id>"`. Output publish tidak memuat atribut ini (publish memakai class/id minimal; lihat [07](./07-publishing-hosting.md)).
  - Link `<a>` dirender tanpa navigasi (handler `click` di-`preventDefault` di level viewport); form input `readonly`, `tabindex="-1"`.
  - Video/iframe embed dirender sebagai poster + overlay "▶" (tidak autoplay di editor).
  - Islands dinamis ([05](./05-dynamic-data.md)) dirender dengan **sample data** atau data collection nyata (mode "Data preview" toggle; data diambil lewat control plane `/v1/sites/:siteId/...`, bukan runtime). Di situs publish, island di-hydrate dengan runtime **Preact** (❓ OPEN, spike M7 — [07 PUB-029](./07-publishing-hosting.md#pub-029-islands-js-bundle)) dan memanggil `/_api/v1/*`.
  - Hover/pressed state tidak aktif di canvas kecuali sedang mengedit state tersebut ([§22](#22-prototype--interactions)).
  - Animasi scroll-reveal dinonaktifkan di canvas (elemen tampil di state akhir).
- Acceptance criteria:
  - [ ] Snapshot test: HTML editor-mode minus atribut `data-node-id` dan atribut editor == HTML publish untuk 20 fixture dokumen.

### ED-018 Rendering inkremental dari Yjs
- Prioritas: P0 · Fase: M1
- Deskripsi: Perubahan Yjs hanya me-render ulang node yang berubah.
- Perilaku:
  - Setiap node dirender oleh komponen `NodeView` yang berlangganan ke Y.Map node-nya (`observe`) melalui hook `useNode(id)` dengan cache snapshot immutable.
  - Perubahan pada `children` (Y.Array) hanya me-render parent.
  - Batch: semua observe dalam satu Yjs transaction digabung → satu React commit (`unstable_batchedUpdates`/React 18 automatic batching).
- Acceptance criteria:
  - [ ] Mengubah fill satu node pada page 2.000 node me-render ≤ 3 komponen (node, inspector, layer row).

### ED-019 Geometry store & pengukuran layout
- Prioritas: P0 · Fase: M0
- Deskripsi: Karena layout (flexbox, text wrapping) dihitung browser, editor harus **mengukur** DOM untuk mendapatkan bounding box setiap node.
- Perilaku:
  - `geometryStore` menyimpan `Map<nodeId, { worldRect, rotation, parentId }>` untuk breakpoint frame aktif.
  - Pengukuran: `ResizeObserver` per node + pengukuran ulang terjadwal (rAF) setelah setiap transaction yang mempengaruhi layout. Posisi dibaca via `getBoundingClientRect()` lalu dikonversi ke world (`/ zoom`) — dilakukan dalam satu batch read (hindari layout thrashing: semua read dulu, baru write).
  - Untuk node yang dirotasi, simpan juga ukuran asli (`offsetWidth/offsetHeight`) dan matriks transform agar overlay bisa menggambar poligon.
  - Saat pan/zoom, geometry world **tidak** berubah sehingga tidak perlu diukur ulang.
- Edge case:
  - Font belum termuat → ukuran teks berubah setelah load; `document.fonts.onloadingdone` memicu pengukuran ulang.
  - Gambar tanpa dimensi → placeholder ukuran tetap sampai `load`.
- Acceptance criteria:
  - [ ] Setelah drag resize, selection box cocok dengan bounding box DOM ±0.5px.
  - [ ] Tidak ada forced synchronous layout di dalam handler pointermove (diverifikasi di Performance panel saat M0).

### ED-020 Hit-testing
- Prioritas: P0 · Fase: M0
- Deskripsi: Menentukan node mana yang berada di bawah pointer, dengan aturan seleksi ala Figma.
- Perilaku:
  - Implementasi utama: `document.elementsFromPoint(x, y)` (atau `shadowRoot.elementsFromPoint`) lalu cari ancestor terdekat dengan `data-node-id`. Ini otomatis menangani z-order, overflow clip, dan rotasi.
  - Hasil difilter oleh aturan seleksi: node `locked`/`hidden` diabaikan; seleksi default memilih **top-level child dari konteks seleksi saat ini** (lihat [ED-051](#ed-051-aturan-kedalaman-seleksi-klik-tunggal)).
  - Spatial index (`rbush`) atas `geometryStore` dipakai untuk **marquee**, **snapping**, dan **culling** (bukan untuk klik).
  - Hover di-throttle per rAF.
- Edge case:
  - Node dengan `pointer-events: none` di style user → editor tetap harus bisa memilihnya: renderer mode editor tidak menerapkan `pointer-events` dari style user (disimpan tetapi hanya berlaku di publish).
  - Node transparan (fill kosong) tetap bisa dipilih di area bounding box-nya (frame kosong).
  - Teks: klik pada area kosong dalam box teks tetap memilih teks.
- Acceptance criteria:
  - [ ] Klik pada child yang terpotong (clip) di luar area parent tidak memilih child tersebut.
  - [ ] Hit-test 2.000 node < 1 ms rata-rata.

### ED-021 Virtualisasi & culling
- Prioritas: P1 · Fase: M2
- Deskripsi: Mengurangi biaya render untuk page besar dan banyak breakpoint frame.
- Perilaku:
  - Level 1 (P0, M2): breakpoint frame dan free node yang sepenuhnya di luar viewport (+ margin 1 layar) mendapat `content-visibility: hidden` + `contain-intrinsic-size` dari ukuran terakhir.
  - Level 2: section di dalam page frame memakai `content-visibility: auto`.
  - Level 3 (P2): breakpoint frame non-aktif di luar viewport di-unmount dan diganti bitmap snapshot (`createImageBitmap` dari render offscreen) — hanya jika profiling menunjukkan perlu.
  - Saat zoom < 25%, efek mahal (`backdrop-filter`, `filter: blur`, shadow besar) boleh dimatikan sementara selama gesture ("low-fidelity while moving").
- Edge case: Node yang di-cull tetap harus ada di `geometryStore` (pakai ukuran terakhir) agar snapping dan layer "zoom to" bekerja.
- Acceptance criteria:
  - [ ] Page 2.000 node dengan 3 breakpoint frame: pan/zoom 60fps di laptop referensi.

### ED-022 Target performa canvas
- Prioritas: P0 · Fase: M0 (target M0), M2 (target M2)
- Deskripsi: Target terukur untuk menjaga kualitas "mulus".
- Perilaku / target (laptop referensi: Intel i5 gen-10 / Apple M1, 8 GB RAM, Chrome stabil, 1080p):

| Skenario | Target M0 | Target M2 |
|---|---|---|
| Pan/zoom (trackpad) | 60fps @ 200 node | 60fps @ 2.000 node |
| Drag move 1 node (absolute) | 60fps @ 200 node | 60fps @ 2.000 node |
| Drag reorder dalam auto-layout | ≥ 50fps @ 200 node | ≥ 50fps @ 2.000 node |
| Resize frame auto-layout dengan 100 child | ≥ 45fps | ≥ 45fps |
| Klik → seleksi tampil | < 50 ms | < 50 ms |
| Ketik di inspector → canvas update | < 16 ms | < 16 ms |
| Load editor (dokumen 500 node, cache dingin) | — | < 3 s TTI |
| Switch page (1.000 node) | — | < 500 ms |

- Acceptance criteria:
  - [ ] Benchmark otomatis Playwright (trace FPS) dijalankan di CI nightly dengan fixture 200 dan 2.000 node; regresi > 20% gagal.

### ED-023 Interaction state machine
- Prioritas: P0 · Fase: M0
- Deskripsi: Semua interaksi pointer dikelola oleh satu state machine eksplisit agar tidak ada konflik (mis. drag vs marquee vs pan).
- Perilaku:
  - State: `idle`, `hovering`, `pressing`, `dragMove`, `dragResize`, `dragRotate`, `marquee`, `panning`, `drawing(tool)`, `textEditing`, `dragInsert` (dari Insert panel/asset), `dragReorder` (auto-layout), `vectorEditing` (P2).
  - Threshold drag: 3px screen sebelum `pressing` → `drag*` (mencegah klik bergeser).
  - Pointer capture (`setPointerCapture`) saat drag; `Esc` selama drag membatalkan dan mengembalikan state awal (perubahan sementara tidak di-commit ke Yjs — lihat [ED-024](#ed-024-preview-sementara-vs-commit)).
  - Implementasi: reducer TS murni (bisa di-unit-test) + adapter event DOM. Library state machine (XState) opsional.
- Acceptance criteria:
  - [ ] Unit test transisi untuk setiap pasangan state yang valid; event tak valid diabaikan tanpa error.

### ED-024 Preview sementara vs commit
- Prioritas: P0 · Fase: M0
- Deskripsi: Selama drag/resize, perubahan diterapkan sebagai **preview** (style DOM langsung / state lokal) dan baru di-commit ke Yjs saat pointerup sebagai satu transaction.
- Perilaku:
  - Preview move pada node absolute: ubah `transform: translate()` sementara pada elemen DOM.
  - Preview resize pada node auto-layout: perlu reflow nyata → tulis ke "ephemeral overrides" store yang dibaca renderer (bukan Yjs), lalu commit.
  - Commit = satu `doc.transact(…, userOrigin)` (`TxOrigin { kind: "user", sessionId }`, 01 DM-060) → satu langkah undo.
  - Untuk input scrub/slider di inspector: preview kontinu, commit saat lepas; perubahan keyboard (`↑`) commit langsung tapi digabung (captureTimeout 500 ms di UndoManager).
- Acceptance criteria:
  - [ ] Drag 2 detik menghasilkan tepat 1 Yjs update terkirim ke server dan 1 langkah undo.
  - [ ] `Esc` saat drag → dokumen identik dengan sebelum drag (deep equal).

### ED-025 Event handling & konflik browser
- Prioritas: P0 · Fase: M0
- Deskripsi: Mencegah perilaku default browser yang mengganggu.
- Perilaku:
  - `wheel` dengan `ctrlKey` (pinch trackpad) di-`preventDefault` (listener non-passive) agar browser tidak zoom halaman.
  - Mencegah `Mod+S` (simpan halaman), `Mod+P` (print), `Mod+D` (bookmark), `Mod+G` (find next) saat fokus di canvas.
  - Drag native gambar (`dragstart`) di world dimatikan.
  - `Space` menahan pan hanya saat fokus bukan di input/teks.
  - Context menu native diganti context menu editor ([§26](#26-context-menu)) kecuali di input teks.
- Acceptance criteria:
  - [ ] Pinch di trackpad Mac tidak pernah memperbesar UI editor (browser zoom).

---

## 5. Navigasi Canvas

### ED-026 Pan
- Prioritas: P0 · Fase: M0
- Deskripsi: Menggeser kamera canvas dengan berbagai input.
- Perilaku:
  - **Space + drag** (mouse kiri): kursor `grab` → `grabbing`. Melepas Space mengembalikan tool sebelumnya.
  - **Hand tool (H)**: drag kiri = pan permanen sampai tool diganti.
  - **Middle mouse drag**: pan dari tool apa pun.
  - **Trackpad two-finger scroll** / `wheel` tanpa modifier: pan vertikal & horizontal (`deltaX`, `deltaY`).
  - **Shift + wheel** (mouse): pan horizontal.
  - Inersia/momentum: mengikuti event OS (trackpad sudah memberi momentum); tidak menambahkan inersia buatan untuk mouse drag.
  - Pan tidak dibatasi (canvas tak terbatas), tetapi tombol "Kembali ke konten" muncul di bottom bar jika tidak ada node di viewport.
- Edge case:
  - Space ditekan saat text editing → mengetik spasi (tidak pan).
  - Space ditekan saat sedang drag move → pan sementara tanpa membatalkan drag (seperti Figma): posisi node tetap mengikuti pointer dalam world.
  - `deltaMode` = LINE (Firefox, mouse tertentu) → konversi ke px (×16).
- Acceptance criteria:
  - [ ] Pan via 4 metode di atas berfungsi di Chrome, Firefox, Safari (Mac & Windows).
  - [ ] Pan 60fps sesuai [ED-022](#ed-022-target-performa-canvas).

### ED-027 Zoom
- Prioritas: P0 · Fase: M0
- Deskripsi: Zoom kamera berpusat di pointer atau di pusat viewport.
- Perilaku:
  - **Ctrl/Cmd + wheel** dan **pinch trackpad** (browser mengirim `wheel` dengan `ctrlKey=true`): zoom berpusat di posisi pointer. Faktor: `zoom *= exp(-deltaY * 0.01)` (dikalibrasi agar terasa seperti Figma), clamp ke batas zoom.
  - **Safari gesture events** (`gesturestart/gesturechange`) ditangani untuk pinch di Safari.
  - `Mod+=` / `Mod++` / `+`: zoom in ke langkah berikutnya (preset: 5, 10, 25, 50, 75, 100, 150, 200, 400, 800, 1600 %), berpusat di tengah viewport (atau di tengah seleksi jika seleksi terlihat).
  - `Mod+-` / `-`: zoom out ke langkah sebelumnya.
  - **Z + klik** (tahan Z): zoom in di titik klik; **Z + Alt + klik**: zoom out. **Z + drag**: zoom ke area marquee (P1).
  - Rumus zoom di titik `p` (screen): `world = screenToWorld(p)`; set `zoom' `; lalu `cam.x = p.x - world.x * zoom'` (sama untuk y).
- Edge case:
  - Zoom saat drag move berlangsung → node tetap di bawah pointer.
  - Wheel event beruntun sangat cepat → akumulasi delta dan terapkan sekali per rAF.
- Acceptance criteria:
  - [ ] Titik world di bawah pointer tetap di bawah pointer selama zoom (error < 0.5px screen).
  - [ ] Zoom tidak pernah keluar dari rentang [ED-013](#ed-013-world-container-dengan-css-transform).

### ED-028 Zoom to fit, zoom to selection, 100%
- Prioritas: P0 · Fase: M2
- Deskripsi: Perintah zoom cepat.
- Perilaku:
  - `Shift+1` **Zoom to fit**: semua konten page (semua breakpoint frame + free node) masuk viewport dengan padding 48px screen.
  - `Shift+2` **Zoom to selection**: bounding box seleksi masuk viewport (padding 64px), zoom maksimal 400% untuk node kecil agar tidak terlalu besar.
  - `Shift+0` **Zoom 100%** berpusat di tengah viewport saat ini.
  - `Shift+N` / `Shift+P` (P1): zoom ke breakpoint frame berikutnya/sebelumnya.
  - Double-click nama breakpoint frame label di canvas: zoom to fit frame tersebut.
  - Transisi kamera dianimasikan 200 ms ease-out (bisa dimatikan di Preferences, dan otomatis mati jika `prefers-reduced-motion`).
- Acceptance criteria:
  - [ ] Zoom to selection pada node 4×4 px menghasilkan zoom ≤ 400%.
  - [ ] Zoom to fit pada page kosong → zoom 100% di origin.

### ED-029 Rulers
- Prioritas: P1 · Fase: M2
- Deskripsi: Penggaris horizontal & vertikal di tepi canvas (toggle `Shift+R`).
- Perilaku:
  - Satuan px, tick menyesuaikan zoom (interval 1/2/5/10/… ×10ⁿ agar label tidak bertumpuk).
  - Origin ruler = pojok kiri atas **frame induk** seleksi (seperti Figma) atau breakpoint frame aktif jika tidak ada seleksi.
  - Area seleksi di-highlight di ruler (pita biru muda) beserta angka start/end.
  - Drag dari ruler membuat **guide** (P2): garis panduan yang disimpan per page (bukan bagian output), bisa di-snap, dihapus dengan drag kembali ke ruler.
- Acceptance criteria:
  - [ ] Ruler tetap sinkron saat pan/zoom 60fps.

### ED-030 Minimap
- Prioritas: P2 · Fase: M9
- Deskripsi: Minimap kecil di pojok kanan bawah canvas berisi thumbnail kasar breakpoint frame (kotak + warna background) dan persegi viewport yang bisa di-drag.
- Acceptance criteria:
  - [ ] Drag persegi viewport di minimap menggeser kamera.

### ED-031 Navigasi via keyboard & pencarian
- Prioritas: P1 · Fase: M2
- Deskripsi: Navigasi tanpa mouse.
- Perilaku:
  - `Tab` / `Shift+Tab` saat seleksi ada: pilih sibling berikutnya/sebelumnya (seperti Figma).
  - `Enter` masuk ke child pertama, `Shift+Enter` / `\` pilih parent (lihat [§8](#8-selection)).
  - `Mod+F` (P1): cari layer berdasarkan nama/teks di page aktif → hasil menyorot node dan zoom to selection.
  - Command palette "Go to page…" (lihat [§25](#25-keyboard-shortcuts--command-palette)).
- Acceptance criteria:
  - [ ] Seluruh navigasi seleksi bisa dilakukan tanpa mouse.

---

## 6. Pages, Frames & Breakpoint Frames

### 6.1 Model konseptual

Berbeda dari Figma (Page = kanvas berisi banyak frame bebas), di Platform:

- **Page = halaman website** dengan route (`/`, `/produk`, `/blog/[slug]` untuk dinamis). Struktur data page ada di [01-document-model.md](./01-document-model.md).
- Setiap page punya **satu root node** (`page root`) = node `type: "page"` itu sendiri ([01 DM-010](./01-document-model.md#dm-010-page)), selalu flex column, `children` = **sections** (frame `props.role: "section"`).
- Di canvas, root page yang sama ditampilkan sebagai beberapa **breakpoint frame** (Desktop 1440, Tablet 768, Mobile 390 = `previewWidth` default [01 DM-035](./01-document-model.md#dm-035-definisi-breakpoint), + custom) berdampingan. Ini **bukan salinan**: semua breakpoint frame merender tree yang sama dengan style breakpoint masing-masing ([§21](#21-responsif--breakpoint)).
- Hanya satu breakpoint frame yang **aktif** (tempat edit berlaku dan geometry diukur). Klik di breakpoint frame lain mengaktifkannya.
- **Draft area** (P1): area canvas di luar breakpoint frame tempat user boleh menaruh node bebas (eksplorasi, potongan). Node di draft area **tidak dipublish**.

```
Canvas page "Home"
 ┌─ Desktop 1440 (aktif) ─┐   ┌─ Tablet 768 ─┐   ┌ Mobile 390 ┐      ┌ Draft area ┐
 │ page root (VStack)      │   │ (tree sama)  │   │ (tree sama)│      │ node bebas  │
 │  ├ Section: Navbar      │   │              │   │            │      │ tidak publish│
 │  ├ Section: Hero        │   │              │   │            │      └─────────────┘
 │  └ Section: Footer      │   │              │   │            │
 └─────────────────────────┘   └──────────────┘   └────────────┘
```

### ED-032 Pages panel
- Prioritas: P0 · Fase: M2
- Deskripsi: Mengelola daftar page website.
- Perilaku:
  - Daftar page dengan ikon (🏠 home, 📄 statis, 🔗 dinamis/template collection, ⚠️ 404).
  - Aksi: Tambah page (`+` → kosong / dari template page / duplikat), rename (double-click), ubah slug/route, duplikat, hapus (konfirmasi + undo), set as home, reorder (drag; urutan hanya untuk tampilan & default navbar).
  - Folder/nesting page (P1): `/layanan/web` ditampilkan sebagai child dari `/layanan`.
  - Klik page → canvas berpindah ke page tersebut dengan kamera terakhir page itu.
  - Halaman sistem: 404 (P0), halaman dinamis per collection item (M7, [05](./05-dynamic-data.md)), halaman checkout/keranjang (M8, [06](./06-commerce-payments.md)) — bisa diedit tapi tidak bisa dihapus selama fitur aktif.
- Edge case:
  - Slug bentrok → validasi inline "Slug sudah dipakai".
  - Slug dengan karakter non-ASCII → di-slugify otomatis (`Tentang Kami` → `tentang-kami`), user bisa edit.
  - Menghapus page yang dirujuk link di page lain → tampilkan daftar link yang akan rusak; link berubah status "broken" (warning di inspector Prototype).
  - Batas jumlah page per paket (`pages.perSiteMax`, [08](./08-accounts-plans-admin.md)) → tombol tambah disabled + CTA upgrade; server/command menolak dengan `PLAN_LIMIT`.
- Acceptance criteria:
  - [ ] CRUD page tercermin di Yjs document & bisa di-undo.
  - [ ] Route unik per website divalidasi di klien dan server.

### ED-033 Page settings
- Prioritas: P0 · Fase: M2 (SEO detail M4)
- Deskripsi: Saat page root terseleksi (atau via "⋯ → Page settings"), tab Settings menampilkan pengaturan page: nama, slug, title & meta description, OG image, noindex, password protect (P2), custom head code (tidak didukung, lihat [§28](#28-accessibility--seo)). Detail SEO di [07](./07-publishing-hosting.md).
- Acceptance criteria:
  - [ ] Preview snippet Google (title/description terpotong sesuai panjang) tampil di panel.

### ED-034 Breakpoint frames di canvas
- Prioritas: P0 · Fase: M2
- Deskripsi: Menampilkan page di beberapa lebar sekaligus.
- Perilaku:
  - Default tampil: Desktop (1440). Tablet & Mobile bisa ditampilkan berdampingan via toggle "Tampilkan semua device" di breakpoint switcher, atau hanya satu (mode fokus).
  - Jarak antar frame 100px world; label nama + lebar di atas frame (overlay), klik label = pilih page root di breakpoint itu & aktifkan.
  - Tinggi frame = tinggi konten (hug) dengan minimal 1 viewport tinggi preset (Desktop 900, Tablet 1024, Mobile 812); garis putus-putus "fold" menandai tinggi viewport.
  - Lebar frame bisa di-drag di tepi kanan untuk mensimulasi lebar arbitrer (preview fluid) — **tidak** membuat breakpoint baru; nilai kembali ke preset saat dilepas kecuali di-pin (P1).
  - Breakpoint custom: tambah lebar bebas (mis. 1920, 1280) sebagai **preview width** tambahan (bukan breakpoint style baru). Breakpoint style tetap `base/tablet/mobile` sesuai [01](./01-document-model.md).
- Edge case:
  - Node terseleksi di frame Desktop, user klik frame Mobile → seleksi dipertahankan (node yang sama), breakpoint aktif berganti, inspector menampilkan nilai mobile.
  - Node hidden di breakpoint tertentu tampil di layers sebagai redup dengan ikon 🚫📱.
- Acceptance criteria:
  - [ ] Edit teks di frame Desktop langsung terlihat di frame Tablet & Mobile (konten tidak per breakpoint).
  - [ ] Perubahan style di frame Mobile (dengan override aktif) tidak mengubah Desktop.

> ❓ OPEN: Apakah preview width custom disimpan per website (dokumen) atau per user (UI state)? Usulan: per user (UI state).

### ED-035 Draft area (node di luar page)
- Prioritas: P1 · Fase: M4
- Deskripsi: User bisa menaruh frame/node di luar breakpoint frame sebagai scratch.
- Perilaku:
  - Node di draft area disimpan di `page.props.drafts` ([01 DM-080](./01-document-model.md#dm-080-draft-area-scratch-per-page)), diberi badge "Draft — tidak dipublish".
  - Drag node dari page ke draft area = memindahkan (command `moveNode` dengan `area: "drafts"`); sebaliknya juga bisa.
  - Node draft memakai posisi absolute world.
- Edge case: AI tidak menulis ke draft area kecuali diminta.
- Acceptance criteria:
  - [ ] Publish tidak menyertakan node draft (test snapshot output).

### ED-036 Page root & section ordering
- Prioritas: P0 · Fase: M2
- Deskripsi: Page root adalah node `page` (bukan frame terpisah): tidak bisa dihapus, dipindah, atau di-resize lebar (lebar = viewport), auto-layout vertikal dengan gap 0 default.
- Perilaku:
  - Section bisa di-reorder dengan drag di canvas (marker insertion horizontal antar section), di layers, atau tombol ↑/↓ di toolbar section (Simple mode).
  - `Mod+]` / `Mod+[` pada section = pindah satu posisi ke bawah/atas (bring forward/send backward pada konteks auto-layout = urutan flow).
  - Properti page root yang bisa diubah: background, padding, max content width (container default, mis. 1200px — diterapkan via token `container`), font default.
- Acceptance criteria:
  - [ ] Page root tidak muncul dengan handle resize; Delete pada page root tidak melakukan apa-apa (toast "Halaman tidak bisa dihapus dari sini").

---

## 7. Tools

### 7.1 Ringkasan

| Tool | Shortcut | Klik | Drag | Shift | Alt | Prioritas |
|---|---|---|---|---|---|---|
| Move/Select | `V` | pilih | move / marquee | tambah ke seleksi; constrain axis | duplikat saat drag; tampilkan jarak | P0 |
| Scale (K) | `K` | — | resize proporsional termasuk teks/stroke | — | dari tengah | P2 |
| Frame | `F` / `A` | buat frame 100×100 | buat frame sesuai drag | persegi | dari tengah | P0 |
| Section | `Shift+S` | sisip section kosong di posisi | — | — | — | P0 |
| Rectangle | `R` | 100×100 | sesuai drag | persegi | dari tengah | P0 |
| Ellipse | `O` | 100×100 | sesuai drag | lingkaran | dari tengah | P0 |
| Line | `L` | panjang 100 horizontal | sesuai drag | snap 15° | dari tengah | P1 |
| Arrow | `Shift+L` | — | sesuai drag | snap 15° | — | P2 |
| Text | `T` | auto-width text | fixed-width text | — | — | P0 |
| Image | `Shift+Mod+K` | buka file picker | area placeholder | aspect | — | P0 |
| Icon | `Shift+I` | buka icon picker | — | — | — | P0 |
| Hand | `H` | — | pan | — | — | P0 |
| Pen | `P` | titik | kurva bezier | snap 45° | patahkan handle | P2 |
| Comment | `C` | taruh pin komentar | — | — | — | P2 |

### ED-037 Model tool umum
- Prioritas: P0 · Fase: M0
- Deskripsi: Aturan umum yang berlaku untuk semua tool pembuat node (Frame, Rectangle, Ellipse, Line, Text, Image).
- Perilaku:
  - Setelah membuat satu node, tool kembali ke **Move** (seperti Figma). Tahan `Shift` saat memilih tool lewat toolbar atau double-click ikon tool → **tool lock** (P1) sampai `Esc`/`V`.
  - **Parent tujuan** ditentukan oleh titik awal drag: frame terdalam (yang bukan instance terkunci & bukan teks) yang memuat titik tersebut di breakpoint frame aktif. Jika titik di luar semua breakpoint frame → draft area (P1) atau, jika draft area belum tersedia, toast "Gambar di dalam halaman".
  - Jika parent tujuan **auto-layout**: node baru disisipkan sebagai child flow pada indeks terdekat dari titik pointer (marker insertion tampil sebelum klik/drag). Ukuran hasil drag menjadi `width/height` fixed, kecuali ukuran drag < 2px (klik) → ukuran default.
  - Jika parent **freeform**: node diposisikan absolute di titik drag, constraints default `left/top`.
  - Nama default: "Frame 1", "Rectangle 2", … (counter per page per tipe). Teks dinamai dari kontennya (40 karakter pertama) sampai di-rename manual.
  - `Esc` saat drawing → batal tanpa membuat node.
  - Node baru langsung terseleksi.
- Edge case:
  - Drag dimulai di dalam instance component → node dibuat di parent instance (instance tidak menerima child kecuali melalui slot, lihat [03](./03-components-templates.md)). Jika instance punya slot di titik tersebut → masuk ke slot.
  - Drag dimulai di atas node teks → parent = parent teks tersebut.
  - Ukuran negatif (drag ke kiri/atas) → dinormalisasi.
- Acceptance criteria:
  - [ ] Membuat Rectangle di frame auto-layout menyisipkannya di indeks yang ditunjuk marker.
  - [ ] Satu pembuatan node = satu langkah undo.

### ED-038 Move/Select tool
- Prioritas: P0 · Fase: M0
- Deskripsi: Tool default untuk memilih, memindahkan, dan mengubah ukuran.
- Perilaku:
  - Klik = pilih (aturan kedalaman di [§8](#8-selection)). Klik di area kosong = clear seleksi.
  - Drag pada node terseleksi/tidak terseleksi = pilih lalu move ([§9](#9-transformasi)).
  - Drag di area kosong (atau di atas page root / breakpoint frame background) = marquee.
  - Double-click: frame/group → masuk ke children (pilih child di bawah pointer); teks → mode edit teks; image → buka crop/replace popover; instance → masuk ke node di dalam instance (lihat [§18](#18-components--instances-di-editor)); vector (P2) → vector edit.
  - Hover menampilkan outline biru tipis pada node yang akan terpilih bila diklik.
- Acceptance criteria:
  - [ ] Semua perilaku klik/double-click di atas tercakup Playwright test.

### ED-039 Frame tool & preset device
- Prioritas: P0 · Fase: M2
- Deskripsi: Membuat frame (container `div`).
- Perilaku:
  - `F` atau `A`. Klik → frame 100×100; drag → ukuran sesuai drag.
  - Saat Frame tool aktif, right sidebar menampilkan **preset**: Desktop (1440×900), Laptop (1280×800), Tablet (768×1024), Mobile (375×812), Mobile L (430×932), Card (360×240), Banner (1200×630 / OG image), Square (1080×1080). Klik preset → frame ukuran tersebut di draft area/di dalam parent terpilih.
  - Default style frame baru: fill putih (`#FFFFFF`) jika top-level di draft area; transparan jika di dalam page; clip content off; layout: freeform. Preferensi "Auto layout by default" (P1) membuat frame baru langsung auto-layout vertikal.
  - Frame yang dibuat dengan menggambar mengelilingi node yang sudah ada (drag yang sepenuhnya melingkupi node sibling) → node-node tersebut **otomatis di-reparent** ke frame baru (perilaku Figma). Bisa dimatikan dengan menahan `Mod` saat melepas (P1).
- Edge case: Frame dibuat di dalam auto-layout parent dengan drag melingkupi sibling → tidak melakukan auto-wrap (ambigu); hanya sisip.
- Acceptance criteria:
  - [ ] Klik preset Mobile menghasilkan frame 375×812.
  - [ ] Auto-wrap sibling terjadi hanya pada parent freeform.

### ED-040 Section tool
- Prioritas: P0 · Fase: M2
- Deskripsi: Menambahkan section kosong ke page root (frame `props.role: "section"`, tag `<section>`, lebar penuh, auto-layout vertikal, padding token `section-y` / `container-x`, berisi inner container max-width).
- Perilaku:
  - `Shift+S` lalu klik di posisi antar section (marker insertion horizontal tampil) → section baru tinggi 480px.
  - Alternatif: tombol "+" yang muncul saat hover di batas antar section (Simple & Design mode) → membuka mini Insert panel berisi section template ([§20](#20-insert-panel)).
  - Konversi: frame top-level di page root bisa "Convert to section" (context menu).
- Acceptance criteria:
  - [ ] Section baru memiliki struktur `section > div.container` (frame role `section` berisi frame role `container`, [01 DM-011](./01-document-model.md#dm-011-frame-termasuk-auto-layout--grid)).

### ED-041 Rectangle tool
- Prioritas: P0 · Fase: M2
- Deskripsi: Shape persegi panjang. Dirender sebagai `div` dengan background/border-radius (bukan SVG) agar ringan & responsif.
- Perilaku: Klik → 100×100; drag → ukuran drag; `Shift` = persegi; `Alt` = dari tengah; `Shift+Alt` = persegi dari tengah. Fill default `#D9D9D9`.
- Acceptance criteria:
  - [ ] Output publish rectangle = satu elemen `div` dengan class style, tanpa SVG.

### ED-042 Ellipse tool
- Prioritas: P0 · Fase: M2
- Deskripsi: Elips/lingkaran = `div` dengan `border-radius: 50%`.
- Perilaku: Sama dengan rectangle (`O`). Arc/donut (sweep, ratio) seperti Figma → **tidak dibuat** di P0/P1 (P2, butuh SVG).
- Acceptance criteria:
  - [ ] Shift+drag menghasilkan W = H.

### ED-043 Line tool
- Prioritas: P1 · Fase: M2
- Deskripsi: Garis lurus. Horizontal/vertikal dirender sebagai `div` (height = stroke weight) atau `<hr>` jika tag dipilih; garis miring dirender sebagai `div` dengan rotasi.
- Perilaku: Drag dari titik A ke B; `Shift` snap ke kelipatan 15°; panjang & sudut diedit di inspector (W = panjang, rotation). Stroke weight default 1, warna `#000`. Arrowhead (P2, SVG).
- Edge case: Line di dalam auto-layout → diperlakukan sebagai child dengan width Fill (divider) jika horizontal.
- Acceptance criteria:
  - [ ] Garis horizontal di auto-layout vertikal dengan width Fill menghasilkan divider responsif.

### ED-044 Text tool
- Prioritas: P0 · Fase: M2
- Deskripsi: Membuat node teks.
- Perilaku:
  - `T` lalu **klik** → teks **auto width** (melebar mengikuti isi) dengan kursor aktif; **drag** → teks **fixed width** (auto height) selebar drag.
  - Style awal = text style default website (token "Body") atau style teks terakhir yang dipakai user di sesi ini (P1, seperti Figma).
  - `Esc` atau klik di luar → selesai edit; jika teks kosong → node dihapus (tanpa langkah undo tambahan).
  - Tag default `p`; jika dibuat di section kosong pertama dan ukuran font ≥ 32 → saran tag `h1`/`h2` (hint di Settings, tidak otomatis).
- Edge case: Paste teks panjang multi-paragraf ke text tool → satu node teks dengan banyak paragraf.
- Acceptance criteria:
  - [ ] Klik-ketik-Esc menghasilkan node teks auto width dengan konten yang benar.
  - [ ] Teks kosong tidak meninggalkan node yatim.

### ED-045 Image tool
- Prioritas: P0 · Fase: M2
- Deskripsi: Menyisipkan gambar.
- Perilaku:
  - `Shift+Mod+K` → file picker (multi-select). Setelah pilih, kursor menjadi "stamp" berisi thumbnail; klik untuk menaruh tiap gambar dengan ukuran natural (dibatasi maksimal lebar parent), atau drag untuk ukuran custom (aspect terkunci).
  - Gambar ditaruh sebagai node `image` (`<img>` dengan `srcset` di publish) — bukan rectangle dengan image fill. Image fill pada frame tetap tersedia ([§13](#13-properti-visual)).
  - Upload berjalan di background dengan progress overlay di node; node bisa diedit selama upload.
  - Alternatif: drag-drop file dari OS, paste dari clipboard, insert dari Assets ([§19](#19-assets--media)).
- Edge case:
  - Upload gagal → node menampilkan state error + tombol "Coba lagi"/"Hapus".
  - File bukan gambar / > batas ukuran → toast error, node tidak dibuat.
- Acceptance criteria:
  - [ ] Insert 5 gambar sekaligus menghasilkan 5 node dengan urutan klik.
  - [ ] Alt text kosong memicu warning aksesibilitas ([§28](#28-accessibility--seo)).

### ED-046 Icon tool
- Prioritas: P0 · Fase: M2
- Deskripsi: Menyisipkan ikon dari set **Lucide** (searchable).
- Perilaku:
  - `Shift+I` → popover icon picker: search (nama & sinonim Bahasa Indonesia, mis. "keranjang" → `shopping-cart`), kategori, recent.
  - Klik ikon → disisipkan di posisi insertion/di tengah viewport; ukuran default 24×24, warna `currentColor` (mengikuti warna teks parent) atau token.
  - Node icon menyimpan `iconSet: "lucide"`, `name`, `strokeWidth`; dirender sebagai inline SVG di publish (hanya ikon yang dipakai).
  - Ganti ikon: pilih node → inspector "Icon: [nama] ▾" membuka picker.
- Edge case: Lucide versi baru menghapus ikon → renderer fallback ke ikon `help-circle` + warning di editor. Versi Lucide dipin per website (lihat [01](./01-document-model.md)).
- Acceptance criteria:
  - [ ] Mencari "rumah" menemukan `home`/`house`.
  - [ ] Ikon mewarisi warna dari parent bila color = currentColor.

### ED-047 Hand tool
- Prioritas: P0 · Fase: M0
- Deskripsi: `H`; drag = pan; tidak memilih node. Kursor `grab`/`grabbing`.
- Acceptance criteria:
  - [ ] Klik dengan Hand tool tidak mengubah seleksi.

### ED-048 Pen / vector tool
- Prioritas: P2 · Fase: M9
- Deskripsi: Membuat path vektor (SVG) dengan titik & kurva bezier; vector edit mode (double-click vector) untuk edit titik, `Shift` snap 45°, `Alt` patahkan handle, `Mod` pilih titik, `Enter`/`Esc` selesai. Output = inline SVG.
- Edge case: Vector network kompleks (seperti Figma) tidak didukung; hanya path tunggal / compound path.
- Acceptance criteria:
  - [ ] Path tertutup bisa diberi fill; path terbuka hanya stroke.

### ED-049 Comment tool
- Prioritas: P2 · Fase: M9
- Deskripsi: `C` → klik untuk menaruh pin komentar yang terikat ke node (fallback ke koordinat world). Detail di [§33](#33-kolaborasi-di-editor).
- Acceptance criteria:
  - [ ] Klik dengan Comment tool membuat pin di titik klik dan membuka input komentar.

### ED-050 Element dasar web tambahan
- Prioritas: P0 · Fase: M2 (Button, Link, Divider, Embed video) · P1 (Embed HTML terbatas)
- Deskripsi: Elemen web yang tidak ada di Figma tapi penting untuk website. Diakses lewat Insert panel ([§20](#20-insert-panel)) bagian "Basic", bukan toolbar.
- Perilaku:
  - **Button**: frame auto-layout horizontal + text (+ icon opsional) dengan tag `a`/`button`, state hover/pressed bawaan.
  - **Link text**: range teks dengan link ([§14](#14-typography)).
  - **Divider**: line horizontal width Fill.
  - **Video embed**: YouTube/Vimeo URL → iframe lazy (poster di editor).
  - **Map embed**: Google Maps URL/alamat → iframe lazy.
  - **Embed HTML** (P1): hanya whitelist provider (YouTube, Vimeo, Google Maps, Spotify, Instagram post) — tidak ada HTML/JS bebas (konsisten dengan prinsip blok aman).
  - Pemetaan ke node type 01: Button = frame `props.role: "button"` (atau instance component button); Divider = `shape` line; Video = node `video` ([01 DM-020](./01-document-model.md#dm-020-video)); Map/Embed = node `embed` iframe allowlist ([01 DM-021](./01-document-model.md#dm-021-embed-html-terbatas)).
  > ❓ OPEN: prioritas berbeda — 02 menempatkan Video & Map embed di P0·M2, 01 menempatkan `video` P1·M4 dan `embed` P2·M9 (node `map` khusus = OPEN-DM-3). Samakan saat menyusun ROADMAP.
- Acceptance criteria:
  - [ ] URL YouTube biasa (`watch?v=`) dan pendek (`youtu.be`) dikenali.

---

## 8. Selection

### ED-051 Aturan kedalaman seleksi (klik tunggal)
- Prioritas: P0 · Fase: M0
- Deskripsi: Klik memilih node pada "level konteks" yang tepat, meniru Figma.
- Perilaku:
  - **Konteks seleksi** = parent dari seleksi saat ini (atau page root jika tidak ada seleksi).
  - Klik pada titik `p`: ambil path node dari hit-test (terdalam → page root). Pilih node **teratas pada path yang merupakan child langsung dari konteks** atau siblings/ancestors-siblings dari seleksi saat ini.
  - Praktiknya: klik pertama di page memilih **section**; klik berikutnya pada child di section yang sama (setelah double-click masuk) memilih child; klik di section lain kembali memilih section lain di level setara.
  - Pengecualian: node **teks** dan **image** di dalam frame yang **bukan** section/instance boleh langsung terpilih bila frame induknya sudah terseleksi atau sedang "masuk" (entered).
  - Group (lihat [§17](#17-group-frame-boolean--mask)) selalu dipilih utuh sebelum anak-anaknya.
  - Instance dipilih utuh; child instance hanya lewat double-click / deep select.
- Edge case:
  - Node yang lebih kecil dari 4px screen tetap bisa dipilih lewat layers atau deep select.
  - Klik pada area clip tersembunyi (child yang overflow) tidak memilih apa pun di situ.
- Acceptance criteria:
  - [ ] Pada fixture "landing page", klik pertama di judul hero memilih section Hero; double-click memilih container; double-click lagi memilih teks judul (atau masuk edit jika sudah terpilih).

### ED-052 Multi-select (Shift)
- Prioritas: P0 · Fase: M2
- Deskripsi: `Shift+klik` menambah/mengurangi node dari seleksi (toggle).
- Perilaku:
  - Node yang ditambahkan memakai aturan kedalaman yang sama, relatif terhadap konteks node yang diklik.
  - Seleksi boleh berisi node dari parent berbeda (seperti Figma); operasi yang memerlukan parent sama (Group, Auto layout, Align ke parent) akan menyesuaikan (lihat masing-masing requirement).
  - Bounding box gabungan + handle resize kolektif digambar di overlay; tiap node juga diberi outline tipis.
  - Di layers panel: `Shift+klik` = range select, `Mod+klik` = toggle (konvensi tree).
- Edge case: Seleksi campur node dari breakpoint frame berbeda tidak mungkin (seleksi bersifat logical node id, ditampilkan di breakpoint aktif).
- Acceptance criteria:
  - [ ] Shift+klik node terseleksi menghapusnya dari seleksi.

### ED-053 Marquee selection
- Prioritas: P0 · Fase: M0
- Deskripsi: Drag di area kosong membuat kotak seleksi.
- Perilaku:
  - Node terpilih jika bounding box-nya **bersinggungan** (intersect) dengan marquee (default Figma) — node yang terpilih adalah child dari **frame tempat marquee dimulai** (atau top-level jika mulai di luar).
  - Mulai drag di dalam frame yang tidak terseleksi tetapi berisi children: drag pada frame background = move frame; untuk marquee di dalam frame, frame harus "entered" atau tahan `Mod` (P1) saat mulai drag.
  - `Shift+marquee` menambah ke seleksi.
  - Highlight hover live untuk node yang akan terpilih selama marquee.
  - Query memakai spatial index `rbush` ([ED-020](#ed-020-hit-testing)).
- Edge case: Marquee pada page root (mulai di background page frame) memilih section yang tersentuh.
- Acceptance criteria:
  - [ ] Marquee pada 2.000 node update ≤ 4 ms per frame.

### ED-054 Deep select (Mod+klik)
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+klik` memilih node **terdalam** di bawah pointer, mengabaikan aturan kedalaman (termasuk menembus group dan instance).
- Perilaku:
  - `Mod+Shift+klik` = deep select tambah ke seleksi.
  - `Mod+drag` dari area kosong = marquee deep (memilih node terdalam yang tersentuh) — P1.
  - Selama tombol `Mod` ditahan, hover outline menunjukkan node terdalam.
  - Klik kanan → "Select layer ▸" menampilkan daftar semua node pada titik tersebut (stack), seperti Figma.
- Acceptance criteria:
  - [ ] Mod+klik pada teks di dalam instance di dalam section langsung memilih teks tersebut.

### ED-055 Select parent / child / sibling
- Prioritas: P0 · Fase: M2
- Deskripsi: Navigasi hierarki dengan keyboard.
- Perilaku:
  - `Enter`: pilih semua child langsung dari node terseleksi (Figma). Jika node teks → masuk text editing. Jika image → buka replace popover.
  - `Shift+Enter` atau `\`: pilih parent.
  - `Tab` / `Shift+Tab`: sibling berikutnya/sebelumnya (wrap around).
  - `Esc`: jika sedang text editing → keluar edit (node tetap terpilih); jika ada seleksi → clear seleksi. Naik ke parent hanya dengan `Shift+Enter` / `\`.
- Acceptance criteria:
  - [ ] Shift+Enter pada section memilih page root; pada page root tidak melakukan apa-apa.

### ED-056 Select all
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+A` memilih semua sibling dalam konteks seleksi saat ini (semua child dari parent seleksi); tanpa seleksi = semua section di page root (breakpoint aktif).
- Perilaku: Saat text editing, `Mod+A` = pilih semua teks di node tersebut.
- Acceptance criteria:
  - [ ] Mod+A dengan satu card terpilih di grid card memilih semua card di grid tersebut.

### ED-057 Select matching layers
- Prioritas: P1 · Fase: M4
- Deskripsi: `Mod+Alt+A` memilih semua node di page yang "serupa" dengan seleksi.
- Perilaku: Kriteria serupa: tipe sama + nama sama, atau untuk instance: component sama. Opsi di context menu: "Select all with same fill", "…same font", "…same component" (P2).
- Acceptance criteria:
  - [ ] Pada 10 instance Button, select matching memilih 10 instance.

### ED-058 Seleksi di dalam instance
- Prioritas: P0 · Fase: M3
- Deskripsi: Child di dalam instance bisa dipilih untuk override properti yang diizinkan.
- Perilaku:
  - Double-click instance → masuk; child terpilih ditandai outline ungu (warna component). Inspector hanya menampilkan properti yang **boleh di-override** (teks, fill, image, visibility, icon — aturan di [03](./03-components-templates.md); node `nodeAccess.hardLocked` tidak bisa di-override sama sekali, 01 DM-079); properti struktural (layout, posisi, menambah child) terkunci dengan ikon 🔒 dan hint "Edit main component atau Detach".
  - Drag move child instance tidak diizinkan (kecuali di dalam slot).
  - Delete child instance = set `visible: false` override (bukan hapus), seperti Figma.
- Acceptance criteria:
  - [ ] Mengubah teks child instance membuat override tercatat dan indikator override muncul ([§18](#18-components--instances-di-editor)).

### ED-059 Lock & hide
- Prioritas: P0 · Fase: M2
- Deskripsi: Mengunci node agar tidak bisa dipilih di canvas, atau menyembunyikannya.
- Perilaku:
  - `Mod+Shift+L` lock/unlock; `Mod+Shift+H` hide/show. Juga ikon di layers panel (muncul saat hover; tetap terlihat jika aktif).
  - **Lock**: node & semua descendant tidak bisa dipilih/digeser di canvas (tetap bisa dipilih di layers; inspector tetap bisa mengubah). Lock adalah state editor (disimpan di dokumen agar persisten, tidak mempengaruhi output).
  - **Hide**: node tidak dirender di canvas (`display: none` di editor), redup di layers. Di output publish juga **tidak dirender** (beda dengan "hide per breakpoint" di [§21](#21-responsif--breakpoint) yang memakai media query).
  - "Show all hidden"/"Unlock all" di context menu page.
- Edge case:
  - Hide node yang sedang terseleksi → tetap terseleksi (outline putus-putus) sampai seleksi berubah.
  - Node hidden di dalam auto-layout tidak memakan ruang (konsisten dengan `display:none`).
- Acceptance criteria:
  - [ ] Node locked tidak terpilih oleh klik maupun marquee.
  - [ ] Node hidden tidak ada di HTML publish.

### ED-060 Visual seleksi & label ukuran
- Prioritas: P0 · Fase: M0
- Deskripsi: Tampilan seleksi.
- Perilaku:
  - Outline biru 1px, 8 handle (4 sudut + 4 sisi) 6×6 putih bergaris biru; handle sisi disembunyikan bila node < 24px screen (hanya sudut).
  - Label ukuran `W × H` di bawah seleksi (badge biru); untuk auto-layout child dengan Hug/Fill, label menampilkan "Hug"/"Fill" (mis. `Fill × 48`).
  - Untuk frame auto-layout terseleksi: padding ditampilkan (area pink transparan) saat hover di area padding; gap ditampilkan saat hover di antara child, dan bisa di-drag untuk mengubah nilai (P1, seperti Figma).
  - Nama node/frame tampil di label atas untuk frame top-level.
- Acceptance criteria:
  - [ ] Handle tidak ikut membesar saat zoom.

### ED-061 Sinkronisasi seleksi
- Prioritas: P0 · Fase: M1
- Deskripsi: Seleksi disimpan di Zustand `selectionStore` (array node id + anchor), **bukan** di Yjs. Canvas, layers, inspector, dan AI panel membaca store yang sama.
- Perilaku:
  - Node yang dihapus (oleh undo, AI, atau kolaborator) otomatis dikeluarkan dari seleksi.
  - Seleksi dipulihkan oleh undo/redo (UndoManager menyimpan seleksi di `stackItem.meta`) — lihat [§24](#24-undoredo-history--autosave).
  - Untuk multiplayer (P2), seleksi disiarkan via Yjs awareness.
- Acceptance criteria:
  - [ ] Hapus → undo mengembalikan node dan seleksinya.

---

## 9. Transformasi

### ED-062 Move dengan drag (node absolute / freeform)
- Prioritas: P0 · Fase: M0
- Deskripsi: Memindahkan node yang berada di parent freeform.
- Perilaku:
  - Drag node terseleksi → posisi baru = posisi awal + delta world (dibulatkan ke pixel grid jika snap pixel aktif).
  - `Shift` saat drag: constrain ke sumbu dominan (horizontal/vertikal/45° P1).
  - `Alt` saat mulai drag (atau ditekan saat drag): **duplikat** node lalu pindahkan duplikatnya (lihat [ED-071](#ed-071-duplikat-dengan-altdrag)).
  - `Mod` saat drag: nonaktifkan snapping sementara.
  - **Reparent saat drag**: jika pointer masuk ke frame lain (bukan descendant node yang di-drag) dan ditahan 0 ms (langsung, seperti Figma), node pindah parent; untuk frame auto-layout → mode reorder ([ED-063](#ed-063-move-di-dalam-auto-layout-reorder--reparent)). Untuk mencegah reparent, tahan `Mod` (P1); `Space` tetap berfungsi sebagai pan sementara.
  - Keluar dari parent yang `clip content` → node tetap terlihat di overlay (ghost) selama drag.
- Edge case:
  - Drag node keluar dari breakpoint frame → masuk draft area (P1) atau tertahan di tepi page (P0).
  - Drag dalam breakpoint non-Desktop dengan override aktif → mengubah `x/y` breakpoint tersebut saja.
- Acceptance criteria:
  - [ ] Drag + Shift hanya mengubah satu sumbu.
  - [ ] Reparent mempertahankan posisi visual (koordinat dikonversi ke parent baru).

### ED-063 Move di dalam auto-layout (reorder & reparent)
- Prioritas: P0 · Fase: M2
- Deskripsi: Child auto-layout tidak punya posisi bebas; drag = mengubah urutan atau parent.
- Perilaku:
  - Saat drag, node asli tetap di tempat (redup 40%) dan "ghost" mengikuti pointer; **insertion marker** (garis biru 2px tegak lurus arah layout) tampil di indeks tujuan. Lepas → node dipindah ke indeks tersebut.
  - Alternatif mode "live reorder" (child bertukar posisi secara animasi saat drag, seperti Figma terbaru) — P1.
  - Drag keluar dari parent ke frame lain → marker di parent baru (auto-layout) atau posisi absolute (freeform).
  - Arrow keys pada child auto-layout: `←/↑` pindah satu indeks sebelumnya, `→/↓` sesudahnya (sesuai arah layout).
  - Untuk wrap layout: indeks dihitung dari baris & kolom terdekat.
- Edge case:
  - Child dengan `position: absolute` di dalam auto-layout ([ED-088](#ed-088-absolute-position-di-dalam-auto-layout)) bergerak bebas seperti freeform.
  - Drag section di page root = reorder section.
  - Drag ke dalam instance (bukan slot) ditolak (kursor 🚫).
- Acceptance criteria:
  - [ ] Reorder via drag dan via arrow keys menghasilkan urutan `children` Yjs yang benar.
  - [ ] Marker insertion selalu muncul sebelum lepas.

### ED-064 Nudge dengan keyboard
- Prioritas: P0 · Fase: M2
- Deskripsi: `Arrow` = geser 1px, `Shift+Arrow` = 10px (nilai "big nudge" bisa diubah di Preferences, default 10).
- Perilaku:
  - Berlaku untuk node absolute/freeform. Child auto-layout → reorder ([ED-063](#ed-063-move-di-dalam-auto-layout-reorder--reparent)).
  - Nudge beruntun digabung menjadi satu langkah undo jika jeda < 500 ms.
- Acceptance criteria:
  - [ ] 10× Arrow dalam 1 detik = 1 langkah undo.

### ED-065 Resize dengan handle
- Prioritas: P0 · Fase: M0
- Deskripsi: Mengubah ukuran via 8 handle dan tepi seleksi.
- Perilaku:
  - Handle sudut: ubah W & H; handle sisi / drag tepi (hit area 6px di sepanjang tepi): ubah satu dimensi. Kursor resize sesuai arah (memperhitungkan rotasi node).
  - Nilai dibulatkan ke integer (atau 0.5 jika preferensi subpixel aktif — P2).
  - Resize melewati sisi berlawanan → **flip** (W negatif dinormalisasi; node di-flip seperti Figma) — untuk node non-teks. Untuk teks, ukuran clamp minimal 1px.
  - Resize child auto-layout: dimensi yang di-drag berubah menjadi **Fixed** (dari Hug/Fill), sama seperti Figma.
  - Resize frame Hug: dimensi berubah menjadi Fixed.
  - Resize teks auto-width secara horizontal → berubah menjadi fixed width (auto height).
  - Children frame freeform mengikuti **constraints** masing-masing ([§12](#12-constraints-frame-non-auto-layout)); tahan `Mod` saat resize = abaikan constraints (children tidak ikut) — P1.
- Edge case:
  - Image: resize bebas mengubah aspect; image fit `cover` mencegah distorsi.
  - Minimal 1×1 px; maksimal 100.000 px.
- Acceptance criteria:
  - [ ] Resize handle kiri tidak menggeser tepi kanan (error < 0.5px).
  - [ ] Resize child Fill → menjadi Fixed dan inspector menampilkan "Fixed".

### ED-066 Modifier resize: Shift (aspect) & Alt (dari tengah)
- Prioritas: P0 · Fase: M2
- Deskripsi: Modifier saat resize.
- Perilaku:
  - `Shift`: pertahankan aspect ratio (pada handle sisi, dimensi lain ikut skala dari tengah sisi).
  - `Alt`: resize simetris dari pusat.
  - `Shift+Alt`: keduanya.
  - Node dengan "Constrain proportions" aktif di inspector (ikon gembok antara W/H) selalu menjaga aspect tanpa Shift.
- Acceptance criteria:
  - [ ] Alt+resize handle kanan sebesar +20 menambah W sebesar 40 dan X berkurang 20.

### ED-067 Resize multi-seleksi
- Prioritas: P1 · Fase: M2
- Deskripsi: Bounding box gabungan di-resize; tiap node diskalakan posisinya & ukurannya secara proporsional relatif ke bounding box.
- Edge case: Seleksi berisi child auto-layout dan node absolute → hanya ukuran yang berubah untuk child auto-layout (posisi dikendalikan flex).
- Acceptance criteria:
  - [ ] Dua kotak 100×100 berjarak 100 di-resize 2× → kotak 200×200 berjarak 200.

### ED-068 Rotate
- Prioritas: P1 · Fase: M4
- Deskripsi: Rotasi node via hover di luar handle sudut (kursor rotate) atau input rotation di inspector.
- Perilaku:
  - Drag rotate: sudut kontinu, `Shift` snap 15°. Pusat rotasi = tengah node.
  - Output CSS: `transform: rotate(Ndeg)` (tidak mempengaruhi flow layout — sama seperti CSS; diberi tooltip "Rotasi tidak mempengaruhi tata letak di sekitarnya").
  - Rotasi pada child auto-layout diizinkan (visual saja).
- Edge case: Rotasi + resize: resize dilakukan dalam koordinat lokal node (handle mengikuti rotasi).
- Acceptance criteria:
  - [ ] Shift+rotate menghasilkan kelipatan 15°.

### ED-069 Flip
- Prioritas: P1 · Fase: M4
- Deskripsi: `Shift+H` flip horizontal, `Shift+V` flip vertical → CSS `scale(-1,1)` / `scale(1,-1)` digabung dengan rotate.
- Edge case: Flip teks membuat teks terbalik (diizinkan, dengan warning a11y ringan). Flip image diterapkan ke `<img>`.
- Acceptance criteria:
  - [ ] Flip 2× kembali ke state awal (tanpa transform tersisa di output).

### ED-070 Numeric input & ekspresi matematika
- Prioritas: P0 · Fase: M2
- Deskripsi: Input X, Y, W, H, rotation, dan semua input numerik di inspector menerima ekspresi.
- Perilaku:
  - Operator: `+ - * / ( )`, persen relatif nilai saat ini (`50%` dari nilai sekarang untuk W/H — P1), unit opsional `px`. Contoh: `100+20` → 120; `W*2` (P2 variabel); `/2` saat nilai 300 → 150 (operasi relatif bila diawali operator, seperti Figma).
  - Parser aman (bukan `eval`) — tokenizer kecil + shunting-yard; hasil dibulatkan sesuai presisi field (0 desimal untuk px default, 2 desimal untuk opacity/line-height ratio).
  - Multi-seleksi: ekspresi relatif (`+10`) diterapkan ke masing-masing node; nilai absolut diterapkan sama ke semua.
  - Scrub: drag label (mis. "W") ke kiri/kanan mengubah nilai ±1 per px (`Shift` ×10, `Alt` ×0.1 untuk nilai desimal).
  - `↑/↓` ±1, `Shift+↑/↓` ±10; `Enter` commit; `Esc` batal; `Tab` pindah field berikutnya dan commit.
  - Input mendukung nilai khusus: `auto`/`hug`/`fill` di W/H (mengubah sizing mode), token (`$spacing-4`, lihat [§15](#15-design-tokens-variables--styles)).
- Edge case:
  - Ekspresi invalid (`10++`) → field merah berkedip, nilai kembali ke sebelumnya.
  - Pembagian dengan 0 → invalid.
  - Nilai di luar batas (W < 0) → clamp ke minimum dengan toast ringan.
- Acceptance criteria:
  - [ ] `100+20` → 120; `(10+5)*2` → 30; `/2` pada 300 → 150; `abc` → invalid tanpa exception.
  - [ ] Unit test parser ≥ 30 kasus.

### ED-071 Duplikat dengan Alt+drag
- Prioritas: P0 · Fase: M2
- Deskripsi: `Alt` + drag membuat salinan dan memindahkannya; original tetap di tempat.
- Perilaku: Di auto-layout, duplikat disisipkan di indeks tujuan. Setelah Alt+drag, `Mod+D` mengulang offset yang sama (smart duplicate, P1) — seperti Figma.
- Acceptance criteria:
  - [ ] Alt+drag = 1 langkah undo (duplikat + move).

### ED-072 Align & distribute
- Prioritas: P0 · Fase: M2
- Deskripsi: Tombol align di bagian atas tab Design.
- Perilaku:
  - Align left/center-h/right/top/center-v/bottom (`Alt+A/H/D/W/V/S`).
  - Satu node absolute terseleksi → align relatif ke parent. Multi → relatif ke bounding box seleksi.
  - Distribute horizontal/vertical spacing (`Alt+Shift+H` / `Alt+Shift+V`) untuk ≥ 3 node.
  - **Tidy up** (`Ctrl+Alt+T`) P2.
  - Child auto-layout: tombol align mengubah **alignment parent** (atau `align-self` P1) — tooltip menjelaskan.
- Acceptance criteria:
  - [ ] Distribute 3 node dengan jarak tak sama menghasilkan jarak sama (±0.5px).

---

## 10. Smart Guides, Snapping & Pengukuran

### ED-073 Smart guides & snapping ke node lain
- Prioritas: P0 · Fase: M2
- Deskripsi: Saat move/resize/draw node absolute, editor menampilkan guide merah/magenta dan men-snap ke tepi dan pusat node lain.
- Perilaku:
  - Kandidat snap: tepi kiri/kanan/atas/bawah dan center-x/center-y dari: sibling, parent (termasuk padding box), dan node lain yang terlihat di viewport dalam frame yang sama (dibatasi 200 node terdekat via `rbush`).
  - Threshold snap: 5px **screen** (berarti lebih kecil di world saat zoom in).
  - Garis guide memanjang di antara node yang di-snap, dengan tanda "×" kecil di titik snap.
  - Snap independen per sumbu.
  - Tahan `Mod` saat drag → nonaktif sementara.
- Edge case: Node rotasi menggunakan bounding box AABB untuk snapping.
- Acceptance criteria:
  - [ ] Drag node mendekati tepi sibling (≤ 5px screen) → posisi pas sejajar.
  - [ ] Perhitungan snap < 2 ms per pointermove (200 kandidat).

### ED-074 Snap ke pixel grid
- Prioritas: P0 · Fase: M2
- Deskripsi: Posisi & ukuran dibulatkan ke integer px (default aktif; toggle di Preferences "Snap to pixel grid" dan View menu).
- Perilaku: Pixel grid (garis 1px abu-abu) ditampilkan saat zoom ≥ 800% (toggle `Shift+'`).
- Acceptance criteria:
  - [ ] Dengan snap aktif, X/Y/W/H hasil drag selalu integer.

### ED-075 Layout grid (kolom) & snap ke grid
- Prioritas: P1 · Fase: M4
- Deskripsi: Frame bisa diberi layout grid: **columns** (count, gutter, margin, type stretch/center/left), **rows**, **grid** (ukuran sel). Toggle tampil: lihat baris "Layout grids" di [ED-203](#ed-203-tabel-shortcut-lengkap).
- Perilaku:
  - Layout grid adalah **alat bantu visual** (tidak dirender di output), tapi kolom bisa dipakai sebagai target snap.
  - Layout grid bisa berbeda per breakpoint (desktop 12 kolom, tablet 8, mobile 4) — default dari token container.
  - Bila frame memakai CSS Grid layout ([ED-097](#ed-097-grid-layout-css-grid)), layout grid visual mengikuti grid nyata.
- Acceptance criteria:
  - [ ] Node di-drag mendekati tepi kolom ter-snap.

### ED-076 Pengukuran jarak (Alt hover)
- Prioritas: P0 · Fase: M2
- Deskripsi: Dengan node terseleksi, tahan `Alt` dan hover node lain → garis merah dengan label jarak (px) antara keduanya (atas/bawah/kiri/kanan).
- Perilaku:
  - Hover parent → jarak ke tepi parent.
  - Hover di dalam auto-layout → menampilkan padding & gap.
  - Label memakai nilai world (dibulatkan 0 desimal; 1 desimal jika ada pecahan).
- Acceptance criteria:
  - [ ] Jarak yang ditampilkan sama dengan selisih geometry DOM (±0.5px).

### ED-077 Equal spacing indicators
- Prioritas: P1 · Fase: M2
- Deskripsi: Saat memindahkan node di antara ≥ 2 sibling, jika jarak sama tercapai, tampil indikator jarak sama (garis pink + label) dan node di-snap ke posisi tersebut.
- Acceptance criteria:
  - [ ] Tiga kotak dapat diatur berjarak sama hanya dengan drag dan snap.

### ED-078 Pengaturan snapping
- Prioritas: P1 · Fase: M4
- Deskripsi: Preferences: Snap to objects, Snap to pixel grid, Snap to layout grid, Show distance on hover, Nudge amount. Disimpan per user.
- Acceptance criteria:
  - [ ] Mematikan "Snap to objects" menghilangkan guide.

---

## 11. Auto-layout & Grid Layout

Auto-layout adalah **fondasi responsif**. Setiap frame auto-layout dirender sebagai `display: flex`. Platform **menganjurkan auto-layout sebagai default** (section & template selalu auto-layout); freeform hanya untuk komposisi dekoratif.

### 11.1 Mapping auto-layout → CSS (normatif)

| Properti editor | Nilai | CSS pada frame (parent) | Catatan |
|---|---|---|---|
| Direction | Horizontal | `display:flex; flex-direction:row` | |
| Direction | Vertical | `display:flex; flex-direction:column` | |
| Wrap | On (hanya Horizontal) | `flex-wrap:wrap` | Row gap terpisah (`row-gap`) |
| Gap | Fixed `n` | `gap:n px` (atau `column-gap`/`row-gap` saat wrap) | Token spacing → `var(--space-x)` |
| Gap | Auto | `justify-content:space-between` | Gap fixed diabaikan |
| Padding | T/R/B/L | `padding: T R B L` | Mode "Horizontal/Vertical" atau per sisi |
| Alignment (row) | 9-titik (x: start/center/end, y: start/center/end) | x → `justify-content`, y → `align-items` | Pada column: x → `align-items`, y → `justify-content` |
| Alignment | Baseline (row text) | `align-items:baseline` | P1 |
| Reverse z-order ("Canvas stacking") | First on top | z-index pada children | P2 |
| Clip content | On | `overflow:hidden` (atau `clip`) | |

| Sizing child | Dalam parent Horizontal | Dalam parent Vertical |
|---|---|---|
| Width **Fixed** `n` | `width:n px; flex-shrink:0` | `width:n px` |
| Width **Hug** | `width:auto; flex:0 0 auto` (fit-content) | `width:fit-content` / `align-self` sesuai alignment |
| Width **Fill** | `flex:1 1 0; min-width:0` | `align-self:stretch; width:auto` |
| Height **Fixed** `n` | `height:n px` | `height:n px; flex-shrink:0` |
| Height **Hug** | `height:auto` (fit-content) | `height:auto; flex:0 0 auto` |
| Height **Fill** | `align-self:stretch` | `flex:1 1 0; min-height:0` |
| Min/Max W/H | `min-width`, `max-width`, `min-height`, `max-height` | sama |
| Absolute position | `position:absolute; left/top/right/bottom` sesuai constraints | parent mendapat `position:relative` |

Sizing frame **sendiri** (bukan sebagai child): Hug = ukuran mengikuti konten (`width:fit-content`/`height:auto`), Fixed = nilai px, Fill = hanya bermakna bila parent auto-layout. Pada breakpoint mobile, renderer boleh menerapkan aturan auto-responsive ([ED-175](#ed-175-auto-responsive-rules)).

> Tabel di atas adalah kontrak antara editor dan `packages/renderer`. Perubahan wajib diikuti snapshot test renderer.

### ED-079 Add / remove auto-layout
- Prioritas: P0 · Fase: M2
- Deskripsi: `Shift+A` menambahkan auto-layout.
- Perilaku:
  - Pada **frame** freeform terseleksi: frame menjadi auto-layout; direction ditebak dari posisi children (jika children tersusun lebih banyak secara horizontal → Horizontal); urutan children diurutkan berdasarkan posisi (kiri→kanan atau atas→bawah); gap = median jarak antar children (dibulatkan); padding = jarak minimum children ke tepi frame; sizing frame = Hug di kedua sumbu kecuali frame adalah section (width Fill).
  - Pada **multi-seleksi** node (non-frame atau campuran) dengan parent sama: bungkus dengan frame auto-layout baru (seperti Figma) di posisi bounding box seleksi, dengan heuristik yang sama.
  - Pada node tunggal non-frame (mis. teks): bungkus dalam frame auto-layout (padding 0) — berguna untuk membuat button.
  - `Shift+Alt+A` (atau tombol "Remove auto layout"): frame kembali freeform; posisi children dipertahankan secara visual (dikonversi ke absolute x/y).
- Edge case: Seleksi berisi node dari parent berbeda → tombol disabled dengan tooltip "Pilih layer dengan parent yang sama".
- Acceptance criteria:
  - [ ] Tiga teks bertumpuk vertikal → Shift+A menghasilkan frame vertical dengan gap = jarak median, tanpa perubahan visual > 1px.
  - [ ] Remove auto layout tidak menggeser posisi visual children.

### ED-080 Direction & wrap
- Prioritas: P0 · Fase: M2 (wrap P0)
- Deskripsi: Pilihan direction: **Vertical** (↓), **Horizontal** (→), **Wrap** (⤶, horizontal + wrap).
- Perilaku:
  - Tidak ada shortcut khusus (`Shift+V` dipakai Flip vertical); gunakan tombol inspector atau command palette "Auto layout: Horizontal/Vertical/Wrap".
  - Mengganti direction: child dengan Fill di sumbu lama ditukar sizing-nya secara masuk akal (Fill width ↔ Fill height) — sesuai perilaku Figma.
  - Wrap memunculkan field **row gap** (vertical gap) dan opsi **align content** (P1).
- Acceptance criteria:
  - [ ] Wrap dengan 10 card lebar 300 di frame 1000 → 3 per baris (dengan gap 20).

### ED-081 Gap (spacing between items)
- Prioritas: P0 · Fase: M2
- Deskripsi: Gap fixed (angka/token) atau **Auto** (space-between).
- Perilaku:
  - Input gap mendukung ekspresi & token.
  - Drag gap di canvas (hover area antar child → kursor resize → drag) mengubah nilai (P1).
  - Gap negatif (P2): Figma mengizinkan; CSS `gap` tidak → dirender dengan `margin` negatif pada child ke-2..n. Hingga diimplementasikan, input menolak nilai < 0.
- Acceptance criteria:
  - [ ] Gap Auto menghasilkan `justify-content: space-between` di output.

### ED-082 Padding
- Prioritas: P0 · Fase: M2
- Deskripsi: Padding horizontal/vertical (2 input) atau per sisi (4 input, toggle ikon).
- Perilaku: Drag area padding di canvas (P1); `Alt` saat drag padding = ubah sisi berlawanan juga; `Shift` = semua sisi.
- Acceptance criteria:
  - [ ] Mode per sisi menyimpan 4 nilai independen.

### ED-083 Alignment 9-titik
- Prioritas: P0 · Fase: M2
- Deskripsi: Grid 3×3 klik untuk alignment; pada Gap Auto, grid berubah menjadi 3 pilihan sumbu silang saja.
- Perilaku:
  - Klik titik → set alignment; double-click titik (P2) → toggle space-between seperti Figma.
  - Tidak ada shortcut khusus (`Alt+W/A/S/D` dipakai Align); gunakan panel.
  - Text baseline alignment (Horizontal) P1.
- Acceptance criteria:
  - [ ] Setiap dari 9 titik × 2 direction menghasilkan kombinasi `justify-content`/`align-items` sesuai tabel 11.1 (18 snapshot test).

### ED-084 Sizing per child: Fixed / Hug / Fill
- Prioritas: P0 · Fase: M2
- Deskripsi: Dropdown pada W dan H: **Fixed width**, **Hug contents**, **Fill container**.
- Perilaku:
  - Hug hanya tersedia untuk frame auto-layout & teks; Fill hanya untuk child dari parent auto-layout.
  - Parent Hug + child Fill pada sumbu yang sama → konflik; Figma mengubah parent menjadi Fixed. Editor mengikuti: parent otomatis menjadi Fixed (toast info).
  - Shortcut pada resize handle: double-click handle sisi = set Hug pada sumbu itu (seperti Figma).
  - Simple mode tidak menampilkan kontrol ini.
- Edge case: Teks dengan width Fill → otomatis menjadi auto height (wrap).
- Acceptance criteria:
  - [ ] Semua kombinasi sizing tabel 11.1 dirender identik di canvas dan publish (visual regression).

### ED-085 Min / max width & height
- Prioritas: P0 · Fase: M2
- Deskripsi: Dropdown W/H → "Add min width…", "Add max width…" (seperti Figma). Nilai px atau token.
- Perilaku: Ditampilkan di bawah W/H sebagai field kecil; hapus via ikon ×. Contoh penggunaan: container `width Fill, max-width 1200` → konten terpusat.
- Acceptance criteria:
  - [ ] Max width 1200 pada child Fill di parent 1440 → lebar 1200.

### ED-086 Nested auto-layout & kemudahan
- Prioritas: P0 · Fase: M2
- Deskripsi: Auto-layout bisa bersarang tanpa batas (dibatasi oleh performa, lihat [§31](#31-performa--batasan)).
- Perilaku:
  - `Mod+Alt+G` = wrap seleksi dalam frame (non-auto) ; `Shift+A` pada seleksi = wrap dalam auto-layout.
  - Membuat node di dalam auto-layout (draw/paste/insert) selalu masuk flow.
  - Breadcrumb di atas inspector menampilkan path frame (Section › Container › Card) yang bisa diklik.
- Acceptance criteria:
  - [ ] Card (vertical) di dalam grid row wrap di dalam section vertical dirender benar di 3 breakpoint.

### ED-087 Panel UI auto-layout
- Prioritas: P0 · Fase: M2
- Deskripsi: Bagian "Auto layout" di tab Design: direction (3 tombol), gap (input + Auto), padding, alignment grid, clip content, opsi lanjutan (⋯): stroke included in layout (P2 — CSS border selalu included pada `box-sizing:border-box`), canvas stacking (P2), align text baseline (P1).
- Acceptance criteria:
  - [ ] Tombol "+" pada header section menambah auto-layout; "−" menghapusnya.

### ED-088 Absolute position di dalam auto-layout
- Prioritas: P0 · Fase: M2
- Deskripsi: Child auto-layout bisa diberi "Absolute position" (ikon di samping X/Y atau context menu) → keluar dari flow, diposisikan dengan constraints relatif ke parent.
- Perilaku:
  - Parent mendapat `position: relative` otomatis.
  - Child absolute bisa di-drag bebas dan memakai constraints ([§12](#12-constraints-frame-non-auto-layout)).
  - Z-order mengikuti urutan layer.
  - Contoh: badge "Promo" di pojok card.
- Acceptance criteria:
  - [ ] Child absolute tidak mempengaruhi ukuran Hug parent.

### ED-089 Auto-layout per breakpoint
- Prioritas: P0 · Fase: M4
- Deskripsi: Properti auto-layout (direction, gap, padding, alignment, wrap, sizing) bisa berbeda per breakpoint bila override manual aktif ([§21](#21-responsif--breakpoint)); tanpa override, aturan auto-responsive yang berlaku.
- Acceptance criteria:
  - [ ] Direction Horizontal di desktop + Vertical di mobile menghasilkan media query yang benar di output.

### ED-090 Reorder via drag & keyboard (ringkas)
- Prioritas: P0 · Fase: M2
- Deskripsi: Lihat [ED-063](#ed-063-move-di-dalam-auto-layout-reorder--reparent). Tambahan: di layers panel, drag mengubah urutan; urutan layer = urutan DOM = urutan visual auto-layout (catatan: Figma menampilkan child pertama di **bawah** daftar layer untuk frame non-auto; editor ini menampilkan urutan **DOM dari atas ke bawah** untuk semua frame agar sesuai mental model web).
- Acceptance criteria:
  - [ ] Urutan di layers panel selalu sama dengan urutan DOM output.

> ❓ OPEN: Urutan layer panel — "DOM order (atas = pertama)" vs "Figma order (atas = paling depan)". Usulan: DOM order untuk semua, karena output adalah HTML dan mayoritas user bukan pengguna Figma. Z-order untuk node absolute dikendalikan via `z-index` eksplisit (Bring forward/Send backward).

### ED-091 Bring forward / send backward
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+]` bring forward, `Mod+[` send backward, `Mod+Alt+]` bring to front, `Mod+Alt+[` send to back.
- Perilaku: Untuk child flow (auto-layout) = pindah urutan DOM. Untuk node absolute = ubah urutan DOM di antara siblings (yang menentukan stacking) dan, jika diperlukan, `z-index`.
- Acceptance criteria:
  - [ ] Bring to front pada node absolute membuatnya tampil di atas semua sibling.

### ED-092 Suggest auto-layout
- Prioritas: P2 · Fase: M9
- Deskripsi: Saat frame freeform berisi ≥ 3 children yang tersusun rapi, tampilkan saran "Jadikan auto layout agar responsif" (lightbulb di inspector). Bisa juga dijalankan oleh AI ([04](./04-ai-agent.md)) secara massal: "Rapikan jadi responsif".
- Acceptance criteria:
  - [ ] Saran tidak muncul lebih dari sekali per frame yang di-dismiss.

### ED-093 Konversi freeform ↔ auto-layout aman
- Prioritas: P1 · Fase: M4
- Deskripsi: Saat publish, frame freeform dengan lebar Fixed > lebar breakpoint mobile memicu warning "Elemen ini tidak responsif" + tombol "Perbaiki" (konversi heuristik ke auto-layout atau scale constraints).
- Acceptance criteria:
  - [ ] Checklist pra-publish ([07](./07-publishing-hosting.md)) menampilkan warning ini.

### ED-094 Gap & padding dengan token
- Prioritas: P0 · Fase: M4
- Deskripsi: Gap & padding bisa diikat ke token spacing ([§15](#15-design-tokens-variables--styles)). Input menampilkan chip token (`space-6 · 24`).
- Acceptance criteria:
  - [ ] Mengubah nilai token spacing mengubah semua gap yang terikat.

### ED-095 Text baseline & align-self
- Prioritas: P1 · Fase: M4
- Deskripsi: Per child bisa override alignment sumbu silang (`align-self`: auto/start/center/end/stretch) lewat dropdown kecil di bagian "Layout child".
- Acceptance criteria:
  - [ ] `align-self: center` dirender di output untuk child tersebut saja.

### ED-096 Visual helper auto-layout di canvas
- Prioritas: P1 · Fase: M2
- Deskripsi: Saat frame auto-layout terseleksi: tampilkan area padding (pink), gap (pink bergaris), dan handle drag di tengah gap/padding untuk mengubah nilai secara langsung. Saat hover child, tampilkan ikon sizing (↔ Fill, ⇥⇤ Hug) di label ukuran.
- Acceptance criteria:
  - [ ] Drag handle gap mengubah nilai gap dengan snap ke token terdekat (bila token ada) — tahan `Mod` untuk nilai bebas.

### ED-097 Grid layout (CSS Grid)
- Prioritas: P1 (dasar) · Fase: M4 · P2 (lanjutan: area bernama, span drag) · Fase: M9
- Deskripsi: Opsi layout ketiga selain freeform & auto-layout: **Grid** → `display: grid`.
- Perilaku:
  - Properti: columns (`count` + ukuran per kolom: `1fr`/px/auto/`minmax`), rows (auto default), column gap, row gap, padding, alignment item (justify-items/align-items).
  - Preset "Responsive cards": `grid-template-columns: repeat(auto-fill, minmax(Npx, 1fr))` — paling berguna untuk UMKM (galeri produk).
  - Child: column span / row span (input angka), placement otomatis (default) atau manual (P2).
  - Canvas: garis grid tipis saat frame terseleksi; drag child menyorot sel tujuan.
  - Per breakpoint: jumlah kolom bisa berbeda (desktop 4, tablet 2, mobile 1) — termasuk dalam auto-responsive default.
- Mapping CSS:
  - `columns: [{ size: "1fr" }×3]` → `grid-template-columns: repeat(3, 1fr)`
  - `autoFill: { min: 240 }` → `repeat(auto-fill, minmax(240px, 1fr))`
  - `child.span: { col: 2 }` → `grid-column: span 2`
- Edge case: Konversi auto-layout wrap → grid mempertahankan urutan children.
- Acceptance criteria:
  - [ ] Grid 3 kolom di desktop otomatis 1 kolom di mobile bila auto-responsive aktif.

---

## 12. Constraints (Frame Non-Auto-layout)

### ED-098 Constraints horizontal & vertikal
- Prioritas: P0 · Fase: M2
- Deskripsi: Child node di dalam frame **freeform** (atau child absolute di auto-layout) punya constraints yang menentukan perilaku saat parent berubah ukuran (termasuk saat breakpoint berubah lebar).
- Perilaku & mapping CSS (parent selalu `position: relative`):

| Constraint horizontal | CSS | Perilaku |
|---|---|---|
| Left | `left: Xpx; width: Wpx` | Jarak ke kiri tetap |
| Right | `right: (PW−X−W)px; width: Wpx` | Jarak ke kanan tetap |
| Left & Right | `left: Xpx; right: Rpx; width:auto` | Melar mengikuti parent |
| Center | `left: calc(50% + (X + W/2 − PW/2)px); transform: translateX(-50%)` atau `left:50%; margin-left` | Tetap relatif ke tengah |
| Scale | `left: X/PW %; width: W/PW %` | Posisi & ukuran proporsional |

| Constraint vertikal | CSS |
|---|---|
| Top | `top: Ypx; height: Hpx` |
| Bottom | `bottom: (PH−Y−H)px; height:Hpx` |
| Top & Bottom | `top; bottom; height:auto` |
| Center | `top: calc(50% + …)` + `translateY(-50%)` |
| Scale | `top: %; height: %` |

- UI: widget constraints (kotak dengan garis kiri/kanan/atas/bawah/center yang bisa diklik, `Shift+klik` untuk multi) + dua dropdown, seperti Figma.
- Edge case:
  - Kombinasi Center + rotasi: `translate` digabung dengan `rotate` dalam satu `transform`.
  - Parent Hug height dengan child absolute: parent tidak menghitung child absolute → tinggi parent mungkin 0 → warning "Frame freeform perlu tinggi tetap".
  - Teks dengan Left & Right → width auto (wrap).
- Acceptance criteria:
  - [ ] Untuk tiap 5×5 kombinasi constraints, resize parent di editor dan di output browser menghasilkan posisi identik (visual regression).

### ED-099 Default constraints & anjuran auto-layout
- Prioritas: P0 · Fase: M2
- Deskripsi: Default constraints = Left + Top (seperti Figma), termasuk untuk node di dalam **section** freeform. Editor menampilkan **banner anjuran** "Gunakan Auto layout agar tampilan rapi di HP" pada frame freeform yang lebih lebar dari 375px, dengan tombol konversi ([ED-079](#ed-079-add--remove-auto-layout)).
- Acceptance criteria:
  - [ ] Banner muncul pada frame freeform ≥ 376px dan bisa di-dismiss per frame.

### ED-100 Constraints & breakpoint
- Prioritas: P0 · Fase: M4
- Deskripsi: Tanpa override manual, posisi node freeform di tablet/mobile dihitung dari constraints terhadap lebar breakpoint. Dengan override aktif, X/Y/W/H dan constraints bisa di-override per breakpoint.
- Edge case: Frame freeform Fixed width 1200 di mobile 390 → auto-responsive rule ([ED-175](#ed-175-auto-responsive-rules)) menskalakan atau memaksa width 100% (sesuai opsi). Tanpa rule → overflow horizontal + warning.
- Acceptance criteria:
  - [ ] Tidak ada horizontal scroll pada output mobile untuk fixture template resmi.

### ED-101 Scale mode untuk komposisi dekoratif
- Prioritas: P1 · Fase: M4
- Deskripsi: Opsi frame "Scale content proportionally" — seluruh frame freeform diskalakan (`transform: scale()` via container query/`aspect-ratio`) agar komposisi ilustratif (hero dengan banyak shape) tetap utuh di layar kecil.
- Perilaku: Implementasi: frame mendapat `container-type: inline-size`; children dipositioning dengan unit `cqw` (persen lebar container).
- Acceptance criteria:
  - [ ] Komposisi 1440 lebar tampil proporsional di 390 tanpa overlap tambahan.

---

## 13. Properti Visual

Urutan bagian di tab Design (mengikuti Figma, disesuaikan web): **Breadcrumb & tipe node** → **Align** → **Position & size** (X, Y, W, H, rotation, constraints) → **Layout** (Auto layout / Grid / Layout child) → **Appearance** (opacity, corner radius, blend mode, cursor) → **Fill** → **Stroke** → **Effects** → **Typography** (jika teks) → **Layout grid** → **Advanced** (overflow, z-index, aspect-ratio).

### ED-102 Fill solid & color picker
- Prioritas: P0 · Fase: M2
- Deskripsi: Fill warna solid dengan color picker.
- Perilaku:
  - Color picker (react-colorful) dengan: area saturation/value, hue slider, alpha slider, input HEX/RGB/HSL (toggle), eyedropper (`I` saat picker terbuka; EyeDropper API — Chrome/Edge; fallback: sampling dari node di canvas berdasarkan fill yang diketahui), daftar **token warna** website (tab "Library"), dan warna terakhir dipakai (10).
  - Input HEX menerima 3/4/6/8 digit, nama warna CSS (`red`), dan `rgb()`; tanpa `#` tetap valid.
  - Opacity fill terpisah dari opacity layer.
  - Untuk teks, fill = warna teks (`color`). Untuk frame/shape = `background-color`. Untuk icon = `color`/`stroke`.
- Edge case: Fill kosong (tidak ada fill) = transparan; frame tanpa fill tetap bisa diklik (lihat [ED-020](#ed-020-hit-testing)).
- Acceptance criteria:
  - [ ] Input `f00` → `#FF0000`; `#FF000080` → alpha 50%.
  - [ ] Eyedropper berfungsi di Chrome; di Firefox/Safari tombol menjadi mode sampling internal.

### ED-103 Gradient fill (linear & radial)
- Prioritas: P0 (linear) · P1 (radial) · Fase: M4
- Deskripsi: Gradient dengan stops editable.
- Perilaku:
  - Picker mode Gradient: bar stops (klik untuk tambah stop, drag untuk geser, `Delete` hapus stop, setiap stop punya warna+alpha), sudut (linear) atau posisi pusat & radius (radial).
  - Edit di canvas: handle gradient (garis dengan dua titik ujung) di atas node terseleksi saat picker terbuka (P1).
  - Mapping: `linear-gradient(<angle>deg, c1 p1%, c2 p2%, …)`, `radial-gradient(<shape> at x% y%, …)`.
  - Angular & diamond gradient (Figma) → **tidak didukung** P0/P1 (`conic-gradient` untuk angular P2).
  - Gradient pada teks (P2): `background-clip: text`.
- Acceptance criteria:
  - [ ] Gradient 3 stops dirender identik di canvas & output.

### ED-104 Image fill
- Prioritas: P0 · Fase: M2
- Deskripsi: Gambar sebagai background frame/shape (beda dengan node image).
- Perilaku:
  - Mode: **Fill** (`background-size: cover`), **Fit** (`contain`), **Crop** (posisi & skala manual: `background-size: W% auto; background-position: x% y%`), **Tile** (`background-repeat: repeat; background-size: Npx`).
  - Crop mode: double-click fill → gambar tampil penuh semi-transparan di luar frame, bisa di-drag & di-resize (seperti Figma).
  - Focal point (P1): titik fokus untuk Fill agar subjek tetap terlihat saat crop responsif → `background-position`.
  - Image adjustments (exposure, contrast, saturation…) Figma → hanya **filter sederhana** P2 (`filter: brightness() contrast() saturate()`), tidak non-destructive bitmap edit.
  - Overlay warna di atas image (umum di hero): gunakan multiple fills (warna semi transparan di atas image).
  - Untuk node image (`<img>`), mode yang sama dipetakan ke `object-fit` + `object-position`.
- Edge case: Image fill di section hero → renderer memakai `<img>` absolut + `object-fit` (bukan CSS background) agar bisa `srcset`/lazy & LCP baik (detail di [07](./07-publishing-hosting.md)); editor tidak perlu tahu perbedaan ini.
- Acceptance criteria:
  - [ ] Keempat mode dirender sesuai di canvas dan output.

### ED-105 Multiple fills
- Prioritas: P1 · Fase: M4
- Deskripsi: Satu node bisa punya banyak fill (urutan atas = paling depan), masing-masing bisa di-hide (ikon mata) dan dihapus (−).
- Perilaku: Mapping ke multiple `background-image` layers; warna solid di atas gambar dikonversi ke `linear-gradient(c, c)`. Untuk teks hanya satu fill (fill pertama yang visible) kecuali gradient text P2.
- Acceptance criteria:
  - [ ] Overlay hitam 40% di atas image fill dirender benar.

### ED-106 Stroke
- Prioritas: P0 · Fase: M2
- Deskripsi: Garis tepi node.
- Perilaku:
  - Properti: warna (solid/token; gradient P2), weight (px), posisi (**Inside / Center / Outside**), per-sisi (All / Top / Right / Bottom / Left / Custom), style (Solid / Dash / Dot), dash length & gap (P2).
  - Mapping CSS:

| Posisi | CSS | Mempengaruhi layout? |
|---|---|---|
| Inside (default) | `box-shadow: inset 0 0 0 Wpx c` atau `border` dengan `box-sizing:border-box` | Inside via `border` mengurangi area konten — renderer memakai **`border`** untuk per-sisi & dash, **inset box-shadow** untuk All solid agar padding tidak berubah |
| Center | `outline: Wpx solid c; outline-offset: -W/2 px` | Tidak |
| Outside | `outline: Wpx solid c; outline-offset: 0` (atau `box-shadow: 0 0 0 Wpx c`) | Tidak |

  - Per sisi → `border-top`, dst. (posisi selalu Inside).
  - Dash/dot → `border-style: dashed/dotted` (panjang dash tidak bisa diatur di CSS border; custom dash P2 via SVG background).
  - Corner radius berlaku ke stroke (outline mengikuti radius di browser modern).
- Edge case:
  - Stroke pada teks (Figma) → `-webkit-text-stroke` P2; P0 tidak tersedia untuk teks (panel stroke disembunyikan).
  - Stroke + shadow: keduanya memakai `box-shadow` → renderer menggabungkan daftar box-shadow dengan urutan benar.
- Acceptance criteria:
  - [ ] Ketiga posisi stroke tidak mengubah ukuran layout node (kecuali per-sisi dengan border, terdokumentasi).

### ED-107 Corner radius
- Prioritas: P0 · Fase: M2
- Deskripsi: Radius seragam atau independen per sudut (toggle ikon "Independent corners").
- Perilaku:
  - Input menerima angka/token (`radius-md`). Nilai sangat besar (≥ setengah sisi pendek) = pill.
  - Drag radius di canvas: handle bulat kecil di dalam sudut saat node terseleksi & cukup besar (P1); `Alt` drag satu sudut saja.
  - Corner smoothing (squircle iOS) Figma → P2 (perlu SVG/mask) atau ❌.
  - Mapping: `border-radius: tl tr br bl`.
  - Clip content + radius → `overflow: hidden` memotong children sesuai radius.
- Acceptance criteria:
  - [ ] Independent corners `8 0 8 0` → `border-radius: 8px 0 8px 0`.

### ED-108 Effects: drop shadow & inner shadow
- Prioritas: P0 · Fase: M2
- Deskripsi: Bayangan.
- Perilaku:
  - Drop shadow: X, Y, blur, spread, warna (+alpha), visible; banyak shadow diperbolehkan.
  - Inner shadow: sama, `inset`.
  - Mapping: `box-shadow: [inset] x y blur spread color, …`. Untuk teks: drop shadow → `text-shadow` (tanpa spread; field spread disembunyikan).
  - Shadow pada node tanpa fill (Figma "show behind transparent areas") → CSS selalu menggambar box-shadow di luar box saja; untuk shape non-persegi pada image PNG transparan → `filter: drop-shadow()` (opsi "Follow shape", P1).
  - Preset & token shadow (`shadow-sm/md/lg`) dari [§15](#15-design-tokens-variables--styles).
- Acceptance criteria:
  - [ ] Dua drop shadow + satu inner shadow menghasilkan satu deklarasi `box-shadow` dengan 3 layer berurutan benar.

### ED-109 Effects: layer blur & background blur
- Prioritas: P1 · Fase: M4
- Deskripsi: Layer blur → `filter: blur(Npx)`; background blur (glassmorphism) → `backdrop-filter: blur(Npx)` (+ `-webkit-` prefix).
- Edge case: Background blur hanya terlihat jika fill semi-transparan → hint di panel. Saat performa rendah (zoom out/pan), blur dinonaktifkan sementara ([ED-021](#ed-021-virtualisasi--culling)).
- Acceptance criteria:
  - [ ] Output menyertakan `-webkit-backdrop-filter` untuk Safari.

### ED-110 Opacity layer
- Prioritas: P0 · Fase: M2
- Deskripsi: Opacity node 0–100% (`opacity`). Shortcut: tekan angka `1`…`9` = 10%…90%, `0` = 100%, dua angka cepat (`4` `5`) = 45% — seperti Figma (hanya saat seleksi ada & fokus canvas).
- Acceptance criteria:
  - [ ] Ketik `5` dengan node terseleksi → opacity 50%.

### ED-111 Blend mode
- Prioritas: P2 · Fase: M9
- Deskripsi: Layer blend mode (`mix-blend-mode`: multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity) dan fill blend (`background-blend-mode`). "Pass through" = default (normal).
- Acceptance criteria:
  - [ ] Semua mode yang didukung CSS tersedia; mode Figma tanpa padanan CSS (plus-darker, plus-lighter non-standar) disembunyikan.

### ED-112 Overflow / clip content
- Prioritas: P0 · Fase: M2
- Deskripsi: Checkbox "Clip content" pada frame → `overflow: hidden` (atau `clip` bila tidak butuh scroll context).
- Perilaku:
  - Advanced (P1): overflow **Scroll** (horizontal/vertical/both) → `overflow-x/y: auto` untuk carousel sederhana / tabel lebar; di editor, konten scroll bisa digulir dengan `Alt+wheel` di atas frame (P2).
  - Default: section `clip` off; card dengan radius + image → clip on.
- Acceptance criteria:
  - [ ] Clip content off: child overflow terlihat di canvas & output.

### ED-113 Cursor & properti interaksi dasar
- Prioritas: P1 · Fase: M4
- Deskripsi: Dropdown cursor (auto, pointer, default, text, not-allowed, grab, zoom-in) → CSS `cursor`. Node dengan link/klik interaction otomatis `pointer`.
- Acceptance criteria:
  - [ ] Cursor tidak berubah di editor canvas (editor memakai kursor tool), hanya di preview & output.

### ED-114 Advanced: aspect ratio, z-index, visibility per breakpoint
- Prioritas: P1 · Fase: M4
- Deskripsi: Bagian Advanced: **aspect-ratio** (lock W/H rasio → CSS `aspect-ratio`, sangat berguna untuk image responsif & video), **z-index** manual (untuk absolute/sticky), **display per breakpoint** (lihat [ED-178](#ed-178-hide-per-breakpoint)).
- Acceptance criteria:
  - [ ] Image dengan aspect-ratio 16/9 dan width Fill mempertahankan rasio di semua breakpoint.

---

## 14. Typography

Teks diedit **inline di canvas** menggunakan **Tiptap** (ProseMirror). Konten teks disimpan sebagai rich text JSON (struktur di [01](./01-document-model.md)); di Yjs `props.content` adalah `Y.XmlFragment` yang di-bind ke Tiptap via `@tiptap/y-tiptap` (fork `y-prosemirror` untuk Tiptap 3; **keputusan 01**, §14 Yjs mapping) — sudah tervalidasi di spike M0 (T0.8.5).

### ED-115 Text editing inline (Tiptap)
- Prioritas: P0 · Fase: M2
- Deskripsi: Double-click / `Enter` pada node teks → editor Tiptap aktif menggantikan elemen render teks di posisi yang sama (style identik).
- Perilaku:
  - Tiptap di-mount di `#text-editor-host` yang ditempatkan di world (ikut transform) agar caret & selection sejajar.
  - Saat aktif: shortcut canvas dinonaktifkan kecuali `Esc`, `Mod+Z/Y` (undo di level Tiptap selama sesi edit), format (`Mod+B/I/U`, `Mod+Shift+X` strikethrough, `Mod+K` link, `Mod+Shift+7/8` list).
  - Keluar: `Esc`, klik di luar node. Dengan binding y-tiptap, perubahan tercatat ke `Y.XmlFragment` per ketikan; selama sesi Ctrl+Z granular per jeda ketik, dan saat keluar UndoManager dokumen menggabungkan seluruh sesi menjadi satu langkah (`beginGroup()`/`end()` di UndoController, T0.8.5).
  - Mini toolbar mengambang di atas teks (P1): bold, italic, link, warna, text style.
  - Enter = paragraf baru; `Shift+Enter` = line break (`<br>`).
- Edge case:
  - Teks di dalam instance → edit override konten (diizinkan bila prop teks).
  - Teks yang terikat ke data collection ([05](./05-dynamic-data.md)) → tidak bisa diedit inline; tampil chip "Bound: item.name" (dari `node.bindings["props.content"] = { "$bind": "item.name" }`, 01 DM-052) dan tombol "Unbind".
  - IME (input method, mis. keyboard Jepang/emoji picker) harus didukung (ProseMirror menangani; diuji).
  - Paste rich text dari Word/Google Docs → dibersihkan ke mark yang didukung (bold, italic, underline, link, list); style asing dibuang.
- Acceptance criteria:
  - [ ] Caret tampil di posisi benar pada zoom 25%, 100%, 400%.
  - [ ] Paste dari Google Docs mempertahankan bold/italic/link dan membuang font asing.

> ✅ Diputuskan di 01 (bukan OPEN lagi): `props.content` = `Y.XmlFragment` + `@tiptap/y-tiptap`; JSON ↔ fragment memakai konversi milik document-model (`richTextToYXmlFragment` / `yXmlFragmentToRichText`, encoding identik y-tiptap) — divalidasi di spike T0.8.5 ([01 §14](./01-document-model.md)).

### ED-116 Font family (Google Fonts)
- Prioritas: P0 · Fase: M2
- Deskripsi: Pemilih font dengan pencarian, kategori (Sans, Serif, Display, Handwriting, Mono), preview nama font dalam font itu sendiri, "Dipakai di website ini" di atas, dan font populer Indonesia/UMKM.
- Perilaku:
  - Sumber: katalog Google Fonts (disinkronkan berkala ke JSON statis di CDN platform; font di-self-host via Fontsource/R2 untuk publish — detail [07](./07-publishing-hosting.md)).
  - Preview list di-virtualisasi; file font preview dimuat lazy (subset nama font saja, `text=` param) saat item terlihat.
  - Font kustom upload (P2, paket Pro): `.woff2` dengan pernyataan lisensi.
  - Batas: maks 4 family per website (warning, bukan blok) demi performa.
- Edge case: Font gagal dimuat → fallback stack (`system-ui, sans-serif`) + ikon ⚠️ di picker.
- Acceptance criteria:
  - [ ] Picker dengan 1.500+ font scroll 60fps.

### ED-117 Weight, size, line height, letter spacing
- Prioritas: P0 · Fase: M2
- Deskripsi: Kontrol dasar typography.
- Perilaku:
  - Weight: dropdown sesuai varian yang tersedia di family (100–900, italic). Variable font axis (P2).
  - Size: px (input + dropdown preset 12…96); responsif otomatis via auto-responsive rule (`clamp()`) bila diaktifkan ([ED-175](#ed-175-auto-responsive-rules)).
  - Line height: `Auto` (normal / ratio dari font), px, atau % (dipetakan ke unitless ratio: 150% → `1.5`).
  - Letter spacing: % (Figma) → `em` (`2%` → `0.02em`) atau px.
  - Semua mendukung token & ekspresi.
- Acceptance criteria:
  - [ ] Line height 150% → `line-height: 1.5` di output.

### ED-118 Paragraph spacing & indent
- Prioritas: P1 · Fase: M4
- Deskripsi: Paragraph spacing → `margin-bottom` antar paragraf (kecuali paragraf terakhir); paragraph indent → `text-indent` (P2).
- Acceptance criteria:
  - [ ] Paragraph spacing tidak menambah ruang setelah paragraf terakhir.

### ED-119 Alignment horizontal & vertikal
- Prioritas: P0 · Fase: M2
- Deskripsi: Horizontal: left/center/right/justify (`text-align`). Vertical (dalam box teks fixed height): top/middle/bottom → teks dibungkus flex column `justify-content`.
- Shortcut: `Mod+Alt+L/T/R` (left/center/right), `Mod+Alt+J` justify — seperti Figma.
- Acceptance criteria:
  - [ ] Vertical middle pada teks fixed height 200 menempatkan teks di tengah.

### ED-120 Decoration, case, style teks
- Prioritas: P0 · Fase: M2
- Deskripsi: Underline, strikethrough (`text-decoration`); case: As typed / UPPER / lower / Title (`text-transform`); small caps (P2, `font-variant-caps`); italic.
- Acceptance criteria:
  - [ ] Case UPPER tidak mengubah konten tersimpan (hanya CSS).

### ED-121 List
- Prioritas: P0 · Fase: M2
- Deskripsi: Bulleted (`ul`) & numbered list (`ol`) dalam node teks; indent `Tab`/`Shift+Tab` (nested, maks 3 level); style bullet (disc/circle/custom ikon P2).
- Acceptance criteria:
  - [ ] Output list menggunakan `<ul><li>` semantik.

### ED-122 Link pada teks
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+K` saat range teks terpilih → popover link: ke Page (dropdown), Section anchor, URL eksternal, email (`mailto:`), telepon (`tel:`), **WhatsApp** (nomor + pesan → `https://wa.me/...`, penting untuk UMKM), file (asset). Opsi "Buka di tab baru".
- Perilaku: Link teks diberi style default token "Link" (warna + underline on hover). Menautkan seluruh node teks = interaction di [§22](#22-prototype--interactions).
- Edge case: URL tanpa skema (`tokobudi.com`) → otomatis `https://`.
- Acceptance criteria:
  - [ ] Link WhatsApp menghasilkan URL `wa.me` dengan pesan ter-encode.

### ED-123 Text auto-resize
- Prioritas: P0 · Fase: M2
- Deskripsi: Mode: **Auto width** (`width: max-content`, tidak wrap), **Auto height** (width tetap/Fill, tinggi mengikuti), **Fixed size** (W & H tetap, overflow terlihat/terpotong).
- Perilaku: Ikon 3 tombol di panel Typography. Resize horizontal teks auto width → auto height. Double-click handle kanan → auto width.
- Edge case: Auto width di mobile bisa overflow → auto-responsive rule mengubah ke auto height (wrap) di breakpoint sempit.
- Acceptance criteria:
  - [ ] Ketiga mode menghasilkan CSS benar dan tidak overflow horizontal di mobile pada template resmi.

### ED-124 Truncation (max lines)
- Prioritas: P1 · Fase: M4
- Deskripsi: "Truncate text" dengan max lines N → `display:-webkit-box; -webkit-line-clamp:N; -webkit-box-orient:vertical; overflow:hidden`. N=1 → `text-overflow: ellipsis; white-space: nowrap`.
- Acceptance criteria:
  - [ ] Deskripsi produk panjang terpotong dengan "…" setelah 2 baris.

### ED-125 Rich text per range
- Prioritas: P0 · Fase: M2
- Deskripsi: Dalam satu node teks, range bisa punya style berbeda: bold, italic, underline, strike, link, warna, font weight, font size (P1), font family (P2), highlight (P2).
- Perilaku: Saat range terpilih, panel Typography menampilkan nilai range (atau "Mixed"); perubahan berlaku ke range. Saat node (bukan range) terpilih, perubahan berlaku ke semua dan menghapus mark yang bertentangan (tanpa konfirmasi; mengikuti Figma: langsung menimpa).
- Edge case: Range style dengan token warna → mark menyimpan referensi token.
- Acceptance criteria:
  - [ ] Satu kata bold + warna merah dalam paragraf dirender `<strong>`/`<span style>` (atau class) di output.

### ED-126 Text styles
- Prioritas: P0 · Fase: M4
- Deskripsi: Kumpulan style typography bernama (Heading 1…6, Body L/M/S, Caption, Button, Link) per website, disimpan sebagai token typography group `type` (`type.h1`, `type.body`, …) dan dipakai node lewat `style.<bp>.typography = { "$token": "type.h1" }` (command `applyTextStyleToken`, 01) ([§15](#15-design-tokens-variables--styles)).
- Perilaku:
  - Panel Typography: tombol "Styles" (ikon ⋮⋮) → daftar style; apply = node terikat ke style; nilai individual tampil read-only dengan tombol "Detach style".
  - "Create style" dari teks terseleksi.
  - Text style responsif: nilai size/line height berbeda per breakpoint (desktop H1 56, mobile H1 36) di definisi style.
  - Mengedit style → semua teks yang memakai style berubah.
- Acceptance criteria:
  - [ ] Ubah H1 dari 56 ke 64 → semua H1 di website berubah, undo mengembalikan.

### ED-127 Teks dinamis & placeholder
- Prioritas: P1 · Fase: M7
- Deskripsi: Variabel dalam teks (`{{ site.title }}`, `{{ item.price | currency }}` di `dataList`) ditampilkan sebagai chip; disimpan sebagai `{ "$template": "…" }` di `node.bindings` ([01 DM-052](./01-document-model.md#dm-052-format-binding), scope root & filter 01 DM-052/053). Kondisi tampil (login/role/data) = `node.visibleWhen` (01 DM-008, [05 DATA-083](./05-dynamic-data.md#data-083-conditional-visibility)). Perilaku binding di [05](./05-dynamic-data.md).
- Acceptance criteria:
  - [ ] Chip tidak bisa dipotong sebagian oleh caret (atomik).

### ED-128 Format angka & mata uang di teks bound
- Prioritas: P1 · Fase: M8
- Deskripsi: Teks bound ke field number/price punya opsi format (filter 01 DM-053: `currency` → `Rp 25.000`, `number`, persen) — konfigurasi di tab Data ([05](./05-dynamic-data.md), [06](./06-commerce-payments.md)).
- Acceptance criteria:
  - [ ] Nilai `25000` dengan format Rupiah tampil `Rp 25.000` di canvas dan output.

---

## 15. Design Tokens, Variables & Styles

Token disimpan di dokumen website (`theme.tokens`, struktur di [01 §9](./01-document-model.md)); referensi di node selalu `{ "$token": "<group>.<name>" }` (mis. `color.primary`, `space.6`, `type.h1`, `radius.lg`, `shadow.md`, `fontFamily.body`). Renderer mengeluarkannya sebagai CSS custom properties di `:root` website (nama variabel ditentukan [07](./07-publishing-hosting.md), `var(--t-…)`).

### ED-129 Kategori token
- Prioritas: P0 · Fase: M4 (warna & typography sejak M2)
- Deskripsi: Kategori: **Color** (primary, secondary, accent, neutral 50–900, background, surface, text, muted, success, warning, danger), **Typography** (text styles, [ED-126](#ed-126-text-styles)), **Spacing** (skala 0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128), **Radius** (none, sm, md, lg, full), **Shadow** (sm, md, lg, xl), **Container/breakpoint** (lebar container), **Font family** (heading, body).
- Perilaku: Template & component library hanya memakai token (aturan di [03](./03-components-templates.md)) sehingga ganti tema = ganti token.
- Acceptance criteria:
  - [ ] Semua template resmi lolos lint "no hardcoded color" (kecuali dikecualikan).

### ED-130 Panel token / Theme
- Prioritas: P0 · Fase: M4
- Deskripsi: Assets → **Tokens** (Design mode) dan tab **Theme** (Simple mode).
- Perilaku:
  - Design mode: tabel token per kategori; tambah, rename (refactor semua referensi), hapus (jika dipakai: pilih pengganti atau detach semua), ubah nilai, sub-grup satu level lewat path titik (mis. `color.brand.600`; grup teratas tetap — 01), deskripsi.
  - Simple mode (Theme): "Warna brand" (1–3 warna → palet turunan otomatis neutral & shade), "Font" (pasangan heading/body kurasi), "Sudut" (tajam/lembut/bulat → token radius), "Logo". Tombol "Acak tema" dan "Tema dari logo" (ambil warna dominan logo; P1) — AI juga bisa melakukannya ([04](./04-ai-agent.md)).
  - Generator palet: dari satu warna → shade 50–900 (OKLCH) + cek kontras teks.
- Acceptance criteria:
  - [ ] Ganti primary color di Theme mengubah semua button di semua page secara live.

### ED-131 Memilih token di input
- Prioritas: P0 · Fase: M4
- Deskripsi: Setiap input yang bisa ditokenisasi (warna, spacing/gap/padding, radius, shadow, font, size) punya tombol token (ikon ◇) yang membuka daftar token kategori terkait, dengan pencarian.
- Perilaku:
  - Mengetik `$` atau `=` di input membuka autocomplete token.
  - Input terikat token menampilkan chip (`◇ color.primary`) dengan nilai di tooltip; nilai tersimpan `{ "$token": "color.primary" }`.
  - Saran otomatis: jika nilai manual yang dimasukkan sama dengan nilai token, tampilkan hint "Gunakan token `space.6`?" (P1).
- Acceptance criteria:
  - [ ] Ketik `$prim` di fill → saran `primary` muncul.

### ED-132 Detach token
- Prioritas: P0 · Fase: M4
- Deskripsi: Tombol "Detach" (ikon ⛓ putus) pada chip → nilai literal saat ini disalin, referensi dilepas. Dari context menu bisa "Detach all tokens" pada seleksi (P1).
- Acceptance criteria:
  - [ ] Detach tidak mengubah tampilan; mengubah token setelahnya tidak mempengaruhi node yang di-detach.

### ED-133 Mode light/dark
- Prioritas: P2 · Fase: M9
- Deskripsi: Collection token punya mode (Light, Dark). Website bisa: hanya light, hanya dark, atau ikut OS + toggle. Editor menyediakan switch preview mode di toolbar.
- Perilaku: Output `@media (prefers-color-scheme: dark)` dan/atau `[data-theme=dark]` override variabel.
- Acceptance criteria:
  - [ ] Preview Dark mengganti semua warna bertoken tanpa mengubah dokumen.

### ED-134 Local styles vs token
- Prioritas: P1 · Fase: M4
- Deskripsi: Figma membedakan Styles dan Variables. Di Platform keduanya **disatukan** sebagai token; "Effect style" = token shadow (bisa berisi beberapa layer shadow); "Color style" dengan gradient = token gradient (P1). UI menamainya "Styles" di Simple mode dan "Tokens" di Design mode.
- Acceptance criteria:
  - [ ] Token shadow multi-layer bisa diterapkan dari panel Effects.

### ED-135 Token usage & clean up
- Prioritas: P2 · Fase: M9
- Deskripsi: Menampilkan jumlah pemakaian token, "Select all using this token", dan laporan nilai hardcoded yang mirip token ("12 warna mirip primary — ganti?").
- Acceptance criteria:
  - [ ] "Select all using" memilih node di page aktif yang memakai token tersebut.

---

## 16. Layers Panel

Layers panel dibangun dengan **react-arborist** (virtualized tree). Satu baris = satu node.

```
🔍 Cari layer…                         [⚙ filter]
▾ ▣ Home (page root)
  ▾ ▤ Navbar                ◆ instance  👁 🔒
      ◆ Logo
      ▤ Menu  ↔
  ▾ ▤ Hero                  (section)
    ▾ ⇵ Container           (auto layout vertical)
        T  Selamat datang di Toko Budi
        T  Kue rumahan sejak 1998
        ◆ Button / Primary  ●override
      🖼 Foto toko          ⚠ alt
  ▸ ▦ Produk                (grid)
  ▸ ◆ Footer
```

### ED-136 Tree layers
- Prioritas: P0 · Fase: M2
- Deskripsi: Menampilkan tree page aktif (root → descendant), urutan DOM ([ED-090](#ed-090-reorder-via-drag--keyboard-ringkas)).
- Perilaku:
  - Virtualized: 2.000+ baris tetap 60fps scroll.
  - Indentasi 12px per level; garis panduan vertikal tipis.
  - Hover baris → hover outline di canvas (dan sebaliknya: hover canvas → baris ter-highlight ringan).
  - Klik baris = pilih node (tanpa aturan kedalaman); seleksi canvas otomatis expand ancestors & scroll baris ke tampilan.
  - Node draft area ditampilkan di grup terpisah "Draft" di bawah.
- Acceptance criteria:
  - [ ] Memilih node terdalam di canvas (deep select) mengekspansi semua ancestor di layers dan scroll ke barisnya.

### ED-137 Rename layer
- Prioritas: P0 · Fase: M2
- Deskripsi: Double-click nama atau `Mod+R` → input inline. `Enter` simpan, `Esc` batal, `Tab` simpan & rename layer berikutnya.
- Perilaku: Batch rename multi-seleksi (P2): pola `Card $n` dengan penomoran. Nama kosong → kembali ke nama default.
- Acceptance criteria:
  - [ ] Rename tercatat sebagai satu langkah undo.

### ED-138 Drag reorder & reparent di layers
- Prioritas: P0 · Fase: M2
- Deskripsi: Drag baris untuk mengubah urutan atau memindahkan ke parent lain.
- Perilaku:
  - Indikator: garis (sisip sebelum/sesudah) atau highlight baris (masuk sebagai child terakhir) tergantung posisi vertikal pointer di baris (atas 25% / tengah 50% / bawah 25%) — tengah hanya untuk frame.
  - Drag horizontal ke kiri saat di posisi child terakhir → naik level (outdent).
  - Auto-expand frame setelah hover 600 ms; auto-scroll di tepi panel.
  - Multi-seleksi bisa di-drag bersamaan (urutan relatif dipertahankan).
  - Validasi: tidak bisa memindahkan ke descendant sendiri, ke teks/image, atau ke dalam instance (kecuali slot) → indikator merah.
  - Reparent dari freeform ke auto-layout atau sebaliknya: posisi dikonversi (lihat [ED-062](#ed-062-move-dengan-drag-node-absolute--freeform)).
- Acceptance criteria:
  - [ ] Drag 3 layer sekaligus ke frame lain mempertahankan urutan relatif.

### ED-139 Visibility & lock di layers
- Prioritas: P0 · Fase: M2
- Deskripsi: Ikon 👁 dan 🔒 di kanan baris (muncul saat hover, tetap tampil jika aktif). Klik = toggle; drag vertikal melewati beberapa ikon = toggle berantai (P1, seperti Figma). `Alt+klik` ikon mata = solo (sembunyikan semua sibling lain) — P2.
- Acceptance criteria:
  - [ ] Child dari node hidden tampil redup dengan ikon mata abu-abu (inherited).

### ED-140 Collapse & expand
- Prioritas: P0 · Fase: M2
- Deskripsi: Klik caret = toggle; `Alt+klik` caret = expand/collapse rekursif; `Alt+L` collapse semua layer (Figma). Status expand per user (localStorage), bukan di dokumen.
- Acceptance criteria:
  - [ ] Alt+L meng-collapse semua kecuali path ke node terseleksi.

### ED-141 Ikon per tipe node
- Prioritas: P0 · Fase: M2
- Deskripsi: Ikon tipe: page root ▣, section ▤ (dengan tag), frame freeform #, auto-layout vertical ⇵ / horizontal ⇆ / wrap ⤶, grid ▦, text T, image 🖼, icon ✦, rectangle ▭, ellipse ◯, line ╱, instance ◆ (ungu), component main ❖ (ungu, Admin mode), group ⧉ (garis putus), dynamic/bound ⚡ (badge), form 📝, hidden-per-breakpoint 📱🚫 (badge).
- Perilaku: Badge tambahan di kanan: ● override (instance), ⚠ masalah aksesibilitas, 🔗 link/interaction.
- Acceptance criteria:
  - [ ] Setiap tipe node di [01](./01-document-model.md) punya ikon unik.

### ED-142 Search & filter layers
- Prioritas: P1 · Fase: M2
- Deskripsi: Kotak cari di atas tree (`Mod+F` saat fokus di layers): cocokkan nama layer dan isi teks; hasil di-highlight, ancestor otomatis expand; filter tipe (Text, Image, Instance, Frame, Hidden, Bound data, Issue a11y).
- Perilaku: `Enter` = pilih semua hasil; `↑/↓` = navigasi hasil.
- Acceptance criteria:
  - [ ] Cari "harga" menemukan teks yang berisi "Harga mulai".

### ED-143 Multi-select & keyboard di layers
- Prioritas: P0 · Fase: M2
- Deskripsi: `Shift+klik` range, `Mod+klik` toggle, `↑/↓` pindah seleksi, `→/←` expand/collapse, `Enter` rename (saat fokus layers; berbeda dengan Enter di canvas), `Delete` hapus.
- Acceptance criteria:
  - [ ] Seleksi di layers & canvas selalu identik (satu sumber: `selectionStore`).

---

## 17. Group, Frame, Boolean & Mask

### ED-144 Group
- Prioritas: P1 · Fase: M2
- Deskripsi: `Mod+G` mengelompokkan seleksi (parent sama) menjadi **group**.
- Perilaku:
  - Group adalah **node type terpisah `group`** ([01 DM-012](./01-document-model.md#dm-012-group)): tanpa fills/padding/layout, bounding box = gabungan children, dirender sebagai `div` berukuran hug dengan children `position.type = "absolute"` relatif ke group. Dibuat lewat command `groupNodes`, dibongkar lewat `unwrap`.
  - Di auto-layout parent, group diperlakukan sebagai satu child (Hug).
  - Properti yang ditampilkan untuk group: position, size (resize menskalakan children), opacity, effects. Tidak ada fill/stroke/auto-layout (tombol "Convert to frame").
- Edge case: Group kosong (semua child dihapus) → group otomatis dihapus.
- Acceptance criteria:
  - [ ] Group lalu ungroup tidak mengubah posisi visual children.

> ✅ Diputuskan di 01 (bukan OPEN lagi): `group` adalah node type sendiri (DM-012, fase M2), bukan flag `isGroup` pada frame.

### ED-145 Ungroup
- Prioritas: P1 · Fase: M2
- Deskripsi: `Mod+Shift+G` (Win: `Ctrl+Shift+G`; Mac: `Cmd+Shift+G`) — membongkar group/frame: children dipindah ke parent group pada indeks yang sama, posisi visual dipertahankan.
- Perilaku: Ungroup frame dengan fill/stroke/effects → konfirmasi "Style frame akan hilang" (atau "Remove frame" di context menu). Ungroup instance tidak diizinkan (harus Detach).
- Acceptance criteria:
  - [ ] Ungroup frame auto-layout di dalam parent auto-layout menyisipkan children pada indeks frame tersebut.

### ED-146 Frame selection / wrap in frame
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+Alt+G` membungkus seleksi dalam frame baru (freeform) seukuran bounding box; `Shift+A` membungkus dalam frame auto-layout ([ED-079](#ed-079-add--remove-auto-layout)).
- Perilaku: Di parent auto-layout, frame baru menggantikan posisi node pertama seleksi; sizing frame = Hug.
- Acceptance criteria:
  - [ ] Wrap tiga node berbeda parent → ditolak dengan pesan.

### ED-147 Konversi group ↔ frame
- Prioritas: P1 · Fase: M4
- Deskripsi: Context menu "Convert to frame" (group → frame, pertahankan ukuran) dan "Convert to group" (frame tanpa fill/stroke/auto-layout → group).
- Acceptance criteria:
  - [ ] Konversi tidak mengubah tampilan.

### ED-148 Boolean operations
- Prioritas: P2 · Fase: M9
- Deskripsi: Union, Subtract, Intersect, Exclude, Flatten antar shape → menghasilkan node vector (SVG path). Hanya untuk shape (rect, ellipse, vector), bukan frame/teks.
- Perilaku: Dihitung di Web Worker (library path boolean, mis. `paper.js`/`clipper`) agar UI tidak freeze.
- Acceptance criteria:
  - [ ] Subtract lingkaran dari persegi menghasilkan SVG dengan lubang.

### ED-149 Mask
- Prioritas: P2 · Fase: M9
- Deskripsi: "Use as mask" (`Mod+Alt+M`): node paling bawah dalam grup menjadi mask untuk sibling di atasnya → CSS `mask-image`/`clip-path` (shape sederhana: `clip-path: inset/circle/ellipse`; shape vector: `clip-path: path()`; image alpha: `mask-image: url()`).
- Edge case: Kombinasi mask + auto-layout tidak didukung (mask hanya di group/freeform).
- Acceptance criteria:
  - [ ] Foto dengan mask lingkaran tampil bulat di output Chrome, Safari, Firefox.

---

## 18. Components & Instances di Editor

Konsep, versioning, publish library, dan aturan override didefinisikan di [03-components-templates.md](./03-components-templates.md). Bagian ini hanya UX editor.

### ED-150 Create component
- Prioritas: P0 (Admin mode) · Fase: M3 · P1 (local component milik website user) · Fase: M4
- Deskripsi: `Mod+Alt+K` mengubah seleksi menjadi **main component**.
- Perilaku:
  - Admin mode: membuat component di library document; panel Component muncul untuk mengisi nama, kategori, tag, props schema ([03](./03-components-templates.md)).
  - Website user (P1): **local component** milik website (tidak berversi publik; perubahan main langsung mengalir ke instance di website yang sama — seperti Figma lokal).
    > ❓ OPEN: 03 CMP-011/CMP-170 menyatakan "Create component" untuk user baru tersedia saat library pribadi (P2), sedangkan 02 menyebut P1·M4 dan 08 sudah punya kuota `library.userComponents`. Samakan fase.
  - Multi-seleksi → `Mod+Alt+K` membuat satu component per node (konfirmasi) atau "Create component set" untuk variants (Admin).
  - Main component ditandai ikon ❖ ungu & label ungu di canvas.
- Edge case: Membuat component dari node yang berisi instance component lain → nested instance diperbolehkan (dependency `componentId@version` dicatat).
- Acceptance criteria:
  - [ ] Main component terlihat di Assets → Components.

### ED-151 Insert instance
- Prioritas: P0 · Fase: M3
- Deskripsi: Instance ditambahkan dari Insert panel ([§20](#20-insert-panel)) atau Assets (local components), atau `Alt+drag` main component (lokal) → instance.
- Perilaku: Instance (command `createInstance`) menyimpan `props.componentId`, `props.version` (integer = `version_seq`, 03 CMP-042), `props.variant`, `props.propValues`, `props.overrides`, `props.slots` ([01 DM-018](./01-document-model.md#dm-018-instance)). Instance ditampilkan dengan outline ungu saat terseleksi dan label `◆ Nama component`.
- Acceptance criteria:
  - [ ] Instance baru memakai versi terbaru yang dipublish saat insert.

### ED-152 Variants
- Prioritas: P0 · Fase: M3
- Deskripsi: Component bisa punya variant properties (mis. `style: primary|secondary|ghost`, `size: sm|md|lg`, `state: default|hover`).
- Perilaku:
  - Admin: component set ditampilkan sebagai frame berisi semua variant (grid); properti variant diedit di panel Component.
  - User: dropdown/segmented control per variant property di panel instance (Design mode) dan di toolbar section (Simple mode, "Ganti gaya").
  - Ganti variant (command `setVariant`, menulis `props.variant`) mempertahankan `propValues` dan override per ID node (varian = delta per ID node, 01 DM-048).
  - Catatan: state interaksi (hover/pressed) **bukan** variant axis di dokumen — memakai `states` (01 DM-040, [ED-183](#ed-183-states-hover-pressed-focus-disabled)).
- Acceptance criteria:
  - [ ] Mengganti `style` Button dari primary ke secondary mempertahankan teks custom.

### ED-153 Props panel instance
- Prioritas: P0 · Fase: M3
- Deskripsi: Saat instance terseleksi, bagian teratas tab Design (dan Content panel di Simple mode) menampilkan **props**: text, rich text, image, link, boolean (show/hide elemen), enum/variant, icon, number, color/token, list (array of items, mis. menu navbar, fitur), slot (P1).
- Perilaku:
  - Edit prop = command `setProp` → `instance.props.propValues[key]` (bukan override struktur).
  - Prop list: tambah/hapus/reorder item (mis. menu Navbar), tiap item punya sub-field.
  - Prop terikat data ([05](./05-dynamic-data.md)) → tampil chip binding.
- Acceptance criteria:
  - [ ] Navbar dengan prop list `menu` bisa ditambah item tanpa Detach.

### ED-154 Swap instance
- Prioritas: P0 · Fase: M3
- Deskripsi: Tombol "Swap" (dropdown nama component) → pilih component lain (difilter kategori yang sama, mis. Hero A → Hero B). Props dengan key/tipe sama dan props dengan `semanticRole` sama ([03 CMP-074](./03-components-templates.md#cmp-074-swap-component), 01 DM-079) dipindahkan; sisanya hilang dengan peringatan "3 konten tidak terbawa" + undo.
- Perilaku: Alternatif `Alt+drag` component dari Insert panel ke atas instance = swap (P1, seperti Figma).
- Acceptance criteria:
  - [ ] Swap Hero A → Hero B membawa `title`, `subtitle`, `ctaText`, `image`.

### ED-155 Indikator override & reset overrides
- Prioritas: P0 · Fase: M3
- Deskripsi: Properti yang berbeda dari main component ditandai.
- Perilaku:
  - Di inspector: titik ungu ● di samping properti yang di-override; hover → tooltip nilai asli.
  - Di layers: badge ● pada instance & child yang punya override.
  - Reset: klik kanan properti → "Reset" (command `resetOverride`); tombol "Reset all overrides" di panel instance; context menu "Reset all changes". Reset per child via context menu child.
- Acceptance criteria:
  - [ ] Reset all overrides mengembalikan instance identik main component versi tersebut (props default tetap/di-reset sesuai opsi).

### ED-156 Detach instance
- Prioritas: P0 · Fase: M3
- Deskripsi: `Mod+Alt+B` (command `detachInstance`) → instance menjadi node biasa (frame tree) yang bisa diedit bebas; tidak lagi menerima update.
- Perilaku: Konfirmasi di Simple mode ("Elemen ini tidak akan mendapat pembaruan desain lagi"); Design mode tanpa konfirmasi (undo tersedia). Nested instance di dalamnya tetap instance.
- Acceptance criteria:
  - [ ] Hasil detach dirender identik dengan instance sebelum detach.

### ED-157 Go to main component
- Prioritas: P1 · Fase: M3
- Deskripsi: Untuk local component: kamera pindah & memilih main component (bisa beda page). Untuk library component: tampilkan panel info (nama, versi, changelog, preview) — user biasa tidak bisa mengedit library; Admin mendapat tautan "Buka di Admin mode".
- Acceptance criteria:
  - [ ] Tombol "Kembali ke instance" muncul setelah go to main (seperti Figma).

### ED-158 Update versi component
- Prioritas: P0 · Fase: M3
- Deskripsi: Saat versi baru component library tersedia, instance menampilkan badge "Update tersedia" dan panel "Updates" (Assets) mendaftar semua component yang bisa di-update di website.
- Perilaku: Review perubahan (preview sebelum/sesudah, changelog), pilihan "Update" per instance / per component / semua. Override dipertahankan sesuai aturan migrasi ([03 CMP-054/055](./03-components-templates.md#cmp-054-migrasi-props-saat-breaking-change)). Command `updateInstanceVersion` (versi integer). Satu update = satu transaction undo.
- Acceptance criteria:
  - [ ] Update tidak pernah terjadi otomatis tanpa aksi user.

### ED-159 Slots / nested content (instance swap area)
- Prioritas: P1 · Fase: M4
- Deskripsi: Component bisa mendefinisikan **slot** (area di mana user boleh menaruh node bebas, mis. konten Card, isi Modal). Di editor, slot ditampilkan dengan outline putus-putus ungu dan placeholder "Taruh elemen di sini".
- Acceptance criteria:
  - [ ] Node di-drag ke slot instance tanpa detach.

---

## 19. Assets & Media

### ED-160 Upload gambar (drag-drop, paste, URL)
- Prioritas: P0 · Fase: M2
- Deskripsi: Cara menambah gambar ke website.
- Perilaku:
  - **Drag-drop** file dari OS ke canvas: drop target menentukan parent (dengan marker insertion); drop di atas node image → ganti gambar (indikator "Ganti"); drop di atas frame dengan `Shift` → jadikan image fill (P1).
  - **Paste** dari clipboard (`Mod+V` dengan image data, mis. screenshot) → node image baru di tengah viewport/parent terseleksi.
  - **URL**: di Assets "Tambah dari URL" → server mengunduh (bukan hotlink) dengan validasi tipe & ukuran (anti-SSRF, lihat [07](./07-publishing-hosting.md)/[ARCHITECTURE](../ARCHITECTURE.md)).
  - Format: JPG, PNG, WebP, GIF (animasi → disimpan apa adanya), SVG (disanitasi server-side), AVIF; HEIC (P1, dikonversi).
  - Upload langsung ke object storage via presigned URL; progress per file; batas ukuran per file & total storage per paket ([08](./08-accounts-plans-admin.md)).
- Edge case:
  - Kuota storage penuh (`storage.bytesMax`) → upload ditolak (`PLAN_LIMIT`) dengan CTA upgrade; node tidak dibuat.
  - Offline → upload diantrekan (blob di IndexedDB) dan dilanjutkan saat online; node menampilkan "Menunggu koneksi".
  - Paste gambar dari halaman web (HTML clipboard dengan `<img src>`) → ambil via URL server-side.
- Acceptance criteria:
  - [ ] Drag-drop 10 gambar sekaligus berhasil dengan progress tiap file.
  - [ ] SVG dengan `<script>` ditolak/dibersihkan.

### ED-161 Media library per website
- Prioritas: P0 · Fase: M2
- Deskripsi: Tab Assets → **Media**: grid semua file website (gambar, video P1, dokumen PDF P1, font P2).
- Perilaku:
  - Search nama, filter tipe, sort (terbaru, nama, ukuran), folder (P1), info (dimensi, ukuran, dipakai di N tempat), edit alt text default, rename, hapus (peringatan bila dipakai).
  - Drag dari library ke canvas = insert; klik saat node image terseleksi = replace.
  - "Unused media" filter untuk bersih-bersih storage.
- Acceptance criteria:
  - [ ] Menghapus media yang dipakai menampilkan daftar lokasi pemakaian.

### ED-162 Stock image
- Prioritas: P1 · Fase: M4
- Deskripsi: Pencarian foto stock gratis di dalam editor (tab "Stock" di picker gambar). Gambar yang dipilih diunduh ke media library website (bukan hotlink) dengan atribusi bila disyaratkan.
- Acceptance criteria:
  - [ ] Cari "kopi" mengembalikan hasil relevan (query diterjemahkan ke English bila perlu).

> ❓ OPEN: Sumber stock image (Unsplash API, Pexels API, atau keduanya) dan kebutuhan atribusi/batas rate. Juga apakah AI image generation masuk (lihat [04](./04-ai-agent.md)).

### ED-163 Ikon Lucide di Assets
- Prioritas: P0 · Fase: M2
- Deskripsi: Tab Assets → **Icons**: browser Lucide (sama dengan Icon tool [ED-046](#ed-046-icon-tool)) dengan drag ke canvas. Set ikon lain (P2: brand icons sosial media — WhatsApp, Instagram, TikTok tersedia sejak P0 sebagai set kecil kurasi karena Lucide tidak memuat logo merek).
- Acceptance criteria:
  - [ ] Ikon WhatsApp & Instagram tersedia untuk footer UMKM.

### ED-164 Optimasi gambar otomatis
- Prioritas: P0 · Fase: M4
- Deskripsi: Setiap upload diproses worker (resize multi-ukuran, WebP/AVIF, strip EXIF, blurhash/LQIP). Detail pipeline di [07-publishing-hosting.md](./07-publishing-hosting.md).
- Perilaku editor: Canvas memakai varian ukuran yang sesuai zoom & ukuran node (mis. node 300px di zoom 100% → varian 640w) agar ringan; sebelum varian siap, gunakan file asli/thumbnail lokal (object URL).
- Acceptance criteria:
  - [ ] Canvas tidak memuat file asli > 2 MB bila varian tersedia.

### ED-165 Replace & edit gambar
- Prioritas: P0 · Fase: M2
- Deskripsi: Node image terseleksi → inspector "Image": thumbnail, tombol Ganti (library/upload/stock/URL), fit mode, crop ([ED-104](#ed-104-image-fill)), alt text, loading (lazy/eager — auto: eager untuk gambar pertama di atas fold), link.
- Perilaku: Crop sederhana & rotate 90° (P1) disimpan sebagai parameter render, bukan file baru. Remove background (P2, AI).
- Acceptance criteria:
  - [ ] Ganti gambar mempertahankan ukuran node dan fit mode.

### ED-166 Components & tokens di Assets
- Prioritas: P1 · Fase: M4
- Deskripsi: Tab Assets juga memuat **Components** (local components website + component library yang dipakai) dan **Tokens** ([ED-130](#ed-130-panel-token--theme)).
- Acceptance criteria:
  - [ ] Search di Assets mencari lintas media, components, dan tokens.

---

## 20. Insert Panel

### ED-167 Struktur Insert panel
- Prioritas: P0 · Fase: M3 (library dasar) · M4 (lengkap)
- Deskripsi: Tab Insert (`Alt+3`, atau tombol "+" di toolbar, atau `/` di canvas — P1) berisi:
  1. **Basic**: Frame, Text, Heading, Paragraph, Button, Image, Icon, Divider, Spacer, Video, Map, List, Columns (2/3/4), Grid.
  2. **Sections** (section templates): Navbar, Hero, Features, About, Services, Products, Pricing, Testimonials, Team, Gallery, FAQ, CTA, Contact, Footer, Blog list, Stats, Logo cloud.
  3. **Components**: Card, Badge, Avatar, Tabs, Accordion, Carousel (P1), Modal (P1), Breadcrumb, Pagination, Rating, Social icons, WhatsApp floating button.
  4. **Forms & Data** (dinamis, M7): Form (kontak, pendaftaran), Login/Register, Table, List bound, Dashboard widgets, Search — dengan badge 🔒 bila paket tidak mendukung ([05](./05-dynamic-data.md)).
  5. **Commerce** (M8): Product grid, Product detail, Cart, Checkout button ([06](./06-commerce-payments.md)).
  6. **Pages** (template halaman lengkap): About, Contact, Menu restoran, Katalog.
- Isi library dan metadata: [03-components-templates.md](./03-components-templates.md).
- Acceptance criteria:
  - [ ] Semua kategori dapat di-scroll dan di-collapse; jumlah item tampil per kategori.

### ED-168 Search & kategori
- Prioritas: P0 · Fase: M4
- Deskripsi: Search dengan sinonim ID/EN ("harga" → Pricing, "testimoni" → Testimonials, "kontak" → Contact), filter kategori & gaya (minimal, bold, elegan), filter industri (kuliner, fashion, jasa, properti, pendidikan).
- Perilaku: Hasil di-rank dengan relevansi + popularitas; kosong → saran "Minta AI membuatkan" ([04](./04-ai-agent.md)).
- Acceptance criteria:
  - [ ] Pencarian berjalan di klien < 50 ms untuk 1.000 item (index lokal, mis. MiniSearch).

### ED-169 Preview hover
- Prioritas: P0 · Fase: M4
- Deskripsi: Hover item ≥ 300 ms → preview besar (thumbnail tinggi resolusi atau render live via renderer dengan token website saat ini, P1) di samping panel. Variant ditampilkan sebagai dot yang bisa di-hover.
- Perilaku: Thumbnail dirender dengan **token website user** (P1) agar user melihat hasil sesuai warna brand-nya.
- Acceptance criteria:
  - [ ] Preview muncul ≤ 300 ms setelah delay hover.

### ED-170 Drag ke canvas & smart insert
- Prioritas: P0 · Fase: M3
- Deskripsi: Item bisa di-drag (dnd-kit) ke canvas atau di-klik.
- Perilaku:
  - **Drag**: ghost thumbnail mengikuti pointer; marker insertion tampil di parent auto-layout tujuan (section → hanya di page root antar section; elemen → di frame terdalam yang valid).
  - **Klik**: smart insert — section disisipkan setelah section terseleksi (atau di akhir page sebelum footer); elemen disisipkan setelah node terseleksi di parent yang sama (atau sebagai child jika node terseleksi adalah frame auto-layout).
  - Aturan validitas: section hanya di page root; Navbar disarankan di atas, Footer di bawah (auto-snap ke posisi tsb, dengan opsi abaikan); form hanya di frame biasa (bukan di dalam button/link).
  - Setelah insert: node baru terseleksi, kamera scroll agar terlihat, highlight 1 detik.
- Edge case: Insert component yang membutuhkan fitur paket lebih tinggi (`ComponentDefinition.requires`) → dialog upgrade, tidak disisipkan (error `PLAN_FEATURE`).
- Acceptance criteria:
  - [ ] Klik "Footer" saat tidak ada seleksi menaruhnya di paling bawah.
  - [ ] Drag Hero ke antara Navbar dan Features menyisipkannya di indeks 1.

### ED-171 Blok dinamis di Insert
- Prioritas: P0 · Fase: M7
- Deskripsi: Saat blok dinamis (Form, Table, Login) disisipkan, editor membuka wizard ringkas: pilih/buat collection, mapping field — atau "Biarkan AI mengatur" ([04](./04-ai-agent.md), [05](./05-dynamic-data.md)).
- Acceptance criteria:
  - [ ] Form kontak bisa dipasang dan terhubung ke collection baru dalam ≤ 3 langkah.

### ED-172 Recent & favorit
- Prioritas: P1 · Fase: M4
- Deskripsi: Bagian "Terakhir dipakai" (10 item) dan favorit (bintang) per user di atas Insert panel.
- Acceptance criteria:
  - [ ] Favorit tersimpan lintas website.

---

## 21. Responsif & Breakpoint

### 21.1 Model

- Style setiap node disimpan sebagai `{ base, tablet?, mobile? }` sejak awal ([01](./01-document-model.md)). **Desktop-first cascade** `base → tablet → mobile`: `base` berlaku untuk semua lebar; `tablet` meng-override di ≤ 991px; `mobile` meng-override di ≤ 479px (nilai default `settings.breakpoints` di [01 DM-035](./01-document-model.md#dm-035-definisi-breakpoint) — 01 sumber kebenaran; editor & publish memakai `maxWidth` yang sama).
- Ada dua lapisan yang menentukan tampilan tablet/mobile:
  1. **Auto-responsive rules** (default, selalu aktif): aturan otomatis yang diterapkan renderer berdasarkan struktur (mis. row → column di mobile).
  2. **Manual override** (opsional, per website): user mengedit style per breakpoint secara eksplisit. Override manual menang atas auto rule.
- Preview width (Desktop 1440, Tablet 768, Mobile 390 = `previewWidth` 01, custom) ≠ breakpoint style. Preview width hanya lebar viewport simulasi.

### ED-173 Breakpoint switcher
- Prioritas: P0 · Fase: M2 (preview) · M4 (edit per breakpoint)
- Deskripsi: Kontrol di toolbar: ikon 🖥 Desktop, 💻 Tablet, 📱 Mobile + dropdown lebar (preset + custom input) + toggle "Tampilkan semua".
- Perilaku:
  - Pilih breakpoint = breakpoint frame tersebut aktif & kamera pindah ke frame itu (mode fokus) atau highlight (mode semua).
  - Shortcut: `Alt+Shift+1/2/3` untuk Desktop/Tablet/Mobile (bukan `Mod+1..3` karena bentrok dengan pindah tab browser).
  - Indikator warna pada toolbar & label frame: Desktop netral, Tablet biru muda, Mobile ungu muda — agar user sadar sedang mengedit breakpoint mana.
- Acceptance criteria:
  - [ ] Ganti breakpoint mempertahankan seleksi.

### ED-174 Preview device & custom width
- Prioritas: P0 · Fase: M2
- Deskripsi: Preset: Desktop 1440, Laptop 1280 (P1), Tablet 768, Mobile 390 (default 01), Mobile S 375 & Mobile L 430 (P1); custom width 320–2560. Lebar custom ditampilkan sebagai breakpoint frame tambahan (non-editable style-nya mengikuti cascade).
- Edge case: Lebar custom 900 → style yang berlaku = tablet (karena ≤ 991); label frame menyebut "Menggunakan style: Tablet".
- Acceptance criteria:
  - [ ] Frame custom 320 tidak menampilkan horizontal overflow pada template resmi.

### ED-175 Auto-responsive rules
- Prioritas: P0 · Fase: M4
- Deskripsi: Aturan default yang membuat desain otomatis rapi di tablet/mobile tanpa kerja manual. Diterapkan oleh renderer (bukan disalin ke dokumen) sehingga konsisten di editor & publish. **Rule ID, konfigurasi (`settings.autoResponsive`), dan nilai default mengikuti [01 DM-038](./01-document-model.md#dm-038-auto-responsive-rules-transformasi-renderer)** (`stackRows`, `wrapRowsTablet`, `gridColumns`, `fixedToFluid`, `absoluteToFlow`, `scaleSpacing`, `scaleType`; default `spacingFactor` 0.6, `fontMin` 14); daftar di bawah adalah deskripsi UX dan usulan nilai yang divalidasi di M4.
- Perilaku (aturan awal, bisa dimatikan per node via "Responsive: Auto/Off"):
  1. Auto-layout **Horizontal** dengan ≥ 2 child dan total lebar minimum > lebar breakpoint → **wrap** di tablet; di mobile → **Vertical** (kecuali frame ditandai `keepRow`, mis. navbar item, button group kecil, ikon sosial).
  2. Child **Fill** di row yang menjadi column → width Fill.
  3. Width **Fixed** > lebar breakpoint − padding parent → `max-width: 100%` (width efektif menyusut).
  4. Padding section: skala `desktop → tablet 0.75 → mobile 0.5` (dibulatkan ke token spacing terdekat).
  5. Gap: skala sama dengan padding (min 8).
  6. Font size heading ≥ 32px: `clamp(min, preferred vw, max)` dengan min = 60% (mobile).
  7. Grid kolom: desktop N → tablet `min(N, 2)`… → mobile 1 (kecuali `minmax` auto-fill yang sudah responsif).
  8. Teks auto width di mobile → auto height (wrap).
  9. Frame freeform lebar > breakpoint: opsi per frame — "Scale" ([ED-101](#ed-101-scale-mode-untuk-komposisi-dekoratif)) atau "Stack" (konversi children ke urutan vertikal berdasarkan posisi Y; P1).
  10. Navbar component punya variant mobile (hamburger) yang diaktifkan otomatis di breakpoint `mobile` (≤ 479px, 01 DM-035) (definisi di [03](./03-components-templates.md)).
- Edge case: Aturan bertabrakan dengan override manual → override menang.
- Acceptance criteria:
  - [ ] Semua template resmi lolos uji "no horizontal scroll" di 375, 390 & 768 dengan auto rules saja.
  - [ ] Setiap aturan punya snapshot test renderer.

> ❓ OPEN: Daftar final auto-responsive rules dan nilai skala (0.75/0.5) perlu divalidasi dengan template nyata di M4.

### ED-176 Toggle "Manual override per device"
- Prioritas: P0 (data siap) · Fase: M4 · UI penuh P1 · Fase: M9 jika belum selesai di M4
- Deskripsi: Pengaturan website "Izinkan pengaturan berbeda per device" = `settings.manualResponsive` ([01 DM-037](./01-document-model.md#dm-037-manualresponsive)). Off (default): edit di breakpoint mana pun mengubah `base` (dengan auto rules). On: edit saat Tablet/Mobile aktif menulis ke `tablet`/`mobile`.
- Perilaku:
  - Saat On dan breakpoint non-Desktop aktif, panel inspector menampilkan banner kecil "Mengedit: Mobile — perubahan hanya berlaku di HP".
  - Properti yang tidak boleh berbeda per breakpoint: konten teks, gambar src (P1: art direction gambar per breakpoint), struktur tree, link. Yang boleh: semua style (layout, ukuran, posisi, typography, fill, visibility, dll).
  - Mematikan toggle setelah ada override → konfirmasi: "Pertahankan override (tetap berlaku, tidak bisa diedit)" atau "Hapus semua override".
- Edge case: Website dibuat AI dengan override → toggle otomatis On.
- Acceptance criteria:
  - [ ] Dengan toggle Off, tidak ada nilai yang tertulis ke `tablet`/`mobile`.
  - [ ] Dengan toggle On, edit di Mobile tidak mengubah Desktop.

### ED-177 Indikator override & reset per breakpoint
- Prioritas: P0 · Fase: M4
- Deskripsi: Properti yang di-override di breakpoint aktif ditandai titik berwarna breakpoint (biru tablet / ungu mobile) di samping label input.
- Perilaku:
  - Hover titik → "Desktop: 64 · Tablet: 48 · Mobile: 32".
  - Klik kanan label / titik → "Reset ke Desktop" (hapus override properti itu); tombol "Reset semua override Mobile" untuk node; context menu node "Reset responsive overrides".
  - Layers: badge kecil pada node yang punya override di breakpoint aktif.
- Acceptance criteria:
  - [ ] Reset properti menghapus key dari `style.mobile` (bukan menyalin nilai base); reset massal = command `clearBreakpointOverrides`.

### ED-178 Hide per breakpoint
- Prioritas: P0 · Fase: M4
- Deskripsi: Node bisa disembunyikan di breakpoint tertentu (checkbox Desktop/Tablet/Mobile di tab Settings, atau context menu "Hide on mobile"). Selalu tersedia (tidak memerlukan toggle manual override).
- Perilaku: Disimpan sebagai `style.<bp>.display = "none"` ([01 DM-039](./01-document-model.md#dm-039-visibility-per-breakpoint)); output `display: none` dalam media query; node tetap ada di HTML (beda dengan Hide [ED-059](#ed-059-lock--hide)). Di canvas breakpoint terkait, node tidak tampil; di layers redup dengan badge 📱🚫.
- Edge case: Node tersembunyi di semua breakpoint → warning "Elemen tidak tampil di device mana pun".
- Acceptance criteria:
  - [ ] Elemen "Hide on mobile" tidak tampil di 390 tetapi tampil di 1440 pada output.

### ED-179 Resize breakpoint frame (preview fluid)
- Prioritas: P1 · Fase: M4
- Deskripsi: Drag tepi kanan breakpoint frame untuk melihat perilaku di lebar antara; label lebar live; snap ke preset; lepas → kembali ke preset (kecuali di-pin).
- Acceptance criteria:
  - [ ] Drag 1440 → 800 menampilkan transisi style di 991 secara live.

### ED-180 Responsive checker
- Prioritas: P1 · Fase: M4
- Deskripsi: Panel "Cek tampilan HP" menjalankan deteksi: horizontal overflow, teks < 12px di mobile, tap target < 44px, gambar terpotong, elemen bertumpuk (overlap absolute). Klik issue → zoom ke node. Juga dipanggil di checklist pra-publish.
- Acceptance criteria:
  - [ ] Overflow horizontal terdeteksi di frame mobile canvas dengan `scrollWidth > clientWidth`.

---

## 22. Prototype & Interactions

Versi web dari "Prototype" Figma: fokus pada link, state, dan animasi ringan. Output = CSS murni bila memungkinkan; JS kecil (runtime interactions < 5 KB gzip) hanya bila perlu (scroll reveal, toggle, modal). Detail output di [07](./07-publishing-hosting.md).

### ED-181 Link (navigasi)
- Prioritas: P0 · Fase: M2
- Deskripsi: Node apa pun (frame, button, image, text utuh) bisa diberi link di tab Prototype (atau `Mod+K` saat node terseleksi, bukan saat edit teks).
- Perilaku:
  - Tujuan: Page (dropdown, termasuk halaman dinamis dengan parameter item, M7), Section anchor (dropdown section di page mana pun → `/page#anchor`), URL eksternal, Email, Telepon, WhatsApp, File/asset download, "Kembali ke atas".
  - Opsi: buka di tab baru, `rel="nofollow"` (P1).
  - Node berlink dirender sebagai `<a>` (renderer mengganti tag atau membungkus); validasi nesting (tidak boleh `<a>` di dalam `<a>`, tidak boleh `<button>` di dalam `<a>`) — lihat [ED-219](#ed-219-validasi-nesting-tag).
  - Di canvas, node berlink punya badge 🔗 kecil saat hover; Prototype tab menampilkan label tujuan. Tidak ada panah koneksi antar frame seperti Figma, karena page tidak divisualisasikan sebagai frame terhubung.
  - Link broken (page dihapus, anchor hilang) → ikon ⚠ merah dan masuk checklist pra-publish.
- Acceptance criteria:
  - [ ] Link ke section anchor menghasilkan `href="/tentang#tim"` dan smooth scroll di output.

### ED-182 Model interaction (trigger → action)
- Prioritas: P1 · Fase: M4
- Deskripsi: Interaction = `{ trigger, action, options }`.
- Perilaku:
  - Trigger: **On click/tap**, **On hover** (P1), **On scroll into view**, **On page load** (P2), **While pressing** (= state pressed).
  - Action: Navigate (link), Scroll to (section/top), Open/close overlay (modal/drawer/popup, P1), Toggle visibility (accordion/menu, P1), Change variant (instance — mis. tab aktif, P2), Play animation, Submit form & dynamic actions (→ [05](./05-dynamic-data.md) workflows), Add to cart (→ [06](./06-commerce-payments.md)).
  - Satu node bisa punya banyak interaction (berbeda trigger).
- Acceptance criteria:
  - [ ] Interaction tersimpan sebagai data deklaratif (tidak ada kode JS bebas di dokumen).

### ED-183 States: hover, pressed, focus, (disabled)
- Prioritas: P0 (hover, focus via component) · Fase: M3 · P1 (state pada node non-component) · Fase: M4
- Deskripsi: Node bisa punya style per state: **Default**, **Hover**, **Pressed (active)**, **Focus (focus-visible)**, **Disabled** (untuk form element). Output (mapping 01 DM-040): `hover` → `:hover` dalam `@media (hover: hover)`, `pressed` → `:active`, `focus` → `:focus-visible`, `disabled` → `[aria-disabled=true]`; state `active` (link halaman aktif) ditambahkan renderer.
- Perilaku:
  - Tab Prototype → bagian "States": daftar state dengan tombol "+ Hover". Pilih state → canvas menampilkan node dalam state tersebut (badge "Editing: Hover"), inspector menulis ke `states.hover.<bp>` (field node `states`, bukan di dalam `style` — [01 DM-040](./01-document-model.md#dm-040-interaction-states-sebagai-style-variant)).
  - Properti yang bisa beda per state: fill, stroke, text color, opacity, shadow, transform (scale/translate), cursor, underline. Bukan: layout & ukuran (dilarang di 01 DM-040 — validator menolak).
  - Child styling saat parent hover (mis. card hover → judul berubah warna): pilih child saat parent dalam state hover → disimpan sebagai `parentState` selector (`.card:hover .title`) — P1. ❓ OPEN: field `parentState` belum ada di 01 DM-040; tambahkan ke 01 sebelum diimplementasikan.
  - Transisi otomatis antar state: durasi (default 150 ms), easing (ease-out) → `transition: <props> 150ms ease-out`.
  - Simple mode: state tidak ditampilkan (sudah dibawa oleh component).
- Edge case: Hover tidak ada di layar sentuh → pastikan informasi penting tidak hanya tersedia via hover (warning a11y ringan).
- Acceptance criteria:
  - [ ] Button dengan hover fill berbeda menghasilkan CSS `:hover` dan transition di output.
  - [ ] Preview mode ([§27](#27-preview--publish-entry-point)) menampilkan hover nyata.

### ED-184 Transisi & animasi sederhana
- Prioritas: P1 · Fase: M4
- Deskripsi: Preset animasi masuk (entrance): **Fade**, **Slide up/down/left/right**, **Zoom in**, **Blur in** (P2); dengan durasi, delay, easing, dan stagger untuk children (P1).
- Perilaku:
  - Trigger: on page load (above fold) atau **scroll reveal** (masuk viewport; `IntersectionObserver` di runtime kecil; once/every time).
  - Output: CSS class `@keyframes` + runtime JS kecil untuk toggling class. Menghormati `prefers-reduced-motion` (animasi dimatikan).
  - Di canvas: animasi tidak berjalan; tombol "▶ Putar" di panel untuk preview pada node tersebut.
- Acceptance criteria:
  - [ ] Dengan `prefers-reduced-motion: reduce`, elemen langsung tampil tanpa animasi.
  - [ ] Elemen dengan scroll reveal tetap terlihat bila JS gagal (progressive enhancement: class `js-anim` ditambahkan oleh runtime sebelum menyembunyikan).

### ED-185 Sticky & fixed position
- Prioritas: P0 (sticky navbar) · Fase: M4 · P1 (fixed/floating) · Fase: M4
- Deskripsi: Properti "Position": **Static/Flow** (default), **Sticky** (top offset → `position: sticky; top: N`), **Fixed** (menempel di viewport: pojok kanan bawah dsb. → `position: fixed`, mis. tombol WhatsApp mengambang).
- Perilaku:
  - Sticky hanya bermakna di dalam parent yang bisa di-scroll; di canvas, sticky disimulasikan di Preview mode saja; di canvas mode desain, badge "Sticky" ditampilkan.
  - Fixed node di canvas ditempatkan relatif ke breakpoint frame (viewport simulasi) pada area "fold" pertama.
  - Navbar component default sticky (bisa dimatikan); opsi "Sembunyikan saat scroll ke bawah" (P2, JS kecil).
- Edge case: Sticky di dalam parent `overflow:hidden` tidak bekerja (CSS) → warning.
- Acceptance criteria:
  - [ ] Navbar sticky tetap di atas saat scroll di preview & output.

### ED-186 Scroll behavior
- Prioritas: P1 · Fase: M4
- Deskripsi: Pengaturan page: smooth scroll untuk anchor (`scroll-behavior: smooth`), offset anchor untuk sticky header (`scroll-margin-top` otomatis = tinggi navbar sticky), scroll snap untuk section (P2), horizontal scroll container (carousel sederhana: `overflow-x:auto; scroll-snap-type:x mandatory`).
- Acceptance criteria:
  - [ ] Klik link anchor tidak membuat judul section tertutup navbar sticky.

### ED-187 Overlay: modal, drawer, popup
- Prioritas: P1 · Fase: M4
- Deskripsi: Frame bisa ditandai sebagai **overlay** (modal/drawer/popup) yang tersembunyi default dan dibuka oleh interaction. Di canvas, overlay ditampilkan di area khusus di samping breakpoint frame ("Overlays") agar bisa diedit.
- Perilaku: Output memakai `<dialog>` native (focus trap & Esc bawaan) dengan runtime JS kecil; opsi tutup saat klik backdrop; animasi masuk.
- Acceptance criteria:
  - [ ] Modal bisa dibuka dari button dan ditutup dengan Esc di output; fokus kembali ke pemicu.

### ED-188 Toggle visibility (accordion, menu mobile)
- Prioritas: P1 · Fase: M4
- Deskripsi: Action "Toggle" mengubah visibility target node; untuk FAQ, gunakan `<details>/<summary>` native bila struktur memungkinkan (tanpa JS).
- Acceptance criteria:
  - [ ] Accordion FAQ berfungsi tanpa JS di output.

### ED-189 Runtime JS interaksi & batasannya
- Prioritas: P1 · Fase: M4
- Deskripsi: Semua interaksi yang butuh JS ditangani oleh satu micro-runtime kecil platform (`pf-runtime.<hash>.js`, vanilla, modular per behavior — [07 PUB-029](./07-publishing-hosting.md#pub-029-islands-js-bundle); dimuat hanya jika page memakai interaksi), dikonfigurasi lewat atribut `data-*` yang dihasilkan renderer. Tidak ada JS user. Ukuran target < 5 KB gzip. Detail di [07](./07-publishing-hosting.md).
- Acceptance criteria:
  - [ ] Page tanpa interaksi JS tidak memuat `pf-runtime`.

---

## 23. Clipboard

### ED-190 Copy, cut, paste
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+C`, `Mod+X`, `Mod+V` untuk node.
- Perilaku:
  - Copy menulis ke clipboard sistem dengan beberapa format: `text/html` (berisi HTML render + payload JSON node dalam komentar/atribut `data-platform-clipboard` — base64 dari subtree + token & asset references), `text/plain` (konten teks node), dan `web application/x-platform-nodes` (P1, Async Clipboard custom formats di Chrome).
  - Paste: jika payload Platform terdeteksi → rekonstruksi node dengan **id baru**; referensi asset & component dipertahankan (asset dari website lain disalin, lihat [ED-196](#ed-196-paste-antar-website--dari-sumber-luar)).
  - Lokasi paste: (1) ke dalam frame terseleksi (jika frame & bukan node yang dicopy itu sendiri) sebagai child terakhir/di indeks setelah seleksi; (2) jika node terseleksi bukan frame → sebagai sibling setelahnya; (3) tanpa seleksi → di tengah viewport (draft area P1 / page root jika section).
  - Node absolute yang di-paste ke parent yang sama dengan sumber → diletakkan di posisi yang sama (mengikuti Figma bila posisi itu terlihat di viewport); jika tidak terlihat → di tengah viewport.
  - Cut = copy + delete (satu langkah undo).
- Edge case:
  - Paste section saat seleksi berada di dalam frame → section tidak dikonversi; karena section hanya boleh di page root, paste diarahkan ke page root setelah section induk dari seleksi (toast info).
  - Paste instance dari library versi yang lebih baru dari yang dipakai website → instance dipaste dengan versi sumber (dua versi bisa koeksis).
  - Clipboard API diblokir (izin) → fallback ke clipboard internal in-memory + pesan.
- Acceptance criteria:
  - [ ] Copy-paste node bersarang 3 level menghasilkan id baru semua dan tampilan identik.
  - [ ] Copy di tab A, paste di tab B (website sama) berfungsi.

### ED-191 Paste in place
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+Shift+V` menempel di posisi & parent yang sama persis dengan sumber (jika parent ada di page aktif); jika tidak ada → koordinat world yang sama di breakpoint aktif.
- Acceptance criteria:
  - [ ] Paste in place di page lain dengan struktur sama menaruh node di koordinat yang sama.

### ED-192 Paste to replace (paste over selection)
- Prioritas: P1 · Fase: M4
- Deskripsi: `Mod+Shift+R` (Figma) — mengganti node terseleksi dengan isi clipboard pada posisi & ukuran yang sama.
- Acceptance criteria:
  - [ ] Replace 5 node terseleksi dengan satu node clipboard → 5 salinan di posisi masing-masing.

### ED-193 Duplicate
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+D` menduplikat seleksi; di auto-layout → disisipkan tepat setelah sumber; di freeform → posisi sama dengan sumber (mengikuti Figma), kecuali "smart duplicate" setelah Alt+drag ([ED-071](#ed-071-duplikat-dengan-altdrag)).
- Perilaku: Duplikat section menyisipkan section baru setelahnya (penting untuk Simple mode).
- Acceptance criteria:
  - [ ] Mod+D pada card di grid menghasilkan card baru tepat setelahnya.

### ED-194 Copy / paste properties
- Prioritas: P1 · Fase: M4
- Deskripsi: `Mod+Alt+C` copy properties (style visual: fill, stroke, effects, radius, opacity, typography, layout auto-layout, sizing); `Mod+Alt+V` paste properties ke seleksi (bisa multi).
- Perilaku: Tidak menyalin konten, posisi, nama, atau interactions (P2: pilih kategori via dialog). Token tetap terikat.
- Acceptance criteria:
  - [ ] Paste properties dari Button A ke frame B menyalin fill, radius, padding, tanpa mengubah teks.

### ED-195 Copy as PNG / SVG / CSS / text
- Prioritas: P2 · Fase: M9
- Deskripsi: `Mod+Shift+C` copy as PNG (render via `html-to-image`/server Playwright); "Copy as SVG" untuk vector/icon; "Copy as CSS" (untuk developer, P2); "Copy text" (P1) menyalin teks seluruh seleksi.
- Acceptance criteria:
  - [ ] Copy as PNG menghasilkan gambar 2× resolusi.

### ED-196 Paste antar website & dari sumber luar
- Prioritas: P0 (antar website) · Fase: M4 · P1 (sumber luar) · Fase: M4
- Deskripsi: Paste node dari website lain milik user yang sama.
- Perilaku:
  - Antar website: asset (gambar) disalin ke media library website tujuan (server-side copy) — node menampilkan sumber lama sampai salinan siap. Token: jika token dengan nama sama ada → pakai token tujuan (tampilan bisa berubah sesuai tema); jika tidak ada → nilai di-detach menjadi literal (opsi "Bawa token juga" P1). Local component → disalin sebagai local component baru (atau di-detach, pilihan dialog).
  - Dari luar: teks biasa → node teks; rich HTML → teks dengan mark yang didukung; gambar → image node; SVG markup → icon/vector node (disanitasi); URL → teks berlink (atau embed jika YouTube/Maps, dengan prompt).
  - Paste dari Figma asli: **tidak didukung** (tidak ada import Figma) — Figma clipboard HTML terdeteksi → toast "Konten Figma tidak bisa ditempel. Gunakan AI untuk membuat ulang dari screenshot" (P2 ide).
- Edge case: Paste ke website di paket Free berisi blok dinamis → blok ditandai terkunci.
- Acceptance criteria:
  - [ ] Paste dari website A ke B tidak mereferensikan URL asset milik A setelah proses salin selesai.

---

## 24. Undo/Redo, History & Autosave

### ED-197 Undo/redo dengan Y.UndoManager
- Prioritas: P0 · Fase: M1
- Deskripsi: `Mod+Z` undo, `Mod+Shift+Z` / `Mod+Y` (Windows) redo. Implementasi `Y.UndoManager` atas struktur Yjs dokumen website.
- Perilaku:
  - `trackedOrigins` = origin user lokal (`TxOrigin { kind: "user", sessionId }`) dan origin AI run yang diterapkan user ini (`ai:<runId>` = `{ kind: "ai", runId }`, satu instance objek per run — [01 DM-060](./01-document-model.md#dm-060-transaction-origin--undo-grouping)), **bukan** `system` atau `remote` (kolaborator) — undo hanya membatalkan perubahan sendiri (prinsip Figma).
  - `captureTimeout` 500 ms untuk mengelompokkan ketikan/nudge; aksi diskrit (drag commit, paste) memanggil `stopCapturing()` agar tidak digabung.
  - Meta per stack item: seleksi sebelum/sesudah, page id, breakpoint aktif, label aksi ("Ubah fill", "Pindah 3 layer") untuk tooltip.
  - Undo/redo memulihkan seleksi dan berpindah ke page tempat perubahan terjadi (kamera tidak berpindah kecuali node di luar viewport → pan halus).
  - Kedalaman stack: 200 langkah (memori); tidak dipersist antar sesi (Figma juga tidak).
  - Saat text editing: undo di level Tiptap untuk sesi tersebut; setelah keluar, satu sesi edit = satu langkah.
- Edge case:
  - Undo perubahan yang node-nya sudah dihapus kolaborator → Yjs menangani; jika tidak ada efek, UndoManager lanjut ke item berikutnya.
  - Undo setelah publish tidak membatalkan publish (publish = snapshot terpisah).
- Acceptance criteria:
  - [ ] 50 aksi beragam → 50× undo → dokumen identik state awal (deep equal); 50× redo → identik state akhir.
  - [ ] Undo tidak membatalkan perubahan origin remote (test dengan dua Y.Doc tersinkron).

### ED-198 Transaction & origin
- Prioritas: P0 · Fase: M1
- Deskripsi: Semua mutasi dokumen lewat lapisan `commands` (`packages/document-model`, daftar & signature di [01 DM-074](./01-document-model.md#dm-074-daftar-command-signature), mis. `createNode`, `moveNode`, `updateStyle`, `setBreakpointOverride`, `createPage`, `setProp`, `detachInstance`) yang membungkus `doc.transact(fn, origin)`. Command yang butuh fitur/batas paket mengembalikan error `PLAN_FEATURE` / `PLAN_LIMIT` (kode 08) untuk ditampilkan sebagai upsell.
- Perilaku:
  - Satu aksi user = satu transaction (bahkan bila menyentuh banyak node).
  - AI run: tool call berjalan di draft (fork) dan baru masuk dokumen saat **Terapkan**, sebagai satu transaction origin `ai:<runId>` = satu grup undo ([04 §7](./04-ai-agent.md#7-draft--transaction-model), [ED-010](#ed-010-ai-panel)); UI menyediakan "Batalkan semua perubahan AI ini".
  - Perubahan sistem (migrasi skema, repair, update version component otomatis yang disetujui) memakai origin `{ kind: "system", reason }` dan tidak masuk undo kecuali dimulai user; update dari server/kolaborator = `{ kind: "remote" }`.
- Acceptance criteria:
  - [ ] Tidak ada mutasi Yjs di luar lapisan commands (lint rule / code review checklist).

### ED-199 Version history
- Prioritas: P1 · Fase: M4 (snapshot otomatis & restore) · P0 untuk "snapshot saat publish" · Fase: M4
- Deskripsi: Panel "Version history" (menu File, atau `Mod+Alt+H`) berisi daftar snapshot.
- Perilaku:
  - Snapshot otomatis: setiap publish (berlabel "Dipublish 12 Okt 14:03"), setiap 30 menit sesi aktif bila ada perubahan, sebelum operasi besar (AI redesign, update component massal, restore).
  - Snapshot bernama: "Simpan versi…" (nama + deskripsi).
  - Lihat versi: canvas read-only menampilkan versi tersebut (badge "Melihat versi 3 Okt"); tombol "Restore versi ini" (membuat snapshot state sekarang dulu, lalu menerapkan state versi sebagai transaction baru — bisa di-undo), "Duplikat sebagai website baru" (P2).
  - Retensi per paket (Free: 7 hari / 10 versi; berbayar lebih lama — angka di [08](./08-accounts-plans-admin.md)).
  - Penyimpanan snapshot: tabel `document_snapshots` (`state` Yjs + `json`, `kind` `auto`/`named`/`publish`/`pre_ai`) — [01 DM-061](./01-document-model.md#dm-061-penyimpanan--encoding), [ARCHITECTURE §7](../ARCHITECTURE.md#7-penyimpanan-dokumen-editor).
- Acceptance criteria:
  - [ ] Restore versi lama → state dokumen sama dengan snapshot (deep equal) dan bisa di-undo.

> ❓ OPEN: Retensi version history per paket (jumlah & durasi).

### ED-200 Autosave & status indicator
- Prioritas: P0 · Fase: M1
- Deskripsi: Tidak ada tombol Save. Sejak M1 setiap Yjs update dikirim lewat **Hocuspocus** (`HocuspocusProvider` → `apps/realtime`, single-editor; multiplayer M9+) dan dipersist ke IndexedDB lokal (`y-indexeddb`). Tidak ada endpoint autosave HTTP terpisah ([ARCHITECTURE §7.2](../ARCHITECTURE.md#72-write-path-autosave)).
- Perilaku:
  - Status di toolbar: **"Tersimpan"** (✓ abu; dikonfirmasi server lewat stateless message `saved:{seq}`), **"Menyimpan…"** (spinner; muncul bila ada update tertunda > 500 ms), **"Offline — perubahan disimpan di perangkat"** (ikon awan coret, kuning), **"Gagal menyimpan — mencoba lagi"** (merah, dengan tombol "Coba sekarang" dan detail).
  - Provider mengirim update real time lewat WebSocket; server mem-flush ke Postgres dengan debounce (ARCHITECTURE §7.2). Saat `visibilitychange: hidden` / `beforeunload` editor memastikan update tertunda terkirim lewat koneksi WS (dan selalu ada di IndexedDB).
  - `beforeunload` memperingatkan jika ada update yang belum terkonfirmasi server.
  - `Mod+S` → flush segera + toast "Semua perubahan sudah tersimpan otomatis" (mencegah dialog save browser).
- Acceptance criteria:
  - [ ] Menutup tab 1 detik setelah edit tidak kehilangan perubahan (dipulihkan dari server atau IndexedDB).
  - [ ] Status berubah sesuai kondisi jaringan (diuji dengan Playwright offline mode).

### ED-201 Offline & konflik
- Prioritas: P0 (offline dasar) · Fase: M1 · P1 (multi-tab/multi-device) · Fase: M4
- Deskripsi: Editor tetap bisa dipakai saat offline; sinkron otomatis saat online.
- Perilaku:
  - Offline: semua edit tersimpan di IndexedDB; upload gambar diantrekan ([ED-160](#ed-160-upload-gambar-drag-drop-paste-url)); fitur yang butuh server (AI, publish, stock image, insert component library yang belum di-cache) disabled dengan tooltip.
  - Online kembali: Yjs sync (state vector diff) → merge otomatis tanpa dialog (CRDT).
  - **Multi-tab / multi-device** (1 akun, sebelum multiplayer): kedua sesi tersinkron via server (BroadcastChannel untuk tab di browser sama) — tidak ada lock. Banner "Website ini juga dibuka di tab/perangkat lain".
  - Konflik semantik (mis. dua sesi mengedit teks yang sama secara bersamaan): CRDT menghasilkan gabungan; untuk properti skalar, last-writer-wins (Yjs). Tidak ada UI konflik di P0.
  - Validasi pasca-merge: document invariant checker (mis. section hanya di page root, tidak ada siklus parent) dijalankan setelah sync; perbaikan otomatis dengan origin `system` + log ke Sentry.
- Edge case: Offline > 7 hari dengan banyak perubahan lalu skema dokumen di server sudah migrasi → klien memaksa reload editor versi baru; update lokal dimigrasi saat load ([ED-230](#ed-230-migrasi-skema--dokumen-invalid)).
- Acceptance criteria:
  - [ ] Edit offline 5 menit → online → server memiliki semua perubahan.
  - [ ] Dua tab mengedit node berbeda bersamaan → keduanya tersimpan.

---

## 25. Keyboard Shortcuts & Command Palette

### ED-202 Sistem shortcut
- Prioritas: P0 · Fase: M2
- Deskripsi: Shortcut didaftarkan terpusat (registry `shortcuts.ts`) memakai **tinykeys**, dengan konteks (`canvas`, `textEditing`, `layers`, `input`, `modal`).
- Perilaku:
  - Satu sumber kebenaran: registry dipakai oleh handler, tooltip, menu, command palette, dan cheat sheet — tidak ada string shortcut hardcoded di UI.
  - Shortcut satu huruf (V, F, R, T…) hanya aktif saat fokus di canvas/layers (bukan di input).
  - Mendeteksi layout keyboard non-QWERTY via `event.code` untuk huruf tool (P1) agar posisi fisik konsisten; shortcut berbasis simbol (`[`, `]`, `\`) memakai `event.key`.
  - Kustomisasi shortcut oleh user: P2.
- Acceptance criteria:
  - [ ] Semua shortcut di tabel ED-203 punya test unit registry (tidak ada duplikat dalam konteks yang sama).

### ED-203 Tabel shortcut lengkap
- Prioritas: P0 (baris bertanda P0) · Fase: M2..M4
- Deskripsi: Tabel normatif. Kolom Win/Linux dan Mac. `⌘`=Cmd, `⌥`=Option, `⇧`=Shift, `⌃`=Control.

**Tools**

| Aksi | Windows/Linux | Mac | Prio |
|---|---|---|---|
| Move/Select | `V` | `V` | P0 |
| Frame | `F` atau `A` | `F` atau `A` | P0 |
| Section | `Shift+S` | `⇧S` | P0 |
| Rectangle | `R` | `R` | P0 |
| Ellipse | `O` | `O` | P0 |
| Line | `L` | `L` | P1 |
| Arrow | `Shift+L` | `⇧L` | P2 |
| Text | `T` | `T` | P0 |
| Image (place) | `Ctrl+Shift+K` | `⌘⇧K` | P0 |
| Icon picker | `Shift+I` | `⇧I` | P0 |
| Hand | `H` (tahan `Space`) | `H` (tahan `Space`) | P0 |
| Pen | `P` | `P` | P2 |
| Comment | `C` | `C` | P2 |
| Insert panel cepat | `/` (canvas) | `/` | P1 |

**Seleksi**

| Aksi | Windows/Linux | Mac | Prio |
|---|---|---|---|
| Select all (dalam konteks) | `Ctrl+A` | `⌘A` | P0 |
| Select matching layers | `Ctrl+Alt+A` | `⌘⌥A` | P1 |
| Deep select | `Ctrl+klik` | `⌘klik` | P0 |
| Tambah/kurangi seleksi | `Shift+klik` | `⇧klik` | P0 |
| Select children | `Enter` | `Enter` | P0 |
| Select parent | `Shift+Enter` atau `\` | `⇧Enter` atau `\` | P0 |
| Next / previous sibling | `Tab` / `Shift+Tab` | `Tab` / `⇧Tab` | P0 |
| Clear selection | `Esc` | `Esc` | P0 |
| Find layer | `Ctrl+F` | `⌘F` | P1 |

**Edit & transform**

| Aksi | Windows/Linux | Mac | Prio |
|---|---|---|---|
| Undo | `Ctrl+Z` | `⌘Z` | P0 |
| Redo | `Ctrl+Shift+Z` / `Ctrl+Y` | `⌘⇧Z` | P0 |
| Copy / Cut / Paste | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | `⌘C` / `⌘X` / `⌘V` | P0 |
| Paste in place | `Ctrl+Shift+V` | `⌘⇧V` | P0 |
| Paste to replace | `Ctrl+Shift+R` | `⌘⇧R` | P1 |
| Duplicate | `Ctrl+D` | `⌘D` | P0 |
| Delete | `Delete` / `Backspace` | `⌫` / `⌦` | P0 |
| Copy properties | `Ctrl+Alt+C` | `⌘⌥C` | P1 |
| Paste properties | `Ctrl+Alt+V` | `⌘⌥V` | P1 |
| Copy as PNG | `Ctrl+Shift+C` | `⌘⇧C` | P2 |
| Rename layer | `Ctrl+R` | `⌘R` | P0 |
| Nudge 1px / 10px | `Arrow` / `Shift+Arrow` | `Arrow` / `⇧Arrow` | P0 |
| Flip horizontal / vertical | `Shift+H` / `Shift+V` | `⇧H` / `⇧V` | P1 |
| Opacity 10–100% | `1`…`9`, `0` | `1`…`9`, `0` | P0 |
| Lock / unlock | `Ctrl+Shift+L` | `⌘⇧L` | P0 |
| Hide / show | `Ctrl+Shift+H` | `⌘⇧H` | P0 |
| Bring forward / send backward | `Ctrl+]` / `Ctrl+[` | `⌘]` / `⌘[` | P0 |
| Bring to front / send to back | `Ctrl+Alt+]` / `Ctrl+Alt+[` | `⌘⌥]` / `⌘⌥[` | P0 |

**Struktur, layout, component**

| Aksi | Windows/Linux | Mac | Prio |
|---|---|---|---|
| Add auto layout / wrap in auto layout | `Shift+A` | `⇧A` | P0 |
| Remove auto layout | `Shift+Alt+A` | `⇧⌥A` | P0 |
| Group | `Ctrl+G` | `⌘G` | P1 |
| Ungroup | `Ctrl+Shift+G` | `⌘⇧G` | P1 |
| Frame selection | `Ctrl+Alt+G` | `⌘⌥G` | P0 |
| Create component | `Ctrl+Alt+K` | `⌘⌥K` | P0 (Admin) |
| Detach instance | `Ctrl+Alt+B` | `⌘⌥B` | P0 |
| Use as mask | `Ctrl+Alt+M` | `⌘⌥M` | P2 |
| Align left/center/right | `Alt+A` / `Alt+H` / `Alt+D` | `⌥A` / `⌥H` / `⌥D` | P0 |
| Align top/middle/bottom | `Alt+W` / `Alt+V` / `Alt+S` | `⌥W` / `⌥V` / `⌥S` | P0 |
| Distribute horizontal / vertical | `Alt+Shift+H` / `Alt+Shift+V` | `⌥⇧H` / `⌥⇧V` | P0 |
| Tidy up | `Ctrl+Alt+T` | `⌃⌥T` | P2 |
| Add link | `Ctrl+K` (node terseleksi) | `⌘K` | P0 |

**Teks (saat text editing)**

| Aksi | Windows/Linux | Mac | Prio |
|---|---|---|---|
| Bold / Italic / Underline | `Ctrl+B` / `Ctrl+I` / `Ctrl+U` | `⌘B` / `⌘I` / `⌘U` | P0 |
| Strikethrough | `Ctrl+Shift+X` | `⌘⇧X` | P0 |
| Link | `Ctrl+K` | `⌘K` | P0 |
| Bulleted / numbered list | `Ctrl+Shift+8` / `Ctrl+Shift+7` | `⌘⇧8` / `⌘⇧7` | P0 |
| Align left/center/right/justify | `Ctrl+Alt+L/T/R/J` | `⌘⌥L/T/R/J` | P0 |
| Increase / decrease font size | `Ctrl+Shift+>` / `Ctrl+Shift+<` | `⌘⇧>` / `⌘⇧<` | P1 |
| Line break | `Shift+Enter` | `⇧Enter` | P0 |
| Keluar edit | `Esc` | `Esc` | P0 |

**View & navigasi**

| Aksi | Windows/Linux | Mac | Prio |
|---|---|---|---|
| Pan | `Space+drag`, middle mouse, wheel | sama / trackpad | P0 |
| Zoom in / out | `Ctrl+=` / `Ctrl+-`, `+` / `-` | `⌘=` / `⌘-` | P0 |
| Zoom (pointer) | `Ctrl+wheel`, pinch | `⌘wheel`, pinch | P0 |
| Zoom to fit | `Shift+1` | `⇧1` | P0 |
| Zoom to selection | `Shift+2` | `⇧2` | P0 |
| Zoom 100% | `Shift+0` | `⇧0` | P0 |
| Next / prev breakpoint frame | `Shift+N` / `Shift+P` | `⇧N` / `⇧P` | P1 |
| Breakpoint Desktop / Tablet / Mobile | `Alt+Shift+1/2/3` | `⌥⇧1/2/3` | P0 |
| Rulers | `Shift+R` | `⇧R` | P1 |
| Layout grids | `Ctrl+Shift+4` | `⌃G` | P1 |
| Pixel grid | `Shift+'` | `⇧'` | P1 |
| Toggle UI (sembunyikan panel) | `Ctrl+\` | `⌘\` | P1 |
| Layers / Assets / Insert / Pages | `Alt+1` / `Alt+2` / `Alt+3` / `Alt+4` | `⌥1` … `⌥4` | P0 |
| Preview | `Ctrl+Enter` | `⌘Enter` | P0 |
| Command palette | `Ctrl+K`* / `Ctrl+/` | `⌘K`* / `⌘/` | P0 |
| Shortcut cheat sheet | `Ctrl+Shift+/` | `⌘⇧/` | P0 |
| AI panel | `Ctrl+J` | `⌘J` | P0 (M6) |
| Simple/Design mode | `Ctrl+Shift+M` | `⌘⇧M` | P0 (M4) |
| Version history | `Ctrl+Alt+H` | `⌘⌥H` | P1 |
| Save (flush) | `Ctrl+S` | `⌘S` | P0 |

\* **Konflik `Mod+K`**: Figma memakai `Mod+K` untuk scale tool/link, banyak web app memakai `Mod+K` untuk command palette. Aturan: `Mod+K` = **Add link** bila ada node terseleksi atau sedang text editing; selain itu `Mod+K` = command palette. `Mod+/` selalu command palette.

> ❓ OPEN: Shortcut layout grid. Figma memakai `Ctrl+G` (Mac: `⌃G`), yang di Windows bentrok dengan Group (`Ctrl+G`). Usulan: Windows `Ctrl+Shift+4`, Mac `⌃G`. Konfirmasi setelah uji pengguna.

- Acceptance criteria:
  - [ ] Cheat sheet in-app dihasilkan dari registry dan sama dengan tabel ini.

### ED-204 Command palette
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+/` (dan `Mod+K` tanpa seleksi) membuka palette (cmdk) untuk mencari & menjalankan perintah.
- Perilaku:
  - Sumber: semua perintah registry (dengan shortcut ditampilkan), "Go to page…", "Go to layer…" (cari nama node), "Insert…" (item Insert panel), "Apply token…", "Switch breakpoint", "Toggle setting…", perintah AI ("Tanya AI: …" mengirim teks ke AI panel).
  - Fuzzy search bilingual (nama perintah ID & EN keduanya diindeks).
  - Recent commands di atas; `Enter` jalankan; `Tab` masuk ke sub-pilihan.
  - Perintah yang tidak tersedia di konteks (mis. "Detach" tanpa instance) disembunyikan atau disabled dengan alasan.
- Acceptance criteria:
  - [ ] Mengetik "auto" menampilkan "Add auto layout" dan "Tambah auto layout" sebagai satu item.

### ED-205 Quick actions & cheat sheet
- Prioritas: P1 · Fase: M4
- Deskripsi: Cheat sheet visual (`Mod+Shift+/`) berupa overlay dengan kategori & pencarian; mode "tahan Ctrl/Cmd 1 detik" menampilkan hint shortcut di toolbar (P2). Quick actions = item pertama palette berdasarkan konteks seleksi (mis. pada image: "Ganti gambar", "Edit alt text", "Hapus background (AI)").
- Acceptance criteria:
  - [ ] Cheat sheet dapat dicari dan ditutup dengan Esc.

---

## 26. Context Menu

### ED-206 Context menu klik kanan
- Prioritas: P0 · Fase: M2 (item P0), bertahap
- Deskripsi: Klik kanan di canvas atau layers membuka menu kontekstual (Radix ContextMenu), setiap item menampilkan shortcut dari registry. Keyboard: `Shift+F10` / tombol Menu membuka context menu seleksi.
- Daftar item — **pada node terseleksi**:

| Grup | Item | Kondisi | Prio |
|---|---|---|---|
| Clipboard | Copy, Cut, Paste, Paste here (di posisi klik), Paste to replace | — | P0/P1 |
| Clipboard | Copy as ▸ PNG, SVG, CSS, Text | — | P2/P1 |
| Clipboard | Copy properties, Paste properties | — | P1 |
| Edit | Duplicate, Delete, Rename | — | P0 |
| Select | Select layer ▸ (daftar node di titik klik), Select parent, Select children, Select matching layers | — | P0/P1 |
| Arrange | Bring to front, Bring forward, Send backward, Send to back | — | P0 |
| Structure | Group selection, Ungroup, Frame selection, Remove frame, Convert to frame/group | sesuai tipe | P0/P1 |
| Layout | Add auto layout, Remove auto layout, Use absolute position, Convert to grid | frame/seleksi | P0/P1 |
| Visibility | Show/Hide, Lock/Unlock, Hide on ▸ Desktop/Tablet/Mobile | — | P0 |
| Responsive | Reset responsive overrides (breakpoint aktif / semua) | ada override | P0 |
| Component | Create component | Admin / local P1 | P0 |
| Component | Go to main component, Swap instance ▸, Reset all overrides, Detach instance, Update to latest version | instance | P0/P1 |
| Section | Move up, Move down, Save as my section (P2), Convert to section | section | P0 |
| Content | Edit text, Replace image, Edit alt text, Add link | tipe sesuai | P0 |
| Data | Bind to data…, Unbind | paket dinamis, M7 | P0 (M7) |
| AI | Edit dengan AI…, Buat variasi, Tulis ulang teks, Terjemahkan, Perbaiki responsif | M6 | P0 (M6) |
| Tokens | Detach all tokens, Create style from selection | — | P1 |
| Info | Show in layers, Zoom to selection, Copy link to node (P2, kolaborasi) | — | P0 |

- Daftar item — **pada area kosong canvas**: Paste here, Select all, Zoom to fit, Zoom 100%, Show/hide rulers, Show/hide layout grid, Show all hidden layers, Unlock all, Add section here (antar section), Page settings.
- Daftar item — **pada baris Pages panel**: Rename, Duplicate, Set as homepage, Page settings, Copy link, Delete.
- Daftar item — **pada media di Assets**: Insert, Replace selected image, Rename, Edit alt text, Copy URL, Show usages, Delete.
- Perilaku: Menu panjang dikelompokkan dengan separator; item tidak relevan disembunyikan (bukan disabled) kecuali karena paket (disabled + ikon 🔒). Klik kanan pada node yang belum terseleksi → pilih dulu node itu (aturan kedalaman) lalu tampilkan menu.
- Acceptance criteria:
  - [ ] Context menu muncul < 50 ms dan tidak keluar dari layar (collision handling Radix).
  - [ ] Klik kanan di dalam input teks memakai menu native browser.

---

## 27. Preview & Publish Entry Point

### ED-207 Preview interaktif di editor
- Prioritas: P0 · Fase: M2
- Deskripsi: `Mod+Enter` atau tombol ▶ → overlay preview full-screen di dalam editor yang merender page dengan renderer mode `preview` (link berfungsi antar page, hover/pressed nyata, animasi berjalan, sticky aktif, form bisa diisi tetapi submit disimulasikan kecuali "Data preview" aktif).
- Perilaku:
  - Bar atas preview: device switcher (Desktop/Tablet/Mobile/custom, rotate untuk mobile), page dropdown, tombol "Buka di tab baru" (URL preview draft bertoken, [ED-209](#ed-209-share-preview-link)), tombol "Kembali ke editor" (`Esc`).
  - Lebar device disimulasikan dengan container lebar tetap + `iframe` (agar media query nyata bekerja). Preview **menggunakan iframe** (berbeda dengan canvas) agar `vw`, media query, `position: fixed`, dan scroll nyata identik dengan publish.
  - Preview mencerminkan state draft terbaru (bukan versi publish).
- Acceptance criteria:
  - [ ] Media query tablet & mobile aktif sesuai lebar iframe.
  - [ ] Navigasi antar page di preview tidak meninggalkan editor.

> ✅ Diputuskan (M0 spike, T0.8.2, 2026-10-13): canvas **tanpa iframe** — setiap breakpoint frame dirender di dokumen yang sama dengan style ter-resolve per breakpoint (`resolveStyle`, DM-036); preview & publish memakai media query nyata. Lihat [ADR-013](../ARCHITECTURE.md#adr-013-breakpoint-frame-canvas-tanpa-iframe-class-scope).

### ED-208 Publish entry point & checklist pra-publish
- Prioritas: P0 · Fase: M4
- Deskripsi: Tombol **Publish** di toolbar membuka popover: URL situs (subdomain/custom domain), status ("Ada perubahan belum dipublish"), checklist pra-publish, tombol Publish. Proses publish, build, hosting di [07-publishing-hosting.md](./07-publishing-hosting.md).
- Perilaku:
  - Checklist (non-blocking kecuali error kritis): link broken, gambar tanpa alt, halaman tanpa title/description, overflow mobile ([ED-180](#ed-180-responsive-checker)), kontras rendah, H1 ganda/kosong, blok dinamis terkunci paket, upload belum selesai (blocking), node draft (info).
  - Klik item checklist → zoom ke node bermasalah.
  - Setelah publish sukses: toast dengan link "Lihat situs", snapshot versi dibuat ([ED-199](#ed-199-version-history)).
  - Dropdown Publish: "Publish", "Lihat situs", "Pengaturan domain", "Unpublish" (konfirmasi).
- Acceptance criteria:
  - [ ] Publish tidak bisa dijalankan saat ada upload gambar belum selesai.
  - [ ] Indikator "perubahan belum dipublish" akurat (bandingkan `contentHash` draft vs deployment live, [07 PUB-007](./07-publishing-hosting.md#pub-007-status-publish-di-editor)).

### ED-209 Share preview link
- Prioritas: P1 · Fase: M4
- Deskripsi: Link preview draft (bertoken, kedaluwarsa, bisa dicabut) untuk dikirim ke klien/rekan sebelum publish, mis. `https://p-<id>.platformmu.site` (lokal `http://p-<id>.localhost:8787`; root domain dari `SITES_ROOT_DOMAIN`). URL Publish di popover: `<acak 8 karakter>.platformmu.site` (Free, mis. `x7k2p9mq.platformmu.site`) / `<nama>.platformmu.site` / custom domain; lokal `<sub>.localhost:8787`. Detail keamanan di [07](./07-publishing-hosting.md).
- Acceptance criteria:
  - [ ] Link preview yang dicabut mengembalikan 404/410.

---

## 28. Accessibility & SEO

### ED-210 Alt text gambar
- Prioritas: P0 · Fase: M2
- Deskripsi: Field "Alt text" di Settings (dan di inspector Image). Opsi "Dekoratif" (alt kosong `alt=""`). Default alt dari media library. Tombol "Buat dengan AI" (M6).
- Edge case: Gambar dalam image fill (background) tidak punya alt; bila konten penting, sarankan konversi ke node image.
- Acceptance criteria:
  - [ ] Gambar tanpa alt dan tidak ditandai dekoratif masuk checklist pra-publish.

### ED-211 Heading level & struktur
- Prioritas: P0 · Fase: M2
- Deskripsi: Text node punya tag (`h1`–`h6`, `p`, `span`, `blockquote`, `li` via list). Text style dan tag **terpisah** (Heading 1 visual bisa memakai `h2` semantik).
- Perilaku: Panel "Outline" (P1) menampilkan hierarki heading page; warning: tidak ada H1, lebih dari satu H1, lompatan level (H2 → H4).
- Acceptance criteria:
  - [ ] Output memakai tag sesuai pilihan, bukan sesuai text style.

### ED-212 ARIA label & properti aksesibilitas
- Prioritas: P1 · Fase: M4
- Deskripsi: Settings → Accessibility: `aria-label` (wajib untuk button ikon tanpa teks — warning otomatis), `role` terbatas (whitelist: `navigation`, `banner`, `contentinfo`, `region`, `img`, `presentation`), `aria-hidden` (dekoratif), bahasa elemen (`lang`, P2), tab index (hanya 0/-1).
- Acceptance criteria:
  - [ ] Button berisi ikon saja tanpa aria-label memicu warning.

### ED-213 Kontras warna warning
- Prioritas: P1 · Fase: M4
- Deskripsi: Saat memilih warna teks / fill di belakang teks, picker menampilkan rasio kontras (WCAG 2.x) terhadap background efektif (dihitung dari ancestor fill solid; untuk gambar/gradient → "tidak bisa dihitung"), badge AA/AAA, dan saran warna terdekat yang lolos AA.
- Acceptance criteria:
  - [ ] Teks abu `#999` di atas putih menampilkan ✗ AA (2.85:1).

### ED-214 Fokus & keyboard output
- Prioritas: P1 · Fase: M4
- Deskripsi: Output website memiliki focus style default yang terlihat (token `focus-ring`) untuk elemen interaktif; urutan fokus = urutan DOM (dijamin oleh model layer DOM order). Link "Skip to content" otomatis (P1).
- Acceptance criteria:
  - [ ] Navigasi Tab di output menampilkan focus ring di semua link & button.

### ED-215 Panel pemeriksa aksesibilitas
- Prioritas: P1 · Fase: M4
- Deskripsi: Panel "Aksesibilitas" mengumpulkan semua issue (alt, kontras, heading, aria-label, tap target, link teks "klik di sini") per page dengan tombol "Perbaiki" (manual / AI M6). Analisis bisa memakai axe-core terhadap render preview (P2).
- Acceptance criteria:
  - [ ] Jumlah issue tampil sebagai badge di Publish popover.

### ED-216 SEO per page (entry point)
- Prioritas: P0 · Fase: M4
- Deskripsi: Page settings ([ED-033](#ed-033-page-settings)) memuat SEO dasar: title, meta description, slug, OG image (auto-generate dari hero — P1), canonical (auto), noindex; site-level: favicon, bahasa, sitemap/robots otomatis. Semua detail & output di [07](./07-publishing-hosting.md). Tombol "Buat dengan AI" untuk title/description (M6).
- Acceptance criteria:
  - [ ] Peringatan saat title > 60 karakter atau description > 160 karakter.

### ED-217 Aksesibilitas editor itu sendiri
- Prioritas: P1 · Fase: M4
- Deskripsi: Chrome editor (toolbar, panel, dialog) dapat dioperasikan keyboard, label ARIA lengkap (Radix), kontras AA, dukungan zoom browser 200% pada panel. Canvas: layers panel sebagai alternatif aksesibel untuk navigasi node; pengumuman screen reader untuk aksi penting (live region: "3 layer dipilih", "Auto layout ditambahkan").
- Acceptance criteria:
  - [ ] Audit axe-core pada chrome editor tanpa pelanggaran serius.

---

## 29. Semantic HTML

### ED-218 Pengaturan tag per node
- Prioritas: P0 · Fase: M2
- Deskripsi: Settings → "HTML tag" untuk setiap node. Output bergantung pada tag ini (penting untuk SEO & aksesibilitas).
- Perilaku — tag yang tersedia per tipe:

| Tipe node | Tag yang bisa dipilih | Default |
|---|---|---|
| Frame | `div`, `section`, `header`, `footer`, `nav`, `main`, `article`, `aside`, `ul`, `ol`, `li`, `figure`, `form` (via blok form), `a` (otomatis bila link), `button` (otomatis bila action) | `div` |
| Section | `section`, `header`, `footer`, `nav`, `main`, `aside` | `section` (Navbar → `header`, Footer → `footer`) |
| Text | `p`, `h1`–`h6`, `span`, `blockquote`, `li`, `label`, `figcaption` (daftar allowed final = [01 DM-009](./01-document-model.md#dm-009-semantic-tag); `small` ❓ OPEN, belum ada di 01) | `p` |
| Image | `img` (dibungkus `figure` bila ada caption, `picture` di output untuk srcset) | `img` |
| Icon | inline `svg` (`aria-hidden` default) | `svg` |
| Line | `hr`, `div` | `div` |
| Button (component) | `a` (bila link) / `button` | sesuai interaction |

  - Page root otomatis `main` di dalam `body` (Navbar/Footer section dengan tag header/footer ditempatkan sebagai sibling `main` di output — logika di renderer, [07](./07-publishing-hosting.md)).
  - Tag dapat di-override per instance child bila component mengizinkan (mis. Heading component level 2 atau 3).
- Acceptance criteria:
  - [ ] Section Footer menghasilkan `<footer>` di output.

### ED-219 Validasi nesting tag
- Prioritas: P0 · Fase: M2
- Deskripsi: Editor mencegah/memperingatkan struktur HTML tidak valid.
- Perilaku:
  - Interaktif di dalam interaktif (`a` dalam `a`, `button` dalam `a`/`button`) → link dalam dipindah ke "warning", renderer menurunkan tag dalam menjadi `span` + peringatan.
  - `li` hanya di dalam `ul/ol`; memilih `ul` pada frame otomatis menjadikan child `li` (renderer).
  - `h1`–`h6` & `p` tidak boleh berisi block → rich text model hanya inline mark (dijamin oleh schema).
  - `main` maksimal satu per page.
  - Validasi dijalankan saat set tag, saat drag/reparent (indikator merah), dan di checklist pra-publish.
- Acceptance criteria:
  - [ ] Output 20 fixture lolos validator HTML (nu validator) tanpa error nesting.

### ED-220 ID, anchor & atribut kustom
- Prioritas: P0 (anchor) · Fase: M2 · P1 (atribut) · Fase: M4
- Deskripsi: Field "Anchor ID" (= `node.htmlId`, 01 DM-008; slug, unik per page; otomatis untuk section dari nama: "Tentang Kami" → `tentang-kami`) dipakai link section ([ED-181](#ed-181-link-navigasi)). Atribut kustom terbatas (P1): `data-*`, `title`, `target`, `rel` — divalidasi; `on*`, `style`, `class` dilarang.
- Edge case: Rename section tidak mengubah anchor yang sudah dipakai link (anchor dikunci setelah dirujuk; ubah manual → link ikut diperbarui).
- Acceptance criteria:
  - [ ] Atribut `onclick` ditolak oleh validasi schema.

---

## 30. Internationalization

### ED-221 UI editor dwibahasa (ID/EN)
- Prioritas: P0 · Fase: M1
- Deskripsi: Semua string UI editor melalui `packages/i18n` (key-based, mis. `editor.toolbar.publish`). Bahasa mengikuti setting akun ([08](./08-accounts-plans-admin.md)), bisa diganti cepat dari menu.
- Perilaku:
  - Istilah desain tetap English di kedua bahasa (Auto layout, Fill, Stroke, Hug, Fill container, Frame, Component, Instance, Variant) dengan tooltip Bahasa Indonesia ("Hug: ukuran mengikuti isi").
  - Format angka & tanggal mengikuti locale (`1.440` vs `1,440` — **kecuali** input numerik inspector selalu memakai titik desimal dan tanpa pemisah ribuan agar ekspresi matematika konsisten).
  - Lint CI: tidak ada string literal UI tanpa i18n key di `apps/editor`.
- Acceptance criteria:
  - [ ] Ganti bahasa tidak me-reload editor dan tidak mengganggu dokumen.
  - [ ] Coverage terjemahan 100% untuk ID & EN (CI cek key hilang).

### ED-222 Konten website multi-bahasa
- Prioritas: P2 · Fase: M9
- Deskripsi: Website user dalam beberapa bahasa (mis. ID & EN): locale switcher di toolbar editor, konten teks/gambar/alt/SEO per locale, layout & style sama untuk semua locale, URL `/en/...`, `hreflang`, tombol "Terjemahkan dengan AI".
- Perilaku (usulan): field konten (teks, alt, link label, SEO) menyimpan map `{ id: "...", en: "..." }`; locale yang belum diterjemahkan fallback ke default dengan indikator "Belum diterjemahkan".
- Acceptance criteria:
  - [ ] Mengedit konten di locale EN tidak mengubah konten ID.

> ❓ OPEN: Model data konten multi-bahasa (map per field vs dokumen terpisah per locale) dan paket mana yang mendapatkannya. Harus diputuskan sebelum M7 agar binding data dinamis kompatibel.

---

## 31. Performa & Batasan

### ED-223 Batasan dokumen
- Prioritas: P0 · Fase: M2
- Deskripsi: Batas keras (hard) dan lunak (soft, warning) untuk menjaga editor & website cepat.

| Item | Soft limit (warning) | Hard limit (ditolak) | Catatan |
|---|---|---|---|
| Node per page | 2.000 | 5.000 | Indikator di bottom bar ([ED-009](#ed-009-bottom-bar--zoom-control)) |
| Kedalaman nesting | 20 | 40 | |
| Page per website | per paket | per paket | [08](./08-accounts-plans-admin.md) |
| Ukuran Yjs state per website | 5 MB | 20 MB | dikompres; snapshot GC |
| Teks per node | 5.000 karakter | 50.000 | Artikel panjang → gunakan collection/blog (M7) |
| Font family per website | 4 | 10 | |
| Gambar per page | 100 | 500 | lazy load wajib |
| Ukuran upload per file | 10 MB (gambar) | per paket | [08](./08-accounts-plans-admin.md) |
| Breakpoint frame tampil bersamaan | 4 | 6 | |
| Interactions per node | 5 | 20 | |

- Perilaku: Saat soft limit terlampaui → banner non-blocking dengan saran (pecah page, gunakan component). Hard limit → aksi ditolak dengan pesan jelas.
- Acceptance criteria:
  - [ ] Paste yang akan melampaui hard limit node ditolak seluruhnya (atomik), bukan sebagian.

> ❓ OPEN: Angka final batas (node per page, ukuran state) setelah benchmark M0/M2.

### ED-224 Lazy load font & gambar di editor
- Prioritas: P0 · Fase: M2
- Deskripsi: Hemat bandwidth & memori.
- Perilaku:
  - Font: hanya family & weight yang dipakai di page aktif yang dimuat (`FontFace.load()`), subset latin; picker memuat preview subset nama saja.
  - Gambar: `loading="lazy"` + `decoding="async"` di canvas; varian resolusi sesuai zoom ([ED-164](#ed-164-optimasi-gambar-otomatis)); gambar di breakpoint frame yang di-cull tidak dimuat.
  - Component library thumbnails: lazy + cache HTTP/Service Worker.
- Acceptance criteria:
  - [ ] Membuka page dengan 100 gambar tidak memuat > 20 gambar sebelum scroll/pan.

### ED-225 Web Worker untuk kalkulasi berat
- Prioritas: P1 · Fase: M4
- Deskripsi: Tugas berat dipindah dari main thread: pencarian layer/Insert index, kalkulasi kontras massal, validasi dokumen (invariant checker), boolean path (P2), kompresi snapshot, diff versi, parsing paste besar, thumbnail generation (OffscreenCanvas, P2).
- Perilaku: Komunikasi via Comlink; Yjs doc tetap di main thread (P0), opsi worker-side Y.Doc dievaluasi (P2).
- Acceptance criteria:
  - [ ] Tidak ada long task > 50 ms di main thread saat paste 500 node (diukur dengan PerformanceObserver).

### ED-226 Loading dokumen besar & code splitting
- Prioritas: P0 · Fase: M2
- Deskripsi: Waktu buka editor cepat.
- Perilaku:
  - Bundle editor di-split: core canvas, panel Design (eager); Prototype, Data, AI, Version history, color picker gradient, Tiptap extensions langka (lazy).
  - Load urutan: Y.Doc dari IndexedDB (instan, bila ada) → render page aktif → sync dengan server di background → render page lain on-demand.
  - Skeleton UI saat memuat; target TTI ([ED-022](#ed-022-target-performa-canvas)).
- Acceptance criteria:
  - [ ] Bundle awal editor < 600 KB gzip (di luar font).

---

## 32. Error Handling & Recovery

### ED-227 Crash recovery dari Yjs IndexedDB
- Prioritas: P0 · Fase: M1
- Deskripsi: Semua update Yjs dipersist lokal (`y-indexeddb`) sebelum/bersamaan dikirim ke server. Jika tab crash/browser ditutup paksa, perubahan dipulihkan saat editor dibuka lagi.
- Perilaku:
  - Saat load: merge state IndexedDB lokal + state server (CRDT merge). Jika lokal punya update yang belum di server → dikirim otomatis, toast "Kami memulihkan perubahan yang belum tersimpan".
  - Data IndexedDB per `websiteId` per user; dibersihkan saat logout (opsi) atau saat website dihapus.
  - Jika IndexedDB tidak tersedia (private mode lama) → banner "Pemulihan offline tidak aktif di browser ini".
- Acceptance criteria:
  - [ ] Kill proses browser 200 ms setelah edit → buka ulang → edit ada.

### ED-228 Error boundary per node & per panel
- Prioritas: P0 · Fase: M1
- Deskripsi: Error render pada satu node tidak boleh menjatuhkan seluruh editor.
- Perilaku:
  - `NodeView` dibungkus error boundary: node bermasalah dirender sebagai kotak placeholder merah bergaris dengan label "Elemen tidak bisa ditampilkan" + tombol "Hapus" / "Laporkan".
  - Panel (inspector, layers, AI) punya boundary sendiri dengan tombol "Muat ulang panel".
  - Error global (store korup) → layar recovery: "Muat ulang editor", "Buka versi terakhir yang tersimpan", "Hubungi bantuan" (dengan ID error).
- Acceptance criteria:
  - [ ] Node dengan data invalid yang disuntik di test tidak menyebabkan blank screen.

### ED-229 Error jaringan & sinkronisasi
- Prioritas: P0 · Fase: M1
- Deskripsi: Menangani kegagalan API/WS.
- Perilaku:
  - Retry eksponensial (1s, 2s, 4s… maks 30s) dengan jitter; status di indikator autosave ([ED-200](#ed-200-autosave--status-indicator)).
  - 401 (sesi habis) → modal login ulang tanpa meninggalkan editor; update tetap di IndexedDB.
  - 403 (akses dicabut / paket berubah) → mode read-only + pesan.
  - 409/422 (update ditolak server karena validasi) → update dibuang dari server state, klien di-resync dari server, user diberi tahu "Satu perubahan tidak valid dan dibatalkan" + log Sentry.
  - 413 (dokumen terlalu besar) → pesan batas ([ED-223](#ed-223-batasan-dokumen)).
- Acceptance criteria:
  - [ ] Simulasi server down 2 menit → tidak ada kehilangan data setelah server kembali.

### ED-230 Migrasi skema & dokumen invalid
- Prioritas: P0 · Fase: M1
- Deskripsi: Document model berversi ([01](./01-document-model.md)). Editor memeriksa `schemaVersion` saat load.
- Perilaku:
  - Dokumen versi lama → migrasi berjalan (fungsi murni di `packages/document-model`) dengan origin `system`, snapshot sebelum migrasi.
  - Dokumen versi lebih baru dari editor (editor lama ter-cache) → paksa reload aset editor terbaru.
  - Validasi Zod gagal pada node tertentu → node dikarantina (placeholder [ED-228](#ed-228-error-boundary-per-node--per-panel)), sisa dokumen tetap bisa diedit.
- Acceptance criteria:
  - [ ] Fixture dokumen v1 terbuka benar di editor v2 setelah migrasi.

### ED-231 Telemetri & pelaporan error
- Prioritas: P0 · Fase: M1
- Deskripsi: Sentry untuk exception & performance (sampling), breadcrumb aksi editor (nama command, bukan konten user), ID website/user (hash). Tidak mengirim konten teks/gambar user. Event analitik produk (penggunaan fitur) terpisah dan anonim (detail [08](./08-accounts-plans-admin.md)).
- Acceptance criteria:
  - [ ] Payload Sentry tidak memuat isi teks dokumen (diuji dengan scrubber).

---

## 33. Kolaborasi di Editor

Kolaborasi real-time = **P2 / M9+** (paket Business/Tim). Karena dokumen sudah Yjs sejak awal, fondasi siap; bagian ini mendefinisikan UX-nya. Server: Hocuspocus ([ARCHITECTURE](../ARCHITECTURE.md)); role & invite: [08](./08-accounts-plans-admin.md).

### ED-232 Presence avatar
- Prioritas: P2 · Fase: M9
- Deskripsi: Avatar kolaborator yang sedang membuka website tampil di toolbar (maks 5 + "+N"), warna unik per user, tooltip nama & page yang sedang dibuka. Di Pages panel, titik warna menunjukkan page tempat user lain berada.
- Acceptance criteria:
  - [ ] Avatar muncul ≤ 2 detik setelah kolaborator membuka editor.

### ED-233 Multiplayer cursor
- Prioritas: P2 · Fase: M9
- Deskripsi: Kursor kolaborator di overlay (koordinat world dikirim via Yjs awareness, ≤ 20 Hz, diinterpolasi), dengan label nama; hanya untuk user di page & breakpoint yang sama. Toggle "Sembunyikan kursor lain".
- Acceptance criteria:
  - [ ] Kursor bergerak mulus (interpolasi) tanpa membebani FPS (< 1 ms per frame untuk 10 kursor).

### ED-234 Follow / spotlight
- Prioritas: P2 · Fase: M9
- Deskripsi: Klik avatar → mengikuti kamera user tersebut (page, breakpoint, pan/zoom); keluar dengan interaksi canvas apa pun atau Esc. "Spotlight me" (P2+) mengajak semua mengikuti.
- Acceptance criteria:
  - [ ] Saat follow, perpindahan page oleh user yang diikuti ikut terjadi.

### ED-235 Komentar
- Prioritas: P2 · Fase: M9
- Deskripsi: Comment tool (`C`): pin di canvas terikat node (`nodeId` + offset relatif) dengan fallback koordinat; thread, mention `@`, resolve, filter (semua/terbuka/saya), notifikasi email. Komentar disimpan di DB (bukan Yjs document website) agar tidak ikut publish/undo.
- Perilaku: Pin mengikuti node saat node bergerak; node dihapus → komentar menjadi "lepas" (ditampilkan di panel). Simple mode: komentar bisa dilihat & dibalas (berguna untuk klien UMKM yang mereview).
- Acceptance criteria:
  - [ ] Pin komentar mengikuti posisi node setelah node dipindah.

### ED-236 Seleksi user lain
- Prioritas: P2 · Fase: M9
- Deskripsi: Node yang sedang dipilih kolaborator diberi outline warna user + label nama kecil. Node yang sedang di-text-edit user lain diberi indikator "sedang mengetik"; edit bersamaan tetap diizinkan (CRDT), tanpa lock keras.
- Acceptance criteria:
  - [ ] Outline seleksi remote hilang ≤ 2 detik setelah user tersebut deselect/keluar.

### ED-237 Semantik kolaborasi & undo
- Prioritas: P2 · Fase: M9
- Deskripsi: Undo hanya untuk perubahan sendiri ([ED-197](#ed-197-undoredo-dengan-yundomanager)); AI run milik user A tidak bisa di-undo user B; permission per role (viewer: lihat & komentar; editor: edit; admin: publish). Aksi berisiko (publish, hapus page, restore versi) menampilkan notifikasi ke kolaborator lain yang aktif.
- Acceptance criteria:
  - [ ] Restore versi oleh user A menampilkan banner di sesi user B.

---

## 34. Testing Strategy Editor

### ED-238 Unit test geometri & logika murni
- Prioritas: P0 · Fase: M0
- Deskripsi: Semua logika non-DOM ditulis sebagai fungsi murni dan diuji dengan **Vitest** (+ `fast-check` untuk property-based).
- Cakupan wajib:
  - Konversi koordinat screen/world/local ([ED-015](#ed-015-koordinat-screen-world-node-local)), termasuk rotasi bersarang.
  - Zoom di titik pointer, zoom to fit/selection.
  - Snapping (kandidat, threshold, equal spacing), distance measurement.
  - Resize dengan modifier, flip, aspect ratio, constraints → CSS.
  - Heuristik add auto-layout (direction, gap, padding, urutan).
  - Parser ekspresi numerik ([ED-070](#ed-070-numeric-input--ekspresi-matematika)).
  - State machine interaksi ([ED-023](#ed-023-interaction-state-machine)).
  - Auto-responsive rules & mapping auto-layout → CSS (snapshot).
  - Clipboard serialize/deserialize (id baru, referensi asset).
  - Registry shortcut (tanpa konflik).
- Acceptance criteria:
  - [ ] Coverage ≥ 90% untuk `apps/editor/src/core/**` (geometri, commands, state machine).

### ED-239 Test interaksi end-to-end (Playwright)
- Prioritas: P0 · Fase: M2
- Deskripsi: **Playwright** menjalankan editor nyata (Chromium wajib; WebKit & Firefox nightly) dengan fixture dokumen.
- Perilaku:
  - Helper `canvas.dragFrom(worldPoint).to(worldPoint, { shift, alt })`, `canvas.clickNode(id, { deep })`, `inspector.set("W", "100+20")`, `layers.drag(rowA, rowB, "inside")`.
  - Assertion terhadap **Yjs document** (via `window.__editorTestApi.getDoc()` yang hanya ada di build test) dan terhadap geometry DOM.
  - Skenario wajib: semua acceptance criteria bertanda interaksi di dokumen ini (target: ≥ 150 skenario saat M4).
  - Trackpad pinch disimulasikan dengan `page.mouse.wheel` + `ctrlKey`.
- Acceptance criteria:
  - [ ] Suite E2E berjalan < 15 menit di CI dengan sharding.

### ED-240 Visual regression (WYSIWYG)
- Prioritas: P0 · Fase: M2
- Deskripsi: Memastikan canvas == preview == publish.
- Perilaku: Untuk setiap fixture (≥ 30 dokumen meliputi semua mode layout, constraints, effects, typography, breakpoint), ambil screenshot (a) canvas zoom 100% breakpoint frame, (b) output publish di iframe lebar sama; bandingkan dengan toleransi piksel kecil (`pixelmatch`, threshold 0.1%). Baseline per browser.
- Acceptance criteria:
  - [ ] Perbedaan canvas vs publish > threshold menggagalkan CI.

### ED-241 Benchmark performa otomatis
- Prioritas: P1 · Fase: M2
- Deskripsi: Playwright + Chrome tracing mengukur FPS pan/zoom/drag, waktu seleksi, TTI pada fixture 200 & 2.000 node ([ED-022](#ed-022-target-performa-canvas)); hasil disimpan sebagai artifact CI & dibandingkan dengan baseline (nightly).
- Acceptance criteria:
  - [ ] Regresi > 20% memunculkan kegagalan job nightly dan komentar di PR terkait.

### ED-242 Fixture, test id & test API
- Prioritas: P0 · Fase: M1
- Deskripsi: Infrastruktur test.
- Perilaku:
  - Fixture dokumen JSON di `packages/document-model/fixtures/` (landing UMKM, toko, portfolio, stress-2000, nested-auto-layout, constraints-matrix, all-effects, typography-matrix).
  - Atribut `data-testid` pada elemen chrome editor penting; node canvas diakses via `data-node-id`.
  - `__editorTestApi` (hanya build test): `getDoc()`, `select(ids)`, `getCamera()`, `setCamera()`, `getGeometry(id)`, `runCommand(name, args)`.
  - Test AI ([04](./04-ai-agent.md)) memakai command layer yang sama sehingga perilaku AI dan manusia diuji dengan assertion yang sama.
- Acceptance criteria:
  - [ ] Fixture stress-2000 tersedia sejak M0 untuk spike canvas.

---

## 35. Lampiran A — Perbandingan Fitur Figma vs Editor

Legenda: **✅ P0** = ada di rilis fase terkait · **P1** = menyusul · **P2** = nanti (M9+) · **❌** = tidak dibuat (alasan dicantumkan) · **➕** = fitur web-spesifik yang tidak ada di Figma.

| # | Area | Fitur Figma | Status | Ref / Catatan |
|---|---|---|---|---|
| 1 | Canvas | Infinite canvas, pan & zoom | ✅ P0 | ED-013, ED-026, ED-027 (zoom 5–1600%, Figma 2–25600%) |
| 2 | Canvas | Renderer WebGL | ❌ | Canvas DOM agar WYSIWYG dengan HTML/CSS publish |
| 3 | Canvas | Zoom to fit / selection / 100% | ✅ P0 | ED-028 |
| 4 | Canvas | Rulers | P1 | ED-029 |
| 5 | Canvas | Guides dari ruler | P2 | ED-029 |
| 6 | Canvas | Minimap | P2 | ED-030 (Figma tidak punya; tambahan) |
| 7 | Canvas | Pixel grid & pixel preview | P1 / ❌ pixel preview | ED-074; pixel preview tidak relevan untuk web |
| 8 | Canvas | Outline mode | P2 | View menu |
| 9 | Pages | Multiple pages per file | ✅ P0 | ED-032 — page = halaman website (berbeda makna) |
| 10 | Pages | Sections (FigJam/Figma section) | ✅ P0 | ED-040 — section = `<section>` website |
| 11 | Frames | Frame tool + device presets | ✅ P0 | ED-039 |
| 12 | Frames | Multiple frames bebas di canvas | P1 | ED-035 Draft area (tidak dipublish) |
| 13 | Frames | Breakpoint frames berdampingan (tree sama) | ➕ P0 | ED-034 |
| 14 | Shapes | Rectangle, Ellipse | ✅ P0 | ED-041, ED-042 |
| 15 | Shapes | Line | P1 | ED-043 |
| 16 | Shapes | Arrow | P2 | ED-043 |
| 17 | Shapes | Polygon, Star | ❌ | Jarang di website; gunakan ikon/SVG |
| 18 | Shapes | Arc / donut ellipse | P2 | ED-042 |
| 19 | Vector | Pen tool & vector edit | P2 | ED-048 |
| 20 | Vector | Vector networks | ❌ | Kompleks, tidak ada padanan SVG sederhana |
| 21 | Vector | Pencil (freehand) | ❌ | Bukan kebutuhan website UMKM |
| 22 | Vector | Boolean operations | P2 | ED-148 |
| 23 | Vector | Flatten / outline stroke | P2 / ❌ | ED-148; outline stroke ❌ |
| 24 | Text | Text tool auto width / fixed | ✅ P0 | ED-044, ED-123 |
| 25 | Text | Rich text per range | ✅ P0 | ED-125 (Tiptap) |
| 26 | Text | Text styles | ✅ P0 | ED-126 (M4) |
| 27 | Text | Lists | ✅ P0 | ED-121 |
| 28 | Text | Hyperlink | ✅ P0 | ED-122 (+ WhatsApp, tel, mailto) |
| 29 | Text | Truncation / max lines | P1 | ED-124 |
| 30 | Text | OpenType features detail | P2 | ED-120 (small caps P2) |
| 31 | Text | Variable font axes | P2 | ED-117 |
| 32 | Text | Text on path | ❌ | Tidak ada padanan CSS yang layak |
| 33 | Text | Vertical trim (leading trim) | P2 | `text-box-trim` belum luas didukung |
| 34 | Selection | Click, shift, marquee | ✅ P0 | ED-051..ED-053 |
| 35 | Selection | Deep select (Mod+klik) | ✅ P0 | ED-054 |
| 36 | Selection | Select parent/children/siblings | ✅ P0 | ED-055 |
| 37 | Selection | Select matching layers | P1 | ED-057 |
| 38 | Selection | Lock / hide | ✅ P0 | ED-059 |
| 39 | Transform | Move, nudge, resize 8 arah | ✅ P0 | ED-062..ED-066 |
| 40 | Transform | Rotate | P1 | ED-068 |
| 41 | Transform | Flip | P1 | ED-069 |
| 42 | Transform | Scale tool (K) | P2 | Tabel 7.1 |
| 43 | Transform | Math di input numerik | ✅ P0 | ED-070 |
| 44 | Transform | Align & distribute | ✅ P0 | ED-072 |
| 45 | Transform | Tidy up | P2 | ED-072 |
| 46 | Snapping | Smart guides ke objek | ✅ P0 | ED-073 |
| 47 | Snapping | Distance on Alt hover | ✅ P0 | ED-076 |
| 48 | Snapping | Equal spacing | P1 | ED-077 |
| 49 | Snapping | Layout grid (columns/rows/grid) | P1 | ED-075 |
| 50 | Auto layout | Direction H/V | ✅ P0 | ED-080 |
| 51 | Auto layout | Wrap | ✅ P0 | ED-080 |
| 52 | Auto layout | Gap fixed / auto | ✅ P0 | ED-081 |
| 53 | Auto layout | Gap negatif | P2 | ED-081 |
| 54 | Auto layout | Padding per sisi | ✅ P0 | ED-082 |
| 55 | Auto layout | Alignment 9 titik | ✅ P0 | ED-083 |
| 56 | Auto layout | Hug / Fill / Fixed | ✅ P0 | ED-084 |
| 57 | Auto layout | Min / max size | ✅ P0 | ED-085 |
| 58 | Auto layout | Absolute position dalam auto layout | ✅ P0 | ED-088 |
| 59 | Auto layout | Canvas stacking (reverse z) | P2 | ED-087 |
| 60 | Auto layout | Text baseline alignment | P1 | ED-083 |
| 61 | Auto layout | Stroke included in layout | ❌ | CSS `border-box` sudah menentukan; disederhanakan |
| 62 | Grid | Auto layout grid (Figma grid flow) | P1 | ED-097 (CSS Grid) |
| 63 | Constraints | Left/Right/Center/Scale/L&R | ✅ P0 | ED-098 |
| 64 | Constraints | Ignore constraints saat resize (Mod) | P1 | ED-065 |
| 65 | Fill | Solid | ✅ P0 | ED-102 |
| 66 | Fill | Linear gradient | ✅ P0 | ED-103 (M4) |
| 67 | Fill | Radial gradient | P1 | ED-103 |
| 68 | Fill | Angular / diamond gradient | P2 / ❌ | Angular via `conic-gradient` P2; diamond ❌ |
| 69 | Fill | Image fill (fill/fit/crop/tile) | ✅ P0 | ED-104 |
| 70 | Fill | Image adjustments (exposure dll.) | P2 | ED-104 (CSS filter terbatas) |
| 71 | Fill | Multiple fills | P1 | ED-105 |
| 72 | Fill | Eyedropper | ✅ P0 | ED-102 |
| 73 | Stroke | Inside/center/outside | ✅ P0 | ED-106 |
| 74 | Stroke | Per-side stroke | ✅ P0 | ED-106 |
| 75 | Stroke | Dash pattern custom | P2 | ED-106 |
| 76 | Stroke | Stroke pada teks | P2 | ED-106 |
| 77 | Corner | Radius independen | ✅ P0 | ED-107 |
| 78 | Corner | Corner smoothing | P2 / ❌ | ED-107 |
| 79 | Effects | Drop / inner shadow | ✅ P0 | ED-108 |
| 80 | Effects | Layer blur / background blur | P1 | ED-109 |
| 81 | Effects | Noise / texture effects | ❌ | Tidak efisien di CSS; gunakan image |
| 82 | Appearance | Opacity + shortcut angka | ✅ P0 | ED-110 |
| 83 | Appearance | Blend modes | P2 | ED-111 |
| 84 | Appearance | Clip content | ✅ P0 | ED-112 |
| 85 | Structure | Group / ungroup | P1 | ED-144, ED-145 |
| 86 | Structure | Frame selection | ✅ P0 | ED-146 |
| 87 | Structure | Mask | P2 | ED-149 |
| 88 | Layers | Tree, rename, reorder, reparent | ✅ P0 | ED-136..ED-138 |
| 89 | Layers | Search/filter layers | P1 | ED-142 |
| 90 | Layers | Urutan Figma (atas = paling depan) | ❌ (diganti DOM order) | ED-090, OPEN |
| 91 | Components | Create component | ✅ P0 (Admin) / P1 (lokal) | ED-150 |
| 92 | Components | Variants | ✅ P0 | ED-152 |
| 93 | Components | Component properties | ✅ P0 | ED-153 (props) |
| 94 | Components | Instance swap | ✅ P0 | ED-154 |
| 95 | Components | Override indicator & reset | ✅ P0 | ED-155 |
| 96 | Components | Detach | ✅ P0 | ED-156 |
| 97 | Components | Go to main component | P1 | ED-157 |
| 98 | Components | Library publish & update review | ✅ P0 | ED-158, [03](./03-components-templates.md) |
| 99 | Components | Slots | P1 | ED-159 |
| 100 | Variables | Color/number/string/boolean variables | ✅ P0 (token warna/spacing/radius/shadow/typo) | ED-129; string/boolean vars ❌ (diganti props & data) |
| 101 | Variables | Modes (light/dark) | P2 | ED-133 |
| 102 | Styles | Color/text/effect/grid styles | ✅ P0 | ED-134 (disatukan dengan token) |
| 103 | Prototype | Link antar frame/page | ✅ P0 | ED-181 |
| 104 | Prototype | Hover / pressed states | ✅ P0 | ED-183 |
| 105 | Prototype | Smart animate | ❌ | Bukan target; animasi web sederhana saja (ED-184) |
| 106 | Prototype | Overlays (modal) | P1 | ED-187 |
| 107 | Prototype | Scroll behavior / sticky / fixed | ✅ P0 sticky / P1 lainnya | ED-185, ED-186 |
| 108 | Prototype | Prototype variables & conditionals | ❌ | Logika diganti Workflows ([05](./05-dynamic-data.md)) |
| 109 | Prototype | Scroll reveal / entrance animation | ➕ P1 | ED-184 |
| 110 | Prototype | Presentation view | ✅ P0 | ED-207 Preview (iframe, media query nyata) |
| 111 | Dev | Dev Mode / inspect code | ❌ | Output = website live, bukan handoff kode |
| 112 | Dev | Code Connect | ❌ | Tidak relevan |
| 113 | Export | Export PNG/JPG/SVG/PDF | P2 (copy as PNG/SVG) | ED-195; export PDF ❌ |
| 114 | Clipboard | Copy/paste/duplicate/paste in place | ✅ P0 | ED-190, ED-191, ED-193 |
| 115 | Clipboard | Paste to replace | P1 | ED-192 |
| 116 | Clipboard | Copy/paste properties | P1 | ED-194 |
| 117 | Clipboard | Paste dari Figma | ❌ | Tidak ada import Figma (keputusan produk) |
| 118 | History | Undo/redo | ✅ P0 | ED-197 |
| 119 | History | Version history & restore | P1 (snapshot publish P0) | ED-199 |
| 120 | Assets | Image upload, drag-drop, paste | ✅ P0 | ED-160 |
| 121 | Assets | Media library | ✅ P0 | ED-161 (Figma tidak punya) |
| 122 | Assets | Stock image | P1 | ED-162, OPEN |
| 123 | Assets | Icon library terintegrasi | ➕ P0 | ED-046, ED-163 (Lucide) |
| 124 | Assets | Community files / plugins | ❌ | Marketplace komponen P2 ([03](./03-components-templates.md)); plugin ❌ |
| 125 | Shortcut | Keyboard shortcuts Figma-compatible | ✅ P0 | ED-203 |
| 126 | Shortcut | Quick actions / command palette | ✅ P0 | ED-204 |
| 127 | Collab | Multiplayer cursor & presence | P2 | ED-232, ED-233 |
| 128 | Collab | Follow / spotlight | P2 | ED-234 |
| 129 | Collab | Comments | P2 | ED-235 |
| 130 | Collab | Branching & merging | ❌ | Terlalu kompleks untuk target user; version history cukup |
| 131 | Collab | Audio/cursor chat | ❌ | Tidak prioritas |
| 132 | A11y | Alt text, heading tag, aria | ➕ P0/P1 | ED-210..ED-215 |
| 133 | SEO | Page title, meta, OG | ➕ P0 | ED-216 |
| 134 | Web | Semantic HTML tag per node | ➕ P0 | ED-218, ED-219 |
| 135 | Web | Responsive breakpoints & overrides | ➕ P0 | ED-173..ED-180 |
| 136 | Web | Auto-responsive rules | ➕ P0 | ED-175 |
| 137 | Web | Data binding / CMS | ➕ P0 (M7) | ED-171, [05](./05-dynamic-data.md) |
| 138 | Web | Form & e-commerce blocks | ➕ P0 (M7/M8) | ED-167, [06](./06-commerce-payments.md) |
| 139 | Web | Simple mode untuk awam | ➕ P0 | ED-001 |
| 140 | AI | AI assistant di editor | ➕ P0 (M6) | ED-010, [04](./04-ai-agent.md) (Figma punya AI terbatas) |
| 141 | Misc | FigJam / whiteboard | ❌ | Di luar scope |
| 142 | Misc | Slides | ❌ | Di luar scope |
| 143 | Misc | Plugins & widgets API | ❌ | Risiko keamanan & scope; extension lewat AI skills |
| 144 | Misc | Offline editing | ✅ P0 | ED-201 (Figma desktop terbatas) |

---

## 36. Lampiran B — Ringkasan ID per Fase & Daftar OPEN

### 36.1 Rentang ID per bagian

| Bagian | Rentang ID |
|---|---|
| 2. Prinsip UX & mode | ED-001 – ED-005 |
| 3. Layout UI | ED-006 – ED-012 |
| 4. Arsitektur canvas | ED-013 – ED-025 |
| 5. Navigasi | ED-026 – ED-031 |
| 6. Pages & breakpoint frames | ED-032 – ED-036 |
| 7. Tools | ED-037 – ED-050 |
| 8. Selection | ED-051 – ED-061 |
| 9. Transformasi | ED-062 – ED-072 |
| 10. Snapping & pengukuran | ED-073 – ED-078 |
| 11. Auto-layout & grid | ED-079 – ED-097 |
| 12. Constraints | ED-098 – ED-101 |
| 13. Properti visual | ED-102 – ED-114 |
| 14. Typography | ED-115 – ED-128 |
| 15. Tokens | ED-129 – ED-135 |
| 16. Layers | ED-136 – ED-143 |
| 17. Group/frame/boolean/mask | ED-144 – ED-149 |
| 18. Components | ED-150 – ED-159 |
| 19. Assets | ED-160 – ED-166 |
| 20. Insert panel | ED-167 – ED-172 |
| 21. Responsif | ED-173 – ED-180 |
| 22. Prototype & interactions | ED-181 – ED-189 |
| 23. Clipboard | ED-190 – ED-196 |
| 24. Undo, history, autosave | ED-197 – ED-201 |
| 25. Shortcuts & palette | ED-202 – ED-205 |
| 26. Context menu | ED-206 |
| 27. Preview & publish | ED-207 – ED-209 |
| 28. Accessibility & SEO | ED-210 – ED-217 |
| 29. Semantic HTML | ED-218 – ED-220 |
| 30. i18n | ED-221 – ED-222 |
| 31. Performa | ED-223 – ED-226 |
| 32. Error & recovery | ED-227 – ED-231 |
| 33. Kolaborasi | ED-232 – ED-237 |
| 34. Testing | ED-238 – ED-242 |

### 36.2 Requirement per fase (berdasarkan fase & prioritas utama pada baris "Prioritas")

| Fase | P0 | P1 | P2 |
|---|---|---|---|
| M0 | ED-013, ED-014, ED-015, ED-016, ED-019, ED-020, ED-022, ED-023, ED-024, ED-025, ED-026, ED-027, ED-037, ED-038, ED-047, ED-051, ED-053, ED-060, ED-062, ED-065, ED-238 | — | — |
| M1 | ED-012, ED-017, ED-018, ED-061, ED-197, ED-198, ED-200, ED-201, ED-221, ED-227, ED-228, ED-229, ED-230, ED-231, ED-242 | — | — |
| M2 | ED-004, ED-006, ED-007, ED-008, ED-009, ED-028, ED-032, ED-033, ED-034, ED-036, ED-039, ED-040, ED-041, ED-042, ED-044, ED-045, ED-046, ED-050, ED-052, ED-054, ED-055, ED-056, ED-059, ED-063, ED-064, ED-066, ED-070, ED-071, ED-072, ED-073, ED-074, ED-076, ED-079, ED-080, ED-081, ED-082, ED-083, ED-084, ED-085, ED-086, ED-087, ED-088, ED-090, ED-091, ED-098, ED-099, ED-102, ED-104, ED-106, ED-107, ED-108, ED-110, ED-112, ED-115, ED-116, ED-117, ED-119, ED-120, ED-121, ED-122, ED-123, ED-125, ED-136, ED-137, ED-138, ED-139, ED-140, ED-141, ED-143, ED-146, ED-160, ED-161, ED-163, ED-165, ED-173, ED-174, ED-181, ED-190, ED-191, ED-193, ED-202, ED-203, ED-204, ED-206, ED-207, ED-210, ED-211, ED-218, ED-219, ED-220, ED-223, ED-224, ED-226, ED-239, ED-240 | ED-021, ED-029, ED-031, ED-043, ED-067, ED-077, ED-096, ED-142, ED-144, ED-145, ED-241 | — |
| M3 | ED-003, ED-058, ED-150, ED-151, ED-152, ED-153, ED-154, ED-155, ED-156, ED-158, ED-167, ED-170, ED-183 | ED-157 | — |
| M4 | ED-001, ED-002, ED-089, ED-094, ED-100, ED-103, ED-126, ED-129, ED-130, ED-131, ED-132, ED-164, ED-168, ED-169, ED-175, ED-176, ED-177, ED-178, ED-185, ED-196, ED-208, ED-216 | ED-011, ED-035, ED-057, ED-068, ED-069, ED-075, ED-078, ED-093, ED-095, ED-097, ED-101, ED-105, ED-109, ED-113, ED-114, ED-118, ED-124, ED-134, ED-147, ED-159, ED-162, ED-166, ED-172, ED-179, ED-180, ED-182, ED-184, ED-186, ED-187, ED-188, ED-189, ED-192, ED-194, ED-199, ED-205, ED-209, ED-212, ED-213, ED-214, ED-215, ED-217, ED-225 | — |
| M6 | ED-010 | — | — |
| M7 | ED-171 | ED-127 | — |
| M8 | — | ED-128 | — |
| M9 | — | ED-005 | ED-030, ED-048, ED-049, ED-092, ED-111, ED-133, ED-135, ED-148, ED-149, ED-195, ED-222, ED-232, ED-233, ED-234, ED-235, ED-236, ED-237 |

> Catatan: beberapa requirement memiliki prioritas/fase bertingkat (mis. "P0 · M2 (dasar) · P1 · M4 (lanjutan)"); tabel di atas memakai pasangan pertama. Lihat requirement masing-masing untuk detail. ROADMAP merujuk tabel ini.

### 36.3 Daftar OPEN

| # | Bagian | Pertanyaan terbuka |
|---|---|---|
| 1 | §4 | ~~Rentang zoom final~~ — **diputuskan T0.8.3**: 5%–1600%. |
| 2 | §4 | ~~Shadow DOM vs prefix class~~ — **diputuskan T0.8.1**: Shadow DOM (ADR-012). |
| 3 | §6 | Apakah preview width custom disimpan per website (dokumen) atau per user (UI state)? Usulan: per user (UI state). |
| 4 | §11 | Urutan layer panel — "DOM order (atas = pertama)" vs "Figma order (atas = paling depan)". Usulan: DOM order untuk semua, karena output adalah HTML dan mayoritas user bukan pengguna Figma. Z-order untuk node absolute dikendalikan via `z-index` eksplisit (Bring forward/Send backward). |
| 5 | §14 | ~~`y-prosemirror` vs JSON utuh~~ — **sudah diputuskan di 01**: `Y.XmlFragment` + `@tiptap/y-tiptap` (divalidasi T0.8.5). |
| 6 | §17 | ~~Group sebagai node type vs flag `isGroup`~~ — **sudah diputuskan di 01 DM-012**: node type `group`. |
| 7 | §19 | Sumber stock image (Unsplash API, Pexels API, atau keduanya) dan kebutuhan atribusi/batas rate. Juga apakah AI image generation masuk (lihat [04](./04-ai-agent.md)). |
| 8 | §21 | Daftar final auto-responsive rules dan nilai skala (0.75/0.5) perlu divalidasi dengan template nyata di M4. |
| 9 | §24 | Retensi version history per paket (jumlah & durasi). |
| 10 | §25 | Shortcut layout grid. Figma memakai `Ctrl+G` (Mac: `⌃G`), yang di Windows bentrok dengan Group (`Ctrl+G`). Usulan: Windows `Ctrl+Shift+4`, Mac `⌃G`. Konfirmasi setelah uji pengguna. |
| 11 | §27 | ~~Iframe per breakpoint frame di canvas~~ — **diputuskan T0.8.2**: tanpa iframe (ADR-013). |
| 12 | §30 | Model data konten multi-bahasa (map per field vs dokumen terpisah per locale) dan paket mana yang mendapatkannya. Harus diputuskan sebelum M7 agar binding data dinamis kompatibel. |
| 13 | §31 | Angka final batas (node per page, ukuran state) setelah benchmark M0/M2. |

---

*Akhir dokumen 02-editor.md. Perubahan pada requirement wajib mempertahankan ID yang sudah ada; requirement baru memakai nomor berikutnya (ED-243 dst.) dan dicatat di tabel 36.1.*
