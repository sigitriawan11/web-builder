# Product Requirements Document (PRD)

> **Nama produk:** belum ditentukan. Dokumen ini memakai placeholder **"Platform"**, domain contoh `platformmu.com`.
> **Status:** Draft v1 · **Tanggal:** 2026-10-12 · **Pemilik:** owner (solo developer)
> **Dokumen terkait:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md) · [specs/](./specs/) · [../CLAUDE.md](../CLAUDE.md)

Dokumen ini menjelaskan **apa** yang dibangun, **untuk siapa**, dan **kenapa**. Detail teknis ada di [ARCHITECTURE.md](./ARCHITECTURE.md). Spesifikasi fitur yang rinci (ribuan requirement ber-ID) ada di folder [specs/](./specs/). Urutan pengerjaan ada di [ROADMAP.md](./ROADMAP.md).

Konvensi dokumen:
- `> ❓ OPEN:` = keputusan yang belum diambil.
- **P0** = wajib pada fase targetnya · **P1** = penting, menyusul · **P2** = nanti.
- **M0–M9** = milestone/fase (lihat [§12](#12-fase-rilis-ringkas)).

---

## Daftar isi

1. [Ringkasan](#1-ringkasan)
2. [Masalah & peluang](#2-masalah--peluang)
3. [Target pengguna & persona](#3-target-pengguna--persona)
4. [Pembeda (positioning)](#4-pembeda-positioning)
5. [Konsep produk: satu dokumen, empat pintu masuk](#5-konsep-produk-satu-dokumen-empat-pintu-masuk)
6. [Lingkup fitur](#6-lingkup-fitur)
7. [User journey utama](#7-user-journey-utama)
8. [Paket & model bisnis](#8-paket--model-bisnis)
9. [Requirement non-fungsional](#9-requirement-non-fungsional)
10. [Non-goals](#10-non-goals)
11. [Metrik keberhasilan](#11-metrik-keberhasilan)
12. [Fase rilis (ringkas)](#12-fase-rilis-ringkas)
13. [Risiko & mitigasi](#13-risiko--mitigasi)
14. [Asumsi](#14-asumsi)
15. [Keputusan terbuka](#15-keputusan-terbuka)
16. [Glosarium](#16-glosarium)

---

## 1. Ringkasan

**Platform** adalah website builder yang menggabungkan:

- **Kekuatan desain Figma**: editor canvas dengan UX dan fitur desain yang lengkap dan detail (frame, auto-layout, component, variants, design token, layers, dan seterusnya).
- **Kemudahan Wix**: template website siap pakai dan component yang sudah didesain, sehingga pengguna awam cukup mengganti gambar dan konten.
- **AI sebagai pembeda utama**: asisten yang bisa merakit website dari component library, mendesain ulang, menulis konten, dan (pada paket berbayar) membuat **website dinamis** (database, form, login member, dashboard, CRUD) serta **toko online**, tanpa pengguna perlu menulis kode atau mengatur backend.

Output akhirnya adalah **website live** yang dipublish ke subdomain platform (atau custom domain pada paket tertentu). Platform **bukan** tool untuk mengekspor kode ke developer.

Pasar pertama: **Indonesia** (UMKM dan perusahaan). UI platform tersedia dalam **Bahasa Indonesia dan Inggris**.

---

## 2. Masalah & peluang

### 2.1 Masalah pengguna

| # | Masalah | Siapa yang mengalami |
|---|---|---|
| P1 | Membuat website yang terlihat profesional butuh designer + developer, mahal dan lama. | UMKM, company kecil |
| P2 | Website builder yang ada sering terasa kaku: mudah di awal, tapi sulit saat ingin kustomisasi desain yang detail. | UMKM yang sedang tumbuh, company |
| P3 | Tool desain profesional (seperti Figma) menghasilkan desain, bukan website live. Hasilnya masih harus dikodekan ulang. | Designer, agensi kecil |
| P4 | Menambahkan fungsi seperti form pesanan, login member, atau dashboard butuh developer backend. | UMKM, company |
| P5 | Menerima pembayaran online butuh integrasi teknis dengan payment gateway. | UMKM yang berjualan |
| P6 | Banyak builder berorientasi pasar global: template, bahasa, dan metode pembayaran kurang cocok untuk Indonesia. | Pasar Indonesia |

### 2.2 Peluang

- AI generatif kini cukup mampu untuk **menyusun** website dari blok yang terstruktur, asalkan diberi "alat" (tools) dan pengetahuan (skills) yang tepat.
- Penggabungan **editor kelas Figma** dengan **template/component siap pakai** dan **AI yang bisa membangun backend secara aman** belum banyak ditawarkan dalam satu produk yang fokus ke pasar Indonesia.

---

## 3. Target pengguna & persona

### 3.1 Segmen

| Segmen | Kebutuhan utama | Cara membuat website yang paling mungkin dipakai |
|---|---|---|
| **UMKM** (kuliner, fashion, jasa, salon, bengkel, kursus, dll) | Cepat jadi, murah, bisa terima pesanan/pembayaran | Template + AI |
| **Company / perusahaan** | Tampil profesional, sesuai brand, multi-halaman, mungkin portal internal sederhana | Template + component + Design mode + AI |
| **Designer / freelancer** (sekunder) | Kontrol desain penuh, cepat publish untuk klien | Canvas bebas (Design mode) |
| **Tim internal Platform** (admin) | Memproduksi template & component berkualitas | Mode admin + AI internal |

### 3.2 Persona

**Persona A: Bu Sari, pemilik toko kue rumahan**
- Tidak paham desain maupun teknis. Aktif di Instagram dan WhatsApp.
- Ingin: katalog kue, pelanggan bisa pesan, notifikasi masuk ke WhatsApp, bisa bayar QRIS.
- Jalur: pilih template "Bakery" → ganti logo, foto, harga → minta AI "buatkan sistem pesanan" (paket berbayar) → publish.

**Persona B: Raka, marketing di perusahaan konsultan (50 karyawan)**
- Paham sedikit desain, punya brand guideline (warna, font, logo).
- Ingin: company profile 8 halaman sesuai brand, form kontak, blog, dan nanti bekerja bersama tim.
- Jalur: template company profile → terapkan theme brand → atur detail di Design mode → custom domain → nanti paket Business untuk kolaborasi.

**Persona C: Dina, designer freelance**
- Mahir Figma.
- Ingin: mendesain dari nol dengan kebebasan penuh, lalu langsung publish tanpa developer.
- Jalur: canvas kosong → Design mode penuh → component pribadi (P2) → publish → custom domain klien.

**Persona D: Admin/designer internal Platform**
- Membuat component dan template untuk library.
- Jalur: mode admin di editor → buat component + props + variants → minta AI membuat variasi → QA → publish versi ke library.

---

## 4. Pembeda (positioning)

Platform bersaing dengan website builder dan tool desain yang sudah ada melalui tiga pilar:

1. **AI sebagai inti, bukan tempelan.** AI bisa memakai seluruh kemampuan platform (desain, component, data, logic, toko) lewat tools resmi. AI juga membangun website **dinamis** yang aman tanpa menulis kode bebas.
2. **UI/UX editor yang menarik dan nyaman.** Pengalaman sekelas Figma untuk yang ingin detail, tetapi tetap ramah bagi pengguna awam lewat Simple mode.
3. **Kombinasi Wix + Figma dalam satu dokumen.** Template, component jadi, canvas bebas, dan AI bukan fitur terpisah, melainkan empat cara mengedit dokumen yang sama. Pengguna bisa berpindah cara kapan saja.

Ditambah fokus **pasar Indonesia**: bahasa, template untuk bisnis lokal, dan integrasi payment gateway lokal milik pengguna.

---

## 5. Konsep produk: satu dokumen, empat pintu masuk

Semua website disimpan dalam satu **document model** (pohon node JSON, lihat [specs/01-document-model.md](./specs/01-document-model.md)). Ada empat cara untuk membuat dan mengubahnya:

```
                    ┌──────────────────────────┐
  Template  ───────▶│                          │
  Component ───────▶│   DOCUMENT MODEL (JSON)  │──▶ Renderer ──▶ Website live
  Canvas ala Figma ▶│   satu sumber kebenaran  │
  AI asisten ──────▶│                          │
                    └──────────────────────────┘
```

| Pintu masuk | Untuk siapa | Contoh |
|---|---|---|
| **Template** (ala Wix) | Pengguna awam | Pilih template "Bakery", ganti teks dan foto |
| **Component library jadi** | Awam s.d. menengah | Tambah section "Testimonial", isi kontennya |
| **Canvas bebas** (ala Figma) | Menengah s.d. ahli | Desain dari nol dengan auto-layout, token, variants |
| **AI asisten** | Semua | "Buatkan halaman katalog dengan sistem pesanan" |

Konsekuensinya: AI membuatkan, pengguna merapikan secara manual, lalu meminta AI lagi. Semuanya berjalan mulus karena datanya sama.

---

## 6. Lingkup fitur

Bagian ini merangkum fitur per area. Spesifikasi rinci (requirement ber-ID, perilaku, edge case, acceptance criteria) ada di dokumen spec yang dirujuk.

### 6.1 Editor ala Figma → [specs/02-editor.md](./specs/02-editor.md)

| Fitur | Prioritas | Fase |
|---|---|---|
| Canvas tak terbatas: pan, zoom, rulers | P0 | M0–M2 |
| Tools: select, frame, rectangle, ellipse, line, text, image, icon, hand | P0 | M2 |
| Selection: single, multi, marquee, deep select, select parent/child | P0 | M2 |
| Transformasi: move, resize 8 arah, nudge, input numerik dengan ekspresi | P0 | M2 |
| Smart guides, snapping, pengukuran jarak | P0 | M2 |
| **Auto-layout** (flexbox): direction, wrap, gap, padding, alignment, hug/fill/fixed, min/max | P0 | M2 |
| Constraints untuk frame non-auto-layout | P1 | M2/M9 |
| Grid layout | P1/P2 | M9 |
| Fill (solid, gradient, image), stroke, radius per sudut, shadow, blur, opacity | P0 | M2 |
| Blend mode, boolean operation, mask, pen/vector | P2 | M9+ |
| Typography lengkap + rich text | P0 | M2 |
| Design tokens / styles (warna, tipografi, spacing, radius, shadow) | P0 | M2 |
| Layers panel: tree, rename, reorder, hide, lock, search | P0 | M2 |
| Component, variants, instance, override, detach | P0 | M3 |
| Assets & media library, ikon | P0 | M2–M4 |
| Insert panel (component, section, blok dinamis) | P0 | M3–M4 |
| Responsif: preview device, auto-responsive, override manual per breakpoint (opsional) | P0 / P1 | M2–M4 / M9 |
| Interaksi: link, hover/pressed state, animasi sederhana, sticky | P0 / P1 | M4 / M9 |
| Clipboard, duplicate, copy/paste properties | P0 | M2 |
| Undo/redo, version history, autosave, crash recovery | P0 | M1–M4 |
| Keyboard shortcuts lengkap + command palette | P0 | M2 |
| Semantic HTML tag per node, aksesibilitas, SEO per halaman | P0 | M2–M4 |
| **Simple mode** (edit konten saja) vs **Design mode** (Figma penuh) | P0 | M4 |
| Kolaborasi real-time (cursor, presence, komentar) | P2 | M9 |

### 6.2 Component & template → [specs/03-components-templates.md](./specs/03-components-templates.md)

- **Mode admin** di editor: buat component dari seleksi, definisikan props, variants, elemen editable/terkunci, kategori/tag, thumbnail otomatis, publish versi. **(P0, M3)**
- **Versioning immutable**: website pengguna terkunci ke versi tertentu, mendapat notifikasi update, bisa preview diff, update, atau detach. **(P0, M3–M4)**
- **Library v1**: target sekitar 150–250 varian component di kategori navigasi, hero, fitur, konten, social proof, pricing, FAQ, CTA, kontak, kartu, form, dashboard, dan lain-lain. **(P0, M4)**
- **Template v1**: target sekitar 20–30 template untuk industri Indonesia (kuliner, fashion, jasa, klinik, kursus, properti, salon, bengkel, company profile, portfolio, undangan/event, toko online, dan lain-lain). **(P0, M4)**
- **Theme system**: preset palet + font pairing + radius/shadow, ganti tema satu klik. **(P0, M4)**
- Library dibuat oleh **tim internal dengan bantuan AI**, langsung di editor milik platform (tidak memakai Figma asli). Library awal boleh di-*seed* lewat JSON. **(P0, M3)**
- Library pribadi pengguna, marketplace designer luar. **(P2)**

### 6.3 AI asisten → [specs/04-ai-agent.md](./specs/04-ai-agent.md)

- **Agent dengan tools**: AI hanya bertindak lewat tools resmi (baca dokumen, cari component, sisipkan, ubah style, buat halaman, dan seterusnya). **(P0, M6)**
- **Skills**: panduan berbentuk Markdown (prinsip desain, pola layout, copywriting ID/EN, cara membuat toko, sistem pesanan, membership, dan lain-lain) yang dimuat sesuai kebutuhan. **(P0, M6)**
- **Generate website dari deskripsi bisnis** saat onboarding. **(P0/P1, M6)**
- **Redesign seleksi**, copywriting, terjemahan ID↔EN, alt text & SEO, theme dari logo. **(P0/P1, M6)**
- **AI melihat hasilnya sendiri** (screenshot preview) dan memperbaiki. **(P0, M6)**
- **Draft & undo**: semua perubahan AI bisa di-preview, diterapkan, atau dibatalkan sekaligus. **(P0, M6)**
- **AI untuk website dinamis** (M7) dan **e-commerce** (M8).
- **AI internal untuk admin**: produksi variasi component/template. **(P1, mulai M3–M4)**
- **Sistem kredit/kuota** per paket. **(P0, M6)**

### 6.4 Website dinamis → [specs/05-dynamic-data.md](./specs/05-dynamic-data.md)

Hanya tersedia pada paket yang menyertakan AI. Pengguna tidak membangun backend sendiri: **AI yang mengkonfigurasi**, sedangkan pengguna tetap bisa melihat dan mengedit konfigurasinya secara visual.

| Fitur | Prioritas | Fase |
|---|---|---|
| **Collections** (tabel database per website, field bertipe, relasi) | P0 | M7 |
| Data manager ala spreadsheet (CRUD, filter, import/export CSV) | P0 | M7 |
| **Bindings** (list/repeater, detail page dinamis, conditional visibility) | P0 | M7 |
| **Forms** (simpan ke collection, validasi, anti-spam, notifikasi) | P0 | M7 |
| **Login end-user / member website** (register, login, roles, halaman terproteksi) | P0 | M7 |
| **Dashboard, table, CRUD** blocks | P0 | M7 |
| Access rules per collection (public, member, owner-only, role) | P0 | M7 |
| **Workflows** (trigger → steps: simpan, kirim email/WA, kondisi, dan lain-lain) | P0 | M7 |
| HTTP request block, jadwal, webhook masuk | P1 | M7+ |
| Custom code di sandbox | P2 | M9+ |

### 6.5 E-commerce → [specs/06-commerce-payments.md](./specs/06-commerce-payments.md)

- Website pengguna bisa berjualan: produk, varian, stok, keranjang, checkout, ongkir sederhana, manajemen pesanan, notifikasi. **(P0, M8)**
- **Bring Your Own Gateway**: pengguna menghubungkan **akun payment gateway miliknya sendiri** (kandidat: Midtrans, Xendit). Dana langsung masuk ke pengguna, dan platform tidak memegang dana. Kredensial dienkripsi. **(P0, M8)**
- Opsi ringan untuk UMKM tanpa gateway: **order via WhatsApp**, transfer manual + upload bukti, COD. **(P0/P1, M7–M8)**

### 6.6 Publish & hosting → [specs/07-publishing-hosting.md](./specs/07-publishing-hosting.md)

- Publish menjadi **HTML statis** yang cepat (CDN), dengan islands JS untuk bagian dinamis. **(P0, M4 / M7)**
- **Subdomain acak** untuk Free (mis. `x7k2p9mq.platformmu.site`), **subdomain nama pilihan** mulai Starter, **custom domain** mulai Pro. **(P0, M4–M5)**
- Preview link, riwayat deployment, rollback. **(P0, M4)**
- SEO: title/description/OG per halaman, sitemap, robots, structured data. **(P0/P1, M4)**
- Analytics ringan bawaan + integrasi GA4/Meta Pixel. **(P1)**
- Badge "Made with Platform" wajib untuk Free. **(P0, M4)**

### 6.7 Akun, paket, admin, moderasi → [specs/08-accounts-plans-admin.md](./specs/08-accounts-plans-admin.md)

- Akun platform, workspace pribadi, dashboard website, onboarding. **(P0, M1–M4)**
- Paket Free / Starter / Pro / Business, entitlements & kuota, billing langganan. **(P0, M4–M5)**
- Admin panel internal: pengguna, website, library, moderasi, override paket, feature flag, audit. **(P0, M4)**
- **Moderasi**: anti-phishing, judi online, penipuan, impersonasi brand pada situs pengguna. **(P0, M4)**
- Tim & kolaborasi (invite, role) untuk paket Business, lalu multiplayer real-time. **(P2, M9)**
- UI dwibahasa ID/EN. **(P0, M1+)**
- Kepatuhan: UU PDP, pendaftaran PSE, syarat & ketentuan. **(P0 sebelum rilis publik)**

---

## 7. User journey utama

### J1: Pengguna baru membuat website dari template (Free) · M4

1. Daftar (email/Google) → verifikasi email.
2. Onboarding: jenis bisnis, tujuan website.
3. Pilih template (difilter berdasarkan jenis bisnis).
4. Isi info bisnis: nama, logo, warna, nomor WhatsApp → template terisi otomatis.
5. Editor terbuka dalam **Simple mode**: klik teks untuk mengganti, klik gambar untuk mengunggah.
6. Preview desktop/tablet/mobile.
7. Publish → website live di `x7k2p9mq.platformmu.site` dengan badge.

**Kriteria sukses:** pengguna awam bisa publish dalam ≤ 15 menit tanpa bantuan.

### J2: Menambah section dari component library · M4

1. Di editor, buka panel **Insert** → kategori "Testimonial".
2. Hover untuk preview → drag ke halaman (otomatis masuk ke posisi yang tepat).
3. Ganti isi lewat props panel (nama, foto, kutipan).
4. Component tetap terhubung ke library dan bisa menerima update versi.

### J3: Desain dari nol (Design mode) · M4

1. Buat website kosong → pindah ke **Design mode**.
2. Buat frame, auto-layout, teks, gambar. Pakai token warna/tipografi.
3. Ubah seleksi menjadi component pribadi (P2), atur override responsif (opsional).
4. Publish.

### J4: AI membuat website dari deskripsi · M6

1. "Buatkan website untuk klinik gigi di Bandung, ada halaman layanan, dokter, dan booking via WhatsApp."
2. AI menampilkan rencana → pengguna setuju.
3. AI memilih template/component, menulis konten, mengatur theme, memeriksa preview.
4. Ringkasan perubahan → **Terapkan** atau **Batalkan semua**.

### J5: AI membuat sistem pesanan (website dinamis) · M7

1. "Saya mau pelanggan bisa pesan kue, pesanan masuk ke daftar, dan saya dapat notifikasi WhatsApp."
2. AI membuat collections `Produk` + `Pesanan`, mengikat product grid ke data, menambah form pesanan, dan membuat workflow notifikasi.
3. AI menanyakan nomor WhatsApp pemilik.
4. Pengguna mengelola produk dan pesanan di data manager (tampilan spreadsheet).

### J6: Website membership · M7

1. "Buat website kursus online: member bisa daftar, login, lihat materi. Saya bisa tambah materi."
2. AI mengaktifkan end-user auth, membuat collection `Materi` dengan access rule "member only", halaman dashboard member, dan halaman admin CRUD.

### J7: Toko online dengan payment gateway sendiri · M8

1. Pengguna Pro membuka **Settings → Payments** → memilih gateway → memasukkan kredensial akun gateway miliknya → mendaftarkan URL webhook (dipandu) → **Test connection** ✅.
2. AI menyiapkan katalog, keranjang, dan checkout.
3. Pembeli membayar via QRIS → webhook → status pesanan "paid" → notifikasi WA ke pemilik.

### J8: Upgrade paket · M5

1. Pengguna Free ingin nama `tokobudi` → upgrade Starter → bayar.
2. Memilih subdomain `tokobudi.platformmu.site`; subdomain acak lama otomatis redirect 301.

### J9: Admin memproduksi component · M3

1. Admin membuka editor dalam mode admin → mendesain card → **Create component**.
2. Mendefinisikan props (`title`, `price`, `image`, `variant`) dan menandai elemen editable.
3. Meminta AI internal membuat 5 variasi → kurasi → QA checklist → **Publish v1**.

---

## 8. Paket & model bisnis

> ❓ OPEN: harga semua paket, batas angka final, dan apakah Starter mendapat AI/dinamis. Detail kerangka pricing, entitlements, dan billing ada di [specs/08-accounts-plans-admin.md](./specs/08-accounts-plans-admin.md).

### 8.1 Prinsip

- **Website statis gratis selamanya** pada paket Free, sebagai alat akuisisi. Badge "Made with Platform" di setiap situs Free juga berfungsi sebagai iklan.
- **Website dinamis hanya lewat paket yang menyertakan AI.** Pengguna tidak membuat backend sendiri.
- **AI memakai kredit/kuota**, bukan unlimited, karena biaya token bersifat variabel.
- Biaya per pengguna Free harus sangat kecil, maka arsitektur hosting dibuat **static-first di CDN**.

### 8.2 Matriks paket (usulan awal)

| Fitur | **Free** | **Starter** | **Pro** | **Business / Tim** |
|---|---|---|---|---|
| Website statis (template, component, canvas) | ✅ | ✅ | ✅ | ✅ |
| Subdomain | **Acak** (`x7k2p9mq`) | **Nama pilihan** | Nama pilihan | Nama pilihan |
| Custom domain | ❌ | ❌ | ✅ | ✅ |
| Badge "Made with Platform" | Wajib | Wajib ❓ | Bisa dihapus | Bisa dihapus |
| Jumlah website | Kecil (mis. 1–3) | Lebih banyak | Lebih banyak | Paling banyak |
| Storage | Kecil | Sedang | Besar | Paling besar |
| Template/component premium | Sebagian | ❓ | ✅ | ✅ |
| AI asisten | Trial terbatas ❓ | Kuota kecil ❓ | Kuota besar | Kuota terbesar / pool tim |
| Website dinamis | ❌ | Terbatas ❓ | ✅ | ✅ |
| E-commerce (BYO gateway) | ❌ | ❓ | ✅ | ✅ |
| Version history | Pendek | Sedang | Panjang | Paling panjang |
| Kolaborasi tim (invite, role) | ❌ | ❌ | ❌ | ✅ (M9) |
| Multiplayer real-time | ❌ | ❌ | ❌ | ✅ (M9+) |

> Matriks ini ringkasan tingkat produk. **Angka & ketersediaan final mengikuti [08 §6.2](./specs/08-accounts-plans-admin.md)** (sumber kebenaran). Usulan 08 saat ini untuk sel ❓: Starter mendapat 100 kredit AI/bulan, dinamis terbatas (form → collection), checkout e-commerce ❌ (katalog statis + tombol WhatsApp ✅); Free mendapat 30 kredit trial sekali.

### 8.3 Aturan subdomain

- **Free**: subdomain dibuat **acak oleh sistem** (8 karakter, contoh `x7k2p9mq.platformmu.site`; aturan generator di [07 PUB-080](./specs/07-publishing-hosting.md#pub-080-generator-subdomain-acak-free)), dan pengguna **tidak bisa** memilih nama. Ini juga mencegah penyalahgunaan nama brand untuk phishing.
- **Starter ke atas**: pengguna memilih nama (`tokobudi.platformmu.site`), mengikuti aturan reserved words dan anti-impersonasi.
- **Saat upgrade**: subdomain acak lama otomatis **redirect 301** ke nama baru.
- **Saat downgrade**: > ❓ OPEN: apakah nama ditahan sementara (grace period) sebelum dilepas.

> ❓ OPEN (rekomendasi arsitektur, dipakai sebagai default di semua dokumen): situs pengguna di **domain terpisah** `*.platformmu.site` (bukan `*.platformmu.com`) agar reputasi dan cookie domain utama aman. Kode membaca root domain situs dari env `SITES_ROOT_DOMAIN` (lokal: `<sub>.localhost:8787`). Lihat [ARCHITECTURE §3](./ARCHITECTURE.md#3-domain-host--routing) dan [07 PUB-201](./specs/07-publishing-hosting.md#pub-201-domain-terpisah-untuk-situs-user).

### 8.4 Sumber pendapatan

1. Langganan bulanan/tahunan (Starter, Pro, Business).
2. Top-up kredit AI.
3. (P2) Add-on: seat tambahan, storage, template premium.
4. (P2) Komisi marketplace.
5. > ❓ OPEN: fee transaksi e-commerce. Rekomendasi: **tidak** mengambil fee di awal.

---

## 9. Requirement non-fungsional

| Area | Requirement |
|---|---|
| **Performa editor** | Pan/zoom 60 fps dengan ≥ 2.000 node per halaman; input latency < 50 ms; membuka editor < 3 detik untuk situs 10 halaman. |
| **Performa situs publish** | Lighthouse mobile ≥ 90 untuk template bawaan; LCP < 2,5 detik pada 4G; halaman statis tanpa framework runtime. |
| **Waktu publish** | < 30 detik untuk situs 10 halaman. |
| **Ketersediaan** | Situs publish ≥ 99,9% (disajikan dari CDN); editor/API ≥ 99,5% di awal. |
| **Keamanan** | Isolasi tenant di setiap layer; kredensial payment pengguna dienkripsi; AI hanya via tools; validasi Zod di setiap boundary; CSP; rate limiting; audit log. |
| **Privasi** | Patuh UU PDP: kebijakan privasi, consent, hapus/ekspor data, platform sebagai pemroses data pembeli/member milik pengguna. |
| **Skalabilitas** | Arsitektur mendukung 10.000 situs tanpa perubahan besar; jalur scaling ke 100.000+ terdokumentasi. |
| **Biaya** | Biaya infrastruktur per situs Free sangat kecil (target: ratusan s.d. beberapa ribu rupiah/bulan). |
| **Aksesibilitas** | Output semantic HTML, alt text, kontras; editor dapat dioperasikan dengan keyboard. |
| **i18n** | UI platform ID (default) dan EN; format angka/mata uang/tanggal lokal (IDR). |
| **Browser** | Editor: Chrome, Edge, Firefox, Safari versi terbaru (desktop). Situs publish: semua browser modern + mobile. Editor di mobile: tidak didukung (hanya preview). |
| **Maintainability** | TypeScript strict, monorepo, test otomatis, dokumentasi sebagai sumber kebenaran untuk AI coding agent. |

---

## 10. Non-goals

Hal-hal berikut **sengaja tidak dibuat** (setidaknya sampai disebut lain di ROADMAP). AI coding agent **tidak boleh** menambahkannya atas inisiatif sendiri.

1. **Export kode** (HTML/React) untuk developer. Output Platform adalah website live.
2. **Import dari Figma asli** atau sinkronisasi dua arah dengan Figma.
3. **Pengguna menulis kode backend bebas** atau mengatur database secara manual di luar collections/workflows.
4. **AI menghasilkan kode bebas** yang dijalankan di server.
5. **Platform memegang dana pembeli** (menjadi payment aggregator). Pembayaran selalu lewat gateway milik pengguna.
6. **Editor di perangkat mobile** (selain preview).
7. **Ilustrasi vektor tingkat lanjut** (pen tool, boolean, mask) sebelum fase M9+.
8. **Aplikasi mobile native** untuk platform.
9. **Multi-bahasa konten situs pengguna** (situs dua bahasa) sebelum P2.
10. **Hosting email** untuk domain pengguna.
11. **Marketplace** sebelum fase lanjut.
12. **Pasar di luar Indonesia** sebagai fokus awal (UI EN tersedia, tetapi template, payment, dan copywriting dioptimalkan untuk Indonesia).

---

## 11. Metrik keberhasilan

| Metrik | Definisi | Target awal (ilustrasi) |
|---|---|---|
| **Aktivasi** | % pendaftar yang publish website dalam 7 hari | ≥ 30% |
| **Time-to-publish** | Median waktu dari daftar ke publish pertama | ≤ 15 menit |
| **Retensi** | % pengguna yang kembali mengedit dalam 30 hari | ≥ 25% |
| **Konversi berbayar** | % pengguna aktif yang berlangganan | 2–5% |
| **Adopsi AI** | % pengguna berbayar yang menjalankan AI ≥ 1×/minggu | ≥ 50% |
| **Kualitas AI** | % run AI yang diterapkan (tidak dibatalkan) | ≥ 60% |
| **Performa situs** | % situs publish dengan Lighthouse mobile ≥ 90 | ≥ 80% |
| **Moderasi** | Waktu median penanganan laporan abuse | < 24 jam |
| **Biaya** | Biaya infra per situs Free per bulan | Di bawah target §9 |

---

## 12. Fase rilis (ringkas)

Rincian task, checklist, dan kriteria selesai ada di [ROADMAP.md](./ROADMAP.md).

| Fase | Nama | Hasil utama |
|---|---|---|
| **M0** | Spike canvas | Bukti bahwa editor DOM-based terasa mulus (pan/zoom, select, drag, auto-layout, undo) |
| **M1** | Fondasi | Monorepo, document model v1, renderer v1, API, DB, auth, dashboard, autosave |
| **M2** | Editor inti | Fitur Figma P0: tools, selection, transform, auto-layout, styling, typography, tokens, layers, shortcuts |
| **M3** | Component & mode admin | Component, props, variants, instance, versioning, mode admin, seed library |
| **M4** | Template, publish, Free | Template, Simple mode, publish statis ke subdomain acak, admin panel & moderasi dasar → 🚀 **rilis publik pertama** |
| **M5** | Billing & paket berbayar | Starter/Pro, subdomain pilihan, custom domain, hapus badge |
| **M6** | AI asisten | Agent + tools + skills, generate/redesign, kredit |
| **M7** | Website dinamis | Collections, bindings, forms, login member, dashboard/table/CRUD, workflows |
| **M8** | E-commerce | Produk, keranjang, checkout, BYO payment gateway, pesanan |
| **M9+** | Lanjutan | Fitur Figma lanjutan, override responsif penuh, Business/Tim, multiplayer, marketplace |

**Mengapa rilis pertama di M4 (tanpa AI)?** Website statis dari template sudah bernilai bagi UMKM, memvalidasi pasar, dan menghasilkan pengguna sebelum mengerjakan bagian termahal (AI, data dinamis, commerce).

---

## 13. Risiko & mitigasi

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | Scope sangat besar untuk solo developer | Tidak pernah rilis | Rilis M4 tanpa AI; prioritas P0/P1/P2 ketat; non-goals tegas |
| R2 | Editor canvas DOM tidak cukup mulus/cepat | UX buruk, pembeda hilang | Spike M0 dengan target performa terukur; renderer dipisah dari model agar bisa diganti |
| R3 | Format document model salah di awal | Migrasi mahal untuk semua situs | Rancang hati-hati (spec 01), `schemaVersion` + migrasi, Yjs & breakpoints sejak awal |
| R4 | Penyalahgunaan subdomain gratis (phishing, judi online) | Domain masuk blacklist, semua situs terdampak | Subdomain acak, domain situs terpisah, moderasi, verifikasi email, laporan abuse, deteksi otomatis |
| R5 | Biaya AI membengkak | Rugi per pengguna | Sistem kredit, routing model, prompt caching, batas iterasi, monitoring biaya |
| R6 | Kualitas hasil AI tidak konsisten | Pengguna kecewa | AI memakai component jadi + skills; AI memeriksa screenshot; eval set; draft + undo |
| R7 | Keamanan data dinamis & multi-tenant | Kebocoran data | Blok terbatas (tanpa kode bebas), scoping site_id di setiap query, access rules default deny, audit |
| R8 | Integrasi payment gateway pengguna rumit | Pengguna gagal setup | Panduan langkah demi langkah, test connection, opsi order via WhatsApp/transfer manual |
| R9 | Regulasi (PSE, UU PDP, pembayaran) | Hambatan operasional | BYO gateway (platform tidak memegang dana), kebijakan privasi, pendaftaran PSE sebelum rilis |
| R10 | Library template/component kurang banyak saat rilis | Pengguna tidak menemukan yang cocok | Seed via JSON sejak M1–M3, AI internal untuk variasi, fokus industri prioritas |
| R11 | Vibe coding menghasilkan kode tidak konsisten | Utang teknis | CLAUDE.md, struktur folder baku, test, lint, typecheck, review per task |

---

## 14. Asumsi

1. Pengguna UMKM mayoritas membuat website dari template, bukan dari nol.
2. Pengguna bersedia membayar untuk AI + website dinamis + custom domain.
3. Model AI (Claude) cukup andal menyusun website lewat tools yang terstruktur.
4. Biaya hosting statis di CDN cukup rendah untuk mendukung paket Free permanen.
5. Pengguna yang berjualan bersedia membuat akun payment gateway sendiri (atau memakai order via WhatsApp/transfer manual).
6. Owner mengerjakan sendiri dengan bantuan AI coding agent, tanpa tenggat waktu.

---

## 15. Keputusan terbuka

| # | Topik | Catatan / rekomendasi |
|---|---|---|
| O1 | Nama produk & domain | Dibutuhkan sebelum M4 |
| O2 | Harga paket & angka batas | Lihat kerangka di spec 08; validasi dengan calon pengguna |
| O3 | Starter: dapat AI/dinamis/commerce? | Rekomendasi: kuota AI kecil + dinamis terbatas |
| O4 | Trial AI untuk Free | Rekomendasi: beberapa kali run gratis untuk aktivasi |
| O5 | Domain terpisah untuk situs pengguna | Direkomendasikan kuat (spec 07, ARCHITECTURE) |
| O6 | Payment gateway yang didukung untuk BYOG | Kandidat Midtrans & Xendit; verifikasi API resmi |
| O7 | Payment gateway untuk langganan platform & model perpanjangan | Recurring terbatas di Indonesia; kemungkinan invoice + reminder |
| O8 | Fee transaksi e-commerce | Rekomendasi: tidak ada di awal |
| O9 | Provider WhatsApp | WhatsApp Business API via BSP resmi |
| O10 | Sumber stock image | Harus berlisensi komersial |
| O11 | Aturan subdomain saat downgrade | Grace period sebelum dilepas |
| O12 | Form kontak sederhana untuk paket non-AI? | Lihat spec 05 |
| O13 | Hosting api/worker & web (VPS, Railway/Fly, Vercel) | Lihat ARCHITECTURE |
| O14 | Pajak (PPN) atas langganan & badan usaha | Konsultasi pajak/legal |

Daftar OPEN yang lebih rinci tersebar di setiap spec (cari `❓ OPEN`).

---

## 16. Glosarium

| Istilah | Arti |
|---|---|
| **Document model** | Format data (pohon node JSON) yang menyimpan seluruh desain website. Satu sumber kebenaran. |
| **Node** | Satu elemen dalam dokumen: frame, text, image, instance, dan lain-lain. |
| **Frame** | Kontainer (mirip `div`) yang bisa memiliki auto-layout. |
| **Auto-layout** | Tata letak otomatis ala Figma, diterjemahkan ke CSS flexbox. |
| **Design token** | Nilai desain bernama (warna, font, spacing) yang dipakai ulang; mengganti token mengubah seluruh situs. |
| **Component** | Elemen desain yang bisa dipakai ulang, disimpan sebagai definisi berversi di library. |
| **Instance** | Pemakaian component di situs: referensi ke `component@versi` + props + overrides. |
| **Props** | Pengaturan component yang boleh diubah (teks, gambar, varian). |
| **Variant** | Variasi component (mis. size=sm/md/lg). |
| **Override** | Perubahan desain pada instance di luar props. |
| **Detach** | Memutus instance dari library menjadi node biasa. |
| **Template** | Website lengkap yang siap dipakai, berisi halaman, theme, dan instance component. |
| **Theme** | Kumpulan token (palet, font, radius, shadow) untuk satu situs. |
| **Breakpoint** | Ukuran layar (desktop/tablet/mobile) untuk responsif. |
| **Simple mode** | Mode editor untuk pengguna awam: hanya mengedit konten. |
| **Design mode** | Mode editor penuh ala Figma. |
| **Mode admin** | Mode editor untuk tim internal: membuat & mempublikasikan component/template. |
| **Collection** | Tabel data milik satu website (mis. Produk, Pesanan). |
| **Record** | Satu baris data dalam collection. |
| **Binding** | Hubungan antara component dan data (mis. card menampilkan isi collection). |
| **Workflow** | Logic "ketika X terjadi → lakukan Y", dijalankan workflow engine. |
| **End-user / member** | Pengunjung yang mendaftar/login di website milik pengguna (bukan akun platform). |
| **Tools (AI)** | Fungsi resmi yang boleh dipanggil AI untuk membaca/mengubah situs. |
| **Skills (AI)** | Dokumen panduan Markdown yang mengajari AI cara memakai platform dengan baik. |
| **Islands** | Potongan kecil JavaScript pada halaman statis yang menghidupkan bagian dinamis. |
| **BYOG** | Bring Your Own Gateway: pengguna memakai akun payment gateway miliknya sendiri. |
| **Entitlements** | Daftar hak dan batas yang dimiliki sebuah akun berdasarkan paketnya. |
| **Deployment** | Satu versi hasil publish yang immutable; bisa di-rollback. |
