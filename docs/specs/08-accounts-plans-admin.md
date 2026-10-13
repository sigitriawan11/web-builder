# 08 — Akun, Paket, Billing, Admin, Moderasi, i18n & Legal

> Spesifikasi untuk semua hal "di sekitar" editor: siapa pemilik website, apa yang boleh mereka lakukan menurut paketnya, bagaimana mereka membayar, bagaimana tim internal mengelola platform, dan bagaimana platform tetap aman & legal di Indonesia.
>
> Prefix requirement: **`ACC-`**. Prioritas: **P0** = wajib untuk fase targetnya, **P1** = penting, **P2** = nanti. Fase: M0..M9 (lihat [ROADMAP](../ROADMAP.md)).
>
> Dokumen terkait: [PRD](../PRD.md) · [ARCHITECTURE](../ARCHITECTURE.md) · [03 Components & Templates](./03-components-templates.md) · [04 AI Agent](./04-ai-agent.md) · [05 Dynamic Data](./05-dynamic-data.md) · [06 Commerce & Payments](./06-commerce-payments.md) · [07 Publishing & Hosting](./07-publishing-hosting.md)

---

## Daftar Isi

1. [Ruang lingkup & istilah](#1-ruang-lingkup--istilah)
2. [Akun platform](#2-akun-platform)
3. [Workspace & tim](#3-workspace--tim)
4. [Dashboard pemilik](#4-dashboard-pemilik)
5. [Onboarding](#5-onboarding)
6. [Paket & matriks fitur](#6-paket--matriks-fitur)
7. [Kerangka pricing](#7-kerangka-pricing)
8. [Entitlements, kuota & metering](#8-entitlements-kuota--metering)
9. [Billing langganan platform](#9-billing-langganan-platform)
10. [Admin panel internal](#10-admin-panel-internal)
11. [Moderasi & abuse](#11-moderasi--abuse)
12. [Notifikasi platform](#12-notifikasi-platform)
13. [Internationalization (i18n)](#13-internationalization-i18n)
14. [Legal & kepatuhan Indonesia](#14-legal--kepatuhan-indonesia)
15. [Support](#15-support)
16. [Analytics produk internal](#16-analytics-produk-internal)
17. [Skema data](#17-skema-data)
18. [Ringkasan API](#18-ringkasan-api)
19. [Fase & urutan implementasi](#19-fase--urutan-implementasi)
20. [Daftar OPEN](#20-daftar-open)

---

## 1. Ruang lingkup & istilah

### 1.1 Cakupan

Dokumen ini mencakup:

- **Akun platform** — orang yang membuat & memiliki website di Platform (pemilik website, "owner", "user platform").
- **Workspace** — wadah kepemilikan site, langganan, dan anggota.
- **Paket, entitlements, kuota, metering** — apa yang boleh dilakukan & berapa banyak.
- **Billing langganan platform** — pembayaran dari user ke Platform (BUKAN pembayaran pembeli ke toko user; itu di [06](./06-commerce-payments.md)).
- **Admin panel internal**, **moderasi & abuse**, **notifikasi**, **i18n UI**, **legal**, **support**, **analytics produk internal**.

Di luar cakupan (dirujuk saja):

| Topik | Dokumen |
|---|---|
| End-user / member website (login pengunjung website user) | [05 Dynamic Data](./05-dynamic-data.md) |
| Payment gateway milik user untuk toko online | [06 Commerce & Payments](./06-commerce-payments.md) |
| Publish, subdomain, custom domain, redirect 301 | [07 Publishing & Hosting](./07-publishing-hosting.md) |
| Library component/template & mode admin editor | [03 Components & Templates](./03-components-templates.md) |
| Agent AI, tools, skills, perhitungan kredit per aksi | [04 AI Agent](./04-ai-agent.md) |

### 1.2 Istilah

| Istilah | Arti |
|---|---|
| **User** | Akun platform (tabel `users`). Pemilik/anggota workspace. |
| **End-user / member** | Pengunjung website user yang login di website tersebut. Tabel terpisah per site, lihat [05](./05-dynamic-data.md). TIDAK pernah tercampur dengan `users`. |
| **Workspace** | Unit kepemilikan & billing. Tipe `personal` (otomatis, 1 per user) atau `team` (Business/Tim). |
| **Site** | Satu website (project) di dalam workspace. |
| **Plan** | Paket: `free`, `starter`, `pro`, `business`. |
| **Entitlements** | Hasil resolusi plan + add-on + override → objek limit & feature flag efektif untuk satu workspace. |
| **Usage counter** | Penghitung pemakaian per workspace per periode (mis. AI kredit, form submissions). |
| **Kredit AI** | Satuan pemakaian AI. Definisi biaya per aksi di [04](./04-ai-agent.md). |
| **Staff / super_admin** | Tim internal Platform yang mengakses `/admin`. |
| **Periode billing** | Rentang 1 bulan atau 1 tahun sejak `current_period_start`. |
| **Dunning** | Proses penagihan ulang saat pembayaran gagal/terlambat. |

### 1.3 Prinsip desain

1. **Satu sumber kebenaran untuk limit**: semua pengecekan memakai `entitlements` service. Tidak ada `if (plan === 'pro')` tersebar di kode.
2. **Jangan pernah menghapus data user karena downgrade**: bekukan (freeze), sembunyikan, read-only — hapus hanya setelah retensi panjang + pemberitahuan berulang.
3. **Sederhana dulu**: tanpa proration rumit, tanpa auto-debit di awal; invoice + reminder.
4. **Aman secara default**: verifikasi email sebelum publish, rate limit, audit log untuk semua aksi staff.
5. **Dwibahasa sejak hari pertama**: semua string UI lewat `packages/i18n`.

---

## 2. Akun platform

Auth platform memakai **Better Auth** di `apps/api` (handler di-mount di `/api/auth/*`), UI di `apps/web`. Session berbasis cookie httpOnly di domain `app.platformmu.com` (lokal `app.localhost`). Editor (`apps/editor`) memakai cookie yang sama (same-site, subpath atau subdomain yang sama — lihat [ARCHITECTURE](../ARCHITECTURE.md)).

> ✅ Diputuskan (2026-10-13, owner): **Better Auth dipertahankan**. Bila spike kecil di T1.5.1 menemukan kendala (nama tabel, Express 5), keputusan ini dibuka ulang sebelum lanjut. Spec ini tetap menulis perilaku, bukan detail library. Tabel `users`/`sessions`/`accounts`/`verifications` mengikuti skema Better Auth dengan kolom tambahan.

### ACC-001 Registrasi email + password
- **P0 · M1**
- **Perilaku**:
  - Form: nama, email, password, checkbox persetujuan S&K + Kebijakan Privasi (wajib, tidak pre-checked), checkbox opsional "kirimi saya tips & promo" (consent marketing terpisah, default off).
  - Password minimal 8 karakter, maksimal 128; cek terhadap daftar password umum (top 10k) — tolak bila ada di daftar. Tidak ada aturan komposisi rumit.
  - Email dinormalisasi (lowercase, trim). Email unik global di `users.email`.
  - Hash: algoritma default Better Auth (scrypt/argon2).
  - Setelah sukses: buat `users`, buat **personal workspace** (ACC-030), catat `consents` (versi S&K & privasi yang disetujui, timestamp, IP), kirim email verifikasi (ACC-003), login otomatis dengan status `email_verified=false`.
  - Bahasa UI awal diambil dari `Accept-Language` (id → `id`, selain itu `en`) dan timezone dari browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`), keduanya disimpan ke profil.
  - Rate limit & anti-abuse: lihat ACC-255.
- **Acceptance criteria**:
  - [ ] Registrasi dengan email yang sudah ada menampilkan pesan generik ("Jika email ini belum terdaftar, kami telah mengirim tautan…") — tidak membocorkan keberadaan akun. (Implementasi: tetap kirim email "Anda sudah punya akun, login di sini" ke pemilik email.)
  - [ ] Personal workspace terbuat dalam transaksi DB yang sama dengan user.
  - [ ] Row `consents` tercatat dengan `terms_version` dan `privacy_version`.
  - [ ] Password `password123` ditolak dengan pesan i18n.

### ACC-002 Registrasi & login dengan Google
- **P0 · M1**
- **Perilaku**:
  - OAuth Google via Better Auth social provider. Scope: `openid email profile`.
  - Jika email Google sudah terdaftar via password dan sudah terverifikasi → akun ditautkan (row baru di `accounts`) setelah login sukses. Jika akun lama BELUM terverifikasi → tolak auto-link, minta user login dengan password dulu (mencegah account takeover).
  - Akun baru dari Google dianggap `email_verified=true` bila Google mengembalikan `email_verified`.
  - Pertama kali: tampilkan layar persetujuan S&K (karena belum dicentang di form).
- **Acceptance criteria**:
  - [ ] User baru via Google langsung bisa publish (sudah terverifikasi).
  - [ ] Tidak ada auto-link ke akun password yang belum terverifikasi.
  - [ ] User bisa melihat & memutus tautan Google di Pengaturan > Keamanan, asalkan masih punya metode login lain (password set).

> ❓ OPEN: Provider tambahan (Apple, Facebook, Microsoft) — usulan P2, tidak di MVP.

### ACC-003 Verifikasi email
- **P0 · M1**
- **Perilaku**:
  - Email berisi tautan bertoken (berlaku 24 jam, sekali pakai) + kode 6 digit (alternatif untuk user yang membuka email di perangkat lain).
  - Banner persisten di dashboard: "Verifikasi email Anda untuk mempublikasikan website" + tombol kirim ulang (cooldown 60 detik, maks 5/jam).
  - User yang belum verifikasi BOLEH: membuat site, mengedit, memakai template. TIDAK BOLEH: publish (ACC-256), mengundang anggota, membeli paket, memakai AI di luar trial onboarding.
  - Akun tidak terverifikasi > 30 hari tanpa site yang dipublish → dihapus otomatis (job harian) setelah reminder H-7.
- **Acceptance criteria**:
  - [ ] Token kedaluwarsa menampilkan halaman "tautan kedaluwarsa" dengan tombol kirim ulang.
  - [ ] Endpoint publish mengembalikan `403 EMAIL_NOT_VERIFIED` untuk user belum terverifikasi.
  - [ ] Ganti email (ACC-008) mengirim verifikasi ke email baru; email lama tetap aktif sampai email baru terverifikasi.

### ACC-004 Login & logout
- **P0 · M1**
- **Perilaku**:
  - Login email + password atau Google. Opsi "Ingat saya" (session 30 hari; tanpa centang 1 hari, rolling).
  - Rate limit: 5 percobaan gagal / 15 menit per (email, IP) → delay progresif + CAPTCHA (Cloudflare Turnstile) setelah 3 gagal.
  - Pesan error generik "Email atau password salah".
  - Setelah login: redirect ke `?next=` (hanya path internal, divalidasi) atau dashboard workspace terakhir.
  - Logout menghapus session di server, bukan hanya cookie.
- **Acceptance criteria**:
  - [ ] Open redirect tidak mungkin (`next=https://evil.com` diabaikan).
  - [ ] Setelah 3 gagal, Turnstile muncul; setelah 5 gagal, 15 menit terkunci untuk pasangan email+IP.
  - [ ] Event `auth.login_failed` & `auth.login` tercatat (tanpa password).

### ACC-005 Lupa & reset password
- **P0 · M1**
- **Perilaku**:
  - Form email → selalu tampil "Jika email terdaftar, kami mengirim tautan reset".
  - Token reset berlaku 1 jam, sekali pakai. Setelah reset: semua session lain dicabut, email notifikasi "password Anda diubah" dikirim.
  - User Google-only bisa "set password" lewat alur yang sama.
- **Acceptance criteria**:
  - [ ] Token yang sudah dipakai menghasilkan error.
  - [ ] Semua session selain session saat ini ter-revoke setelah reset.
  - [ ] Respons endpoint identik (status & waktu kira-kira sama) untuk email terdaftar/tidak.

### ACC-006 Two-factor authentication (2FA)
- **P1 · M5**
- **Perilaku**:
  - TOTP (Google Authenticator, Authy, dsb.) via plugin 2FA Better Auth. 10 backup code sekali pakai (ditampilkan sekali, bisa diunduh `.txt`).
  - Wajib re-auth (password / TOTP) untuk: menonaktifkan 2FA, ganti email, hapus akun, export data, mengubah konfigurasi pembayaran toko (rujuk [06](./06-commerce-payments.md)).
  - Admin workspace Business dapat mewajibkan 2FA bagi semua anggota (P2).
  - Staff internal (`/admin`) **wajib** 2FA (ACC-200).
- **Acceptance criteria**:
  - [ ] Login user dengan 2FA aktif meminta kode setelah password benar.
  - [ ] Backup code hanya bisa dipakai sekali; sisa backup code terlihat jumlahnya.
  - [ ] Akses `/admin` tanpa 2FA aktif → diarahkan ke setup 2FA.

> ❓ OPEN: Passkey/WebAuthn (P2). 2FA via WhatsApp OTP (biaya per pesan) — tidak direkomendasikan.

### ACC-007 Sesi & perangkat
- **P0 · M1** (daftar sesi P1 · M4)
- **Perilaku**:
  - Tabel `sessions` menyimpan `user_agent`, `ip`, perkiraan lokasi (kota/negara dari header Cloudflare `cf-ipcountry`/geo IP), `last_active_at`.
  - Halaman Pengaturan > Keamanan > Sesi aktif: daftar perangkat, tombol "Keluar" per sesi dan "Keluar dari semua perangkat lain".
  - Login dari perangkat/negara baru → email notifikasi "Login baru" (P1).
  - Ganti password / aktifkan 2FA → tawarkan cabut sesi lain.
- **Acceptance criteria**:
  - [ ] Mencabut sesi membuat request berikutnya dari perangkat itu `401` dalam < 1 menit (cache session maksimal 60 detik).
  - [ ] Sesi saat ini ditandai "Perangkat ini" dan tidak bisa dicabut dari daftar (pakai logout).

### ACC-008 Profil pengguna
- **P0 · M1**
- **Perilaku**:
  - Field: `name`, `avatar` (upload ke R2, crop persegi, maks 2 MB; default inisial), `email` (ganti dengan verifikasi ulang + re-auth), nomor HP (opsional; verifikasi P1 ACC-257), `locale` (`id`/`en`), `timezone` (IANA, default dari browser, fallback `Asia/Jakarta`), preferensi notifikasi (ACC-273).
  - Info bisnis default (opsional, dipakai onboarding & AI): nama bisnis, kategori, kota.
- **Acceptance criteria**:
  - [ ] Mengubah `locale` langsung mengganti bahasa UI tanpa reload penuh (atau dengan reload yang mempertahankan halaman).
  - [ ] Semua tanggal di dashboard tampil sesuai `timezone` profil.

### ACC-009 Bahasa UI & timezone
- **P0 · M1**
- **Perilaku**: Detail i18n di [§13](#13-internationalization-i18n). Bahasa disimpan di `users.locale`; untuk tamu (belum login) di cookie `NEXT_LOCALE`. Switcher bahasa ada di footer landing, header dashboard, dan menu profil editor.
- **Acceptance criteria**:
  - [ ] User `en` menerima email transaksional dalam bahasa Inggris.
  - [ ] Tanggal invoice & jadwal reminder dihitung di `Asia/Jakarta` (waktu bisnis), ditampilkan di timezone user.

### ACC-010 Hapus akun
- **P0 · M4** (UU PDP — sebelum rilis publik)
- **Perilaku**:
  - Pengaturan > Akun > Hapus akun. Syarat: re-auth; user bukan satu-satunya owner workspace team yang masih punya anggota lain (harus transfer dulu, ACC-036); langganan aktif akan dibatalkan (tanpa refund otomatis, sesuai kebijakan refund ACC-314).
  - Konfirmasi dengan mengetik email. Tampilkan apa yang akan dihapus: N site, M site terpublikasi (akan di-unpublish), data dinamis, order toko.
  - **Masa tenggang 14 hari**: akun berstatus `pending_deletion`, semua site di-unpublish, login masih bisa untuk membatalkan. Setelah 14 hari job `account.purge` menghapus: user, personal workspace beserta site, aset R2, data dinamis, session, OAuth link.
  - Yang **disimpan** (anonimisasi): `invoices` & `billing_payments` (kewajiban pajak/akuntansi, retensi 10 tahun — lihat ACC-312), `audit_logs` (user_id diganti hash), `moderation_*` terkait abuse (retensi 2 tahun).
  - Subdomain yang dilepas masuk karantina 90 hari (tidak bisa diklaim orang lain) — lihat [07](./07-publishing-hosting.md).
- **Acceptance criteria**:
  - [ ] Setelah purge, email yang sama bisa mendaftar lagi sebagai akun baru.
  - [ ] Invoice lama tetap ada dengan `customer_snapshot` (nama/email saat itu) dan `user_id = NULL`.
  - [ ] Email konfirmasi dikirim saat request dan saat purge selesai.

### ACC-011 Export data pribadi (hak akses & portabilitas)
- **P0 · M4**
- **Perilaku**:
  - Tombol "Unduh data saya" → job worker `account.export` membuat ZIP: `profile.json`, `workspaces.json`, `sites/<siteId>/document.json` (document model, lihat [01](./01-document-model.md)), `sites/<siteId>/assets/*`, `sites/<siteId>/collections/*.csv` (data dinamis, lihat [05](./05-dynamic-data.md)), `orders.csv` bila commerce, `invoices/*.pdf`, `consents.json`, `ai_usage.csv`.
  - Link unduh (signed URL R2) dikirim via email, berlaku 7 hari. Maks 1 export / 24 jam.
- **Acceptance criteria**:
  - [ ] Export selesai < 15 menit untuk akun dengan ≤ 5 site & 1 GB aset (target).
  - [ ] Signed URL tidak bisa diakses setelah 7 hari.
  - [ ] Data dari workspace team hanya diikutkan bila user adalah owner/admin workspace tersebut.

### ACC-012 Status akun
- **P0 · M4**
- **Perilaku**: `users.status ∈ { active, pending_deletion, suspended, banned }`.
  - `suspended`: bisa login, melihat dashboard read-only & banner alasan + tombol banding; tidak bisa edit/publish; site tetap sesuai tindakan moderasi.
  - `banned`: tidak bisa login (pesan generik + tautan banding via email), semua site di-unpublish.
- **Acceptance criteria**:
  - [ ] Middleware API menolak mutasi dari user `suspended` dengan `403 ACCOUNT_SUSPENDED`.
  - [ ] Ban mencabut semua session saat itu juga.

---

## 3. Workspace & tim

### 3.1 Model

- Setiap user **selalu** punya 1 **personal workspace** (`type='personal'`), dibuat saat registrasi, tidak bisa dihapus selama user ada, tidak bisa punya anggota lain.
- **Team workspace** (`type='team'`) hanya tersedia di paket Business/Tim (M9). User bisa menjadi anggota banyak team workspace.
- **Langganan melekat ke workspace**, bukan ke user. Personal workspace bisa Free/Starter/Pro; team workspace = Business.
- Site selalu milik tepat satu workspace (`sites.workspace_id`).
- Switcher workspace di kiri atas dashboard (gaya Figma/Vercel).

### ACC-030 Personal workspace otomatis
- **P0 · M1**
- **Perilaku**: dibuat bersamaan dengan user; nama default "Workspace {nama}"; slug acak (`ws_` + nanoid, kolom slug — bukan PK) untuk URL dashboard `app.platformmu.com/w/{workspaceSlug}`. Plan default `free`.
- **Acceptance criteria**:
  - [ ] Tidak ada user tanpa personal workspace (constraint dicek di test integrasi & job konsistensi harian).
  - [ ] Personal workspace tidak menampilkan menu Anggota.

### ACC-031 Membuat team workspace
- **P0 · M9**
- **Perilaku**: Tombol "Buat workspace tim" → nama, slug, (opsional) logo. Wajib memilih paket Business (checkout ACC-162) atau trial Business 14 hari (P1, OPEN). Pembuat menjadi `owner`.
- **Acceptance criteria**:
  - [ ] Team workspace tanpa langganan Business aktif/trial tidak bisa ditambah anggota (selain owner).

> ❓ OPEN: Trial Business 14 hari tanpa kartu — perlu dicek risiko abuse.

### ACC-032 Undang anggota via email
- **P0 · M9**
- **Perilaku**:
  - Owner/admin memasukkan 1..20 email + role. Membuat `workspace_invitations` (token acak, berlaku 7 hari) dan mengirim email.
  - Penerima klik link → jika belum punya akun: daftar (email terkunci ke email undangan) → otomatis bergabung. Jika punya akun dengan email berbeda: tampil peringatan "Undangan ini untuk x@y.com".
  - Tiap anggota (kecuali `billing` & `viewer`, OPEN) memakai 1 **seat**. Undangan pending juga mengklaim seat agar tidak melebihi batas.
  - Undangan bisa dibatalkan & dikirim ulang.
- **Acceptance criteria**:
  - [ ] Undangan ke-N yang melebihi seat ditolak dengan `402 PLAN_LIMIT_REACHED` (`details.key = "seats"`) + CTA tambah seat (add-on, [§7.6](#76-add-on)).
  - [ ] Token undangan tidak bisa dipakai setelah dibatalkan/kedaluwarsa/dipakai.
  - [ ] Pengundang harus terverifikasi email.

> ❓ OPEN: Apakah `viewer` dan `billing` gratis (tidak memakai seat)? Usulan: `viewer` gratis s.d. 5, `billing` gratis.

### ACC-033 Role & permission matrix
- **P0 · M9** (enforcement layer `can()` P0 · M1 agar personal workspace sudah lewat jalur yang sama)
- **Perilaku**: Role tetap (bukan custom role): `owner`, `admin`, `editor`, `viewer`, `billing`. Satu workspace tepat 1 `owner`. Personal workspace: user = `owner` implisit.

**Permission matrix** (✅ boleh · ❌ tidak · 🔸 terbatas):

| Resource / aksi | owner | admin | editor | viewer | billing |
|---|:-:|:-:|:-:|:-:|:-:|
| **Site** — lihat daftar & buka editor (read) | ✅ | ✅ | ✅ | ✅ (read-only) | ❌ |
| Site — buat, duplikat | ✅ | ✅ | ✅ | ❌ | ❌ |
| Site — edit desain & konten | ✅ | ✅ | ✅ | ❌ | ❌ |
| Site — publish / unpublish | ✅ | ✅ | ✅ | ❌ | ❌ |
| Site — arsip / hapus / restore | ✅ | ✅ | 🔸 (site buatannya) | ❌ | ❌ |
| Site — pengaturan domain & subdomain | ✅ | ✅ | ❌ | ❌ | ❌ |
| Site — transfer ke workspace lain | ✅ | ❌ | ❌ | ❌ | ❌ |
| Site — komentar (multiplayer) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **AI** — memakai AI asisten (konsumsi kredit workspace) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Data dinamis** — lihat records & submissions | ✅ | ✅ | ✅ | 🔸 (tanpa PII, OPEN) | ❌ |
| Data — ubah skema collection & workflow | ✅ | ✅ | ✅ | ❌ | ❌ |
| Data — export CSV, hapus massal | ✅ | ✅ | ❌ | ❌ | ❌ |
| Data — kelola member (end-user) website | ✅ | ✅ | 🔸 (lihat saja) | ❌ | ❌ |
| **Payments config** (kredensial gateway toko, [06](./06-commerce-payments.md)) | ✅ | ✅ (re-auth) | ❌ | ❌ | ❌ |
| Commerce — kelola produk | ✅ | ✅ | ✅ | ❌ | ❌ |
| Commerce — kelola order & refund | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Billing** — lihat paket, invoice, usage | ✅ | ✅ | ❌ | ❌ | ✅ |
| Billing — upgrade/downgrade, bayar, add-on | ✅ | ❌ | ❌ | ❌ | ✅ |
| Billing — batalkan langganan | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Members** — lihat daftar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Members — undang / ubah role / keluarkan | ✅ | ✅ (kecuali owner & admin lain) | ❌ | ❌ | ❌ |
| **Workspace** — rename, logo | ✅ | ✅ | ❌ | ❌ | ❌ |
| Workspace — hapus | ✅ | ❌ | ❌ | ❌ | ❌ |
| Workspace — transfer ownership | ✅ | ❌ | ❌ | ❌ | ❌ |
| Audit log workspace (P2) | ✅ | ✅ | ❌ | ❌ | ❌ |

- Implementasi: `packages/` bersama (mis. `packages/permissions` atau modul di `apps/api/src/modules/workspaces/permissions.ts`) mengekspor:

```ts
type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'billing';
type Action =
  | 'site.read' | 'site.create' | 'site.edit' | 'site.publish' | 'site.delete'
  | 'site.domain' | 'site.transfer' | 'site.comment'
  | 'ai.use'
  | 'data.read' | 'data.schema' | 'data.export' | 'data.members'
  | 'payments.config' | 'commerce.products' | 'commerce.orders'
  | 'billing.read' | 'billing.manage' | 'billing.cancel'
  | 'members.read' | 'members.manage'
  | 'workspace.update' | 'workspace.delete' | 'workspace.transfer';

function can(ctx: { role: WorkspaceRole; userId: string }, action: Action,
             resource?: { createdBy?: string }): boolean;
```

- **Acceptance criteria**:
  - [ ] Setiap route API yang menyentuh resource workspace memanggil `requirePermission(action)`; test tabel (table-driven) mencakup seluruh sel matriks.
  - [ ] UI menyembunyikan/menonaktifkan aksi yang tidak diizinkan (berdasarkan endpoint `GET /workspaces/:id/me` yang mengembalikan daftar `permissions`).
  - [ ] Admin tidak bisa mengeluarkan/menurunkan owner atau admin lain.

### ACC-034 Kelola anggota
- **P0 · M9**
- **Perilaku**: halaman Anggota: daftar (avatar, nama, email, role, bergabung, terakhir aktif), ubah role, keluarkan, "Keluar dari workspace" (untuk diri sendiri, kecuali owner). Anggota yang dikeluarkan: sesi editor real-time diputus, site yang dibuatnya tetap milik workspace.
- **Acceptance criteria**:
  - [ ] Anggota yang dikeluarkan kehilangan akses dalam < 1 menit (cache permission ≤ 60 detik + broadcast invalidasi ke `apps/realtime`).
  - [ ] Seat dibebaskan dan tercermin di usage meter.

### ACC-035 Transfer site antar workspace
- **P1 · M9** (antar personal workspace user berbeda: P1 · M5)
- **Perilaku**:
  - Owner site memilih "Transfer site" → target workspace (miliknya sendiri) atau email user lain → penerima menerima/menolak (berlaku 7 hari).
  - Validasi entitlements target: jumlah site, fitur yang dipakai (custom domain, dinamis, commerce). Jika target tidak memenuhi, tampilkan daftar konflik dan tolak (tidak ada transfer parsial).
  - Yang ikut pindah: document, aset, collections & records, members website, orders, domain, subdomain. Yang TIDAK ikut: kredensial payment gateway (harus diisi ulang oleh pemilik baru; alasan keamanan, lihat [06](./06-commerce-payments.md)), riwayat kredit AI.
  - Audit log di kedua workspace.
- **Acceptance criteria**:
  - [ ] Setelah transfer, site live tidak downtime (subdomain/domain tetap).
  - [ ] Kredensial gateway terhapus dan checkout toko menampilkan "toko sementara tidak menerima pembayaran" sampai diisi ulang; pemilik baru dinotifikasi.

> ❓ OPEN: Apakah order & data pembeli ikut pindah (implikasi UU PDP: pengendali data berganti)? Usulan: ikut, dengan persetujuan eksplisit kedua pihak + catatan di audit.

### ACC-036 Transfer kepemilikan workspace
- **P0 · M9**
- **Perilaku**: owner memilih anggota `admin` → konfirmasi re-auth → penerima menerima. Owner lama menjadi `admin`. Langganan & metode tagihan ikut workspace; email tagihan berikutnya ke owner baru (dan role `billing`).
- **Acceptance criteria**:
  - [ ] Tepat satu owner sebelum & sesudah (constraint unik parsial `WHERE role='owner'`).

### ACC-037 Hapus team workspace
- **P1 · M9**
- **Perilaku**: hanya owner, tidak boleh ada langganan aktif berjalan (harus cancel dulu; akan berakhir di akhir periode) ATAU pilih "hapus sekarang tanpa refund". Soft delete 30 hari (seperti site, ACC-054), lalu purge.
- **Acceptance criteria**:
  - [ ] Selama 30 hari, staff bisa memulihkan dari `/admin`.

---

## 4. Dashboard pemilik

Route di `apps/web`: `app.platformmu.com/w/{workspaceSlug}` (lokal `app.localhost:3000/w/...`).

### ACC-050 Daftar website
- **P0 · M1**
- **Perilaku**:
  - Grid kartu (thumbnail screenshot halaman home — dibuat worker Playwright setelah publish/simpan, lihat [07](./07-publishing-hosting.md)) dan mode list.
  - Info per kartu: nama site, URL live (subdomain/custom domain) atau "Belum dipublikasikan", status publish (badge: `Draft`, `Published`, `Perubahan belum dipublikasikan`, `Publish gagal`, `Dibekukan`, `Ditangguhkan moderasi`), terakhir diedit + oleh siapa, label plan-limit bila site melebihi batas.
  - Filter: Semua / Published / Draft / Arsip. Sort: terakhir diedit, nama, dibuat. Search nama.
  - Aksi cepat (menu ⋯): Buka editor, Lihat live, Pengaturan, Duplikat, Ganti nama, Arsip, Hapus, (M9) Transfer.
- **Acceptance criteria**:
  - [ ] Dashboard load < 1,5 detik (p75) untuk workspace dengan 50 site (pagination 24 per halaman).
  - [ ] Status "Perubahan belum dipublikasikan" muncul bila `sites.draft_updated_at > sites.published_at`.

### ACC-051 Buat website baru
- **P0 · M1** (blank) / **M4** (template) / **M6** (AI)
- **Perilaku**: modal "Buat website" dengan 3 jalur:
  1. **Dari template** — galeri template ([03](./03-components-templates.md)) dengan filter kategori (Kuliner, Fashion, Jasa, Company Profile, Portofolio, Event, Pendidikan, Kesehatan…), preview live, badge "Premium" untuk template berbayar (ACC-090).
  2. **Kosong (blank)** — pilih preset ukuran/tema minimal.
  3. **Dengan AI** — prompt bebas + info bisnis → agent membangun draft ([04](./04-ai-agent.md)). Free memakai AI trial (ACC-094).
  - Cek entitlement `sites.max` sebelum membuat. Jika penuh → modal upgrade.
  - Site baru: status `draft`, belum punya subdomain sampai publish pertama (atau subdomain acak di-reserve saat dibuat — keputusan di [07](./07-publishing-hosting.md)).
- **Acceptance criteria**:
  - [ ] Melebihi batas site → `402 PLAN_LIMIT_REACHED` dengan `details: { key: 'sites.max', used, limit, upgrade }`.
  - [ ] Template premium tidak bisa dipakai di paket yang tidak mencakupnya (tombol "Upgrade untuk memakai").

### ACC-052 Duplikasi website
- **P0 · M4**
- **Perilaku**: menyalin document (Yjs snapshot), halaman, aset (reference-copy di R2 — tidak menggandakan objek; aset dihitung ke storage sekali per workspace bila memakai content-addressed storage, lihat [07](./07-publishing-hosting.md)), skema collections TANPA records (opsi centang "salin data" P1), TANPA domain/subdomain, TANPA members/orders/kredensial gateway. Nama: "{nama} (salinan)". Dikerjakan worker bila besar.
- **Acceptance criteria**:
  - [ ] Duplikat dihitung terhadap `sites.max`.
  - [ ] Salinan berstatus draft dan tidak membagi state Yjs dengan aslinya.

### ACC-053 Arsip website
- **P0 · M4**
- **Perilaku**: site diarsip → di-unpublish (subdomain di-reserve tetap milik site, custom domain tetap terpasang tapi menampilkan halaman "situs tidak aktif"), hilang dari daftar utama, **tidak dihitung** ke `sites.max` aktif tetapi dihitung ke `sites.archivedMax` (usulan: Free 3, lainnya 50). Unarchive = cek entitlement lagi.
- **Acceptance criteria**:
  - [ ] Unarchive saat slot penuh → modal upgrade.

> ❓ OPEN: Apakah site arsip tetap menghitung storage? Usulan: ya (aset tetap disimpan).

### ACC-054 Hapus (soft delete) & restore 30 hari
- **P0 · M4**
- **Perilaku**:
  - Hapus → konfirmasi ketik nama site → `sites.deleted_at = now()`, unpublish, subdomain & custom domain tetap di-reserve selama 30 hari.
  - Halaman "Sampah" menampilkan site terhapus + sisa hari + tombol Restore.
  - Hari ke-30: job `site.purge` menghapus permanen document, aset (yang tidak direferensi site lain), records, members, orders (orders dianonimkan? → ikut kebijakan [06](./06-commerce-payments.md)), melepas subdomain ke karantina 90 hari.
  - "Hapus permanen sekarang" tersedia dari Sampah (re-auth).
- **Acceptance criteria**:
  - [ ] Restore di hari ke-29 mengembalikan site utuh (termasuk subdomain) dalam status draft (tidak auto-publish).
  - [ ] Site di Sampah tidak dihitung `sites.max` tapi storage tetap dihitung.

### ACC-055 Status publish & riwayat
- **P0 · M4**
- **Perilaku**: halaman site menampilkan publish terakhir (waktu, oleh siapa, versi), 10 riwayat publish, error publish terakhir beserta pesan yang dapat dipahami, tombol "Publish ulang". Detail pipeline di [07](./07-publishing-hosting.md).
- **Acceptance criteria**:
  - [ ] Publish gagal memunculkan notifikasi in-app + email (ACC-270).

### ACC-056 Usage meter
- **P0 · M4**
- **Perilaku**: widget di dashboard & halaman Billing > Pemakaian: bar per resource (site, storage, bandwidth, kredit AI, form submissions, records, email/WA, seats) dengan warna: hijau < 80%, kuning 80–99%, merah ≥ 100%. Tooltip: tanggal reset. Data dari `GET /workspaces/:id/usage` (Redis + DB, ACC-133).
- **Acceptance criteria**:
  - [ ] Angka di meter sama (selisih ≤ 1 menit) dengan counter yang dipakai untuk enforcement.
  - [ ] Resource yang tidak ada di paket ditampilkan terkunci dengan CTA upgrade, bukan "0/0".

### ACC-057 Pusat notifikasi di dashboard
- **P0 · M4**
- **Perilaku**: ikon lonceng + badge jumlah belum dibaca, panel daftar notifikasi. Detail [§12](#12-notifikasi-platform).
- **Acceptance criteria**:
  - [ ] Klik notifikasi menandai dibaca & membuka tautan konteks.

### ACC-058 Pengaturan site (ringkas)
- **P0 · M4**
- **Perilaku**: halaman `…/sites/{siteId}/settings` dengan tab: Umum (nama, favicon, bahasa site), Domain ([07](./07-publishing-hosting.md)), SEO ([07](./07-publishing-hosting.md)), Akses (password protect — paket), Data ([05](./05-dynamic-data.md)), Toko & Pembayaran ([06](./06-commerce-payments.md)), Kode kustom (paket), Bahaya (arsip, transfer, hapus). Tab yang tidak tersedia di paket tampil terkunci.
- **Acceptance criteria**:
  - [ ] Tab terkunci menampilkan nama paket minimum yang membuka fitur tersebut (dari entitlements, bukan hardcode).

---

## 5. Onboarding

Tujuan: **user baru mempublikasikan website pertamanya dalam ≤ 15 menit** (metrik aktivasi, [§16](#16-analytics-produk-internal)).

### ACC-070 Survei singkat
- **P0 · M4**
- **Perilaku**: setelah registrasi pertama, 3 layar (bisa dilewati, maksimal ~30 detik):
  1. "Website untuk apa?" — Toko online, Profil usaha/company, Portofolio, Landing page/produk, Acara/undangan, Blog, Lainnya.
  2. "Jenis bisnis Anda?" — kategori (Kuliner, Fashion, Kecantikan, Jasa, Pendidikan, Kesehatan, Properti, Teknologi, Komunitas/Organisasi, Lainnya + teks bebas).
  3. "Tujuan utama?" (multi) — Dapat pesanan via WhatsApp, Jualan online, Dikenal/dipercaya, Kumpulkan data pelanggan, Booking/janji temu.
  - Opsional: "Seberapa nyaman Anda mendesain?" (Pemula / Sedang / Desainer) → mempengaruhi mode default editor (sederhana vs penuh) — lihat [02](./02-editor.md).
  - Jawaban disimpan di `user_onboarding` (JSONB) dan dipakai untuk merekomendasikan template & sebagai konteks AI.
- **Acceptance criteria**:
  - [ ] Tombol "Lewati" selalu ada; skip tidak memblokir apa pun.
  - [ ] Jawaban tersedia ke agent AI sebagai konteks bisnis (dengan izin implisit karena diisi user sendiri).

### ACC-071 Pilih titik awal
- **P0 · M4** (AI: M6)
- **Perilaku**: layar "Mulai dari mana?" — (a) 6 template rekomendasi sesuai survei + "lihat semua", (b) "Buat dengan AI" (menonjol setelah M6; Free memakai trial), (c) "Mulai kosong".
- **Acceptance criteria**:
  - [ ] Rekomendasi template berbeda untuk kategori Kuliner vs Portofolio (uji dengan seed template).

### ACC-072 Isi info bisnis
- **P0 · M4**
- **Perilaku**: form ringkas: nama bisnis, tagline (opsional), nomor WhatsApp, alamat/kota, jam buka (opsional), logo (upload opsional), warna brand (opsional; dari logo bisa diekstrak palette P1). Data mengisi placeholder template (`{{business.name}}`, dsb. — mekanisme di [03](./03-components-templates.md)) dan konteks AI.
- **Acceptance criteria**:
  - [ ] Setelah mengisi, template terbuka di editor dengan nama bisnis & nomor WA sudah terpasang di header/footer/tombol WA.

### ACC-073 Tur editor
- **P1 · M4**
- **Perilaku**: tur 5–7 langkah (tooltip berurutan): pilih elemen, ubah teks, ganti gambar, tambah section dari library, preview mobile, publish. Bisa diulang dari menu Bantuan. Status disimpan di `user_onboarding.tourCompletedAt`.
- **Acceptance criteria**:
  - [ ] Tur tidak muncul lagi setelah selesai/dilewati, kecuali dipanggil manual.

### ACC-074 Checklist "Website siap publish"
- **P0 · M4**
- **Perilaku**: panel checklist (di dashboard & sidebar editor) per site:
  - [ ] Email terverifikasi
  - [ ] Nama bisnis & logo terpasang
  - [ ] Semua placeholder teks template diganti (deteksi teks lorem/placeholder bertanda di template)
  - [ ] Gambar placeholder diganti
  - [ ] Judul & deskripsi SEO halaman home terisi ([07](./07-publishing-hosting.md))
  - [ ] Favicon
  - [ ] Cek tampilan mobile dibuka setidaknya sekali
  - [ ] Tautan/tombol WhatsApp valid
  - [ ] Publish pertama
  - Item wajib (blocking) hanya: email terverifikasi. Item lain = rekomendasi (warning saat publish, bisa diabaikan).
- **Acceptance criteria**:
  - [ ] Checklist dihitung dari document model secara deterministik (fungsi murni di `packages/renderer` atau `packages/document-model`), dapat ditest unit.
  - [ ] Setelah publish pertama: layar selebrasi + tombol bagikan (salin link, WhatsApp, QR code unduh).

### ACC-075 Email onboarding (drip)
- **P1 · M5**
- **Perilaku**: hanya untuk user dengan consent marketing ATAU kategori "transaksional-edukasi" yang diizinkan (OPEN legal): H+1 "lanjutkan website Anda" (bila belum publish), H+3 tips, H+7 "hubungkan domain sendiri" (Free → Starter/Pro). Berhenti bila user publish / unsubscribe.
- **Acceptance criteria**:
  - [ ] Unsubscribe 1-klik bekerja dan tercermin di preferensi.

> ❓ OPEN: Apakah email "lanjutkan website Anda" tergolong transaksional atau marketing menurut kebijakan privasi kita.

---

## 6. Paket & matriks fitur

> ⚠️ **Semua angka di bagian ini adalah USULAN AWAL** untuk memulai implementasi entitlements dan bisa diubah tanpa migrasi kode (cukup ubah data `plans` / seed). Harga = **OPEN** (lihat [§7](#7-kerangka-pricing)).

### 6.1 Ringkasan positioning

| Paket | Untuk siapa | Kunci pembeda |
|---|---|---|
| **Free** | Coba-coba, UMKM sangat kecil, undangan/acara | Statis, subdomain acak, badge wajib, AI trial |
| **Starter** | UMKM yang ingin tampil profesional murah | Subdomain nama pilihan, batas lebih besar, AI kecil, dinamis terbatas (form) |
| **Pro** | UMKM serius & company | Custom domain, tanpa badge, AI lebih besar, website dinamis penuh, e-commerce |
| **Business/Tim** | Agensi, company dengan tim | Semua Pro + workspace tim, role, seats, multiplayer (M9), support prioritas |

### 6.2 Matriks fitur & batas (usulan awal)

Notasi: angka = batas; `—` = tidak tersedia; ✅ = tersedia; "FU" = fair use. Batas "per bulan" di-reset tiap awal periode billing (Free: tiap tanggal 1, `Asia/Jakarta`).

#### 6.2.1 Website & hosting

| Fitur / batas | key entitlement | Free | Starter | Pro | Business/Tim |
|---|---|---|---|---|---|
| Jumlah site aktif (non-arsip) | `sites.max` | 1 | 3 | 10 | 30 (+ add-on) |
| Site di arsip | `sites.archivedMax` | 3 | 20 | 50 | 200 |
| Halaman per site | `pages.perSiteMax` | 5 | 20 | 100 | 300 |
| Storage aset (per workspace) | `storage.bytesMax` | 500 MB | 3 GB | 20 GB | 100 GB (+ add-on) |
| Ukuran file upload maks | `upload.fileBytesMax` | 5 MB | 10 MB | 25 MB | 50 MB |
| Bandwidth / bulan (fair use) | `bandwidth.bytesMonthly` | 5 GB FU | 30 GB FU | 150 GB FU | 500 GB FU |
| Subdomain acak (`x7k2p9mq.platformmu.site`) | `domain.randomSubdomain` | ✅ | ✅ (redirect 301 ke nama) | ✅ | ✅ |
| Subdomain nama pilihan (`tokobudi.platformmu.site`) | `domain.namedSubdomain` | — | ✅ | ✅ | ✅ |
| Custom domain | `domain.customMax` (per site) | — | — | 1 per site (+ www) | 3 per site |
| SSL otomatis | — | ✅ | ✅ | ✅ | ✅ |
| Badge "Made with Platform" | `branding.badgeRequired` | wajib | wajib (kecil) | bisa dihapus | bisa dihapus |
| Favicon kustom | `site.favicon` | ✅ | ✅ | ✅ | ✅ |
| SEO dasar (title, meta, OG, sitemap) | `seo.basic` | ✅ | ✅ | ✅ | ✅ |
| SEO lanjutan (redirect manual, robots kustom, schema.org) | `seo.advanced` | — | — | ✅ | ✅ |
| Password protect site/halaman | `site.passwordProtect` | — | — | ✅ | ✅ |
| Preview link (berbagi draft sebelum publish) | `site.previewLinks` | 1 link aktif, 7 hari | 5 link, 30 hari | ✅ tanpa batas wajar | ✅ |
| Version history retention | `history.retentionDays` | 7 hari | 30 hari | 180 hari | 365 hari |
| Restore versi publish | `publish.rollback` | 1 terakhir | 10 terakhir | ✅ semua dalam retensi | ✅ |
| Custom code (head/body snippet, embed HTML) | `site.customCode` | — | — | ✅ (P1) | ✅ |
| Analytics pengunjung (bawaan, privacy-friendly) | `analytics.level` | dasar (7 hari, total views) | standar (30 hari, halaman, sumber) | lanjutan (12 bln, UTM, device, event form/klik WA) | lanjutan + export |
| Integrasi GA4 / Meta Pixel | `analytics.thirdParty` | — | ✅ | ✅ | ✅ |

> Catatan Starter & subdomain acak: saat upgrade ke Starter dan user memilih nama, subdomain acak lama redirect 301 ke subdomain nama ([07](./07-publishing-hosting.md)).

> ❓ OPEN: Starter boleh menghapus badge? Usulan: tidak (badge kecil), sebagai insentif ke Pro.

#### 6.2.2 Library: template & component

| Fitur | key | Free | Starter | Pro | Business/Tim |
|---|---|---|---|---|---|
| Template gratis | `library.templatesFree` | ✅ | ✅ | ✅ | ✅ |
| Template premium | `library.templatesPremium` | — (preview saja) | 🔸 pilihan "Starter" | ✅ | ✅ |
| Component gratis | `library.componentsFree` | ✅ | ✅ | ✅ | ✅ |
| Component premium (section/blok lanjutan, animasi) | `library.componentsPremium` | — | 🔸 | ✅ | ✅ |
| Component data-bound (table, dashboard, login form) | `library.componentsDynamic` | — | 🔸 (form) | ✅ | ✅ |
| Simpan component sendiri (local components) | `library.userComponents` | 5 | 50 | ✅ | ✅ + shared ke tim |

Tingkat akses per item library ditentukan field `tier` (`free | starter | pro`) di metadata template/component — [03](./03-components-templates.md).

#### 6.2.3 AI

| Fitur | key | Free | Starter | Pro | Business/Tim |
|---|---|---|---|---|---|
| AI trial (sekali seumur akun) | `ai.trialCredits` | 30 kredit (≈ 1 website + beberapa edit) | — | — | — |
| Kredit AI / bulan | `ai.creditsMonthly` | 0 | 100 | 600 | 2.000 (pool workspace) |
| Rollover kredit bulanan | `ai.rollover` | — | — | — | — |
| Top-up kredit (berlaku 12 bln) | `ai.topupAllowed` | — | ✅ | ✅ | ✅ |
| Model/skill lanjutan (redesign penuh, multi-halaman, generate gambar OPEN) | `ai.advancedSkills` | trial terbatas | — | ✅ | ✅ |
| AI mengonfigurasi website dinamis | `ai.dynamicConfig` | — | 🔸 form saja | ✅ | ✅ |
| Batas kecepatan (request agent / menit) | `ai.rateLimitPerMin` | 3 | 6 | 12 | 20 per user |

Definisi "1 kredit" dan biaya per aksi ada di [04](./04-ai-agent.md). Urutan konsumsi: trial → kredit bulanan → kredit top-up (kedaluwarsa paling cepat dulu).

> ❓ OPEN: Starter mendapat AI? Brief: usulan kuota kecil + dinamis terbatas. Spec ini mengikuti usulan tersebut (100 kredit, dinamis = form saja).

#### 6.2.4 Website dinamis ([05](./05-dynamic-data.md))

| Fitur / batas | key | Free | Starter | Pro | Business/Tim |
|---|---|---|---|---|---|
| Website dinamis | `dynamic.enabled` | — (statis saja) | 🔸 form → collection | ✅ | ✅ |
| Collections per site | `dynamic.collectionsPerSite` | — | 2 | 20 | 50 |
| Records total per workspace | `dynamic.recordsMax` | — | 1.000 | 50.000 | 250.000 |
| Form submissions / bulan | `forms.submissionsMonthly` | 50 (form statis → email notifikasi saja) | 500 | 5.000 | 20.000 |
| Members (end-user login) per site | `dynamic.membersPerSite` | — | — | 1.000 | 10.000 |
| Workflow runs / bulan | `workflows.runsMonthly` | — | 200 (notifikasi form) | 5.000 | 25.000 |
| Blok HTTP request di workflow | `workflows.httpBlock` | — | — | ✅ (P1) | ✅ |
| Custom code sandbox | `workflows.customCode` | — | — | — | P2 |
| Upload file oleh end-user | `dynamic.fileUploadBytes` | — | — | 2 GB (bagian storage) | 10 GB |

> Catatan Free: form kontak sederhana pada site statis tetap boleh (submission dikirim ke email pemilik + tersimpan 30 hari untuk anti-spam), karena "form kontak" adalah kebutuhan dasar UMKM. ❓ OPEN: konfirmasi bahwa ini tidak melanggar prinsip "dinamis hanya untuk langganan AI".

#### 6.2.5 E-commerce ([06](./06-commerce-payments.md))

| Fitur / batas | key | Free | Starter | Pro | Business/Tim |
|---|---|---|---|---|---|
| Katalog produk + tombol "Pesan via WhatsApp" (statis) | `commerce.catalogWa` | 10 produk | 50 produk | ✅ | ✅ |
| Toko penuh (keranjang, checkout, gateway milik user) | `commerce.checkout` | — | — | ✅ | ✅ |
| Produk | `commerce.productsMax` | 10 | 50 | 1.000 | 10.000 |
| Order / bulan | `commerce.ordersMonthly` | — | — | 1.000 | 10.000 |
| Biaya transaksi platform | `commerce.platformFeePct` | — | — | 0% | 0% |

> ❓ OPEN: Apakah Platform pernah memungut fee transaksi? Brief: dana langsung ke user; usulan 0%.

#### 6.2.6 Komunikasi (email & WhatsApp)

| Fitur / batas | key | Free | Starter | Pro | Business/Tim |
|---|---|---|---|---|---|
| Email notifikasi ke pemilik (form/order) | `email.ownerNotifications` | ✅ | ✅ | ✅ | ✅ |
| Email ke end-user (konfirmasi order, workflow) / bulan | `email.sendsMonthly` | — | 500 | 5.000 | 20.000 |
| Pengirim email domain sendiri (SPF/DKIM) | `email.customSender` | — | — | ✅ (P1) | ✅ |
| WhatsApp otomatis (via provider) / bulan | `wa.sendsMonthly` | — | — | 200 (OPEN) | 1.000 (OPEN) |

> ❓ OPEN: Provider WhatsApp (WA Business API resmi via BSP vs gateway tidak resmi). Biaya per pesan tinggi → kemungkinan hanya add-on berbayar.

#### 6.2.7 Kolaborasi & support

| Fitur / batas | key | Free | Starter | Pro | Business/Tim |
|---|---|---|---|---|---|
| Workspace tim | `team.enabled` | — | — | — | ✅ |
| Seats termasuk | `team.seatsIncluded` | 1 | 1 | 1 | 5 (+ add-on) |
| Role & permission | `team.roles` | — | — | — | ✅ |
| Multiplayer real-time (cursor, presence) | `team.multiplayer` | — | — | — | ✅ (M9) |
| Komentar di canvas | `team.comments` | — | — | 🔸 komentar klien via preview link (P2) | ✅ |
| Audit log workspace | `team.auditLog` | — | — | — | ✅ 90 hari (P2) |
| Support | `support.level` | Help center + komunitas | Email (≤ 2 hari kerja) | Email + chat (≤ 1 hari kerja) | Prioritas + WA (≤ 4 jam kerja) |

### ACC-090 Definisi plan sebagai data
- **P0 · M4**
- **Perilaku**: paket disimpan di tabel `plans` (kolom `limits` JSONB + `features` JSONB) dan diseed dari `apps/api/src/modules/plans/plans.seed.ts` yang divalidasi Zod. Kode hanya mengenal **key** entitlement, bukan nama paket. Perubahan nilai = migrasi data, bukan perubahan logika.

```ts
// packages/config? atau apps/api/src/modules/entitlements/entitlements.schema.ts
export const EntitlementsSchema = z.object({
  sites: z.object({ max: z.number().int(), archivedMax: z.number().int() }),
  pages: z.object({ perSiteMax: z.number().int() }),
  storage: z.object({ bytesMax: z.number().int() }),
  upload: z.object({ fileBytesMax: z.number().int() }),
  bandwidth: z.object({ bytesMonthly: z.number().int(), fairUse: z.literal(true) }),
  domain: z.object({
    randomSubdomain: z.boolean(), namedSubdomain: z.boolean(), customMax: z.number().int(),
  }),
  branding: z.object({ badgeRequired: z.enum(['full', 'small', 'none']) }),
  history: z.object({ retentionDays: z.number().int() }),
  ai: z.object({
    trialCredits: z.number().int(), creditsMonthly: z.number().int(),
    topupAllowed: z.boolean(), advancedSkills: z.boolean(),
    dynamicConfig: z.enum(['none', 'forms', 'full']), rateLimitPerMin: z.number().int(),
  }),
  dynamic: z.object({
    enabled: z.enum(['none', 'forms', 'full']),
    collectionsPerSite: z.number().int(), recordsMax: z.number().int(),
    membersPerSite: z.number().int(),
  }),
  forms: z.object({ submissionsMonthly: z.number().int() }),
  workflows: z.object({ runsMonthly: z.number().int(), httpBlock: z.boolean() }),
  commerce: z.object({
    catalogWa: z.boolean(), checkout: z.boolean(),
    productsMax: z.number().int(), ordersMonthly: z.number().int(),
  }),
  email: z.object({ sendsMonthly: z.number().int(), customSender: z.boolean() }),
  wa: z.object({ sendsMonthly: z.number().int() }),
  library: z.object({ tierMax: z.enum(['free', 'starter', 'pro']), userComponents: z.number().int() }),
  team: z.object({
    enabled: z.boolean(), seatsIncluded: z.number().int(),
    multiplayer: z.boolean(), auditLog: z.boolean(),
  }),
  site: z.object({ passwordProtect: z.boolean(), customCode: z.boolean(), previewLinksMax: z.number().int() }),
  analytics: z.object({ level: z.enum(['basic', 'standard', 'advanced']), thirdParty: z.boolean() }),
  support: z.object({ level: z.enum(['community', 'email', 'chat', 'priority']) }),
});
export type Entitlements = z.infer<typeof EntitlementsSchema>;
// -1 = unlimited (dipakai hanya untuk override staff), 0 = tidak tersedia.
```

- **Acceptance criteria**:
  - [ ] Seed gagal (CI merah) bila ada plan yang tidak lolos `EntitlementsSchema`.
  - [ ] Halaman pricing publik (`apps/web/pricing`) dirender dari data `plans` yang sama (tidak ada angka hardcode di JSX).
  - [ ] Setiap plan punya `version`; langganan menyimpan `plan_version` agar perubahan plan tidak diam-diam mengurangi hak pelanggan lama (grandfathering, ACC-091).

### ACC-091 Versi plan & grandfathering
- **P1 · M5**
- **Perilaku**: mengubah limit plan membuat `plans` versi baru. Pelanggan aktif tetap di versi lama sampai: (a) mereka mengubah paket, atau (b) staff memigrasi dengan pemberitahuan ≥ 30 hari. Kenaikan limit (lebih murah hati) boleh langsung diterapkan ke semua versi.
- **Acceptance criteria**:
  - [ ] Resolusi entitlements memakai `subscriptions.plan_version`.

### ACC-092 Halaman pricing publik
- **P0 · M5** (M4: hanya Free + "segera hadir")
- **Perilaku**: kartu 4 paket, toggle Bulanan/Tahunan (menampilkan hemat %), tabel perbandingan lengkap (dari §6.2) dengan grup yang bisa dilipat, FAQ (refund, ganti paket, PPN, metode bayar), harga IDR dengan format `Rp 49.000` (`Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`).
- **Acceptance criteria**:
  - [ ] Bahasa EN tetap menampilkan IDR (mata uang tagihan tunggal di MVP).

### ACC-093 Template & component premium
- **P0 · M5**
- **Perilaku**: item library dengan `tier` lebih tinggi dari `entitlements.library.tierMax` tampil dengan badge dan bisa di-preview, tapi menyisipkan/menggunakan memunculkan modal upgrade. Site yang sudah memakai item premium lalu downgrade: item tetap tampil & tetap ter-publish (tidak merusak site), tapi tidak bisa menambah instance baru atau mengedit props premium (OPEN, lihat ACC-172).
- **Acceptance criteria**:
  - [ ] Pengecekan ada di API (insert instance via AI/agent juga dicek), bukan hanya UI.

### ACC-094 AI trial untuk Free
- **P0 · M6**
- **Perilaku**: `ai.trialCredits` diberikan sekali per akun terverifikasi (bukan per workspace) — dicatat `credit_ledger` (`bucket='trial'`, `reason='grant'`). Anti-abuse: trial hanya diberikan setelah email terverifikasi, dan (P1) setelah verifikasi nomor HP bila sinyal risiko tinggi (ACC-257). Trial tidak bisa dipakai untuk fitur dinamis.
- **Acceptance criteria**:
  - [ ] Hapus akun lalu daftar ulang dengan email sama tidak mendapat trial kedua (simpan hash email di `trial_grants` 12 bulan).

> ❓ OPEN: Besar trial (usulan 30 kredit) dan apakah trial kedaluwarsa (usulan 30 hari).

---

## 7. Kerangka pricing

> ⚠️ Seluruh angka di bagian ini **ILUSTRASI** untuk kerangka berpikir — **bukan keputusan harga**. Harga final = ❓ OPEN.

### 7.1 Komponen biaya per user (COGS)

| Komponen | Driver | Catatan sumber |
|---|---|---|
| Hosting statis (R2 + Cloudflare Worker) | storage GB, request, egress | R2 tanpa biaya egress; Worker per juta request. Lihat [ARCHITECTURE](../ARCHITECTURE.md) & [07](./07-publishing-hosting.md). |
| Database & API (VPS/managed Postgres, Redis) | jumlah user aktif, records | Biaya relatif tetap per tier server; dibagi rata. |
| Worker (publish build, screenshot Playwright, image processing) | jumlah publish, ukuran gambar | CPU-bound; batasi frekuensi publish di Free. |
| **AI (Claude API)** | token input/output per aksi | **Komponen terbesar & paling variabel.** Lihat [04](./04-ai-agent.md) untuk estimasi token per aksi. |
| Email (Resend dsb.) | jumlah email | Murah per email, tapi kuota bulanan provider. |
| WhatsApp | per pesan/percakapan | Mahal → add-on. |
| Payment fee langganan | % / flat per transaksi gateway | Ditanggung platform (bagian margin). |
| Custom domain SSL | Cloudflare for SaaS (per hostname di atas kuota) | Lihat [07](./07-publishing-hosting.md). |
| Support | waktu owner | Biaya tersembunyi terbesar untuk solo dev. |

### 7.2 Rumus biaya AI per kredit

Definisikan kredit sehingga **1 kredit ≈ biaya AI rata-rata `C_credit` (IDR)**:

```
C_credit = (avgInputTokens × priceIn + avgOutputTokens × priceOut) × kursUSD_IDR × (1 + bufferRetry)
           ───────────────────────────────────────────────────────────────────────────────────────
                                         kreditPerAksiRataRata
```

- `priceIn/priceOut` diambil dari pricing resmi model yang dipakai (cek saat implementasi; jangan hardcode di dokumen).
- `bufferRetry` ≈ 0,2–0,3 untuk retry, screenshot loop, tool call gagal.
- Prompt caching (system prompt & skills) menurunkan `avgInputTokens` efektif — lihat [04](./04-ai-agent.md).

Biaya AI maksimum per pelanggan per bulan = `creditsMonthly × C_credit`. Target: **biaya AI maksimum ≤ 35% harga paket** (sisanya hosting, payment fee, pajak, margin).

### 7.3 Rumus kecukupan revenue

```
MRR_needed = FixedCost_monthly + Σ_paid (VarCost_user) + Σ_free (VarCost_free) + Target_margin

Syarat sehat:
  ARPPU × N_paid × (1 − payment_fee% − tax_on_revenue%) ≥ FixedCost + N_paid × COGS_paid + N_free × COGS_free
```

Dengan `N_paid = N_total × conversion_rate`. Contoh ilustrasi (BUKAN keputusan):

| Variabel | Ilustrasi |
|---|---|
| Fixed cost (server, tooling, domain, email base) | Rp 3.000.000 / bulan |
| COGS Free (hosting + publish + trial AI diamortisasi) | Rp 1.500 / user / bulan |
| COGS Starter (rata-rata pakai 50% kredit) | Rp 8.000 / user / bulan |
| COGS Pro (rata-rata pakai 50% kredit) | Rp 30.000 / user / bulan |
| Konversi freemium | 2–4% (rentang industri website builder; OPEN, ukur sendiri) |
| Mix berbayar | 60% Starter, 35% Pro, 5% Business |

Dari ilustrasi ini owner bisa menghitung titik impas (break-even) `N_total` untuk tiap kandidat harga di spreadsheet. Disarankan membuat sheet sederhana dengan variabel di atas sebelum memutuskan harga.

### 7.4 Rentang harga ilustrasi (IDR, bulanan)

| Paket | Rentang ilustrasi bulanan | Tahunan (ilustrasi) |
|---|---|---|
| Free | Rp 0 | Rp 0 |
| Starter | Rp 29.000 – 59.000 | bayar 10 bulan (hemat ~17%) |
| Pro | Rp 99.000 – 199.000 | bayar 10 bulan |
| Business/Tim | Rp 299.000 – 599.000 (5 seat) | bayar 10 bulan |

Pertimbangan pasar Indonesia: UMKM sangat sensitif harga; angka psikologis `Rp 49.000`, `Rp 99.000`; pembayaran tahunan via QRIS/VA cukup umum; e-wallet populer. Pembanding: harga domain .com/.id per tahun dan biaya jasa pembuatan website sekali bayar.

> ❓ OPEN: Harga final semua paket; diskon tahunan (usulan "2 bulan gratis"); harga khusus peluncuran (early bird) & apakah dikunci seumur langganan.

### 7.5 Mata uang & pajak

- Mata uang tagihan MVP: **IDR saja**. USD untuk pengguna luar negeri = P2.
- PPN 12% (atau tarif efektif yang berlaku) — apakah harga **sudah termasuk** PPN atau ditambahkan, dan kewajiban menjadi PKP = ❓ **OPEN** (konsultasi konsultan pajak; bergantung omzet & status badan usaha, lihat [§14](#14-legal--kepatuhan-indonesia)).
- Rekomendasi tampilan: harga di halaman pricing **sudah termasuk pajak** bila PKP (lebih ramah konsumen), dengan rincian di invoice. Kolom `tax_amount` & `tax_rate` tetap ada di `invoices` sejak awal meski bernilai 0.

### 7.6 Add-on

| Add-on | Unit | Berlaku | Ketersediaan | Ilustrasi harga |
|---|---|---|---|---|
| **Kredit AI tambahan** (top-up) | paket 100 / 500 / 2.000 kredit | 12 bulan sejak beli | Starter+ | OPEN (≥ 3× `C_credit` per kredit) |
| **Seat tambahan** | per seat / bulan | mengikuti periode langganan | Business | OPEN |
| **Storage tambahan** | per 10 GB / bulan | periode | Pro, Business | OPEN |
| **Site tambahan** | per 5 site / bulan | periode | Pro, Business | OPEN (P1) |
| **Paket WhatsApp** | per 500 pesan | 3 bulan | Pro, Business | OPEN (P2) |

### ACC-110 Konfigurasi harga sebagai data
- **P0 · M5**
- **Perilaku**: tabel `plan_prices` (plan_id, interval `month|year`, currency `IDR`, amount, active, valid_from) dan `addon_products` (sku, type, quantity, amount, validity_days). Harga tidak di-hardcode di kode/UI.
- **Acceptance criteria**:
  - [ ] Mengganti harga dari `/admin` (ACC-206) tidak mengubah invoice yang sudah terbit.

### ACC-111 Kupon & promo
- **P1 · M5**
- **Perilaku**: `coupons` (code, type `percent|fixed|extra_credits|trial_days`, value, berlaku untuk plan/interval tertentu, `max_redemptions`, `per_user_limit`, `expires_at`, `first_payment_only`). Dimasukkan saat checkout; divalidasi server. Redemption dicatat di `coupon_redemptions`.
- **Acceptance criteria**:
  - [ ] Kupon tidak bisa ditumpuk (1 per invoice).
  - [ ] Kupon kedaluwarsa/limit tercapai → pesan jelas.

### ACC-112 Program referral
- **P2 · M9**
- **Perilaku**: user mendapat link referral; teman yang upgrade pertama kali → keduanya mendapat bonus kredit AI / 1 bulan gratis. Anti-fraud: email & payment berbeda, bonus setelah 14 hari (melewati periode refund).

---

## 8. Entitlements, kuota & metering

### 8.1 Arsitektur

```
plans(limits, version) ─┐
subscriptions(status)  ─┼─► EntitlementsService.resolve(workspaceId) ─► Entitlements (cache Redis 5 mnt)
addons (aktif)         ─┤                                               │
entitlement_overrides  ─┘                                               ▼
                                         check(workspaceId, key, delta) / assertFeature(workspaceId, key)
                                         dipanggil oleh: apps/api, apps/worker, apps/site-host (via snapshot)

usage events ─► UsageService.increment(key, delta) ─► Redis INCRBY  ─(tiap 5 mnt / akhir periode)─► usage_counters (DB)
```

### ACC-130 Entitlements service (satu sumber kebenaran)
- **P0 · M4**
- **Perilaku**:
  - Modul `apps/api/src/modules/entitlements/` (`entitlements.service.ts`, `.repository.ts`, `.schema.ts`) mengekspor:

```ts
interface EntitlementsService {
  resolve(workspaceId: string): Promise<ResolvedEntitlements>;   // plan + addons + overrides, efektif
  assertFeature(workspaceId: string, key: FeatureKey): Promise<void>;          // throw PlanFeatureError (402)
  checkLimit(workspaceId: string, key: LimitKey, delta?: number): Promise<LimitCheck>;
  assertLimit(workspaceId: string, key: LimitKey, delta?: number): Promise<void>; // throw PlanLimitError (402)
  invalidate(workspaceId: string): Promise<void>; // dipanggil saat subscription/override/addon berubah
}

type LimitCheck = {
  key: LimitKey; used: number; limit: number; // limit -1 = unlimited
  remaining: number; ratio: number;           // used/limit
  state: 'ok' | 'warn' | 'exceeded' | 'grace';
};

type ResolvedEntitlements = Entitlements & {
  planCode: 'free' | 'starter' | 'pro' | 'business';
  planVersion: number;
  subscriptionStatus: SubscriptionStatus;
  periodStart: string; periodEnd: string;
  sources: Record<string, 'plan' | 'addon' | 'override'>; // untuk debugging di /admin
};
```

  - Urutan resolusi: `plan.limits` (versi langganan) → `+ addons` (penjumlahan untuk limit numerik) → `entitlement_overrides` aktif (menimpa; bisa menaikkan atau menurunkan; punya `expires_at`).
  - Jika langganan `past_due` dalam grace → entitlements plan berbayar tetap berlaku. Setelah grace → resolve sebagai `free` (ACC-170).
  - Error format seragam:

```json
{
  "error": {
    "code": "PLAN_LIMIT_REACHED",
    "message": "Batas website untuk paket Starter sudah tercapai.",
    "details": {
      "key": "sites.max",
      "used": 3, "limit": 3,
      "upgrade": { "suggestedPlan": "pro", "url": "/w/ws_abc/billing?upgrade=pro&reason=sites.max" }
    },
    "requestId": "0190f6c2-…"
  }
}
```

- **Acceptance criteria**:
  - [ ] Grep CI: tidak ada string literal `'pro'`/`'starter'` dipakai sebagai kondisi di luar modul `plans`/`entitlements`/`billing` (lint rule kustom atau test).
  - [ ] `resolve()` p95 < 5 ms dari cache, < 50 ms cache miss.
  - [ ] Unit test untuk kombinasi plan + addon + override + grace.

### ACC-131 Titik pengecekan
- **P0 · M4**
- **Perilaku** — tabel di mana tiap key dicek:

| Key | Dicek di | Kapan |
|---|---|---|
| `sites.max`, `sites.archivedMax` | API `POST /sites`, duplicate, unarchive, restore, transfer | sebelum create |
| `pages.perSiteMax` | Command `createPage` di `@platform/document-model` + validasi server saat persist di `apps/realtime` (jumlah page node) & AI tool `create_page` (04) | saat menambah halaman |
| `storage.bytesMax`, `upload.fileBytesMax` | API presign upload | sebelum presigned URL diterbitkan |
| `domain.*` | API domain settings, publish | saat set domain |
| `branding.badgeRequired` | Worker publish (renderer menyisipkan badge) | saat build |
| `ai.*` | API agent endpoint (sebelum run) + worker per tool call (debit kredit) | sebelum & selama run, lihat [04](./04-ai-agent.md) |
| `dynamic.*`, `workflows.*` | API schema collection; runtime API records; worker workflow | create & runtime |
| `forms.submissionsMonthly` | Runtime API submit form (dipanggil island dari site) | runtime |
| `commerce.*` | API produk; runtime checkout | create & runtime |
| `email/wa.sendsMonthly` | Worker kirim | sebelum enqueue/kirim |
| `bandwidth.bytesMonthly` | site-host (agregasi log, bukan blocking per request) | async |
| `team.*` | API invitations, realtime join | invite & join |
| `site.passwordProtect`, `site.customCode` | API settings + worker publish | set & build |

  - **site-host** (Cloudflare Worker) tidak memanggil DB per request. Ia membaca **site manifest** di KV/R2 yang ditulis saat publish & saat entitlements berubah, berisi `{ status: 'live'|'unpublished'|'suspended'|'frozen', badge, passwordHash?, redirects }` — lihat [07](./07-publishing-hosting.md). Perubahan entitlements yang mempengaruhi site live (downgrade, suspend) memicu job `site.manifest.refresh`.
- **Acceptance criteria**:
  - [ ] Test integrasi: setiap baris tabel punya minimal 1 test yang memverifikasi `402` saat limit tercapai.
  - [ ] Suspend site oleh moderasi terlihat di site-host dalam < 60 detik.

### ACC-132 Kategori limit: kapasitas vs periodik
- **P0 · M4**
- **Perilaku**:
  - **Kapasitas (gauge)** — dihitung dari state aktual: `sites.max`, `storage.bytesMax`, `dynamic.recordsMax`, `commerce.productsMax`, `team.seats`. Sumber = DB (COUNT/SUM), di-cache di Redis, dikoreksi rekonsiliasi.
  - **Periodik (counter)** — reset tiap periode: `ai.creditsMonthly`, `forms.submissionsMonthly`, `workflows.runsMonthly`, `email/wa.sendsMonthly`, `commerce.ordersMonthly`, `bandwidth.bytesMonthly`. Sumber = Redis counter + flush ke `usage_counters`.
- **Acceptance criteria**:
  - [ ] Setiap `LimitKey` dideklarasikan di registry dengan `kind: 'gauge' | 'counter'`, `unit`, `hardBehavior` (ACC-135).

### ACC-133 Usage counters (Redis + rekonsiliasi DB)
- **P0 · M4**
- **Perilaku**:
  - Key Redis: `usage:{workspaceId}:{key}:{periodId}` (periodId = `2026-10` untuk Free / `sub_{id}_{periodStartISO}` untuk berbayar). Operasi `INCRBY` atomik; untuk pengecekan + increment gunakan Lua script `checkAndIncr(key, delta, limit, allowOverage)` agar tidak ada race.
  - Flush job (BullMQ repeatable, tiap 5 menit) menulis nilai ke `usage_counters (workspace_id, key, period_id, value, updated_at)` dengan `GREATEST`.
  - Rekonsiliasi harian (gauge): hitung ulang dari tabel sumber (COUNT sites, SUM `assets.bytes`, COUNT records) → perbaiki Redis bila selisih; catat metrik drift.
  - Kredit AI TIDAK hanya di counter: setiap debit juga ditulis ke `credit_ledger` (double-entry ringan) — ledger adalah sumber kebenaran untuk saldo; Redis sebagai cache cepat (ACC-150).
  - Redis hilang (restart tanpa persist) → bootstrap dari `usage_counters` + ledger.
- **Acceptance criteria**:
  - [ ] 100 request paralel submit form dengan sisa kuota 10 → tepat 10 sukses (test konkurensi).
  - [ ] Drift gauge > 1% memicu alert Sentry.

### ACC-134 Soft limit warning (80% & 100%)
- **P0 · M4**
- **Perilaku**:
  - Saat counter melewati 80% dan 100% (sekali per key per periode), emit event `usage.threshold` → notifikasi in-app + email ke owner/admin/billing (ACC-270). Idempoten via set Redis `usage:notified:{ws}:{key}:{period}:{80|100}`.
  - Banner di dashboard & editor (untuk key relevan, mis. kredit AI di panel AI).
- **Acceptance criteria**:
  - [ ] Tidak ada notifikasi ganda untuk ambang yang sama dalam satu periode.

### ACC-135 Hard limit behavior per resource
- **P0 · M4**
- **Perilaku**:

| Resource | Saat 100% tercapai | Dampak ke website live |
|---|---|---|
| Sites | Tidak bisa buat/duplikat/unarchive | Tidak ada |
| Pages | Tidak bisa tambah halaman | Tidak ada |
| Storage | Upload ditolak; publish tetap boleh | Tidak ada |
| Bandwidth (fair use) | Tidak diblok otomatis. Email peringatan; bila > 150% 2 bulan berturut → review manual staff (tawarkan upgrade / throttle) | Tidak ada (kecuali keputusan staff) |
| Kredit AI | Agent run baru ditolak; run yang sedang berjalan boleh selesai dengan overage maksimal 10% kredit (dicatat sebagai `overage`) — lihat [04](./04-ai-agent.md) | Tidak ada |
| Form submissions | **Tetap diterima** sampai 110% (buffer), lalu: submission disimpan di antrean "tertahan" (tidak terlihat sampai upgrade/reset) maks 500 item; pengunjung tetap melihat sukses. Pemilik diberi tahu. | Pengunjung tidak terganggu |
| Records | Insert baru dari dashboard ditolak; insert dari form publik → perilaku seperti submissions | Minimal |
| Workflow runs | Run baru di-skip dengan status `skipped_quota`, tercatat di log workflow | Otomasi berhenti (pemilik diberi tahu) |
| Orders (commerce) | **Tidak pernah memblok checkout** (uang pembeli). Overage dicatat, pemilik diminta upgrade; setelah 120% 2 periode → staff review | Tidak ada |
| Email/WA sends | Pengiriman ke end-user di-skip (`skipped_quota`); notifikasi ke pemilik tetap | Pembeli tidak menerima email konfirmasi (halaman sukses tetap ada) |
| Seats | Undangan baru ditolak | — |
| Members (end-user) | Registrasi member baru di website ditolak dengan pesan "pendaftaran ditutup sementara" | Ya (minimal) |

  - Prinsip: **jangan rusak pengalaman pengunjung website user** & jangan hilangkan data/uang; batasi aksi pemilik di dashboard.
- **Acceptance criteria**:
  - [ ] Checkout toko tetap sukses saat `commerce.ordersMonthly` terlampaui (test e2e).
  - [ ] Submissions tertahan terlihat setelah upgrade (dilepas otomatis) atau setelah reset periode.

### ACC-136 Reset bulanan
- **P0 · M4**
- **Perilaku**:
  - Free: periode kalender (`Asia/Jakarta`, tanggal 1 00:00 WIB).
  - Berbayar: anniversary `current_period_start` (bulanan). Paket tahunan: **kredit & kuota bulanan tetap di-reset tiap bulan** (sub-periode bulanan dalam langganan tahunan) — periodId dihitung `floor(months since start)`.
  - Reset = pindah `periodId` (counter baru); counter lama tetap di DB untuk histori. Kredit AI bulanan yang tidak terpakai hangus (`credit_ledger` entry `expire`).
- **Acceptance criteria**:
  - [ ] Langganan tahunan dimulai 31 Jan → sub-periode berikutnya 28/29 Feb (clamp akhir bulan) — unit test tanggal.

### ACC-137 Grace period kuota
- **P1 · M5**
- **Perilaku**: untuk resource kapasitas setelah downgrade (bukan setelah sekadar memakai), workspace mendapat grace 14 hari dengan state `grace` (banner "Kurangi pemakaian atau upgrade sebelum {tanggal}") sebelum tindakan ACC-172 diterapkan.
- **Acceptance criteria**:
  - [ ] `LimitCheck.state = 'grace'` terlihat di usage meter dengan tanggal berakhir.

### ACC-138 Bandwidth metering
- **P1 · M5**
- **Perilaku**: site-host menulis log bytes per hostname via Cloudflare Analytics / Workers Analytics Engine; job harian menarik agregat per site → `usage_counters (bandwidth.bytesMonthly)`. Murni informatif + fair use. Detail di [07](./07-publishing-hosting.md).
- **Acceptance criteria**:
  - [ ] Angka bandwidth tersedia di usage meter dengan keterlambatan ≤ 24 jam dan label "diperbarui harian".

### 8.2 Kredit AI

### ACC-150 Credit ledger
- **P0 · M6**
- **Perilaku**:
  - `credit_ledger` append-only: `{ id, workspace_id, user_id?, delta (+/-), bucket ('trial'|'monthly'|'topup'|'bonus'|'override'), reason ('grant'|'consume'|'reserve'|'release'|'expire'|'refund'|'adjust'), ref_type ('ai_run'|'invoice'|'admin'|...), ref_id, expires_at?, period_id?, created_at }`.
  - Saldo = SUM(delta) per bucket yang belum kedaluwarsa. Cache saldo di Redis `credits:{ws}`.
  - Konsumsi: agent run melakukan **reservasi** di awal (estimasi), lalu **settle** sesuai aktual per tool call/model call ([04](./04-ai-agent.md)); selisih dikembalikan. Run gagal karena error platform → refund otomatis (`reason='refund'`).
  - Urutan bucket saat konsumsi: `trial` → `monthly` → `bonus` → `topup` (topup paling akhir karena dibayar & berlaku lama).
- **Acceptance criteria**:
  - [ ] SUM ledger == saldo Redis setelah rekonsiliasi; selisih memicu alert.
  - [ ] Staff bisa memberi `adjust` dengan alasan wajib (tercatat di audit log).

### ACC-151 Tampilan kredit di editor
- **P0 · M6**
- **Perilaku**: panel AI menampilkan saldo kredit, perkiraan biaya aksi sebelum dijalankan (mis. "± 8 kredit"), riwayat pemakaian (per run: prompt ringkas, kredit, waktu, user). CTA top-up saat < 10%.
- **Acceptance criteria**:
  - [ ] Riwayat per user tersedia di workspace Business (siapa memakai berapa).

### ACC-152 Top-up kredit AI
- **P0 · M6**
- **Perilaku**: pembelian sekali bayar (invoice tipe `one_time`, ACC-165). Setelah `paid` → `credit_ledger` grant `bucket='topup'`, `expires_at = +12 bulan`. Tidak bisa direfund setelah ada konsumsi.
- **Acceptance criteria**:
  - [ ] Kredit masuk ≤ 1 menit setelah webhook pembayaran sukses.

---

## 9. Billing langganan platform

> Ini adalah pembayaran **user → Platform**. Pembayaran **pembeli → toko user** memakai gateway milik user dan dibahas di [06](./06-commerce-payments.md). Kredensial dan modul kode keduanya **terpisah** (`apps/api/src/modules/billing` vs `modules/commerce`).

### 9.1 Realitas pembayaran berulang di Indonesia

- Auto-debit kartu kredit tersedia, tetapi penetrasi kartu kredit UMKM rendah.
- Metode populer (QRIS, Virtual Account, e-wallet, minimarket) umumnya **sekali bayar**; tokenisasi/recurring e-wallet tersedia terbatas & perlu persetujuan merchant khusus.
- **Rekomendasi MVP (M5)**: model **invoice + renewal manual + reminder**. Setiap periode, sistem menerbitkan invoice baru H-7; user membayar via halaman pembayaran gateway (QRIS/VA/e-wallet/kartu). Auto-renew kartu = P1 bila gateway mendukung.

> ❓ OPEN: Gateway langganan platform: **Midtrans** (Snap, mendukung subscription kartu) vs **Xendit** (Invoice API, Recurring/Subscriptions). Spec dibuat provider-agnostic lewat interface `BillingProvider`.

```ts
// apps/api/src/modules/billing/providers/billing-provider.ts
interface BillingProvider {
  code: 'midtrans' | 'xendit';
  createPaymentLink(input: {
    invoiceId: string; amount: number; currency: 'IDR';
    customer: { name: string; email: string; phone?: string };
    items: { name: string; quantity: number; price: number }[];
    expiresAt: Date; successRedirectUrl: string; failureRedirectUrl: string;
  }): Promise<{ providerRef: string; paymentUrl: string }>;
  verifyWebhook(req: RawRequest): Promise<ProviderEvent>;   // signature check wajib
  getStatus(providerRef: string): Promise<ProviderPaymentStatus>; // untuk rekonsiliasi
  refund?(providerRef: string, amount: number, reason: string): Promise<{ refundRef: string }>;
  createRecurring?(...): Promise<...>; // P1
}
```

### 9.2 State machine langganan

```
            checkout paid
  (none) ───────────────────► active ──── period end, invoice paid ───► active (periode baru)
                                 │
                                 ├── H-7 invoice terbit (status open)
                                 │
                 period end, invoice belum dibayar
                                 ▼
                            past_due (grace 7 hari, fitur tetap jalan)
                    paid ┌───────┴────────┐ grace habis
                         ▼                ▼
                       active        downgraded → (plan free, status 'expired')

  active ── user cancel ──► active (cancel_at_period_end=true) ── period end ──► canceled → free
  active ── staff suspend/ban ──► suspended (billing dibekukan)
```

`subscriptions.status ∈ { active, past_due, canceled, expired, suspended }` + flag `cancel_at_period_end`. Workspace Free tidak punya row `subscriptions` (atau punya row `plan=free` — pilih **tanpa row**, plan efektif `free` bila tidak ada langganan aktif).

### ACC-160 Halaman Billing workspace
- **P0 · M5**
- **Perilaku**: `…/w/{slug}/billing`: paket saat ini, periode, tanggal jatuh tempo berikutnya, status (aktif / menunggu pembayaran / akan berakhir), tombol Ganti paket / Bayar sekarang / Batalkan, usage meter (ACC-056), daftar invoice (unduh PDF), add-on aktif, saldo kredit AI, data penagihan (nama/perusahaan, NPWP opsional untuk faktur, alamat, email tagihan).
- **Acceptance criteria**:
  - [ ] Hanya role dengan `billing.read` yang bisa membuka; aksi mengikuti matriks ACC-033.

### ACC-161 Checkout langganan baru (upgrade dari Free)
- **P0 · M5**
- **Perilaku**:
  1. User pilih paket + interval (+ kupon P1) → `POST /billing/checkout` membuat `invoices` (status `open`, tipe `subscription_new`) dan payment link via provider (kedaluwarsa 24 jam).
  2. Redirect ke halaman pembayaran gateway.
  3. Webhook `paid` → transaksi DB: invoice `paid`, `billing_payments` row, buat/aktifkan `subscriptions` (`current_period_start=now`, `current_period_end=+1 interval`), invalidate entitlements, enqueue `site.manifest.refresh` (badge, domain), email invoice/kwitansi.
  4. Redirect sukses menampilkan "Menunggu konfirmasi pembayaran…" dengan polling hingga status aktif (karena webhook bisa lebih lambat dari redirect).
  - Syarat: email terverifikasi; workspace tidak `suspended`.
- **Acceptance criteria**:
  - [ ] Webhook idempoten: event yang sama dua kali tidak membuat dua periode/dua payment (unique `(provider, provider_event_id)`).
  - [ ] Signature webhook tidak valid → `401` dan tercatat.
  - [ ] Job rekonsiliasi tiap 15 menit memeriksa invoice `open` yang punya `provider_ref` via `getStatus` (menangani webhook hilang).
  - [ ] Setelah aktif, user Starter langsung bisa memilih subdomain nama ([07](./07-publishing-hosting.md)).

### ACC-162 Upgrade antar paket berbayar
- **P0 · M5**
- **Perilaku** — **rekomendasi sederhana tanpa proration harian**:
  - Upgrade (mis. Starter → Pro, atau bulanan → tahunan): **periode baru dimulai hari ini**; sisa nilai periode lama diberikan sebagai **kredit saldo** (`account_balance`) yang dihitung linear: `sisaHari / totalHari × hargaDibayar`, dibulatkan ke bawah ke Rp 1.000, lalu langsung dipotong dari invoice upgrade. Ini satu rumus sederhana dan mudah dijelaskan di UI ("Sisa nilai paket Starter Anda Rp 23.000 dipotong dari tagihan").
  - Upgrade berlaku segera setelah invoice upgrade dibayar. Sebelum dibayar, paket lama tetap berjalan.
  - Kredit AI: kredit bulanan paket lama yang tersisa **hangus**, diganti kuota penuh paket baru (lebih murah hati & sederhana).
- **Acceptance criteria**:
  - [ ] UI menampilkan rincian: harga paket baru − sisa nilai = total bayar, sebelum ke gateway.
  - [ ] Invoice mencantumkan baris "Kredit sisa paket sebelumnya" bernilai negatif.

> ❓ OPEN: Alternatif lebih sederhana lagi — upgrade tanpa kredit sisa, tetapi periode lama diperpanjang. Owner pilih; rekomendasi spec = kredit sisa linear.

### ACC-163 Downgrade antar paket
- **P0 · M5**
- **Perilaku**: downgrade (Pro → Starter, Starter → Free, tahunan → bulanan) **berlaku di akhir periode** (`scheduled_plan_id`). Tidak ada refund sisa periode. Sebelum konfirmasi, tampilkan **pratinjau dampak** (ACC-172) secara konkret: "2 dari 5 site akan dibekukan, custom domain tokobudi.com akan dilepas, 1.240 records dibekukan…" dan biarkan user memilih site mana yang tetap aktif.
- **Acceptance criteria**:
  - [ ] Downgrade bisa dibatalkan sebelum akhir periode.
  - [ ] Pratinjau dampak dihasilkan oleh fungsi yang sama dengan eksekusi downgrade (dry-run), bukan logika terpisah.

### ACC-164 Pembatalan langganan
- **P0 · M5**
- **Perilaku**: tombol Batalkan → survei alasan singkat (harga, fitur kurang, hanya sementara, pindah platform, lainnya + teks) → opsi retensi (P1: tawarkan kupon / downgrade ke paket lebih murah) → konfirmasi. Set `cancel_at_period_end=true`; fitur tetap sampai akhir periode; lalu ke Free dengan aturan downgrade. "Aktifkan kembali" tersedia sebelum periode berakhir.
- **Acceptance criteria**:
  - [ ] Email konfirmasi pembatalan berisi tanggal berakhir & dampak.
  - [ ] Alasan tersimpan di `subscriptions.cancel_reason` (untuk analytics).

### ACC-165 Invoice & kwitansi
- **P0 · M5**
- **Perilaku**:
  - Nomor invoice berurutan tanpa celah per tahun: `INV/2026/10/000123` (sequence DB, dibuat saat invoice difinalisasi).
  - Tipe: `subscription_new`, `subscription_renewal`, `subscription_upgrade`, `one_time` (top-up, add-on), `manual` (dibuat staff).
  - Status: `draft → open → paid | void | uncollectible`. Invoice `open` kedaluwarsa payment link-nya tapi invoice bisa diterbitkan ulang link-nya.
  - PDF dirender worker (HTML → PDF via Playwright) dengan: identitas badan usaha Platform (nama PT, alamat, NPWP — bila PKP), identitas pelanggan (`customer_snapshot`), item, subtotal, diskon, kredit saldo, PPN (tarif & nominal; 0 bila belum PKP), total, metode bayar, tanggal bayar. Disimpan di R2 (`invoices/{workspaceId}/{number}.pdf`).
  - Bahasa PDF mengikuti locale user penagih; nomor & format angka IDR.
- **Acceptance criteria**:
  - [ ] Invoice `paid` immutable (tidak bisa diedit; koreksi via credit note P2 / refund).
  - [ ] Nomor invoice unik & berurutan meski transaksi paralel (gunakan sequence/lock).

### ACC-166 Faktur pajak
- **P2 · M9**
- **Perilaku**: bila Platform PKP, pelanggan dengan NPWP bisa meminta e-Faktur. MVP: manual oleh owner via aplikasi pajak resmi; sistem hanya mengumpulkan NPWP & data penagihan dan menyediakan export CSV.

> ❓ OPEN: Status PKP & mekanisme e-Faktur (bergantung omzet dan konsultasi pajak).

### ACC-167 Renewal & reminder (model invoice manual)
- **P0 · M5**
- **Perilaku** (job harian 08:00 WIB, BullMQ repeatable):

| Waktu (relatif `current_period_end`) | Aksi |
|---|---|
| H-7 | Terbitkan invoice `subscription_renewal` (open) + email & in-app "Tagihan perpanjangan" dengan tombol bayar |
| H-3 | Reminder kedua (email) |
| H-1 | Reminder ketiga (email + in-app + WA opsional P2) |
| H (period end) belum bayar | Status `past_due`, **grace 7 hari**: fitur tetap jalan, banner merah di dashboard & editor |
| H+3 | Reminder "Paket Anda akan diturunkan dalam 4 hari" + pratinjau dampak |
| H+7 belum bayar | **Downgrade otomatis ke Free** (ACC-170), invoice → `uncollectible`, email "Paket Anda telah diturunkan" + cara mengaktifkan kembali |
| Bayar kapan pun selama grace | `active`, periode baru dihitung dari `current_period_end` lama (bukan dari tanggal bayar — mencegah "gratis" selama grace) |

- **Acceptance criteria**:
  - [ ] Semua tanggal dihitung di `Asia/Jakarta`; job idempoten (aman dijalankan ulang).
  - [ ] Pembayaran setelah downgrade (invoice uncollectible dibayar terlambat) → ditangani sebagai reaktivasi: langganan aktif lagi dengan periode baru dari tanggal bayar, aset/site yang dibekukan dipulihkan otomatis (ACC-173).

### ACC-168 Auto-renew kartu / recurring
- **P1 · M5+**
- **Perilaku**: bila provider mendukung tokenisasi, user dapat menyimpan kartu/akun e-wallet untuk ditagih otomatis H-1. Gagal tagih → masuk alur dunning ACC-167 (reminder + link bayar manual). Kartu disimpan di provider (token), tidak pernah di DB Platform (PCI).
- **Acceptance criteria**:
  - [ ] User bisa mematikan auto-renew & menghapus metode bayar.

### ACC-169 Dunning — kegagalan pembayaran
- **P0 · M5**
- **Perilaku**: pembayaran `failed`/`expired` di gateway tidak mengubah status langganan sendiri — yang menentukan adalah tenggat periode (ACC-167). Payment link baru dapat dibuat kapan saja dari halaman Billing ("Bayar sekarang"). Catat setiap percobaan di `billing_payments` (status `failed`, `failure_reason`).
- **Acceptance criteria**:
  - [ ] User melihat riwayat percobaan bayar yang gagal beserta alasan bila tersedia.

### ACC-170 Downgrade otomatis ke Free
- **P0 · M5**
- **Perilaku**: dieksekusi oleh job `billing.downgrade` (juga dipakai cancel & downgrade terjadwal). Langkah:
  1. `subscriptions.status = expired|canceled`; entitlements → plan target (Free atau paket lebih rendah); `invalidate()`.
  2. Hitung dampak dengan fungsi `planDowngradeImpact(workspaceId, targetPlan)` (sama dengan pratinjau ACC-163).
  3. Terapkan aturan ACC-172 per resource.
  4. Enqueue `site.manifest.refresh` & publish ulang site yang terdampak (badge muncul lagi, dsb.).
  5. Catat `audit_logs` (`actor='system'`) + notifikasi.
- **Acceptance criteria**:
  - [ ] Tidak ada data user yang terhapus oleh job ini (test: hitung row sebelum/sesudah).
  - [ ] Job aman diulang (idempoten).

### ACC-171 Pilihan site yang tetap aktif
- **P0 · M5**
- **Perilaku**: bila jumlah site melebihi `sites.max` target, user memilih site yang tetap aktif (default: site yang terakhir dipublish/dikunjungi terbanyak). Pilihan bisa diatur saat pratinjau downgrade dan diubah setelahnya (maks 1×/7 hari agar tidak dipakai sebagai "rotasi" untuk menghindari batas).
- **Acceptance criteria**:
  - [ ] Tanpa pilihan user, sistem memakai default deterministik dan memberi tahu.

### ACC-172 Aturan dampak downgrade per resource
- **P0 · M5**
- **Perilaku**:

| Resource | Aturan saat target plan tidak mencakup / melebihi batas | Retensi |
|---|---|---|
| **Site melebihi `sites.max`** | Site yang tidak dipilih menjadi **frozen**: editor read-only, **tetap live** selama grace 14 hari (ACC-137), lalu **unpublish** (halaman "Situs ini sedang tidak aktif"). User dapat memilih "unpublish sekarang" alih-alih read-only. | Dokumen & aset disimpan **180 hari** sejak frozen; reminder H-30, H-7 sebelum purge. ❓ OPEN: angka retensi. |
| **Halaman melebihi `pages.perSiteMax`** | Halaman tetap ada & tetap live; tidak bisa tambah halaman baru sampai di bawah batas. | — |
| **Custom domain** (turun ke < Pro) | Domain **dilepas** dari site setelah grace 14 hari; domain menampilkan halaman info (bila DNS masih mengarah) selama 30 hari, lalu hostname dihapus dari Cloudflare for SaaS. Konfigurasi DNS user dicatat agar mudah dipasang lagi. | Catatan domain 180 hari |
| **Subdomain nama** (turun ke Free) | Site kembali memakai **subdomain acak** (yang lama bila masih di-reserve, atau baru). Subdomain nama **redirect 301 ke subdomain acak selama 90 hari**, dan nama tetap **di-reserve untuk workspace ini 90 hari** (bisa diklaim kembali saat upgrade). Lihat [07](./07-publishing-hosting.md). | 90 hari |
| **Badge** | Badge dimunculkan kembali pada publish ulang otomatis. | — |
| **Template/component premium** | Instance yang sudah ada tetap dirender & live; tidak bisa menambah instance baru atau mengubah props yang ditandai premium. | — |
| **Data dinamis** (collections, records, members) | **Dibekukan, tidak dihapus**: collections read-only di dashboard (bisa export CSV), komponen data-bound di website menampilkan data terakhir (snapshot statis saat freeze) atau disembunyikan (pilihan user); form tidak lagi menulis ke collection → fallback ke email notifikasi (Free). Member login dinonaktifkan dengan halaman info. | 180 hari, lalu purge setelah reminder |
| **Workflows** | Dinonaktifkan (status `paused_plan`), konfigurasi disimpan. | 180 hari |
| **Commerce checkout** | Checkout dinonaktifkan; produk kembali ke mode katalog + tombol WhatsApp (bila ≤ batas produk Free, sisanya disembunyikan). Order lama tetap bisa dilihat & di-export. | Order: mengikuti [06](./06-commerce-payments.md) (kewajiban data transaksi) |
| **Storage melebihi batas** | Tidak menghapus aset; upload diblok sampai di bawah batas. | — |
| **Version history** | Riwayat lebih tua dari retensi baru tidak dihapus segera; dipangkas oleh job harian setelah 30 hari. | 30 hari |
| **Kredit AI** | Kredit bulanan hangus; kredit top-up tetap tersimpan (berlaku 12 bln) tetapi hanya bisa dipakai bila paket kembali mendukung AI. | sesuai `expires_at` |
| **Seats/anggota (Business → lainnya)** | Team workspace menjadi **read-only** untuk semua anggota kecuali owner; owner dapat memindahkan site ke personal workspace (sesuai batas) atau berlangganan lagi. | 180 hari |
| **Password protect, custom code** | Dinonaktifkan pada publish ulang; konfigurasi disimpan. ⚠️ Untuk password protect: site yang sebelumnya dilindungi **di-unpublish** (bukan dibuka ke publik) kecuali user memilih eksplisit "buka ke publik". | 180 hari |

- **Acceptance criteria**:
  - [ ] Site berproteksi password tidak pernah tiba-tiba terbuka publik karena downgrade (test e2e).
  - [ ] Redirect 301 subdomain nama → acak aktif segera setelah eksekusi downgrade.
  - [ ] Semua resource frozen memiliki `frozen_at` & `purge_after` yang terlihat di UI.

### ACC-173 Reaktivasi & pemulihan
- **P0 · M5**
- **Perilaku**: upgrade/bayar ulang sebelum `purge_after` → otomatis: unfreeze site (dalam batas), pasang kembali custom domain (verifikasi DNS ulang otomatis), kembalikan subdomain nama (bila masih di-reserve), aktifkan ulang workflows (tetap `paused` — user mengaktifkan manual agar tidak ada blast email tak terduga), collections writable.
- **Acceptance criteria**:
  - [ ] Pemulihan selesai ≤ 5 menit setelah pembayaran terkonfirmasi (kecuali propagasi DNS).

### ACC-174 Refund
- **P0 · M5**
- **Perilaku**: kebijakan (ACC-314): refund penuh bila diminta ≤ 7 hari sejak pembayaran **pertama** dan pemakaian kredit AI < 20% (usulan, OPEN). Refund diproses manual oleh staff dari `/admin` (ACC-207): via API provider bila didukung, atau transfer bank manual (catat bukti). Setelah refund: langganan berakhir segera, aturan downgrade berlaku.
- **Acceptance criteria**:
  - [ ] Setiap refund punya `refunds` row (amount, method, reason, staff_id, provider_ref/bukti) & audit log.

### ACC-175 Saldo akun (account balance)
- **P1 · M5**
- **Perilaku**: `workspaces.balance_idr` (atau ledger kecil `balance_ledger`) menampung kredit sisa upgrade & kompensasi staff; otomatis dipotong pada invoice berikutnya. Tidak bisa dicairkan.
- **Acceptance criteria**:
  - [ ] Invoice yang tertutup penuh oleh saldo langsung `paid` tanpa ke gateway.

---

## 10. Admin panel internal

Route: `apps/web` → `app.platformmu.com/admin/*`. API: `apps/api` `/admin/*` dengan middleware `requireStaff(role)`.

### 10.1 Role staff

| Role | Akses |
|---|---|
| `super_admin` | Semua, termasuk mengubah plans/harga, feature flags, role staff, refund, ban akun, hapus permanen |
| `staff` | Baca semua; moderasi (warning, unpublish, suspend site); impersonate (read-only default); support (resend verifikasi, adjust kredit kecil ≤ batas); TIDAK bisa refund, ubah harga, ban permanen (butuh super_admin) |
| `library_admin` | Mode Admin library ([03 CMP-010](./03-components-templates.md)): buat/edit draft, approve review, publish versi component/template. Akses `/admin` hanya bagian library |
| `designer` | Staff internal pembuat library: buat/edit draft milik sendiri & submit review, **tidak** bisa publish. Akses `/admin` hanya bagian library |

Role disimpan di `users.staff_role` (nullable: `super_admin` \| `staff` \| `library_admin` \| `designer`) — terpisah dari role workspace. **Ini daftar final role platform internal**; dokumen lain merujuk ke sini. `vendor` (designer luar di marketplace, P2 · M9+, [03 §19](./03-components-templates.md)) **bukan** staff role: vendor adalah user biasa dengan profil vendor terverifikasi dan hanya mengakses entitas `owner_type='vendor'` miliknya.

### ACC-200 Akses & keamanan admin
- **P0 · M4**
- **Perilaku**: wajib 2FA (ACC-006 — sehingga 2FA P0 untuk staff di M4), session admin maksimal 8 jam, IP allowlist opsional (env), semua aksi mutasi dicatat `audit_logs` (actor, action, target, before/after diff, IP, alasan wajib untuk aksi destruktif). Route `/admin` tidak di-index (`noindex`) dan 404 untuk non-staff (bukan 403).
- **Acceptance criteria**:
  - [ ] Test: non-staff mengakses `/admin/*` & `/api/admin/*` mendapat 404.
  - [ ] Setiap endpoint admin mutasi gagal bila `reason` kosong untuk aksi bertanda destruktif.

### ACC-201 Users
- **P0 · M4**
- **Perilaku**: pencarian (email, nama, ID, subdomain, domain), detail user: profil, status, email verified, 2FA, sesi, workspace & role, site, langganan, kredit, consents, riwayat moderasi, audit. Aksi: kirim ulang verifikasi, tandai terverifikasi (dengan alasan), reset 2FA (setelah verifikasi identitas manual), cabut semua sesi, suspend/ban/unban, set staff role (super_admin).
- **Acceptance criteria**:
  - [ ] Pencarian dengan potongan subdomain mengembalikan pemilik site.

### ACC-202 Workspaces
- **P0 · M4**
- **Perilaku**: daftar & detail workspace: tipe, owner, anggota, plan & versi, status langganan, entitlements efektif beserta **sumber** tiap nilai (plan/addon/override), usage, invoice, saldo, kredit ledger.
- **Acceptance criteria**:
  - [ ] Halaman detail menampilkan JSON `ResolvedEntitlements` yang identik dengan yang dipakai API.

### ACC-203 Sites
- **P0 · M4**
- **Perilaku**: daftar site (filter: status publish, plan, dilaporkan, dibuat 24 jam terakhir), detail: URL, domain, riwayat publish, ukuran, laporan moderasi, tindakan. Aksi: unpublish, suspend, restore dari sampah, paksa republish, lihat snapshot publish (HTML dari R2) tanpa impersonate.
- **Acceptance criteria**:
  - [ ] Tindakan site langsung memicu `site.manifest.refresh`.

### ACC-204 Impersonate dengan audit
- **P0 · M4**
- **Perilaku**:
  - Staff memulai impersonate dengan **alasan wajib** (mis. nomor tiket). Membuat session khusus (`sessions.impersonated_by = staffId`, TTL 30 menit).
  - **Default read-only**: semua mutasi ditolak kecuali staff mengaktifkan "mode tulis" (hanya `super_admin`, alasan tambahan).
  - Banner merah permanen di seluruh UI (dashboard & editor): "Anda melihat sebagai {email} — Keluar".
  - Tidak bisa melihat: kredensial payment gateway user (tetap tersamar), backup code 2FA, password; tidak bisa mengubah email/password/2FA user; tidak bisa melakukan pembayaran.
  - Setiap request saat impersonate tercatat (aksi penting) di `audit_logs` dengan `impersonator_id`.
  - Opsional P1: user mendapat notifikasi "Tim support mengakses akun Anda pada …" (transparansi).
- **Acceptance criteria**:
  - [ ] Mutasi dalam mode read-only → `403 IMPERSONATION_READ_ONLY`.
  - [ ] Session impersonate kedaluwarsa otomatis setelah 30 menit.
  - [ ] Audit log dapat difilter per `impersonator_id`.

### ACC-205 Plans & override entitlements per akun
- **P0 · M4** (plans editor: P1 · M5)
- **Perilaku**:
  - `entitlement_overrides`: `{ workspace_id, key, value, reason, expires_at?, created_by }`. Contoh: beri `sites.max=5` ke workspace Free mitra UMKM binaan selama 6 bulan; turunkan `ai.rateLimitPerMin` untuk akun mencurigakan.
  - Assign plan manual (comp/gratis, mis. untuk partner) → `subscriptions` dengan `source='manual'`, `amount=0`, `current_period_end` ditentukan staff.
  - Editor plan (super_admin): ubah `limits` → membuat versi baru (ACC-091), preview diff, konfirmasi.
- **Acceptance criteria**:
  - [ ] Override kedaluwarsa otomatis tidak berlaku lagi tanpa job manual (resolusi mengecek `expires_at`).
  - [ ] Setiap override tercatat audit dengan alasan.

### ACC-206 Harga, add-on, kupon
- **P1 · M5**
- **Perilaku**: CRUD `plan_prices`, `addon_products`, `coupons` (ACC-110, ACC-111) — hanya `super_admin`. Harga baru berlaku untuk checkout/renewal setelah `valid_from`; renewal pelanggan lama memakai harga yang dikunci di `subscriptions.price_id` sampai migrasi dengan pemberitahuan 30 hari.
- **Acceptance criteria**:
  - [ ] Mengubah harga tidak mengubah invoice `open` yang sudah terbit.

### ACC-207 Billing records & refund manual
- **P0 · M5**
- **Perilaku**: daftar invoice/payment (filter status, provider, tanggal), detail dengan payload webhook mentah (disimpan `billing_payments.raw` — tanpa data kartu), tombol "Cek status ke provider" (rekonsiliasi manual), "Tandai lunas manual" (bukti transfer wajib di-upload, super_admin), "Void invoice", "Refund" (ACC-174), export CSV untuk akuntansi bulanan.
- **Acceptance criteria**:
  - [ ] Ringkasan bulanan: total pendapatan, refund, PPN terkumpul, per paket — dapat diekspor CSV.

### ACC-208 Library management
- **P0 · M3/M4**
- **Perilaku**: daftar template & component, versi, status (`draft/published/deprecated`), tier (free/starter/pro), kategori, bahasa (nama/deskripsi ID & EN), statistik pemakaian, tombol "Buka di editor (mode admin)". Detail lengkap di [03](./03-components-templates.md).
- **Acceptance criteria**:
  - [ ] Mengubah `tier` item tercermin di pengecekan ACC-093 tanpa deploy.

### ACC-209 Moderation queue & abuse reports
- **P0 · M4**
- **Perilaku**: lihat [§11](#11-moderasi--abuse) — antrean kasus dengan prioritas, screenshot site, sinyal deteksi, riwayat akun, tombol tindakan cepat, template pesan ke user.
- **Acceptance criteria**:
  - [ ] Kasus bisa di-assign ke staff dan berstatus `open → in_review → actioned | dismissed`.

### ACC-210 Feature flags
- **P0 · M4**
- **Perilaku**:
  - Tabel `feature_flags (key, description, enabled, rollout_percent, allow_workspace_ids[], allow_user_ids[], deny_*[], updated_by)`. Evaluasi deterministik: `hash(key + workspaceId) % 100 < rollout_percent`.
  - SDK kecil `isEnabled(key, ctx)` di API (cache 30 detik) dan endpoint `GET /me/flags` untuk web/editor.
  - Beda dengan entitlements: flags = rollout/eksperimen/kill-switch; entitlements = hak paket. Keduanya bisa dicek bersamaan (`flag && entitlement`).
  - Kill-switch wajib: `ai.enabled`, `publish.enabled`, `signup.enabled`, `billing.checkout.enabled`.
- **Acceptance criteria**:
  - [ ] Mematikan `signup.enabled` menampilkan halaman "Pendaftaran sementara ditutup" dalam < 1 menit.

### ACC-211 Announcement banner
- **P1 · M4**
- **Perilaku**: staff membuat pengumuman (judul & isi ID/EN, tingkat `info|warning|critical`, target: semua / plan tertentu / workspace tertentu, jadwal mulai/akhir, dapat ditutup atau tidak). Tampil di dashboard & editor.
- **Acceptance criteria**:
  - [ ] Banner yang ditutup user tidak muncul lagi (disimpan per user), kecuali `critical`.

### ACC-212 System health
- **P1 · M4**
- **Perilaku**: halaman ringkas: status API, DB (koneksi, ukuran), Redis, antrean BullMQ (waiting/active/failed per queue + tombol retry job gagal — via Bull Board yang di-mount dengan auth staff), publish gagal 24 jam, error rate (tautan ke Sentry), biaya AI hari ini/bulan ini (dari ledger × `C_credit`), signup/publish hari ini.
- **Acceptance criteria**:
  - [ ] Bull Board tidak bisa diakses tanpa session staff.

### ACC-213 Audit log viewer
- **P0 · M4**
- **Perilaku**: pencarian `audit_logs` per actor, target (user/workspace/site), action, rentang tanggal; diff before/after; export CSV. Audit log **append-only** (tidak ada endpoint update/delete; retensi 2 tahun).
- **Acceptance criteria**:
  - [ ] Role DB aplikasi tidak memiliki hak `UPDATE/DELETE` pada `audit_logs` (atau dicegah trigger).

### ACC-214 Dashboard metrik bisnis
- **P1 · M5**
- **Perilaku**: kartu: total user, user aktif 7/30 hari, site published, MRR, churn bulan ini, konversi Free→berbayar, biaya AI vs pendapatan AI. Sumber: query agregat DB + event analytics ([§16](#16-analytics-produk-internal)).
- **Acceptance criteria**:
  - [ ] Angka MRR = SUM harga bulanan-ekuivalen langganan aktif (tahunan / 12).

---

## 11. Moderasi & abuse

Subdomain gratis adalah magnet penyalahgunaan. Moderasi adalah **syarat rilis publik M4**, bukan tambahan.

### 11.1 Kategori risiko

| Kategori | Contoh pola | Tingkat |
|---|---|---|
| **Phishing** | halaman login tiruan bank/e-wallet/marketplace/email, form meminta PIN/OTP/password | Kritis |
| **Judi online** | slot, togel, "gacor", "maxwin", "deposit pulsa", daftar link alternatif | Kritis (fokus regulator Indonesia) |
| **Pinjol ilegal** | pinjaman tanpa izin OJK, "cair tanpa BI checking", meminta akses kontak | Tinggi |
| **Pornografi / konten seksual** | konten eksplisit, prostitusi, "open BO" | Kritis |
| **Penipuan** | investasi bodong, giveaway palsu, arisan online, lowongan kerja penipuan, toko fiktif | Tinggi |
| **Impersonasi** | meniru brand, bank, instansi pemerintah (domain/subdomain mirip, logo resmi, "resmi", "official") | Kritis |
| **Malware** | link unduhan APK mencurigakan, redirect berbahaya | Kritis |
| **Lainnya** | SARA/ujaran kebencian, narkoba, senjata, pelanggaran hak cipta (P1 via laporan), spam SEO | Sedang–Tinggi |

### ACC-240 Kebijakan Penggunaan yang Dapat Diterima (AUP)
- **P0 · M4**
- **Perilaku**: halaman publik `/legal/aup` (ID & EN) yang mendaftar kategori terlarang di atas, konsekuensi, proses banding. Disetujui sebagai bagian S&K saat registrasi (ACC-001).
- **Acceptance criteria**:
  - [ ] Setiap email tindakan moderasi menautkan pasal AUP yang relevan.

### ACC-241 Deteksi saat publish (keyword & pola)
- **P0 · M4**
- **Perilaku**:
  - Worker publish menjalankan `moderation.scanSite` **sebelum** file diunggah ke R2 (untuk publish pertama & publish akun baru < 7 hari) dan **asinkron setelah** publish untuk akun terpercaya.
  - Input scan: semua teks halaman, title/meta, alt text, URL tautan keluar, nama form field, nama subdomain, nama file gambar.
  - Aturan (data, bukan kode — tabel `moderation_rules` yang bisa diubah staff):
    - Daftar kata/frasa berbobot per kategori (ID + EN + slang, mis. "gacor", "slot88", "maxwin", "deposit via dana", "pinjaman cepat cair tanpa jaminan", "masukkan PIN").
    - Pola: form dengan field bernama/berlabel `password`, `pin`, `otp`, `cvv`, `nomor kartu` di site non-commerce; brand/bank/instansi terkenal di subdomain atau title (`bca`, `bri`, `mandiri`, `dana`, `ovo`, `gopay`, `shopee`, `tokopedia`, `djp`, `bpjs`, `kemenkes`, `polri`, `go.id` …) dipadukan dengan form login → skor tinggi.
    - Tautan keluar ke domain yang ada di blocklist internal.
  - Skor total → keputusan:
    - `< 30` lolos.
    - `30–69` lolos tetapi **masuk antrean review** (`moderation_reports.source='auto'`).
    - `≥ 70` **publish ditahan** (`publish_status='held_for_review'`), user melihat pesan netral "Website Anda sedang ditinjau, biasanya < 24 jam" + tautan AUP.
  - Daftar subdomain terlarang (reserved & sensitif) dicek saat memilih subdomain — lihat [07](./07-publishing-hosting.md).
- **Acceptance criteria**:
  - [ ] Fixture situs phishing tiruan bank (form PIN + nama bank) ditahan; fixture toko kue biasa lolos.
  - [ ] Mengubah aturan di `/admin` berlaku untuk scan berikutnya tanpa deploy.
  - [ ] Waktu scan p95 < 2 detik untuk site 20 halaman.

### ACC-242 AI classifier
- **P1 · M6**
- **Perilaku**: untuk site dengan skor 30–69 atau akun baru, kirim ringkasan teks + screenshot halaman utama ke model (Claude, model kecil/murah) dengan prompt klasifikasi → `{ category, confidence, rationale }`. Hasil menambah skor dan membantu reviewer. Biaya dicatat sebagai biaya platform (bukan kredit user).
- **Acceptance criteria**:
  - [ ] Output disimpan di `moderation_reports.signals` untuk reviewer; keputusan akhir kategori kritis tetap manusia kecuali confidence sangat tinggi (≥ 0,95) + kategori phishing/judi → auto-hold.

### ACC-243 Google Safe Browsing / Web Risk check
- **P1 · M5**
- **Perilaku**: cek tautan keluar saat publish & cek berkala (harian) semua hostname site publik terhadap Safe Browsing / Web Risk API. Hit → otomatis unpublish + kasus kritis.
- **Acceptance criteria**:
  - [ ] Hostname kita yang ditandai pihak ketiga terdeteksi ≤ 24 jam.

> ❓ OPEN: Lisensi penggunaan Safe Browsing untuk komersial (mungkin perlu Web Risk API berbayar).

### ACC-244 Laporan dari publik ("Laporkan situs")
- **P0 · M4**
- **Perilaku**:
  - Badge "Made with Platform" dan footer halaman info (site suspended/unpublished) memuat tautan "Laporkan situs" → `platformmu.com/report?site={hostname}`.
  - Form: kategori, deskripsi, email pelapor (opsional, untuk tindak lanjut), Turnstile. Rate limit per IP.
  - Juga tersedia `abuse@platformmu.com` (email masuk diparse menjadi laporan, P1).
  - Laporan menjadi `moderation_reports (source='public')`; banyak laporan pada site yang sama digabung (dedupe) dan menaikkan prioritas.
- **Acceptance criteria**:
  - [ ] Site Pro tanpa badge tetap bisa dilaporkan via halaman `platformmu.com/report` (input URL).
  - [ ] Pelapor menerima email konfirmasi bila mengisi email.

### ACC-245 Antrean moderasi & SLA
- **P0 · M4**
- **Perilaku**:
  - Prioritas otomatis: `critical` (phishing, judi, porno, malware, impersonasi pemerintah/bank), `high`, `normal`.
  - SLA target (owner solo → realistis, OPEN): `critical` ≤ 4 jam di jam kerja / ≤ 12 jam di luar jam kerja (dibantu auto-hold), `high` ≤ 24 jam, `normal` ≤ 72 jam, banding ≤ 72 jam.
  - Notifikasi ke staff (email/Telegram/Slack-webhook, OPEN) untuk kasus `critical` baru.
  - Tampilan kasus: screenshot terbaru (worker Playwright), teks yang memicu (highlight), skor & sinyal, info akun (umur akun, verifikasi, plan, site lain, IP/ASN signup, kasus sebelumnya), tombol tindakan.
- **Acceptance criteria**:
  - [ ] Dashboard antrean menampilkan umur kasus dan menandai yang melewati SLA.

> ❓ OPEN: SLA final & kanal notifikasi staff.

### ACC-246 Tindakan moderasi
- **P0 · M4**
- **Perilaku** — gradasi tindakan, setiap tindakan = row `moderation_actions` (+ audit log + email ke owner dengan alasan & pasal AUP):

| Tindakan | Efek | Siapa |
|---|---|---|
| `dismiss` | Kasus ditutup, tidak ada pelanggaran; site ditandai "reviewed OK" (skor auto di-whitelist untuk konten yang sama) | staff |
| `warning` | Email peringatan + minta perbaikan dalam N hari | staff |
| `unpublish_site` | Site di-unpublish; user bisa memperbaiki & publish ulang (masuk review wajib) | staff |
| `suspend_site` | Site diblokir: halaman "Situs ini ditangguhkan karena melanggar kebijakan" + link laporan; user tidak bisa publish site ini | staff |
| `suspend_account` | Akun `suspended` (ACC-012), semua site di-unpublish | staff (kritis) / super_admin |
| `ban_account` | Akun `banned`, semua site suspended, langganan dibatalkan tanpa refund (sesuai S&K), email & sinyal perangkat dimasukkan blocklist | super_admin |
| `restore` | Membatalkan tindakan sebelumnya | staff/super_admin |

  - Phishing/judi/porno/malware terkonfirmasi → langsung `suspend_site` (tanpa warning) + pertimbangkan `ban_account`.
  - Subdomain site suspended **tidak dilepas** (tidak bisa didaftar ulang) selama minimal 1 tahun.
- **Acceptance criteria**:
  - [ ] Site suspended tidak bisa diakses (site-host menyajikan halaman suspended) ≤ 60 detik setelah tindakan.
  - [ ] Tidak ada tindakan tanpa `reason` dan `policy_ref`.

### ACC-247 Banding (appeal)
- **P0 · M4**
- **Perilaku**: email tindakan & banner dashboard memuat tombol "Ajukan banding" → form (penjelasan, lampiran). Banding ditinjau oleh staff berbeda bila memungkinkan (solo owner: catat bahwa reviewer sama). Hasil: `upheld` / `overturned` + email. Maksimal 1 banding aktif per tindakan.
- **Acceptance criteria**:
  - [ ] User `banned` bisa mengajukan banding via halaman publik dengan email akun (tanpa login).

### ACC-248 Laporan dari otoritas / takedown request
- **P1 · M4**
- **Perilaku**: kanal khusus (email `legal@`) untuk permintaan pemblokiran dari instansi (mis. Kementerian Komunikasi dan Digital) atau pemilik merek/hak cipta. Staff mencatat sebagai `moderation_reports (source='authority'|'legal')` dengan dokumen pendukung; tindakan sesuai hukum yang berlaku & SLA regulasi (OPEN, dicek bersama pendaftaran PSE).
- **Acceptance criteria**:
  - [ ] Ada log dan dokumen untuk setiap permintaan otoritas (bukti kepatuhan).

### ACC-255 Rate limit pembuatan akun & site
- **P0 · M4**
- **Perilaku** (nilai usulan, di config):

| Aksi | Batas |
|---|---|
| Registrasi per IP | 3 / jam, 10 / hari (Turnstile wajib di form) |
| Registrasi per /24 subnet atau ASN hosting/VPN mencurigakan | ambang lebih ketat + tandai `risk_score` |
| Email disposable (daftar domain temp-mail) | ditolak |
| Pembuatan site per user | 5 / hari (Free), 20 / hari (berbayar) |
| Publish per site | 30 / jam (Free), 120 / jam (berbayar) |
| Subdomain change | 3 / hari |
| Laporan publik per IP | 10 / hari |

  - Sinyal risiko disimpan di `users.risk_score` & `users.signup_meta` (IP, ASN, negara, UA hash) — dipakai moderasi & keputusan verifikasi HP.
- **Acceptance criteria**:
  - [ ] Rate limit memakai Redis (sliding window) dan mengembalikan `429` dengan `Retry-After`.

### ACC-256 Verifikasi email wajib sebelum publish
- **P0 · M4**
- **Perilaku**: lihat ACC-003. Publish, invite, checkout langganan, AI di luar trial onboarding → wajib `email_verified`.
- **Acceptance criteria**:
  - [ ] Tercakup di test API publish.

### ACC-257 Verifikasi nomor HP (anti-spam)
- **P1 · M5**
- **Perilaku**: OTP via SMS/WhatsApp diminta hanya bila `risk_score` tinggi, atau sebelum menerima AI trial (bila abuse trial meningkat), atau sebelum publish site kedua di Free (OPEN). 1 nomor HP hanya bisa memverifikasi maks 2 akun.
- **Acceptance criteria**:
  - [ ] Nomor disimpan dalam format E.164 dan di-hash untuk pengecekan duplikasi.

> ❓ OPEN: Provider OTP & biaya per OTP; kapan verifikasi HP diwajibkan.

### ACC-258 Pemantauan pasca-publish
- **P1 · M5**
- **Perilaku**: scan ulang berkala (mingguan) semua site publik Free; scan ulang segera bila konten berubah > 50% setelah lolos review (pola "bait-and-switch").
- **Acceptance criteria**:
  - [ ] Job tidak membebani worker publish (queue terpisah `moderation`, prioritas rendah).

---

## 12. Notifikasi platform

### ACC-270 Katalog notifikasi
- **P0 · M4** (item billing M5, AI M6, tim M9)
- **Perilaku**: setiap notifikasi punya `type`, kanal default, dan apakah bisa dimatikan.

| Type | Email | In-app | Bisa dimatikan | Fase |
|---|:-:|:-:|:-:|---|
| `auth.welcome` | ✅ | — | ❌ | M1 |
| `auth.verify_email` | ✅ | — | ❌ | M1 |
| `auth.password_reset` / `auth.password_changed` | ✅ | — | ❌ | M1 |
| `auth.new_login` | ✅ | — | ✅ | M4 (P1) |
| `site.publish_failed` | ✅ | ✅ | ✅ (email) | M4 |
| `site.published_first` | ✅ | ✅ | ✅ | M4 |
| `usage.threshold_80` / `usage.threshold_100` | ✅ | ✅ | ✅ (80%) / ❌ (100%) | M4 |
| `billing.invoice_issued` | ✅ | ✅ | ❌ | M5 |
| `billing.payment_succeeded` (kwitansi) | ✅ | ✅ | ❌ | M5 |
| `billing.renewal_reminder` (H-7/H-3/H-1) | ✅ | ✅ | ❌ | M5 |
| `billing.past_due` / `billing.downgraded` | ✅ | ✅ | ❌ | M5 |
| `billing.canceled` | ✅ | — | ❌ | M5 |
| `ai.credits_low` / `ai.topup_succeeded` | ✅ | ✅ | ✅ / ❌ | M6 |
| `moderation.action` (warning/unpublish/suspend) | ✅ | ✅ | ❌ | M4 |
| `moderation.appeal_result` | ✅ | ✅ | ❌ | M4 |
| `team.invited` / `team.role_changed` / `team.removed` | ✅ | ✅ | ❌ | M9 |
| `data.form_submission` (ke pemilik website) | ✅ | ✅ | ✅ (per form) | M4/M7 — detail [05](./05-dynamic-data.md) |
| `commerce.new_order` | ✅ | ✅ | ✅ | M8 — detail [06](./06-commerce-payments.md) |
| `account.deletion_scheduled` / `account.export_ready` | ✅ | — | ❌ | M4 |
| `announcement` | — | ✅ | — | M4 |
| `marketing.*` (tips, promo) | ✅ | — | ✅ (opt-in) | M5 |

- **Acceptance criteria**:
  - [ ] Semua type terdaftar di satu registry TS (`packages/` atau `apps/api/src/modules/notifications/registry.ts`) dengan schema payload Zod.

### ACC-271 Email transaksional
- **P0 · M1**
- **Perilaku**:
  - Provider: Resend (atau sejenis) di belakang interface `EmailProvider`. Dikirim dari worker (queue `email`), retry eksponensial 5×.
  - Template: React Email (`packages/emails` atau di `apps/worker/src/emails`), dwibahasa via `packages/i18n`, mengikuti `users.locale`.
  - Domain pengirim: `no-reply@mail.platformmu.com` (SPF, DKIM, DMARC). Reply-to: `support@`.
  - Lokal: MailPit/MailHog di Docker Compose.
  - Footer marketing email memuat unsubscribe 1-klik (header `List-Unsubscribe`).
- **Acceptance criteria**:
  - [ ] Setiap email terkirim tercatat `notifications` (kanal email) dengan `provider_message_id` & status (sent/bounced/complained via webhook provider).
  - [ ] Bounce keras menandai `users.email_bouncing=true` dan menampilkan banner "perbarui email".

### ACC-272 In-app notifications
- **P0 · M4**
- **Perilaku**: tabel `notifications` (user_id, workspace_id?, type, payload, read_at). Delivery: polling ringan tiap 60 detik atau SSE (P1). Lonceng di dashboard & editor (ACC-057). Notifikasi workspace dikirim ke anggota yang relevan berdasarkan permission (mis. billing → owner & billing).
- **Acceptance criteria**:
  - [ ] "Tandai semua dibaca" & pagination 20 per halaman.
  - [ ] Notifikasi > 90 hari dihapus otomatis.

### ACC-273 Preferensi notifikasi
- **P0 · M4**
- **Perilaku**: Pengaturan > Notifikasi: matriks type × kanal untuk yang bisa dimatikan; toggle marketing (consent, tercatat di `consents` dengan timestamp); ringkasan form submission harian vs instan (P1).
- **Acceptance criteria**:
  - [ ] Notifikasi wajib (billing, keamanan, moderasi) tidak bisa dimatikan dan diberi keterangan.

---

## 13. Internationalization (i18n)

### ACC-290 `packages/i18n`
- **P0 · M1**
- **Perilaku**:
  - Locale didukung: `id` (default & fallback) dan `en`. Struktur: `packages/i18n/messages/{id,en}/{common,auth,dashboard,editor,billing,admin,emails,errors}.json` (format ICU MessageFormat untuk plural/variabel).
  - Dipakai oleh `apps/web` (next-intl atau setara), `apps/editor` (React context ringan dari paket yang sama), `apps/worker` (email, PDF invoice), `apps/api` (pesan error yang ditampilkan ke user — API mengembalikan `code` + `message` ter-lokalisasi sesuai `Accept-Language`/locale user).
  - Type-safe: key di-generate menjadi tipe TS; CI gagal bila key ada di `id` tapi tidak di `en` (atau sebaliknya).
  - Admin panel boleh hanya `id` + `en` minimal (P1 untuk EN penuh).
- **Acceptance criteria**:
  - [ ] Script `pnpm i18n:check` memverifikasi kelengkapan & placeholder konsisten.
  - [ ] Tidak ada string UI literal di JSX (lint rule, dengan allowlist).

### ACC-291 Format angka, mata uang, tanggal
- **P0 · M1**
- **Perilaku**: helper di `packages/i18n/format.ts` berbasis `Intl`:

```ts
formatCurrency(49000, 'id')       // "Rp 49.000"   (IDR, 0 desimal)
formatCurrency(49000, 'en')       // "IDR 49,000"
formatNumber(1234567.5, 'id')     // "1.234.567,5"
formatBytes(3_221_225_472, 'id')  // "3 GB"
formatDate(date, 'id', tz)        // "12 Okt 2026"
formatDateTime(date, 'id', tz)    // "12 Okt 2026, 14.30 WIB"
formatRelative(date, 'id')        // "3 menit lalu"
```

  - Waktu disimpan UTC (`timestamptz`); ditampilkan di timezone user; logika bisnis billing di `Asia/Jakarta`.
- **Acceptance criteria**:
  - [ ] Unit test snapshot untuk kedua locale.

### ACC-292 Konten library dwibahasa
- **P0 · M3**
- **Perilaku**: metadata template/component menyimpan `name`, `description`, `tags`, `category` sebagai `{ id: string; en: string }`; teks default di dalam component/template juga punya varian bahasa bila relevan (mis. template "Toko Kue" dengan konten contoh ID & EN — konten awal mengikuti locale user saat membuat site). Detail di [03](./03-components-templates.md).
- **Acceptance criteria**:
  - [ ] Pencarian library mencocokkan kedua bahasa.

### ACC-293 AI merespons sesuai bahasa
- **P0 · M6**
- **Perilaku**: agent menerima `uiLocale` (bahasa obrolan default) dan `siteLocale` (bahasa konten website). Agent membalas dalam bahasa yang dipakai user di prompt (fallback `uiLocale`), dan menulis konten website dalam `siteLocale` kecuali diminta lain. Detail di [04](./04-ai-agent.md).
- **Acceptance criteria**:
  - [ ] User EN membuat website untuk pasar Indonesia (siteLocale `id`) → chat EN, konten ID.

### ACC-294 Konten website multi-bahasa
- **P2 · M9**
- **Perilaku**: website user dengan beberapa bahasa (mis. `/en/...`), terjemahan per text node, language switcher component, hreflang. Lihat [02](./02-editor.md) (UI editor) & [07](./07-publishing-hosting.md) (routing & SEO). Tidak dibahas lebih jauh di sini; entitlement usulan: Pro+ (`site.multiLanguage`).

---

## 14. Legal & kepatuhan Indonesia

> ⚠️ Bagian ini **bukan nasihat hukum**. Semua butir bertanda "cek" harus dikonfirmasi dengan konsultan hukum/pajak sebelum rilis publik (M4) atau sebelum menerima pembayaran (M5).

### ACC-310 Badan usaha
- **P0 · sebelum M5**
- **Perilaku**: untuk menerima pembayaran via gateway sebagai merchant bisnis, menerbitkan invoice resmi, dan menandatangani perjanjian dengan provider, dibutuhkan badan usaha. Kandidat: **PT Perorangan** (untuk UMK, pendirian via OSS, 1 pendiri) atau **PT** biasa. Data badan usaha dipakai di invoice, S&K, kebijakan privasi, dan halaman kontak.
- **Acceptance criteria**:
  - [ ] Identitas badan usaha (nama, alamat, NIB, NPWP) tersedia sebagai konfigurasi (env/DB), bukan hardcode di template.

> ❓ OPEN: PT Perorangan vs PT; KBLI yang sesuai (cek).

### ACC-311 Pendaftaran PSE
- **P0 · sebelum M4** (cek)
- **Perilaku**: Platform kemungkinan tergolong **Penyelenggara Sistem Elektronik (PSE) Lingkup Privat** yang wajib mendaftar ke **Kementerian Komunikasi dan Digital** (via OSS). Pendaftaran membawa kewajiban: menyediakan kanal pengaduan, menindaklanjuti permintaan pemutusan akses konten terlarang dalam tenggat yang ditentukan, dan memberi akses data bila diwajibkan hukum.
- **Acceptance criteria**:
  - [ ] Checklist kepatuhan PSE dicek & didokumentasikan sebelum rilis publik.
  - [ ] Kanal pengaduan (ACC-244, ACC-248) sudah aktif.

> ❓ OPEN: Konfirmasi kewajiban PSE, kategori, dan tenggat takedown (cek regulasi terbaru).

### ACC-312 UU PDP (Pelindungan Data Pribadi)
- **P0 · M4**
- **Perilaku**:
  - **Peran**: untuk data akun platform (user), Platform = **pengendali data**. Untuk data pengunjung/pembeli/member website user, **pemilik website = pengendali**, Platform = **prosesor** (bertindak atas instruksi pemilik website). Hal ini dituangkan di S&K + **Data Processing Addendum (DPA)** sederhana yang disetujui pemilik website saat mengaktifkan fitur dinamis/commerce.
  - **Kebijakan Privasi** (`/legal/privacy`, ID & EN): data yang dikumpulkan, tujuan, dasar pemrosesan, pihak ketiga (subprocessor list: Cloudflare, provider email, payment gateway, Anthropic untuk AI, Sentry, penyedia DB), retensi, hak subjek data, kontak.
  - **Consent**: tercatat versi & waktu (tabel `consents`); consent marketing terpisah; banner cookie untuk `apps/web` hanya bila memakai cookie non-esensial (analytics pihak ketiga).
  - **Hak subjek data**: akses & portabilitas (ACC-011), koreksi (profil, ACC-008), penghapusan (ACC-010), penarikan consent (ACC-273), keberatan pemrosesan (via support). SLA respons permintaan: ≤ 3×24 jam pengakuan, penyelesaian sesuai ketentuan (cek).
  - **Permintaan dari end-user website**: Platform meneruskan ke pemilik website (sebagai pengendali); pemilik punya alat export/hapus record & member ([05](./05-dynamic-data.md)).
  - **Lokasi data**: ❓ OPEN — DB & storage di region terdekat (mis. Singapura) vs di Indonesia. Catat lokasi di kebijakan privasi; transfer lintas batas memerlukan dasar yang memadai (cek).
  - **Insiden kebocoran**: prosedur notifikasi ke subjek data & otoritas dalam tenggat yang diatur (cek; umumnya 3×24 jam) — runbook tertulis.
  - **Keamanan**: enkripsi in-transit (TLS), at-rest (DB managed), kredensial gateway user dienkripsi aplikasi (lihat [06](./06-commerce-payments.md)), akses staff dibatasi & diaudit.
  - **Retensi** (usulan): akun dihapus → purge 14 hari; invoice/payment 10 tahun (kewajiban dokumen pajak/perusahaan — cek); audit log 2 tahun; log akses server 90 hari; data moderasi abuse 2 tahun.
- **Acceptance criteria**:
  - [ ] Halaman privacy & subprocessor list publik sebelum M4.
  - [ ] DPA tercatat di `consents (type='dpa')` sebelum fitur dinamis/commerce aktif untuk workspace.
  - [ ] Runbook insiden ada di repo (`docs/runbooks/` — dibuat saat implementasi).

### ACC-313 Syarat & Ketentuan
- **P0 · M4**
- **Perilaku**: `/legal/terms` — layanan, akun, paket & pembayaran, perpanjangan & dunning, downgrade & retensi data, konten pengguna & tanggung jawab (pemilik website bertanggung jawab penuh atas konten, produk yang dijual, dan data pembeli/member mereka), AUP (ACC-240), hak Platform menangguhkan, batas tanggung jawab, perubahan layanan, hukum yang berlaku (Indonesia), penyelesaian sengketa. Versi tercatat; perubahan material → email ≥ 14 hari sebelumnya + penerimaan ulang saat login.
- **Acceptance criteria**:
  - [ ] Versi S&K baru memicu modal penerimaan ulang yang tercatat di `consents`.

### ACC-314 Kebijakan refund
- **P0 · M5**
- **Perilaku**: `/legal/refund`: usulan — refund penuh ≤ 7 hari sejak pembayaran pertama paket (bukan perpanjangan), bila pemakaian kredit AI < 20%; top-up kredit tidak bisa direfund setelah dipakai; tidak ada refund prorata untuk pembatalan di tengah periode; akun yang di-ban karena pelanggaran tidak berhak refund. Refund diproses ≤ 14 hari kerja.
- **Acceptance criteria**:
  - [ ] Kebijakan tertaut dari checkout & FAQ pricing.

> ❓ OPEN: Ketentuan refund final.

### ACC-315 Kebijakan konten & hak cipta
- **P1 · M4**
- **Perilaku**: `/legal/content` — konten terlarang (merujuk AUP), prosedur pengaduan hak cipta/merek (form + `legal@`), counter-notice, tindakan untuk pelanggar berulang. Aset library Platform (template, component, gambar stok) memiliki lisensi pemakaian di website user selama berlangganan/aktif; tidak boleh dijual ulang sebagai template.
- **Acceptance criteria**:
  - [ ] Lisensi gambar stok di library tercatat per aset ([03](./03-components-templates.md)).

### ACC-316 Halaman legal untuk website user
- **P1 · M7**
- **Perilaku**: generator template kebijakan privasi & S&K sederhana untuk website user (terutama yang punya form/commerce/member), diisi dari info bisnis — dengan disclaimer bahwa pemilik website bertanggung jawab menyesuaikan.
- **Acceptance criteria**:
  - [ ] Checklist publish site dinamis menyarankan halaman privasi bila ada form yang mengumpulkan PII.

---

## 15. Support

### ACC-330 Help center / docs
- **P0 · M4**
- **Perilaku**: `platformmu.com/bantuan` (ID) & `/help` (EN): artikel memulai, editor, publish & domain (panduan DNS per registrar populer di Indonesia), paket & pembayaran, AI, data dinamis, toko online, keamanan akun. Sumber: MDX di repo (`apps/web/content/help/{id,en}`), pencarian sisi klien. Editor & dashboard memiliki tombol "?" kontekstual yang membuka artikel terkait.
- **Acceptance criteria**:
  - [ ] Setiap error kode yang terlihat user (`PLAN_LIMIT_REACHED`, `DOMAIN_VERIFICATION_FAILED`, …) punya tautan artikel.

### ACC-331 Kanal support per paket
- **P1 · M5**
- **Perilaku**: Free → help center + komunitas (grup/forum, OPEN); Starter → email/tiket; Pro → email + live chat (widget pihak ketiga atau sederhana); Business → prioritas + WhatsApp. Form kontak di dashboard otomatis melampirkan konteks (workspaceId, plan, siteId, browser) — tanpa data sensitif.
- **Acceptance criteria**:
  - [ ] Tiket dari dashboard memuat plan & ID untuk triase.

> ❓ OPEN: Tool helpdesk/live chat; jam support; apakah WA support untuk Pro juga; komunitas (Telegram/WA group/forum).

### ACC-332 AI support assistant
- **P2 · M9**
- **Perilaku**: chatbot bantuan berbasis help center (RAG) sebelum eskalasi ke manusia; tidak memotong kredit AI user.

### ACC-333 Status page
- **P1 · M4**
- **Perilaku**: `status.platformmu.com` (layanan pihak ketiga atau halaman statis) dengan komponen: Dashboard & Editor, Publish, Website live (site-host), AI, Pembayaran. Insiden diumumkan juga via announcement banner (ACC-211).
- **Acceptance criteria**:
  - [ ] Health check eksternal memantau `api /health`, site-host, dan satu site contoh.

---

## 16. Analytics produk internal

### ACC-350 Event tracking
- **P0 · M4**
- **Perilaku**:
  - Event server-side (sumber kebenaran) ditulis ke tabel `product_events` (atau tool analytics self-host seperti PostHog self-hosted, OPEN) via helper `track(event, props, ctx)`; event client-side terbatas untuk interaksi UI (tur, klik CTA).
  - Event inti (nama `object.action`, snake_case properti):

| Event | Properti utama |
|---|---|
| `user.signed_up` | method (`email`/`google`), locale, utm_* |
| `user.email_verified` | hours_since_signup |
| `onboarding.completed` / `onboarding.skipped` | step, business_category, goals |
| `site.created` | source (`template`/`blank`/`ai`/`duplicate`), template_id |
| `site.published` | is_first_publish, minutes_since_signup, page_count, plan |
| `site.publish_failed` | error_code |
| `ai.run_completed` | skill, credits_used, duration_ms, success, plan |
| `paywall.viewed` | limit_key / feature_key, plan |
| `billing.checkout_started` / `billing.subscription_activated` | plan, interval, coupon, amount |
| `billing.subscription_canceled` / `billing.downgraded` | reason, plan_from, plan_to |
| `domain.connected` | type (`named_subdomain`/`custom`) |
| `team.member_invited` / `team.member_joined` | role |

  - Event memakai `user_id`/`workspace_id` internal (pseudonim), **tanpa** email, nama, konten website, atau PII pengunjung website user.
- **Acceptance criteria**:
  - [ ] Registry event berskema Zod; event tak terdaftar ditolak di dev.

### ACC-351 Funnel aktivasi & retensi
- **P1 · M5**
- **Perilaku**: funnel: signup → email verified → site created → first publish (≤ 24 jam = "activated") → kembali edit di minggu kedua → upgrade. Kohort retensi mingguan (user yang melakukan edit/publish). Ditampilkan di `/admin` (ACC-214) atau tool analytics.
- **Acceptance criteria**:
  - [ ] Metrik "time to first publish" (median) tersedia per minggu.

### ACC-352 Privasi analytics
- **P0 · M4**
- **Perilaku**: analytics produk mengikuti kebijakan privasi; user dapat opt-out tracking non-esensial di Pengaturan; IP tidak disimpan mentah di event (hanya negara/kota kasar); retensi event mentah 13 bulan. Analytics **pengunjung website user** (fitur produk, §6.2.1) adalah sistem terpisah, cookieless/privacy-friendly — lihat [07](./07-publishing-hosting.md).
- **Acceptance criteria**:
  - [ ] Tidak ada script analytics pihak ketiga di website publish user kecuali dipasang pemilik (GA4/Pixel di paket yang mengizinkan).

---

## 17. Skema data

Konvensi: PK mengikuti [ARCHITECTURE §6](../ARCHITECTURE.md#6-data-architecture) (UUIDv7; `bigint identity` untuk tabel append-only bervolume tinggi seperti `credit_ledger`, `audit_logs`) — prefix `usr_…`/`ws_…` di dokumen ini hanya ilustrasi; semua tabel punya `created_at timestamptz default now()`, `updated_at` bila mutable. Drizzle schema di `packages/db/src/schema/*.ts` (`@platform/db`, satu-satunya lokasi schema). Nama tabel mengikuti ARCHITECTURE §6.3. Kolom yang ditandai *(BA)* mengikuti kebutuhan Better Auth.

### ACC-370 Skema inti akun & workspace
- **P0 · M1**

**`users`**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | *(BA)* — UUIDv7 lewat `generateId` Better Auth (ARCHITECTURE §6.1; diputuskan T1.3.2) |
| name | text | *(BA)* |
| email | text unique | lowercase *(BA)* |
| email_verified | boolean | *(BA)* |
| image | text null | avatar URL *(BA)* |
| locale | text | `id` \| `en` |
| timezone | text | IANA, default `Asia/Jakarta` |
| phone_e164 | text null | ACC-257 |
| phone_verified_at | timestamptz null | |
| status | text | `active`/`pending_deletion`/`suspended`/`banned` |
| staff_role | text null | `super_admin`/`staff`/`library_admin`/`designer` (ACC §10.1) |
| two_factor_enabled | boolean | *(BA plugin)* |
| risk_score | int default 0 | ACC-255 |
| signup_meta | jsonb | ip_country, asn, ua_hash, utm |
| email_bouncing | boolean default false | |
| deletion_requested_at | timestamptz null | |
| last_active_at | timestamptz null | |

**`sessions`** *(BA)*: `id`, `user_id` FK, `token` (hash) unique, `expires_at`, `ip_address`, `user_agent`, `geo` jsonb, `last_active_at`, `impersonated_by` (FK users null), `impersonation_reason` text null, `impersonation_write` boolean.

**`accounts`** (OAuth & credential, *BA*): `id`, `user_id` FK, `provider_id` (`credential`/`google`), `account_id`, `password` (hash, untuk credential), `access_token`/`refresh_token` (terenkripsi, null bila tak perlu), `scope`, unique `(provider_id, account_id)`.

**`verifications`** *(BA)*: `id`, `identifier`, `value` (hash token), `expires_at` — untuk verifikasi email, reset password, ganti email.

**`two_factors`** *(BA plugin)*: `user_id`, `secret` (terenkripsi), `backup_codes` (hash).

**`consents`**: `id`, `user_id` FK null, `workspace_id` null, `type` (`terms`/`privacy`/`marketing`/`dpa`/`aup`), `version`, `granted` boolean, `ip`, `user_agent`, `created_at`.

**`user_onboarding`**: `user_id` PK, `answers` jsonb, `tour_completed_at`, `checklist_dismissed_at`.

**`workspaces`**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | UUIDv7 (diputuskan T1.3.3); `ws_…` adalah **slug** untuk URL (ACC-030), bukan PK |
| type | text | `personal` \| `team` |
| name, slug | text | slug unique |
| logo_url | text null | |
| owner_user_id | text FK | denormalisasi untuk query cepat |
| balance_idr | bigint default 0 | ACC-175 |
| billing_profile | jsonb | nama/perusahaan, NPWP, alamat, email tagihan |
| status | text | `active`/`read_only`/`suspended`/`deleted` |
| deleted_at | timestamptz null | |

Unique parsial: satu `personal` per `owner_user_id`.

**`workspace_members`**: `workspace_id` FK, `user_id` FK, `role` (`owner`/`admin`/`editor`/`viewer`/`billing`), `invited_by`, `joined_at`; PK `(workspace_id, user_id)`; unique parsial `(workspace_id) WHERE role='owner'`.

**`workspace_invitations`**: `id`, `workspace_id`, `email`, `role`, `token_hash` unique, `invited_by`, `status` (`pending`/`accepted`/`revoked`/`expired`), `expires_at`, `accepted_user_id`.

**`site_transfers`** (ACC-035): `id`, `site_id`, `from_workspace_id`, `to_workspace_id` null, `to_email`, `status`, `expires_at`, `conflicts` jsonb.

> Tabel `sites` didefinisikan di [ARCHITECTURE](../ARCHITECTURE.md)/[07](./07-publishing-hosting.md); kolom terkait dokumen ini: `workspace_id`, `created_by`, `archived_at`, `deleted_at`, `purge_after`, `frozen_at`, `frozen_reason` (`plan`/`moderation`), `moderation_status` (`ok`/`held`/`suspended`), `risk_score`.

### ACC-371 Skema paket, billing & kuota
- **P0 · M4 (plans, usage, overrides) / M5 (billing) / M6 (credit_ledger)**

**`plans`**: `id`, `code` (`free`/`starter`/`pro`/`business`), `version` int, `name` jsonb `{id,en}`, `limits` jsonb (`Entitlements`), `is_public` bool, `sort`, unique `(code, version)`.

**`plan_prices`**: `id`, `plan_id` FK, `interval` (`month`/`year`), `currency` (`IDR`), `amount` bigint, `active`, `valid_from`.

**`addon_products`**: `id`, `sku`, `type` (`ai_credits`/`seat`/`storage`/`sites`/`wa`), `quantity`, `amount`, `validity_days`, `recurring` bool, `active`.

**`subscriptions`**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | text PK | |
| workspace_id | text FK | unique parsial untuk status aktif |
| plan_id / plan_version | FK / int | |
| price_id | FK plan_prices | harga terkunci |
| interval | text | `month`/`year` |
| status | text | `active`/`past_due`/`canceled`/`expired`/`suspended` |
| source | text | `checkout`/`manual`/`coupon` |
| current_period_start / current_period_end | timestamptz | |
| cancel_at_period_end | boolean | |
| cancel_reason | jsonb null | |
| scheduled_plan_id | FK null | downgrade terjadwal |
| grace_ends_at | timestamptz null | |
| provider / provider_subscription_ref | text null | recurring P1 |

**`subscription_addons`**: `id`, `subscription_id`, `addon_product_id`, `quantity`, `status`, `period_end`.

**`invoices`**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | text PK | |
| number | text unique null | diisi saat finalisasi `INV/YYYY/MM/NNNNNN` |
| workspace_id | FK null | null setelah akun di-purge |
| subscription_id | FK null | |
| type | text | `subscription_new`/`subscription_renewal`/`subscription_upgrade`/`one_time`/`manual` |
| status | text | `draft`/`open`/`paid`/`void`/`uncollectible` |
| currency | text | `IDR` |
| lines | jsonb | `[{ description:{id,en}, quantity, unitAmount, amount, kind }]` |
| subtotal, discount, balance_applied, tax_rate, tax_amount, total | bigint/numeric | |
| coupon_id | FK null | |
| customer_snapshot | jsonb | nama, email, perusahaan, NPWP, alamat saat terbit |
| due_at, paid_at | timestamptz | |
| period_start, period_end | timestamptz null | |
| pdf_key | text null | R2 key |

**`billing_payments`** (pembayaran langganan platform; **bukan** tabel `payments` commerce di [06](./06-commerce-payments.md)/ARCHITECTURE): `id`, `invoice_id` FK, `provider` (`midtrans`/`xendit`/`manual`), `provider_ref`, `provider_event_id` (unique bersama provider), `method` (`qris`/`va_bca`/`ewallet_dana`/`card`/…), `amount`, `status` (`pending`/`paid`/`failed`/`expired`/`refunded`), `failure_reason`, `payment_url`, `expires_at`, `raw` jsonb (tanpa data kartu), `paid_at`.

**`refunds`**: `id`, `billing_payment_id`, `amount`, `method` (`provider`/`bank_transfer`), `reason`, `proof_key`, `staff_user_id`, `provider_ref`, `status`.

**`coupons`** / **`coupon_redemptions`**: lihat ACC-111.

**`usage_counters`**: `workspace_id`, `key`, `period_id`, `value` bigint, `updated_at`; PK `(workspace_id, key, period_id)`.

**`entitlement_overrides`**: `id`, `workspace_id`, `key` (path, mis. `sites.max`), `value` jsonb, `reason`, `expires_at` null, `created_by` (staff), `revoked_at`.

**`credit_ledger`**: `id`, `workspace_id`, `user_id` null, `delta` int, `bucket` (`trial`/`monthly`/`topup`/`bonus`/`override`), `reason` (`grant`/`consume`/`reserve`/`release`/`expire`/`refund`/`adjust`), `ref_type`, `ref_id`, `period_id` null, `expires_at` null, `created_at`; index `(workspace_id, bucket, expires_at)`.

**`trial_grants`**: `email_hash` PK, `phone_hash` null, `granted_at` (ACC-094).

### ACC-372 Skema admin, moderasi, notifikasi
- **P0 · M4**

**`audit_logs`** (append-only): `id`, `actor_type` (`user`/`staff`/`system`), `actor_id`, `impersonator_id` null, `workspace_id` null, `action` (mis. `site.suspend`, `entitlement.override.create`), `target_type`, `target_id`, `before` jsonb, `after` jsonb, `reason`, `ip`, `user_agent`, `created_at`; index `(target_type, target_id)`, `(actor_id, created_at)`.

**`moderation_rules`**: `id`, `category`, `type` (`keyword`/`regex`/`domain`/`pattern`), `value`, `weight`, `locale`, `active`, `updated_by`.

**`moderation_reports`**: `id`, `site_id`, `hostname`, `source` (`auto`/`ai`/`public`/`safe_browsing`/`authority`/`legal`/`staff`), `category`, `priority` (`critical`/`high`/`normal`), `score`, `signals` jsonb (rule hits, AI result, screenshot key), `reporter_email` null, `description`, `status` (`open`/`in_review`/`actioned`/`dismissed`), `assigned_to` null, `dedupe_key`, `report_count`, `sla_due_at`, `resolved_at`.

**`moderation_actions`**: `id`, `report_id` null, `target_type` (`site`/`user`/`workspace`), `target_id`, `action` (`dismiss`/`warning`/`unpublish_site`/`suspend_site`/`suspend_account`/`ban_account`/`restore`), `policy_ref` (pasal AUP), `reason`, `message_to_user`, `staff_user_id`, `expires_at` null, `created_at`.

**`moderation_appeals`**: `id`, `action_id`, `user_id`, `message`, `attachments` jsonb, `status` (`open`/`upheld`/`overturned`), `reviewer_id`, `decided_at`.

**`notifications`**: `id`, `user_id`, `workspace_id` null, `type`, `channel` (`in_app`/`email`), `payload` jsonb, `read_at` null, `provider_message_id` null, `delivery_status` null, `created_at`; index `(user_id, read_at, created_at)`.

**`notification_preferences`**: `user_id`, `type`, `channel`, `enabled`; PK `(user_id, type, channel)`.

**`feature_flags`**: `key` PK, `description`, `enabled`, `rollout_percent` int, `allow_workspace_ids` text[], `allow_user_ids` text[], `deny_workspace_ids` text[], `updated_by`, `updated_at`.

**`announcements`**: `id`, `title` jsonb, `body` jsonb, `level`, `target` jsonb, `dismissible`, `starts_at`, `ends_at`, `created_by`. **`announcement_dismissals`**: `(announcement_id, user_id)`.

**`product_events`** (bila tidak memakai tool eksternal): `id`, `name`, `user_id`, `workspace_id`, `props` jsonb, `occurred_at` — partisi bulanan.

- **Acceptance criteria (ACC-370..372)**:
  - [ ] Semua tabel didefinisikan di Drizzle + migrasi drizzle-kit; Zod schema turunan via drizzle-zod untuk validasi API.
  - [ ] FK `ON DELETE` dipilih eksplisit: data finansial & audit `SET NULL`, data milik workspace `CASCADE` hanya lewat job purge (bukan delete langsung).

---

## 18. Ringkasan API

Semua di `apps/api`, prefix `/api`. Auth Better Auth di `/api/auth/*`. Modul: `auth`, `users`, `workspaces`, `invitations`, `entitlements`, `usage`, `billing`, `credits`, `notifications`, `moderation`, `admin`, `flags`, `analytics`.

| Method & path | Deskripsi | Permission |
|---|---|---|
| `GET /me` | profil, locale, flags, workspaces | login |
| `PATCH /me` | ubah profil/locale/timezone | login |
| `POST /me/export` · `DELETE /me` · `POST /me/deletion/cancel` | ACC-011, ACC-010 | login + re-auth |
| `GET /me/sessions` · `DELETE /me/sessions/:id` | ACC-007 | login |
| `GET /workspaces` · `POST /workspaces` | daftar / buat team | login / Business |
| `GET /workspaces/:id/me` | role & permissions saya | member |
| `GET/POST/PATCH/DELETE /workspaces/:id/members…` | ACC-034 | `members.*` |
| `POST /workspaces/:id/invitations` · `POST /invitations/:token/accept` | ACC-032 | `members.manage` |
| `POST /workspaces/:id/transfer-ownership` | ACC-036 | `workspace.transfer` |
| `GET /workspaces/:id/entitlements` | ResolvedEntitlements | member |
| `GET /workspaces/:id/usage` | usage meter | `billing.read` atau member (ringkas) |
| `GET /workspaces/:id/billing` | ringkasan billing | `billing.read` |
| `POST /workspaces/:id/billing/checkout` | ACC-161/162, top-up | `billing.manage` |
| `POST /workspaces/:id/billing/preview-change` | pratinjau upgrade/downgrade + dampak | `billing.manage` |
| `POST /workspaces/:id/billing/cancel` · `/resume` | ACC-164 | `billing.cancel` |
| `GET /workspaces/:id/invoices` · `GET /invoices/:id/pdf` | ACC-165 | `billing.read` |
| `GET /workspaces/:id/credits` · `/credits/history` | ACC-150/151 | member |
| `POST /webhooks/billing/:provider` | webhook gateway langganan | signature |
| `GET /notifications` · `POST /notifications/read` · `GET/PUT /notification-preferences` | §12 | login |
| `POST /public/reports` | "Laporkan situs" | publik + Turnstile |
| `POST /moderation/appeals` | ACC-247 | login / publik (banned) |
| `/admin/*` | users, workspaces, sites, impersonate, overrides, plans, prices, coupons, invoices, refunds, library, moderation, flags, announcements, health, audit | staff/super_admin |

Error envelope seragam (`{ error: { code, message, ... } }`) — kode di dokumen ini: `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `PLAN_LIMIT_REACHED` (semua batas angka: site, seat, storage, kuota bulanan — dibedakan `details.key`), `PLAN_FEATURE_REQUIRED` (fitur tidak ada di paket — `details.feature`), `INSUFFICIENT_CREDITS`, `IMPERSONATION_READ_ONLY`, `RATE_LIMITED`, `PAYMENT_PENDING`, `HELD_FOR_REVIEW`.

---

## 19. Fase & urutan implementasi

| Fase | Cakupan dokumen ini | Requirement utama |
|---|---|---|
| **M1 – Fondasi** | Akun & personal workspace, Better Auth, register/login/Google, verifikasi email, reset password, sesi, profil, locale/timezone, `packages/i18n` + format, email transaksional dasar, layer `can()` & skema inti, dashboard daftar site + buat blank | ACC-001..005, 007..009, 030, 033 (layer), 050, 051 (blank), 271, 290, 291, 370 |
| **M3 – Component** | Konten library dwibahasa, library management dasar | ACC-292, 208 |
| **M4 – Rilis publik (statis)** | Paket **Free**, entitlements service & metering dasar, usage meter, onboarding & checklist, duplikat/arsip/sampah, hapus akun & export (UU PDP), status akun, **moderasi dasar** (AUP, scan keyword, laporan publik, antrean, tindakan, banding, rate limit, verifikasi wajib), **admin panel dasar** (users, workspaces, sites, impersonate, overrides, flags, audit, 2FA staff), notifikasi in-app & preferensi, legal (privacy, terms, AUP, PSE cek), help center, event tracking | ACC-006 (staff), 010..012, 051..058, 070..074, 090, 130..136, 200..205, 208..213, 240..241, 244..248, 255..256, 270, 272..273, 311..313, 330, 350, 352, 371 (plans/usage), 372 |
| **M5 – Billing** | **Starter & Pro**, pricing page, harga sebagai data, checkout, upgrade/downgrade/cancel, invoice & PDF, renewal manual + dunning, downgrade otomatis & dampak, reaktivasi, refund manual, saldo, kupon (P1), grace kuota, bandwidth meter, 2FA user, transfer site antar personal, Safe Browsing (P1), verifikasi HP (P1), badan usaha & refund policy, support per paket | ACC-006, 035 (personal), 075, 091..093, 110..111, 137..138, 160..175, 206..207, 214, 243, 257..258, 310, 314, 331, 351, 371 (billing) |
| **M6 – AI** | Kredit AI, ledger, trial, top-up, tampilan kredit, AI classifier moderasi, AI sesuai bahasa | ACC-094, 150..152, 242, 293 |
| **M7 – Dinamis** | Entitlements dinamis aktif, DPA, generator halaman legal user | ACC-312 (DPA), 316 |
| **M8 – Commerce** | Entitlements commerce aktif (aturan "jangan blok checkout") | ACC-135 (commerce) |
| **M9 – Business/Tim** | Team workspace, invite, role & permission matrix penuh, kelola anggota, transfer ownership & site, hapus workspace, seat add-on, referral, multi-bahasa site, faktur pajak, AI support | ACC-031..037, 112, 166, 294, 332 |

Urutan kerja yang disarankan untuk AI coding agent dalam satu fase: **skema (Drizzle) → service + unit test → route + permission/entitlement guard → UI → e2e test**.

---

## 20. Daftar OPEN

| # | Topik | Bagian |
|---|---|---|
| 1 | ~~Better Auth dipertahankan atau diganti~~ — **diputuskan 2026-10-13: dipertahankan** | §2 |
| 2 | Provider OAuth tambahan (Apple/Facebook/Microsoft) | ACC-002 |
| 3 | Passkey/WebAuthn; 2FA via WA | ACC-006 |
| 4 | Trial Business 14 hari tanpa kartu | ACC-031 |
| 5 | `viewer` & `billing` memakai seat atau gratis | ACC-032 |
| 6 | Order & data pembeli ikut saat transfer site (implikasi PDP) | ACC-035 |
| 7 | Site arsip dihitung storage | ACC-053 |
| 8 | Email "lanjutkan website" = transaksional atau marketing | ACC-075 |
| 9 | Semua angka batas paket (usulan awal §6.2) | §6 |
| 10 | Starter boleh hapus badge | §6.2.1 |
| 11 | Starter mendapat AI (usulan 100 kredit + form saja) | §6.2.3 |
| 12 | Form kontak di Free vs prinsip "dinamis hanya paket AI" | §6.2.4 |
| 13 | Fee transaksi platform untuk commerce (usulan 0%) | §6.2.5 |
| 14 | Provider & kuota WhatsApp | §6.2.6 |
| 15 | Besar & masa berlaku AI trial | ACC-094 |
| 16 | **Harga final semua paket**, diskon tahunan, early bird | §7.4 |
| 17 | PPN: termasuk/tidak, status PKP | §7.5, ACC-166 |
| 18 | Harga add-on | §7.6 |
| 19 | Gateway langganan Midtrans vs Xendit; recurring/auto-debit | §9.1, ACC-168 |
| 20 | Proration: kredit sisa linear vs perpanjangan periode | ACC-162 |
| 21 | Retensi data frozen setelah downgrade (usulan 180 hari) | ACC-172 |
| 22 | Kriteria refund (usulan 7 hari, < 20% kredit) | ACC-174, ACC-314 |
| 23 | Lisensi Safe Browsing vs Web Risk API | ACC-243 |
| 24 | SLA moderasi & kanal notifikasi staff | ACC-245 |
| 25 | Provider OTP & kapan verifikasi HP wajib | ACC-257 |
| 26 | PT Perorangan vs PT, KBLI | ACC-310 |
| 27 | Kewajiban & tenggat PSE (cek regulasi) | ACC-311, ACC-248 |
| 28 | Lokasi data (Indonesia vs Singapura) & transfer lintas batas | ACC-312 |
| 29 | Tool helpdesk/live chat, jam support, komunitas | ACC-331 |
| 30 | Tool analytics produk (tabel sendiri vs PostHog self-host) | ACC-350 |
| 31 | Item premium setelah downgrade: kunci props atau hanya kunci instance baru | ACC-093 |
