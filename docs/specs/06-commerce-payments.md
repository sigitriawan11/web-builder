# 06 — Commerce & Payments

> **Status:** Draft v0.1 · **Prefix requirement:** `COM-` · **Fase utama:** M8 (dengan "Order via WhatsApp" lebih awal di M7)
> **Pembaca:** owner (solo developer) & AI coding agent (Claude Code).
> **Dokumen terkait:** [Document Model](./01-document-model.md) · [Components & Templates](./03-components-templates.md) · [AI Agent](./04-ai-agent.md) · [Dynamic Data](./05-dynamic-data.md) · [Publishing & Hosting](./07-publishing-hosting.md) · [Accounts, Plans & Admin](./08-accounts-plans-admin.md) · [Architecture](../ARCHITECTURE.md)

Dokumen ini mendefinisikan kemampuan **e-commerce** untuk website milik user Platform: katalog produk, keranjang, checkout, pembayaran lewat **payment gateway milik user sendiri**, manajemen pesanan, akun pembeli, component commerce, peran AI, paket, keamanan, dan skema data.

Istilah yang dipakai:

| Istilah | Arti |
|---|---|
| **Owner** / **merchant** | User Platform yang memiliki website toko (mis. Bu Sari, pemilik toko kue). |
| **Pembeli** / **buyer** | Pengunjung website toko yang membeli produk. Bisa guest atau member (end-user auth, lihat [05](./05-dynamic-data.md)). |
| **Gateway** / **provider** | Payment gateway pihak ketiga (kandidat: Midtrans, Xendit) tempat owner punya akun merchant sendiri. |
| **BYOG** | *Bring Your Own Gateway* — owner menghubungkan akun gateway miliknya; dana langsung masuk ke akun owner. |
| **Site** | Satu website (project) milik owner. Semua data commerce di-scope per `site_id`. |
| **Runtime API** | Endpoint publik `apps/api` yang dipanggil islands di website publish (lihat [07](./07-publishing-hosting.md)). |
| **Minor unit** | Satuan uang terkecil. Untuk IDR = rupiah utuh (tanpa desimal). Semua harga disimpan sebagai integer. |

---

## 1. Tujuan, ruang lingkup, dan prinsip

### 1.1 Tujuan

1. UMKM Indonesia bisa membuka toko online di website Platform **tanpa menulis kode** dan **tanpa backend sendiri**.
2. Dana penjualan **langsung masuk ke akun payment gateway milik owner**, bukan ke rekening Platform.
3. Untuk UMKM yang belum punya gateway, tersedia jalur ringan: **Order via WhatsApp**, **transfer manual + upload bukti**, dan **COD**.
4. AI (lihat [04](./04-ai-agent.md)) bisa menyiapkan toko dari prompt — tanpa pernah menyentuh kredensial pembayaran.

### 1.2 Di dalam scope

- Katalog produk + varian + stok, kategori/koleksi.
- Keranjang (guest & member), checkout, ongkir sederhana, voucher (P1).
- Integrasi gateway via adapter `PaymentProvider` (Midtrans, Xendit — kandidat), metode offline (manual transfer, COD), Order via WhatsApp.
- Konfigurasi pembayaran oleh owner (Settings > Payments), penyimpanan kredensial terenkripsi.
- Webhook pembayaran, state machine order, notifikasi via workflow ([05](./05-dynamic-data.md)).
- Dashboard order & penjualan untuk owner, akun pembeli (riwayat pesanan).
- Component commerce di library ([03](./03-components-templates.md)).

### 1.3 Di luar scope (sekarang)

- Platform sebagai aggregator/marketplace yang menampung dana (P2, lihat §2.4).
- Multi-mata uang, multi-bahasa katalog (P2), marketplace multi-vendor dalam satu site.
- Langganan berulang (subscription billing) untuk produk milik owner (P2).
- POS offline, sinkronisasi ke marketplace eksternal (P2+).
- Menyimpan data kartu (TIDAK PERNAH — lihat §15).

### 1.4 Prinsip desain

| # | Prinsip | Konsekuensi |
|---|---|---|
| P1 | **Platform tidak memegang dana** | Tidak ada saldo, escrow, atau payout di Platform. Platform hanya mengorkestrasi order & memanggil API gateway atas nama owner. |
| P2 | **Server adalah sumber kebenaran harga** | Harga, stok, ongkir, diskon selalu dihitung ulang di server. Nilai dari client hanya "hint". |
| P3 | **Status pembayaran hanya dari gateway** | Order berubah ke `paid` hanya dari webhook terverifikasi atau polling `getStatus` ke gateway — tidak pernah dari redirect browser. |
| P4 | **Kredensial tidak pernah keluar dari vault** | Tidak dikirim ke browser, AI, log, Sentry, export, atau email. |
| P5 | **Idempotent di semua titik** | Webhook, pembuatan order, pembuatan pembayaran, dan transisi status aman dipanggil ulang. |
| P6 | **Adapter, bukan hard-code** | Logika gateway terisolasi di `packages/payments/providers/*`; core commerce tidak tahu detail provider. |
| P7 | **Tidak mengklaim detail gateway tanpa verifikasi** | Semua detail API/fitur/harga gateway di dokumen ini = kandidat; wajib dicek ke dokumentasi resmi sebelum implementasi. |

---

## 2. Model bisnis: Bring Your Own Gateway (BYOG)

### COM-001 Model BYOG sebagai default
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Setiap site yang berjualan menghubungkan akun gateway **milik owner** (owner sendiri yang mendaftar, menjalani KYC/verifikasi merchant, dan menandatangani perjanjian dengan gateway). Platform menyimpan kredensial API owner (terenkripsi) dan memanggil API gateway atas nama owner. Dana dari pembeli mengalir: **pembeli → gateway → akun merchant owner → rekening bank owner** (sesuai jadwal settlement gateway). Platform tidak berada di jalur dana.
- **Alasan:**
  1. **Regulasi:** menampung dan menyalurkan dana pihak lain berpotensi masuk kategori penyelenggara jasa pembayaran (PJP) yang diatur Bank Indonesia dan memerlukan izin. Dengan BYOG, Platform hanya penyedia perangkat lunak. *(Interpretasi hukum final = OPEN, konsultasikan ke konsultan hukum.)*
  2. **Risiko finansial:** Platform tidak menanggung chargeback, fraud, refund, atau rekonsiliasi dana.
  3. **Operasional solo developer:** tidak perlu tim finance, payout, atau CS dana.
  4. **Kepercayaan owner:** dana langsung ke owner, settlement mengikuti kontrak owner dengan gateway.
- **Tanggung jawab owner (ditampilkan di UI & syarat layanan):** pendaftaran & KYC di gateway, biaya transaksi gateway (MDR/fee), pajak usaha, pengiriman barang, refund, layanan pelanggan, kepatuhan produk legal.
- **Tanggung jawab Platform:** keamanan penyimpanan kredensial, keandalan webhook & order, UI toko, notifikasi, uptime runtime API.
- **Acceptance criteria:**
  - [ ] Tidak ada tabel/kolom "saldo", "payout", atau "wallet" milik owner di skema Platform.
  - [ ] Semua panggilan pembayaran memakai kredensial dari `payment_gateway_configs` milik site tersebut, tidak pernah kredensial Platform.
  - [ ] Halaman Settings > Payments menampilkan teks tanggung jawab owner dan tautan ke ketentuan commerce.
  - [ ] Kredensial gateway Platform (untuk langganan paket, lihat [08](./08-accounts-plans-admin.md)) disimpan terpisah dan tidak bisa dipakai untuk checkout site user.

> ❓ OPEN: Konfirmasi hukum bahwa model BYOG (software-only, tanpa menampung dana) tidak mewajibkan izin PJP untuk Platform. Termasuk posisi "Platform memanggil API atas nama merchant".

### COM-002 Jalur tanpa gateway (offline methods)
- **Prioritas:** P0 · **Fase:** M8 (Order via WhatsApp: M7, lihat COM-003)
- **Deskripsi:** Owner yang belum punya akun gateway tetap bisa berjualan dengan metode:
  - `manual_transfer`: pembeli transfer ke rekening yang diisi owner, upload bukti, owner konfirmasi manual.
  - `cod`: bayar di tempat; order langsung `processing` setelah owner menerima, status `paid` di-set owner saat uang diterima.
  - `whatsapp_order`: tidak ada checkout di website; keranjang dikirim sebagai pesan WhatsApp ke nomor owner (COM-003).
- **Acceptance criteria:**
  - [ ] Owner dapat mengaktifkan kombinasi metode online (gateway) + offline secara bersamaan.
  - [ ] Checkout menampilkan hanya metode yang aktif dan valid (gateway dengan status `connected`).
  - [ ] Site tanpa metode aktif sama sekali tidak menampilkan tombol checkout; component cart menampilkan pesan "Toko belum menerima pembayaran" di editor (dan tombol disembunyikan di website publish).

### COM-003 Order via WhatsApp (commerce ringan)
- **Prioritas:** P0 · **Fase:** **M7** (rekomendasi: dirilis lebih awal dari commerce penuh)
- **Deskripsi:** Mode toko paling sederhana untuk UMKM: katalog produk + keranjang lokal (browser) → tombol "Pesan via WhatsApp" membuka `https://wa.me/<nomor>?text=<pesan ter-encode>` berisi daftar item, jumlah, harga, total, dan data pembeli opsional (nama, alamat). Tidak ada pembayaran online, tidak ada kredensial.
- **Mengapa M7:** banyak UMKM Indonesia sudah bertransaksi lewat WhatsApp; fitur ini memberi nilai jualan cepat, memvalidasi katalog/produk/cart component, dan tidak memerlukan webhook/kredensial. Fondasinya (tabel `products`, component product card, cart lokal) dipakai ulang di M8.
- **Perilaku:**
  - Owner mengisi `whatsappNumber` (format E.164, mis. `+6281234567890`) dan template pesan di Settings > Commerce.
  - Template default (bisa diedit, dengan placeholder):
    ```text
    Halo {{storeName}}, saya mau pesan:
    {{#each items}}- {{name}}{{#if variant}} ({{variant}}){{/if}} x{{qty}} = {{lineTotal}}
    {{/each}}Total: {{total}}
    Nama: {{buyerName}}
    Alamat: {{buyerAddress}}
    ```
  - Opsional (P1): sebelum membuka WA, buat `orders` dengan `payment_method = 'whatsapp_order'` & status `pending_payment` agar owner punya catatan; nomor order disisipkan di pesan (`Order #TK-1042`).
  - Harga di pesan dihitung ulang di server bila opsi "catat order" aktif; bila tidak, dihitung di client dari data publish (risiko manipulasi diterima karena owner memverifikasi manual di chat).
- **Acceptance criteria:**
  - [ ] Tombol "Pesan via WhatsApp" menghasilkan URL `wa.me` valid, pesan ter-encode (`encodeURIComponent`), panjang pesan dipotong aman (≤ ~2000 karakter; bila lebih, ringkas item).
  - [ ] Berfungsi di website statis (paket yang mengizinkan, lihat §14) tanpa runtime API bila opsi "catat order" mati.
  - [ ] Nomor WA divalidasi format Indonesia/E.164 di Settings.
  - [ ] Saat upgrade ke commerce penuh (M8), produk & cart yang sama dipakai tanpa migrasi data manual.

> ❓ OPEN: Apakah Order via WhatsApp (tanpa pencatatan order) tersedia di paket Free/Starter sebagai fitur statis? Usulan awal dokumen ini: **Starter ke atas**; namun [08 §6.2.5](./08-accounts-plans-admin.md) (sumber kebenaran) sudah memberi Free katalog statis + tombol "Pesan via WhatsApp" (10 produk, tanpa keranjang/pencatatan order). Keranjang + pencatatan order mengikuti keputusan 08.

### COM-004 Alternatif masa depan: Platform sebagai aggregator/marketplace
- **Prioritas:** P2 · **Fase:** M9+
- **Deskripsi:** Opsi di mana Platform memakai akun gateway sendiri dengan fitur sub-merchant / split payment / platform account (bila tersedia di gateway) sehingga owner tidak perlu KYC sendiri ke gateway dan Platform bisa mengambil fee otomatis. **Risiko:** regulasi (izin PJP/kerja sama resmi dengan gateway), tanggung jawab KYC sub-merchant, chargeback, dukungan CS dana, pajak atas fee.
- **Acceptance criteria:**
  - [ ] Tidak diimplementasikan sebelum ada keputusan hukum & bisnis tertulis.
  - [ ] Interface `PaymentProvider` (COM-020) tidak menghalangi mode ini (ada field `mode: 'byog' | 'platform_managed'` di config, default `byog`).

> ❓ OPEN: Fitur sub-merchant/split payment pada Midtrans/Xendit (nama produk, syarat, biaya) — verifikasi di dokumentasi & tim sales gateway sebelum mempertimbangkan COM-004.

---

## 3. Arsitektur integrasi gateway

### 3.1 Gambaran komponen

```text
 Website publish (island JS)          apps/api (Express)                         Gateway milik owner
 ┌─────────────────────┐   HTTPS   ┌───────────────────────────────┐   HTTPS   ┌──────────────────┐
 │ Cart / Checkout      │ ───────▶ │ commerce/runtime routes        │ ───────▶ │ Create payment   │
 │ (component commerce) │          │  - cart, checkout, order status│          │ (Snap/Invoice/..)│
 └─────────────────────┘          │ payments/ service              │          └────────┬─────────┘
          ▲  redirect/popup        │  - ProviderRegistry            │                   │ webhook
          └────────────────────────│  - CredentialVault (decrypt)   │ ◀─────────────────┘
                                   │ webhooks/ routes               │
                                   │  - verify → payment_events     │──▶ BullMQ (apps/worker)
                                   └───────────────────────────────┘      - process event
                                                                           - workflow trigger (05)
                                                                           - email / WA notif
```

Lokasi kode (usulan, detail di [ARCHITECTURE](../ARCHITECTURE.md)):

```text
packages/payments/
  src/provider.ts            # interface PaymentProvider + tipe bersama
  src/registry.ts            # ProviderRegistry: id → factory
  src/providers/midtrans/    # adapter Midtrans (Snap)
  src/providers/xendit/      # adapter Xendit (Invoice / Payment Request)
  src/providers/manual/      # manual_transfer, cod (tanpa API)
  src/money.ts               # util integer IDR, formatting
apps/api/src/modules/commerce/   # products, carts, checkout, orders (routes/controller/service/repository/schema)
apps/api/src/modules/payments/   # configs, credential vault, webhooks
apps/worker/src/jobs/payments/   # process-payment-event, expire-orders, reconcile-pending
```

### COM-020 Interface `PaymentProvider` (adapter pattern)
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Semua provider mengimplementasikan interface yang sama. Core commerce hanya bergantung pada interface ini.
  ```ts
  // packages/payments/src/provider.ts
  export type ProviderId = 'midtrans' | 'xendit' | 'manual_transfer' | 'cod';
  export type PaymentEnv = 'sandbox' | 'production';

  export type PaymentMethodKind =
    | 'qris' | 'virtual_account' | 'ewallet' | 'card' | 'retail_outlet'
    | 'bank_transfer_manual' | 'cod';

  export interface ProviderCapabilities {
    methods: PaymentMethodKind[];          // metode yang didukung adapter (bukan janji gateway; lihat OPEN)
    hostedPage: boolean;                   // redirect/popup ke halaman gateway
    refund: 'none' | 'manual' | 'api';     // refund via API = P1
    partialRefund: boolean;
    expiryConfigurable: boolean;
    webhookVerification: 'signature' | 'token' | 'none';
    statusPolling: boolean;                // bisa getStatus untuk konfirmasi
  }

  export interface DecryptedCredentials {   // hanya hidup di memori proses api/worker
    [key: string]: string;                  // mis. serverKey, clientKey, secretKey, webhookToken
  }

  export interface ProviderContext {
    siteId: string;
    env: PaymentEnv;
    credentials: DecryptedCredentials;
    webhookUrl: string;                     // URL webhook unik site (COM-033)
    logger: SafeLogger;                     // logger yang me-redact secret
  }

  export interface CreatePaymentInput {
    orderNumber: string;                    // dipakai sebagai external/reference id unik di gateway
    paymentAttemptId: string;               // id baris payments; idempotency key
    amount: number;                         // integer IDR, sudah final (termasuk ongkir, diskon)
    currency: 'IDR';
    customer: { name: string; email?: string; phone?: string };
    items: Array<{ sku?: string; name: string; price: number; quantity: number }>;
    allowedMethods?: PaymentMethodKind[];
    expiresAt: Date;
    successRedirectUrl: string;
    failureRedirectUrl: string;
  }

  export interface CreatePaymentResult {
    providerPaymentId: string;              // token/invoice id dari gateway
    action:
      | { type: 'redirect'; url: string }
      | { type: 'popup'; token: string; clientScriptUrl: string } // mis. Snap popup
      | { type: 'instructions'; data: Record<string, unknown> }; // manual transfer: no rekening
    expiresAt: Date;
    raw: unknown;                           // disimpan ter-redact untuk debugging
  }

  export type NormalizedPaymentStatus =
    | 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded' | 'partially_refunded';

  export interface PaymentStatusResult {
    providerPaymentId: string;
    orderNumber: string;
    status: NormalizedPaymentStatus;
    amountPaid?: number;
    method?: PaymentMethodKind;
    paidAt?: Date;
    providerStatus: string;                 // status asli gateway (untuk audit)
    raw: unknown;
  }

  export interface VerifiedWebhook {
    eventId: string;                        // id event dari gateway atau hash deterministik payload
    orderNumber: string;
    providerPaymentId?: string;
    status: NormalizedPaymentStatus;
    amount?: number;
    occurredAt: Date;
    raw: unknown;
  }

  export interface PaymentProvider {
    readonly id: ProviderId;
    capabilities(ctx: Pick<ProviderContext, 'env'>): ProviderCapabilities;
    validateCredentials(input: Record<string, string>): { ok: true } | { ok: false; errors: string[] }; // format saja
    testConnection(ctx: ProviderContext): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }>;
    createPayment(ctx: ProviderContext, input: CreatePaymentInput): Promise<CreatePaymentResult>;
    getStatus(ctx: ProviderContext, ref: { orderNumber: string; providerPaymentId?: string }): Promise<PaymentStatusResult>;
    verifyWebhook(ctx: ProviderContext, req: { headers: Record<string, string>; rawBody: Buffer }): Promise<VerifiedWebhook>; // throw bila invalid
    refund?(ctx: ProviderContext, input: { providerPaymentId: string; amount: number; reason: string; idempotencyKey: string }): Promise<{ ok: boolean; providerRefundId?: string; raw: unknown }>; // P1
    cancel?(ctx: ProviderContext, ref: { providerPaymentId: string }): Promise<void>;
  }
  ```
- **Aturan:**
  - Adapter **tidak** mengakses DB; hanya menerima context & input, mengembalikan hasil ternormalisasi.
  - Mapping status gateway → `NormalizedPaymentStatus` ada di adapter, dengan tabel mapping eksplisit dan unit test.
  - Semua HTTP call ke gateway: timeout (mis. 15 detik), retry hanya untuk operasi idempotent (`getStatus`), tidak untuk `createPayment` kecuali gateway mendukung idempotency key.
- **Acceptance criteria:**
  - [ ] `packages/payments` memiliki interface di atas + `ProviderRegistry.get(id)`.
  - [ ] Setiap adapter memiliki unit test mapping status dan test verifikasi webhook (payload valid, signature salah, payload diubah).
  - [ ] Menambah provider baru tidak memerlukan perubahan pada modul `commerce` (hanya registrasi adapter + form config).
  - [ ] Kontrak test bersama (`providerContractTest(adapter)`) dijalankan untuk semua adapter.

### COM-021 Adapter Midtrans (kandidat utama #1)
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Adapter memakai produk **Snap** (hosted payment page / popup) agar Platform tidak menangani data kartu. Pembuatan transaksi via API server-side dengan server key owner, menghasilkan token/redirect URL. Konfirmasi status via notifikasi HTTP (webhook) + Status API.
- **Kredensial yang diminta (kandidat):** `serverKey`, `clientKey` (untuk popup Snap di browser — client key memang publik menurut desain gateway, tetap disimpan di config, *boleh* dikirim ke browser), `merchantId` (opsional, untuk tampilan).
- **Verifikasi webhook (kandidat):** cek `signature_key` di payload terhadap hash yang dihitung dari field transaksi + server key (algoritma persis = verifikasi di dokumentasi), **ditambah** konfirmasi via Status API (COM-052).
- **Acceptance criteria:**
  - [ ] Sandbox end-to-end: buat transaksi → bayar di simulator sandbox → webhook diterima → order `paid`.
  - [ ] Popup mode dan redirect mode didukung; default redirect (lebih andal di mobile in-app browser).
  - [ ] `orderNumber` unik per percobaan bayar (lihat COM-085 bila retry pembayaran memerlukan id baru di gateway).

> ❓ OPEN (Midtrans): verifikasi di dokumentasi resmi — (a) endpoint & base URL sandbox/production Snap, (b) formula `signature_key` dan field yang dipakai, (c) daftar `payment_type` & mapping `transaction_status`/`fraud_status`, (d) apakah order id boleh dipakai ulang setelah expired, (e) pengaturan URL notifikasi per transaksi vs hanya di dashboard, (f) API refund & syaratnya per metode, (g) ketersediaan & biaya QRIS/VA/e-wallet/kartu/retail.

### COM-022 Adapter Xendit (kandidat utama #2)
- **Prioritas:** P0 (setelah Midtrans) · **Fase:** M8
- **Deskripsi:** Adapter memakai produk hosted (kandidat: **Invoice / Payment Link**) untuk MVP karena satu halaman bayar mencakup banyak metode; opsi **Payment Request** / API metode spesifik (QRIS, VA, e-wallet) sebagai P1 bila ingin pengalaman checkout embedded.
- **Kredensial yang diminta (kandidat):** `secretKey` (API key), `webhookVerificationToken` (callback token dari dashboard).
- **Verifikasi webhook (kandidat):** bandingkan header token callback dengan token yang disimpan (constant-time compare), **ditambah** konfirmasi via GET status ke API (COM-052).
- **Acceptance criteria:**
  - [ ] Sandbox/test mode end-to-end berhasil seperti COM-021.
  - [ ] `external_id`/reference = `orderNumber` + attempt agar unik.
  - [ ] Bila token callback tidak cocok → 401, event dicatat `rejected`.

> ❓ OPEN (Xendit): verifikasi — (a) produk yang paling cocok (Invoice vs Payment Request vs Payment Session) dan statusnya (versi API terbaru, deprecation), (b) nama header & mekanisme verifikasi callback, (c) apakah URL callback bisa per-request atau hanya global di dashboard (berdampak pada COM-033), (d) mapping status, (e) refund API, (f) metode & biaya yang tersedia untuk akun merchant Indonesia.

### COM-023 Provider manual: `manual_transfer` dan `cod`
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:**
  - `manual_transfer`: owner mengisi 1–5 rekening (`bankName`, `accountNumber`, `accountHolder`). `createPayment` mengembalikan `action.type = 'instructions'` berisi rekening + total + batas waktu. Pembeli upload bukti (gambar/PDF ≤ 5 MB) di halaman status order → `payments.status = 'awaiting_confirmation'` → owner klik **Konfirmasi** / **Tolak** di dashboard.
  - Opsi **kode unik** (P1): tambah 1–999 rupiah unik ke total agar owner mudah mencocokkan mutasi; kode unik dicatat sebagai baris `adjustments` order.
  - `cod`: tidak ada pembayaran di checkout; order `processing` setelah owner menerima order (atau otomatis, konfigurasi), owner menandai `paid` saat barang diterima & dibayar.
- **Acceptance criteria:**
  - [ ] Bukti transfer disimpan di storage privat (bukan bucket publik website), URL bertanda tangan berumur pendek untuk owner.
  - [ ] `getStatus`/`verifyWebhook` tidak dipanggil untuk provider manual; capabilities `webhookVerification: 'none'`, `statusPolling: false`.
  - [ ] Konfirmasi owner tercatat di `payment_events` (`source = 'owner_manual'`, `actor_user_id`).
  - [ ] COD bisa dibatasi per wilayah (P1) dan per nilai maksimal order (P1).

### COM-024 Metode pembayaran per gateway
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Metode yang **ditargetkan** (tergantung gateway & aktivasi akun owner): QRIS, Virtual Account (bank-bank utama), e-wallet, kartu kredit/debit, retail outlet. Platform **tidak** menjanjikan metode tertentu; checkout menampilkan metode yang (a) didukung adapter dan (b) diaktifkan owner. Untuk hosted page, pemilihan metode terjadi di halaman gateway; Platform hanya meneruskan `allowedMethods` bila owner membatasi.
- **Matriks (semua kolom = harus diverifikasi):**

  | Metode | Midtrans (Snap) | Xendit (Invoice) | Catatan |
  |---|---|---|---|
  | QRIS | kandidat ✅ (OPEN) | kandidat ✅ (OPEN) | prioritas untuk UMKM |
  | Virtual Account | kandidat ✅ (OPEN) | kandidat ✅ (OPEN) | bank yang tersedia = OPEN |
  | E-wallet | kandidat ✅ (OPEN) | kandidat ✅ (OPEN) | daftar wallet = OPEN |
  | Kartu | kandidat ✅ (OPEN) | kandidat ✅ (OPEN) | wajib hosted (PCI, §15) |
  | Retail outlet | kandidat (OPEN) | kandidat (OPEN) | P1 |
  | Paylater | OPEN | OPEN | P2 |

- **Acceptance criteria:**
  - [ ] Owner bisa mencentang metode yang ingin ditampilkan (default: semua yang tersedia di hosted page).
  - [ ] Bila owner memilih metode yang belum diaktifkan di akun gateway-nya, error dari gateway ditampilkan jelas di "Test connection" atau saat checkout sandbox.

> ❓ OPEN: Matriks metode & biaya per gateway untuk akun merchant Indonesia — isi setelah verifikasi dokumentasi resmi; jangan tampilkan biaya MDR di UI Platform (biaya adalah urusan kontrak owner–gateway), cukup tautan ke halaman harga gateway.

### COM-025 Pemilihan provider aktif per site
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Satu site boleh punya **maksimal satu gateway online aktif** (Midtrans **atau** Xendit) + metode offline. Multi-gateway bersamaan (mis. QRIS via A, kartu via B) = P2.
- **Acceptance criteria:**
  - [ ] Mengaktifkan gateway kedua menonaktifkan gateway pertama setelah konfirmasi; order yang sedang `pending_payment` di gateway lama tetap diproses webhook-nya (config lama tetap ada dengan status `inactive`, bukan dihapus).
  - [ ] Webhook untuk config `inactive` tetap diterima selama 7 hari setelah dinonaktifkan (agar pembayaran yang terlambat tidak hilang).

---

## 4. Konfigurasi pembayaran oleh owner (Settings > Payments)

### 4.1 Wireframe ringkas

```text
Settings › Payments                                             [Sandbox ◉ | Production ○]
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Payment gateway                                                                     │
│  ( ) Belum pakai gateway    (•) Midtrans    ( ) Xendit                              │
│                                                                                     │
│  Server key   [ ••••••••••••••••••••••a91F ]  [Ganti]                               │
│  Client key   [ SB-Mid-client-xxxx…        ]                                        │
│                                                                                     │
│  Webhook URL (daftarkan di dashboard Midtrans):                                     │
│  https://api.platformmu.com/webhooks/payments/midtrans/whk_4fQ…     [Salin]         │
│  ▸ Panduan langkah demi langkah                                                     │
│                                                                                     │
│  Status: ● Terhubung (sandbox) · Test terakhir 12 Okt 2026 10:21 · Webhook diterima ✓│
│  [Test connection]  [Kirim webhook uji]  [Putuskan koneksi]                          │
├────────────────────────────────────────────────────────────────────────────────────┤
│ Metode offline                                                                      │
│  [x] Transfer manual   Rekening: BCA 123xxx a.n. Sari Kue  [+ Tambah rekening]      │
│  [ ] COD                                                                            │
│  [x] Order via WhatsApp   +62 812-xxxx-xxxx                                          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### COM-030 Halaman Settings > Payments
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Halaman di dashboard site (`apps/web`, route `/sites/[siteId]/settings/payments`) untuk memilih provider, mengisi kredensial, memilih mode, menguji koneksi, melihat URL webhook, dan status. Hanya role **owner** site (dan nanti role `admin` tim dengan izin `payments.manage`, lihat [08](./08-accounts-plans-admin.md)) yang bisa melihat/mengubah.
- **Perilaku:**
  - Form kredensial dibangun dari schema per provider (`providerConfigSchemas[providerId]`, Zod) sehingga field, label, help text, dan validasi format berasal dari satu sumber.
  - Field secret bertipe password, **write-only**: setelah disimpan, UI hanya menampilkan versi tersamar (`••••a91F`, 4 karakter terakhir) dan tombol **Ganti**. API tidak pernah mengembalikan nilai asli.
  - Kredensial **sandbox** dan **production** disimpan sebagai dua config terpisah; toggle mode memilih config aktif.
  - Perubahan disimpan → status menjadi `unverified` sampai "Test connection" sukses.
  - Teks bantuan bilingual (ID/EN) via `packages/i18n`.
- **Acceptance criteria:**
  - [ ] `GET /v1/sites/:siteId/payment-configs` mengembalikan `{ provider, env, status, maskedFields, webhookUrl, lastTestedAt, lastWebhookAt }` tanpa secret.
  - [ ] `PUT /v1/sites/:siteId/payment-configs/:provider/:env` menerima secret, mengenkripsi (COM-040), menyimpan, menulis audit log (COM-044).
  - [ ] Field kosong saat update = "tidak diubah" (bukan menghapus secret).
  - [ ] User tanpa izin mendapat 403; tidak ada data config di response.
  - [ ] Validasi format (mis. prefix key sandbox vs production) menampilkan peringatan bila key terlihat tidak cocok dengan mode (heuristik; OPEN: pola prefix per gateway).

### COM-031 Mode sandbox / production
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Setiap site punya `payment_mode` aktif: `sandbox` atau `production`.
  - Saat `sandbox`: website publish menampilkan **banner "Mode uji — pembayaran tidak nyata"** di checkout; order ditandai `is_test = true`.
  - Beralih ke `production` memerlukan: config production `connected` (test sukses), konfirmasi dialog ("Saya sudah menyelesaikan verifikasi akun di gateway"), dan paket yang mengizinkan commerce.
- **Acceptance criteria:**
  - [ ] Order test tidak dihitung di dashboard penjualan (default filter) dan tidak memotong kuota order paket (§14).
  - [ ] Order test & produksi tidak tercampur di export CSV kecuali dipilih.
  - [ ] Switch mode tercatat di audit log.

### COM-032 Tombol "Test connection"
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Memanggil `provider.testConnection(ctx)` di server, yang melakukan panggilan API ringan dan aman (tanpa membuat transaksi nyata bila memungkinkan; mis. memanggil endpoint status untuk order id acak dan mengharapkan "not found" yang terautentikasi, atau endpoint balance/merchant info bila tersedia — **mekanisme per gateway = OPEN**).
- **Hasil yang mungkin:**

  | Hasil | Status config | Pesan ke owner |
  |---|---|---|
  | Autentikasi sukses | `connected` | "Terhubung ke Midtrans (Sandbox)." |
  | 401/403 dari gateway | `invalid_credentials` | "Server key ditolak. Periksa apakah key sesuai mode Sandbox/Production." |
  | Timeout / 5xx | `unreachable` (status lama dipertahankan) | "Gateway tidak merespons. Coba lagi." |
  | Key format salah | (tidak dipanggil) | Error validasi field. |

- **Acceptance criteria:**
  - [ ] Rate limit: maks 10 test/menit per site.
  - [ ] Respons gateway mentah tidak dikirim ke browser; hanya pesan ternormalisasi.
  - [ ] Hasil test tersimpan (`last_tested_at`, `last_test_result`).

> ❓ OPEN: Endpoint "test connection" yang aman per gateway (tanpa efek samping, tanpa biaya). Alternatif terakhir: buat transaksi sandbox bernilai minimum lalu batalkan — hanya untuk sandbox.

### COM-033 URL webhook unik per site & provider
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Setiap `payment_gateway_configs` punya `webhook_token` acak (≥ 128-bit, prefix `whk_`), menghasilkan URL:
  ```text
  https://api.platformmu.com/webhooks/payments/{provider}/{webhookToken}
  # lokal (perlu tunnel publik, mis. cloudflared/ngrok, karena gateway tidak bisa memanggil localhost):
  https://<tunnel>.example/webhooks/payments/midtrans/whk_...
  ```
  Token ini **bukan** secret otentikasi utama (verifikasi tetap via signature/token gateway, COM-051) tetapi berfungsi sebagai **routing key** ke site & config yang benar dan lapisan pertahanan tambahan.
- **Perilaku:**
  - Bila gateway mendukung URL notifikasi per transaksi, adapter mengirim URL ini di `createPayment` juga (lebih andal).
  - Bila gateway hanya mendukung URL global di dashboard merchant: owner wajib menempelkan URL ini di dashboard gateway miliknya (karena akun gateway milik owner, URL global itu memang hanya untuk toko owner — cocok dengan BYOG).
  - Tombol **Regenerate URL** (P1): membuat token baru; token lama tetap diterima 72 jam.
- **Acceptance criteria:**
  - [ ] Token unik global (unique index), tidak bisa ditebak, tidak mengandung `site_id`.
  - [ ] Request ke token tidak dikenal → `404` tanpa detail, dicatat di metrik `webhook_unknown_token`.
  - [ ] UI menampilkan `lastWebhookAt` dan indikator "Webhook belum pernah diterima" setelah test pembayaran sandbox.

### COM-034 Panduan step-by-step menghubungkan gateway
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Panel panduan in-app (expandable) per provider, bilingual, dengan screenshot (diperbarui manual). Isi kerangka (detail menu dashboard gateway = OPEN, verifikasi saat menulis konten):
  1. **Daftar / login** ke dashboard gateway (tautan resmi). Selesaikan verifikasi bisnis (KYC) untuk production.
  2. Pilih environment **Sandbox** dulu.
  3. Buka menu pengaturan **Access Keys / API Keys**; salin **Server Key / Secret Key** (dan Client Key bila ada).
  4. Tempelkan ke Platform → **Simpan** → **Test connection**.
  5. Buka menu pengaturan **Notification / Webhook / Callback URL** di dashboard gateway; tempel **Webhook URL** dari Platform; (Xendit: salin juga **callback verification token** ke Platform).
  6. (Opsional) Atur **Finish/Redirect URL** bila diminta: `https://<domain-toko>/checkout/result`.
  7. Lakukan **pembayaran uji** dari website (mode sandbox) → pastikan status "Webhook diterima ✓".
  8. Ulangi langkah 3–7 untuk **Production** setelah akun disetujui gateway.
- **Acceptance criteria:**
  - [ ] Setiap langkah punya checklist status otomatis bila bisa dideteksi (kredensial tersimpan, test sukses, webhook diterima).
  - [ ] Konten panduan disimpan sebagai Markdown di repo (`apps/web/content/payments-guides/{provider}.{locale}.md`) agar mudah diperbarui.

### COM-035 Status koneksi & health
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Status config: `not_configured` → `unverified` → `connected` | `invalid_credentials` | `unreachable` | `inactive`. Ditambah sinyal health: `last_webhook_at`, rasio webhook gagal verifikasi 24 jam, jumlah order `pending_payment` > 24 jam.
- **Acceptance criteria:**
  - [ ] Bila createPayment gagal karena 401 di production → status otomatis `invalid_credentials`, owner mendapat email ("Kredensial pembayaran tidak valid, checkout dinonaktifkan sementara").
  - [ ] Checkout publik menampilkan "Pembayaran online sedang tidak tersedia" bila status bukan `connected`, dan metode offline tetap ditampilkan.
  - [ ] Badge status tampil di dashboard site & di panel Settings.

---

## 5. Penyimpanan kredensial

### COM-040 Enkripsi envelope
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Kredensial disimpan terenkripsi dengan skema **envelope encryption**:
  - **DEK** (data encryption key) acak 256-bit per baris config.
  - Payload kredensial (JSON) dienkripsi dengan DEK memakai **AES-256-GCM** (Node `crypto`, IV/nonce 96-bit acak per enkripsi). **AAD** = `site_id || provider || env || config_id` (mencegah ciphertext dipindah ke baris lain). Skema ini sama untuk semua secret milik user (lihat [05 DATA-324](./05-dynamic-data.md#data-324-secret-storage)) dan diimplementasikan sekali di `@platform/shared/node` ([ARCHITECTURE §9.4](../ARCHITECTURE.md#94-secrets--enkripsi-kredensial)).
  - DEK dienkripsi oleh **KEK** (key encryption key):
    - Opsi A (rekomendasi production): KMS terkelola (AWS KMS / GCP KMS / sejenis) — `encrypted_dek` = hasil `Encrypt` KMS.
    - Opsi B (MVP / self-host, default): master key 256-bit per environment dari environment variable/secret manager (`CREDENTIALS_KEK_V1`, versi aktif di `CREDENTIALS_KEK_CURRENT`); DEK dibungkus dengan AES-256-GCM memakai KEK tersebut.
  - **Key per environment**: dev, staging, production memakai KEK berbeda; dump DB staging tidak bisa didekripsi di dev.
  - Kolom tersimpan: `ciphertext`, `nonce`, `encrypted_dek`, `kek_id`, `kek_version`, `masked_fields`.
- **Contoh modul:**
  ```ts
  // apps/api/src/modules/payments/credential-vault.ts — membungkus primitive envelope dari @platform/shared/node
  export interface CredentialVault {
    seal(input: { configId: string; siteId: string; provider: ProviderId; env: PaymentEnv; secrets: Record<string, string> }): Promise<SealedCredentials>;
    open(row: SealedCredentials & { configId: string; siteId: string; provider: ProviderId; env: PaymentEnv }): Promise<DecryptedCredentials>;
    rewrap(row: SealedCredentials, toKekVersion: number): Promise<SealedCredentials>; // rotasi KEK tanpa ubah DEK
  }
  ```
- **Acceptance criteria:**
  - [ ] Tidak ada kolom plaintext secret di DB; test memastikan `SELECT` mentah tidak mengandung string secret.
  - [ ] Dekripsi hanya terjadi di `apps/api` (saat createPayment/testConnection/verifyWebhook) dan `apps/worker` (reconcile/refund); `apps/web`, `apps/editor`, `apps/site-host` tidak punya akses KEK.
  - [ ] Secret didekripsi per operasi, tidak di-cache lebih dari durasi request/job (boleh cache in-memory ≤ 60 detik, opsional).
  - [ ] Mengubah AAD (memindah ciphertext ke config lain) membuat dekripsi gagal (test).

> ❓ OPEN: Pilih KMS (tergantung hosting final di [ARCHITECTURE](../ARCHITECTURE.md)) vs master key env untuk rilis pertama M8.

### COM-041 Kredensial tidak pernah keluar
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Secret dilarang muncul di: response API, HTML/JS website publish, document model/Yjs, konteks/tool AI, log aplikasi, Sentry breadcrumbs/event, job payload BullMQ, export data, email, audit log (hanya nama field yang berubah, bukan nilai).
- **Implementasi wajib:**
  - `SafeLogger` dengan redaction path (`*.serverKey`, `*.secretKey`, `*.webhookVerificationToken`, header `authorization`, `x-callback-token`).
  - Sentry `beforeSend` men-scrub field yang sama.
  - Job BullMQ hanya membawa `configId`, bukan secret.
  - Pengecualian: `clientKey` Midtrans yang **memang dirancang publik** boleh dikirim ke browser untuk popup Snap (OPEN: konfirmasi di dokumentasi).
- **Acceptance criteria:**
  - [ ] Test integrasi: setelah alur checkout sandbox lengkap, grep log & event Sentry mock tidak menemukan secret.
  - [ ] Tool AI tidak punya tool apa pun yang membaca/menulis `payment_gateway_configs` (lihat COM-142).

### COM-042 Rotasi kredensial & kunci
- **Prioritas:** P0 (rotasi kredensial owner) / P1 (rotasi KEK otomatis) · **Fase:** M8
- **Deskripsi:**
  - **Kredensial owner:** owner menekan **Ganti** dan memasukkan key baru → DEK baru → status `unverified` → test. Key lama dihapus (tidak disimpan riwayat secret).
  - **KEK:** versi KEK baru ditambahkan (`CREDENTIALS_KEK_V2`, lalu `CREDENTIALS_KEK_CURRENT=2`); job `rewrap-payment-credentials` membungkus ulang semua `encrypted_dek`; KEK lama dipensiunkan setelah 0 baris memakainya.
- **Acceptance criteria:**
  - [ ] Rotasi KEK tidak memerlukan downtime dan idempotent (bisa dijalankan ulang).
  - [ ] Owner mendapat email notifikasi setiap kali kredensial diganti (keamanan akun).

### COM-043 Penghapusan kredensial
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** "Putuskan koneksi" menghapus ciphertext (hard delete kolom secret, baris config tetap untuk riwayat dengan status `inactive`). Menghapus site → semua config dihapus permanen.
- **Acceptance criteria:**
  - [ ] Setelah putus koneksi, webhook untuk token tersebut masih diterima 7 hari tetapi verifikasi yang memerlukan secret gagal → event disimpan `unverified`, owner dapat menyambungkan ulang lalu "Proses ulang event" (P1).

### COM-044 Audit akses kredensial
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Setiap create/update/delete/test config, switch mode, dan **setiap akses dekripsi oleh staf Platform** (seharusnya tidak pernah; admin panel tidak punya fitur lihat secret) dicatat di `audit_logs` (tabel umum, lihat [08](./08-accounts-plans-admin.md)) dengan `actor`, `action`, `site_id`, `provider`, `env`, `ip`, `user_agent`, `changed_fields`.
- **Acceptance criteria:**
  - [ ] Owner bisa melihat riwayat perubahan konfigurasi pembayaran di Settings > Payments > Riwayat.
  - [ ] Admin panel Platform hanya menampilkan status & masked fields, tidak ada tombol "reveal".
  - [ ] Dekripsi dicatat sebagai metrik agregat (jumlah per jenis operasi), bukan per baris log berisi detail.

---

## 6. Webhook handling

### 6.1 Alur

```text
Gateway ──POST──▶ /webhooks/payments/:provider/:token
   1. Lookup config by token (404 bila tidak ada)
   2. Baca raw body (express.raw, limit 1 MB) — JANGAN parse JSON sebelum verifikasi
   3. provider.verifyWebhook(ctx, {headers, rawBody})  → gagal: 401 + simpan event status 'rejected'
   4. INSERT payment_events (provider, provider_event_id, ...) ON CONFLICT DO NOTHING
        - duplikat → 200 OK (idempotent), stop
   5. Enqueue job 'process-payment-event' {paymentEventId}
   6. Balas 200 OK cepat (< 2 detik)
Worker:
   7. Lock order (SELECT ... FOR UPDATE)
   8. Konfirmasi status via provider.getStatus() (verify-by-refetch)
   9. Terapkan transisi state machine (COM-090) bila valid & tidak mundur
  10. Commit stok, set paid_at, dsb
  11. Emit domain event 'commerce.order.paid' → workflow engine (05) → email/WA
```

### COM-050 Endpoint webhook per site/provider
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Route `POST /webhooks/payments/:provider/:webhookToken` di `apps/api`, di luar middleware auth/CSRF/JSON parser global; memakai `express.raw()` agar signature dihitung dari byte asli.
- **Acceptance criteria:**
  - [ ] `:provider` di URL harus sama dengan `provider` config milik token; bila beda → 404.
  - [ ] Rate limit per token (mis. 300 req/menit) dan body limit 1 MB.
  - [ ] Respons selalu cepat; pemrosesan berat di worker.
  - [ ] Endpoint tidak pernah mengembalikan detail error internal ke gateway.

### COM-051 Verifikasi signature
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Adapter memverifikasi keaslian event dengan mekanisme gateway (signature hash atau callback token), memakai perbandingan **constant-time** (`crypto.timingSafeEqual`). Opsional: allowlist IP gateway (OPEN — hanya bila gateway mempublikasikan daftar IP resmi; jangan jadi satu-satunya pertahanan).
- **Acceptance criteria:**
  - [ ] Signature salah / token salah → 401, `payment_events.verification = 'failed'`, tidak ada perubahan order.
  - [ ] Test dengan payload valid dari fixture dokumentasi gateway (disimpan di `packages/payments/test/fixtures`).

### COM-052 Verify-by-refetch (konfirmasi status ke gateway)
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Sebelum menandai order `paid`, worker memanggil `provider.getStatus()` dengan kredensial owner dan memakai **hasil API** sebagai kebenaran (bukan payload webhook). Ini melindungi dari payload palsu/terlambat dan menyeragamkan perilaku antar gateway.
- **Acceptance criteria:**
  - [ ] Bila status webhook = `paid` tetapi `getStatus` = `pending` → tidak ada transisi; job dijadwalkan ulang (backoff 30 dtk, 2 mnt, 10 mnt).
  - [ ] `amountPaid` dari `getStatus` harus sama dengan `payments.amount`; bila beda → order ditandai `needs_review` (flag), owner diberi notifikasi, tidak otomatis `paid`.
  - [ ] Provider tanpa `statusPolling` (manual) dikecualikan.

### COM-053 Idempotency
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:**
  - `payment_events` unique `(provider, provider_event_id)`; bila gateway tidak memberi event id, pakai `sha256(rawBody)` sebagai `provider_event_id`.
  - Transisi state memakai compare-and-set (`UPDATE orders SET status = $new WHERE id = $id AND status = ANY($allowedFrom)`).
  - Side-effect (email, WA, workflow) di-trigger via domain event dengan `dedupe_key = orderId + ':' + newStatus`.
- **Acceptance criteria:**
  - [ ] Mengirim webhook yang sama 10× menghasilkan satu transisi, satu email, satu WA.
  - [ ] Dua webhook berbeda (mis. `pending` lalu `settlement`) yang tiba bersamaan diproses berurutan via row lock.

### COM-054 Retry & ketahanan
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:**
  - Gateway umumnya me-retry webhook bila respons non-2xx (kebijakan per gateway = OPEN). Platform membalas 2xx segera setelah event tersimpan, sehingga retry gateway hanya terjadi bila Platform down.
  - Job `process-payment-event` di BullMQ queue `payments` ([ARCHITECTURE §5.4](../ARCHITECTURE.md#54-appsworker--bullmq)): 8 attempt, exponential backoff, gagal final → queue `dead-letter` (konvensi ARCHITECTURE) + alert Sentry.
  - Job **reconcile** terjadwal (setiap 10 menit): untuk payments `pending` yang berumur 5 menit–48 jam, panggil `getStatus` (menangani webhook yang hilang / URL belum didaftarkan owner).
- **Acceptance criteria:**
  - [ ] Bila webhook tidak pernah datang tetapi pembeli sudah bayar, order tetap menjadi `paid` ≤ 15 menit lewat reconcile.
  - [ ] Reconcile menghormati rate limit gateway (concurrency per site ≤ 2, global ≤ N; OPEN: batas gateway).
  - [ ] Event di DLQ terlihat di admin panel (tanpa secret) dengan tombol "retry".

### COM-055 Urutan event & transisi monoton
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Event bisa datang tidak berurutan (mis. `expired` tiba setelah `paid`). Aturan: status pembayaran hanya bergerak maju sesuai ranking `pending(0) < failed/expired/cancelled(1) < paid(2) < partially_refunded(3) < refunded(4)`, dengan pengecualian: `failed/expired → paid` **diizinkan** (pembayaran terlambat yang sah; lihat COM-171).
- **Acceptance criteria:**
  - [ ] Event `expired` setelah `paid` diabaikan (dicatat `ignored_out_of_order`).
  - [ ] Event `paid` setelah order `expired` → ditangani COM-171 (bukan diabaikan).
  - [ ] Unit test tabel transisi lengkap.

### COM-056 Integrasi workflow (domain events)
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Commerce memancarkan trigger untuk workflow engine ([05](./05-dynamic-data.md)), tersedia sebagai trigger bawaan di editor workflow:

  | Trigger | Payload utama |
  |---|---|
  | `commerce.order.created` | `order` (tanpa data sensitif pembayaran), `items`, `buyer` |
  | `commerce.order.paid` | `order`, `payment.method`, `paidAt` |
  | `commerce.order.status_changed` | `order`, `from`, `to` |
  | `commerce.order.shipped` | `order`, `shipment.courier`, `shipment.trackingNumber` |
  | `commerce.order.cancelled` / `.expired` / `.refunded` | `order`, `reason` |
  | `commerce.payment.proof_uploaded` | `order`, `proofUrl` (signed, owner-only) |
  | `commerce.stock.low` | `product`, `variant`, `stock` |

  Saat commerce diaktifkan, Platform membuat **workflow default** (bisa diedit/dimatikan owner): email konfirmasi order ke pembeli, email/WA ke owner saat order `paid`, email ke pembeli saat `shipped`.
- **Acceptance criteria:**
  - [ ] Workflow default terbuat sekali (idempotent) saat commerce diaktifkan, ditandai `system_template = 'commerce_default_v1'`.
  - [ ] Payload trigger tidak mengandung kredensial atau data kartu.
  - [ ] Langkah "Kirim WhatsApp" memakai mekanisme WA dari [05](./05-dynamic-data.md) (provider WA = OPEN di dokumen itu).

---

## 7. Katalog produk

### 7.1 Keputusan: tabel sistem khusus, diekspos sebagai "system collections"

Produk, varian, keranjang, dan order disimpan di **tabel Drizzle khusus** (`products`, `product_variants`, `orders`, dst.), **bukan** di collections generik buatan user ([05](./05-dynamic-data.md)).

| Pertimbangan | Collections generik (JSONB) | Tabel khusus (dipilih) |
|---|---|---|
| Integritas stok & reservasi (row lock, constraint `stock >= 0`) | sulit | mudah, transaksional |
| Validasi harga server, foreign key ke order | lemah | kuat |
| Query laporan penjualan | lambat/kompleks | SQL biasa + index |
| Fleksibilitas field custom | tinggi | dibantu kolom `attributes JSONB` |
| Binding ke component | native | lewat adapter read-only |

Agar tetap bisa dipakai binding & AI seperti collections lain, tabel ini diekspos sebagai **system collections read-only** dengan nama tetap: `sys_products`, `sys_product_categories`, `sys_orders` (hanya untuk member pemilik order / owner). Binding (repeat list, field mapping) di [05](./05-dynamic-data.md) membaca lewat `SystemCollectionAdapter`; penulisan hanya lewat API commerce. Owner boleh menambah **custom fields** produk (disimpan di `products.attributes`) yang muncul sebagai field di system collection.

### COM-060 Produk
- **Prioritas:** P0 · **Fase:** M7 (subset untuk Order via WA) / M8 (lengkap)
- **Deskripsi:** Field produk: `name`, `slug` (unik per site), `description` (rich text Tiptap JSON + HTML tersanitasi untuk render), `price` (integer IDR), `compare_at_price` (harga coret, opsional, harus > `price`), `sku` (opsional, unik per site bila diisi), `images` (array asset id, urutan; gambar pertama = cover), `category_ids`, `weight_grams` (untuk ongkir), `status` (`draft` | `active` | `archived`), `track_inventory` (bool), `stock` (bila tanpa varian), `attributes` (custom fields JSONB), `seo` (`title`, `description`), `is_featured`.
- **Halaman produk:** setiap produk `active` punya URL `/{productBasePath}/{slug}` (default `/produk/{slug}`) yang dirender dari **template halaman produk** (dynamic page, lihat [05](./05-dynamic-data.md) & [07](./07-publishing-hosting.md)), termasuk meta SEO & structured data `Product` (P1).
- **Acceptance criteria:**
  - [ ] CRUD produk di dashboard `Commerce > Produk` (tabel + form), dengan bulk action (aktifkan, arsipkan, hapus, ubah kategori).
  - [ ] Slug otomatis dari nama (transliterasi, lowercase, `-`), editable, dicek unik; perubahan slug membuat redirect 301 dari slug lama (P1).
  - [ ] Produk `draft`/`archived` tidak tampil di website dan tidak bisa masuk keranjang.
  - [ ] Hapus produk yang pernah dipesan = soft delete (`deleted_at`); `order_items` menyimpan snapshot sehingga riwayat utuh.
  - [ ] Perubahan produk aktif ter-reflect di website publish tanpa publish ulang manual (data diambil runtime atau revalidate cache; strategi di [07](./07-publishing-hosting.md)).

### COM-061 Varian
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Produk punya 0–3 **opsi** (mis. `Ukuran`, `Warna`, `Rasa`), masing-masing dengan nilai. Kombinasi nilai = **varian** dengan `price` (override opsional), `compare_at_price`, `sku`, `stock`, `weight_grams`, `image_id`, `is_active`. Maks 100 varian per produk.
  ```json
  {
    "options": [
      { "name": "Ukuran", "values": ["16 cm", "20 cm"] },
      { "name": "Rasa", "values": ["Coklat", "Keju"] }
    ],
    "variants": [
      { "id": "var_01", "optionValues": ["16 cm", "Coklat"], "price": 150000, "sku": "BRW-16-CK", "stock": 5 },
      { "id": "var_02", "optionValues": ["20 cm", "Keju"],   "price": 210000, "sku": "BRW-20-KJ", "stock": 0 }
    ]
  }
  ```
- **Acceptance criteria:**
  - [ ] Editor varian bisa generate semua kombinasi dari opsi, lalu nonaktifkan yang tidak dijual.
  - [ ] Bila produk punya varian, pembeli wajib memilih varian sebelum add to cart; varian stok 0 tampil "Habis" dan tidak bisa dipilih (kecuali `allow_backorder`, P2).
  - [ ] Harga tampil "mulai dari Rp…" di product card bila harga varian berbeda.

### COM-062 Stok & reservasi
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:**
  - Stok disimpan per varian (atau per produk bila tanpa varian) bila `track_inventory = true`.
  - **Reservasi saat order dibuat** (bukan saat add to cart): dalam satu transaksi DB, `UPDATE product_variants SET stock_reserved = stock_reserved + :qty WHERE id = :id AND stock - stock_reserved >= :qty`. Gagal → checkout menolak item tersebut.
  - Saat `paid`: `stock = stock - qty`, `stock_reserved = stock_reserved - qty` (commit).
  - Saat `expired`/`cancelled` sebelum bayar: reservasi dilepas.
  - Masa reservasi = masa berlaku pembayaran (default 60 menit untuk gateway; 24 jam untuk transfer manual; dapat diatur).
  - Pergerakan stok tercatat di `inventory_movements` (P1) untuk audit.
- **Acceptance criteria:**
  - [ ] Test konkurensi: 2 checkout paralel untuk stok terakhir → tepat 1 berhasil.
  - [ ] Stok tersedia yang ditampilkan ke publik = `stock - stock_reserved`.
  - [ ] Owner mendapat trigger `commerce.stock.low` saat stok tersedia ≤ ambang (default 3).

### COM-063 Kategori / koleksi
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** `product_categories` (nama, slug, deskripsi, gambar, urutan, `parent_id` maks 2 level). Produk many-to-many dengan kategori. Halaman kategori `/{categoryBasePath}/{slug}` dirender dari template dynamic page. Koleksi otomatis (rule-based, mis. "harga < 50rb") = P2.
- **Acceptance criteria:**
  - [ ] Product grid dapat difilter per kategori via binding (props `categoryId` atau dari URL).
  - [ ] Urutan produk dalam kategori dapat diatur manual (drag) atau otomatis (terbaru, harga, terlaris P1).

### COM-064 Produk digital
- **Prioritas:** P2 · **Fase:** M9+
- **Deskripsi:** Produk tipe `digital` tanpa ongkir; file disimpan privat; setelah `paid`, pembeli menerima link unduh bertanda tangan (berlaku N hari, maks M unduhan).
- **Acceptance criteria:**
  - [ ] File tidak pernah bisa diakses tanpa order `paid`; batas ukuran file mengikuti kuota storage paket.

### COM-065 Gambar produk
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Gambar diunggah ke asset storage site (R2/MinIO), diproses worker menjadi beberapa ukuran (thumb 320, card 640, detail 1280, WebP/AVIF) — pipeline sama dengan asset umum ([07](./07-publishing-hosting.md)). Maks 10 gambar per produk (P0).
- **Acceptance criteria:**
  - [ ] `alt` text per gambar (bisa diisi AI, COM-141).
  - [ ] Gambar dihitung ke kuota storage paket.

---

## 8. Keranjang

### COM-070 Guest cart (lokal + server)
- **Prioritas:** P0 · **Fase:** M7 (lokal saja, untuk Order via WA) / M8 (lokal + server)
- **Deskripsi:** Keranjang guest disimpan di `localStorage` (`platform_cart_{siteId}`) berisi `{ cartToken?, items: [{ productId, variantId, qty }] }`. Di M8, saat item pertama ditambahkan, island memanggil `POST /_api/v1/commerce/carts` (same-origin; site-host meneruskan ke api `/runtime/v1/commerce/carts` dengan `X-Site-Token`, sehingga `siteId` berasal dari token, bukan path) → server membuat `carts` dengan `token` acak (dikembalikan sekali, disimpan di localStorage); perubahan berikutnya disinkronkan (`PUT /_api/v1/commerce/carts/:token/items`). Cart server kedaluwarsa 30 hari tanpa aktivitas.
- **Acceptance criteria:**
  - [ ] Cart tetap ada setelah reload & tutup tab.
  - [ ] Bila server tidak tersedia, cart lokal tetap berfungsi; sinkron ulang saat online.
  - [ ] Qty dibatasi 1–99 per baris dan tidak melebihi stok tersedia (dicek server, pesan ramah bila disesuaikan).

### COM-071 Cart member login
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Bila pembeli login (end-user auth site, [05](./05-dynamic-data.md)), cart terikat ke `member_id` (satu cart aktif per member per site) dan tersedia lintas device.
- **Acceptance criteria:**
  - [ ] Login di device lain menampilkan cart yang sama.
  - [ ] Logout tidak menghapus cart member; cart lokal dikosongkan.

### COM-072 Merge cart saat login
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Saat guest dengan cart login: item guest digabung ke cart member — baris dengan `(productId, variantId)` sama dijumlah (dibatasi stok/99), lainnya ditambahkan. Cart guest ditandai `merged_into`.
- **Acceptance criteria:**
  - [ ] Merge idempotent (dipanggil ulang tidak menggandakan qty).
  - [ ] Pembeli melihat notifikasi singkat bila ada item yang disesuaikan.

### COM-073 Validasi harga & ketersediaan di server
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Endpoint `GET /carts/:token` selalu mengembalikan cart **yang dihitung ulang server**: harga terkini, nama, gambar, stok tersedia, `warnings` (`price_changed`, `out_of_stock`, `product_unavailable`, `qty_adjusted`). Client tidak pernah mengirim harga.
- **Acceptance criteria:**
  - [ ] Mengubah harga di localStorage/devtools tidak mempengaruhi total checkout (test).
  - [ ] Item yang tidak lagi tersedia ditampilkan dengan tanda dan dikecualikan dari subtotal.

---

## 9. Checkout

### 9.1 Alur

```text
Cart ─▶ [1] Data pembeli ─▶ [2] Alamat & pengiriman ─▶ [3] Metode bayar & voucher ─▶ [4] Ringkasan
     ─▶ POST /checkout  (server: hitung ulang, reservasi stok, buat order + payment attempt)
     ─▶ provider.createPayment ─▶ redirect / popup / instruksi transfer
     ─▶ /checkout/result?order=TK-1042&t=<orderAccessToken>  (sukses / pending / gagal — status dibaca dari server)
```

Checkout default berupa **satu halaman** dengan section bertahap (lebih cocok mobile), dirender oleh component `CheckoutForm` (COM-110).

### COM-080 Data pembeli
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Field: `name` (wajib), `phone` (wajib, format Indonesia, dipakai notifikasi WA), `email` (wajib bila notifikasi email aktif; default wajib), `note` (opsional). Member login: prefill dari profil. Checkbox persetujuan syarat & kebijakan privasi toko (COM-163).
- **Acceptance criteria:**
  - [ ] Validasi Zod yang sama dipakai client (UX) dan server (otoritatif).
  - [ ] Nomor telepon dinormalisasi ke E.164 (`+62…`).

### COM-081 Alamat pengiriman
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Field: `recipientName`, `phone`, `addressLine`, `province`, `city`, `district` (kecamatan), `postalCode`, `notes`. Dropdown wilayah memakai dataset wilayah Indonesia statis (bundled JSON; sumber & lisensi data = OPEN). Opsi **ambil di toko (pickup)** tanpa alamat. Member dapat menyimpan beberapa alamat (P1).
- **Acceptance criteria:**
  - [ ] Bila semua item tidak memerlukan pengiriman (pickup/digital), section alamat disembunyikan.
  - [ ] Alamat disimpan sebagai snapshot di order (perubahan buku alamat tidak mengubah order lama).

> ❓ OPEN: Sumber dataset wilayah (provinsi/kab/kota/kecamatan) yang lisensinya jelas & mudah diperbarui; atau ambil dari API ongkir pihak ketiga bila dipakai (COM-082).

### COM-082 Ongkos kirim
- **Prioritas:** P0 (aturan manual) / P1 (API pihak ketiga) · **Fase:** M8 / M9
- **Deskripsi:** Owner membuat **shipping rules** (dievaluasi server, urutan prioritas):

  | Tipe | P | Contoh |
  |---|---|---|
  | `flat` | P0 | Rp15.000 per order |
  | `free_over` | P0 | gratis bila subtotal ≥ Rp200.000 |
  | `by_region` | P0 | Jabodetabek Rp10.000, Jawa Rp20.000, luar Jawa Rp35.000 (berdasarkan provinsi/kota) |
  | `by_weight` | P1 | Rp10.000 per kg (dibulatkan ke atas) |
  | `pickup` | P0 | Ambil di toko, Rp0, dengan alamat & jam toko |
  | `carrier_api` | P1 | ongkir real-time kurir via API agregator pihak ketiga |

  Pembeli memilih satu opsi pengiriman dari daftar yang lolos rule.
- **Acceptance criteria:**
  - [ ] Ongkir dihitung server di `POST /checkout/quote` dan dikunci di order.
  - [ ] Bila tidak ada rule yang cocok untuk alamat, checkout menampilkan "Pengiriman ke wilayah ini belum tersedia" dan tombol bayar dinonaktifkan.

> ❓ OPEN: Penyedia API ongkir pihak ketiga (agregator kurir Indonesia) — kandidat, harga, ketentuan kredensial (BYO API key milik owner, sama seperti gateway?) — verifikasi saat P1.

### COM-083 Voucher / diskon
- **Prioritas:** P1 · **Fase:** M9
- **Deskripsi:** `discount_codes`: kode, tipe (`percent` | `fixed` | `free_shipping`), nilai, minimal subtotal, maks potongan, periode berlaku, kuota total, kuota per pembeli (by phone/email/member), berlaku untuk produk/kategori tertentu. Diskon otomatis (tanpa kode) = P2.
- **Acceptance criteria:**
  - [ ] Pemakaian kuota dicatat atomik saat order dibuat; dilepas bila order expired/cancelled sebelum bayar.
  - [ ] Pesan error spesifik (kedaluwarsa, minimal belanja, kuota habis).

### COM-084 Pajak (PPN)
- **Prioritas:** P1 · **Fase:** M9
- **Deskripsi:** Default: harga produk dianggap **sudah termasuk pajak** dan Platform tidak menghitung pajak (banyak UMKM bukan PKP). Opsi P1: owner yang PKP mengaktifkan "Tampilkan PPN" dengan tarif yang diisi owner sendiri, mode `inclusive` / `exclusive`; nilai pajak tercatat di order & invoice.
- **Acceptance criteria:**
  - [ ] Tarif tidak di-hard-code; diisi owner, default kosong/nonaktif.
  - [ ] Pembulatan pajak per order (bukan per item), aturan pembulatan terdokumentasi di `money.ts`.

> ❓ OPEN: Tarif & aturan PPN yang berlaku, kewajiban faktur pajak, serta apakah Platform perlu menyediakan apa pun untuk PKP — konsultasikan ke konsultan pajak; Platform tidak memberi saran pajak di UI.

### COM-085 Pembuatan order & pembayaran
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** `POST /_api/v1/commerce/checkout` (→ api `/runtime/v1/commerce/checkout`) dengan header `Idempotency-Key` (UUID dari client per percobaan checkout). Server dalam **satu transaksi DB**:
  1. Muat cart, hitung ulang harga, ongkir, diskon, pajak → `totals`.
  2. Validasi `expectedTotal` dari client: bila beda dari server → `409 price_changed` + totals baru (pembeli harus konfirmasi ulang).
  3. Reservasi stok (COM-062).
  4. Insert `orders` (`status = 'pending_payment'`, `order_number` berurutan per site, mis. `TK-1042` dengan prefix dari owner), `order_items` (snapshot nama, varian, harga, berat, gambar).
  5. Insert `payments` (attempt #1, `status = 'pending'`, `expires_at`).
  6. Commit, lalu (di luar transaksi) panggil `provider.createPayment`. Gagal → `payments.status = 'failed_to_create'`, reservasi tetap sampai expiry agar pembeli bisa "Coba bayar lagi".
  7. Kembalikan `{ orderNumber, orderAccessToken, action }`.
- **Retry bayar:** dari halaman status, pembeli bisa "Bayar ulang" → attempt baru (`payments` baris baru) dengan reference gateway `TK-1042-2` bila gateway tidak mengizinkan reuse id (OPEN per gateway). Attempt lama di-cancel via `provider.cancel` bila didukung.
- **Acceptance criteria:**
  - [ ] Request checkout yang sama dengan `Idempotency-Key` sama mengembalikan order yang sama (tidak membuat order ganda).
  - [ ] `orderAccessToken` (acak, ≥128-bit) diperlukan untuk melihat status order sebagai guest; tidak ada enumerasi via `orderNumber` saja.
  - [ ] Total yang dikirim ke gateway = `orders.grand_total` persis (integer).
  - [ ] Waktu respons checkout p95 < 3 detik (di luar latensi gateway).

### COM-086 Halaman hasil: sukses / pending / gagal
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Route `/checkout/result` di website (system page, gaya mengikuti tema site; bisa dikustomisasi di editor) membaca status dari `GET /_api/v1/commerce/orders/:orderNumber?t=…` dan polling tiap 3 detik selama 2 menit bila `pending_payment`.
  - **Sukses** (`paid` dst.): ringkasan order, langkah berikut, tombol WA ke toko.
  - **Pending**: instruksi bayar (mis. nomor VA / QR dari gateway bila tersedia, atau tombol "Lanjutkan pembayaran"), hitung mundur expiry.
  - **Gagal/expired**: alasan umum + tombol "Bayar ulang" (bila stok masih ada) atau "Kembali belanja".
- **Acceptance criteria:**
  - [ ] Parameter query dari redirect gateway (mis. `transaction_status`) **tidak** dipakai untuk menentukan status (P3 di §1.4).
  - [ ] Cart dikosongkan setelah order dibuat (bukan setelah bayar); item dapat dipulihkan ke cart dari halaman gagal.

---

## 10. Order management (dashboard owner)

### COM-090 State machine order
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:**

  ```text
                    ┌──────────── cancelled ◀──────────┐ (owner/pembeli batal sebelum bayar)
                    │                                   │
  [create] ─▶ pending_payment ──(paid)──▶ paid ──▶ processing ──▶ shipped ──▶ completed
                    │                       │          │             │
                    └─(timeout)─▶ expired   └──────────┴─────────────┴──▶ refunded (manual/API)
                         └─(late payment, COM-171)─▶ paid / needs_review
  ```

  | Dari | Ke | Pemicu | Efek |
  |---|---|---|---|
  | `pending_payment` | `paid` | webhook/reconcile terverifikasi, konfirmasi owner (manual), owner tandai lunas (COD) | commit stok, trigger `order.paid` |
  | `pending_payment` | `expired` | job `expire-orders` setelah `expires_at` | lepas reservasi & voucher |
  | `pending_payment` | `cancelled` | owner / pembeli (member) | lepas reservasi, cancel payment di gateway bila bisa |
  | `paid` | `processing` | owner klik "Proses" (atau otomatis, setting) | — |
  | `processing`/`paid` | `shipped` | owner isi kurir & nomor resi | trigger `order.shipped` |
  | `shipped` | `completed` | owner, atau otomatis N hari setelah shipped (default 7, setting) | — |
  | `paid`..`completed` | `refunded` | owner catat refund (COM-174) | stok dikembalikan opsional |
  | `paid`/`processing` | `cancelled` | owner (wajib catat refund terlebih dahulu bila sudah dibayar) | — |

  COD: `pending_payment` dilewati → order dibuat dengan status `processing` dan `payment_status = 'unpaid'`; saat owner menandai lunas → `payment_status = 'paid'`. Karena itu order punya **dua dimensi**: `status` (fulfillment/lifecycle) dan `payment_status` (`unpaid` | `pending` | `paid` | `partially_refunded` | `refunded` | `void`).
- **Acceptance criteria:**
  - [ ] Transisi di luar tabel ditolak di service layer (`InvalidOrderTransitionError`) dan di-test.
  - [ ] Setiap transisi tercatat di `order_status_history` (`from`, `to`, `actor_type` = `system|owner|buyer|gateway`, `actor_id`, `note`, `created_at`).

### COM-091 Daftar & detail order
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** `Commerce > Pesanan`: tabel (nomor, tanggal, pembeli, total, status, payment_status, metode, badge test), filter (status, tanggal, metode), pencarian (nomor, nama, telepon), pagination. Detail order: item, totals, alamat, pembayaran (attempt, status gateway, id referensi gateway), timeline status, bukti transfer, catatan internal owner.
- **Acceptance criteria:**
  - [ ] Daftar memuat < 1 detik untuk 10.000 order (index `site_id, created_at desc`).
  - [ ] Owner dapat menambah catatan internal (tidak terlihat pembeli).
  - [ ] Badge `needs_review` untuk order yang perlu perhatian (amount mismatch, double payment).

### COM-092 Pengiriman & nomor resi
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Aksi "Kirim pesanan": pilih kurir (daftar teks bebas + saran umum), isi nomor resi, tanggal kirim. Link lacak = template URL per kurir yang diisi owner (P0) atau dari API ongkir (P1).
- **Acceptance criteria:**
  - [ ] Mengisi resi memicu transisi `shipped` dan trigger `commerce.order.shipped`.
  - [ ] Resi dapat diedit (tercatat di history) tanpa memicu notifikasi ganda, kecuali owner memilih "Kirim ulang notifikasi".

### COM-093 Notifikasi email/WA
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Semua notifikasi commerce dijalankan oleh **workflow** (COM-056) memakai template yang bisa diedit owner (subject/isi dengan placeholder `{{order.number}}`, `{{order.total}}`, dst.). Default:

  | Event | Ke pembeli | Ke owner |
  |---|---|---|
  | order dibuat (pending) | email "Selesaikan pembayaran" + link status | — |
  | paid | email + WA "Pembayaran diterima" | email + WA "Pesanan baru dibayar" |
  | bukti transfer diunggah | — | email + WA "Cek bukti transfer" |
  | shipped | email + WA dengan resi | — |
  | expired | email "Pesanan kedaluwarsa" (opsional) | — |

- **Acceptance criteria:**
  - [ ] Email dikirim dari domain Platform dengan `reply-to` email toko (domain kustom pengirim = OPEN di [08](./08-accounts-plans-admin.md)).
  - [ ] Kegagalan kirim notifikasi tidak menggagalkan transisi order (dicatat & di-retry worker).

### COM-094 Invoice PDF
- **Prioritas:** P1 · **Fase:** M9
- **Deskripsi:** Generate invoice PDF per order (nama/logo toko, nomor order, item, total, status pembayaran) di worker (render HTML → PDF via Playwright yang sudah ada di stack). Tersedia di dashboard owner & halaman status pembeli.
- **Acceptance criteria:**
  - [ ] PDF disimpan privat, diakses via signed URL.
  - [ ] Nomor invoice berurutan per site (format diatur owner).

### COM-095 Export CSV
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Export order (rentang tanggal & filter) ke CSV: satu baris per order item atau per order (pilihan). Dikerjakan worker untuk > 1.000 baris, link unduh dikirim via email/notifikasi dashboard.
- **Acceptance criteria:**
  - [ ] CSV UTF-8 dengan BOM (agar terbaca benar di Excel), angka uang tanpa format ribuan.
  - [ ] Tidak memuat data pembayaran sensitif (hanya metode & id referensi gateway).
  - [ ] Export tercatat di audit log (data pribadi pembeli, lihat COM-162).

### COM-096 Dashboard penjualan sederhana
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** `Commerce > Ringkasan`: omzet (order `paid`+), jumlah order, rata-rata nilai order, produk terlaris (top 5), grafik harian 30 hari, order perlu tindakan (bukti transfer menunggu, `paid` belum diproses, `needs_review`). Timezone `Asia/Jakarta` (atau timezone site).
- **Acceptance criteria:**
  - [ ] Angka mengecualikan order test, `cancelled`, `expired`; refund dikurangkan.
  - [ ] Query agregat < 500 ms untuk 50.000 order (boleh tabel agregat harian P1).

---

## 11. Akun pembeli

### COM-100 Riwayat pesanan member
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Memakai end-user auth per site ([05](./05-dynamic-data.md)). Member melihat `Akun > Pesanan saya`: daftar order miliknya, detail, status, resi, tombol bayar ulang (bila pending), unduh invoice (P1). Dirender component `OrderStatus`/`OrderList` (COM-110) yang terikat ke `sys_orders` dengan filter otomatis `member_id = currentMember`.
- **Acceptance criteria:**
  - [ ] Member tidak dapat melihat order member lain (test otorisasi pada runtime API, bukan hanya filter UI).
  - [ ] Checkout sebagai guest dengan email yang sama dengan member: order **tidak** otomatis ditautkan; tautkan hanya setelah verifikasi email (P1: "Klaim pesanan").

### COM-101 Lacak pesanan guest
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Guest mengakses status via link berisi `orderAccessToken` (dikirim di email/WA). Opsi P1: form "Lacak pesanan" (nomor order + nomor HP → kirim link ke email/WA terdaftar, bukan langsung menampilkan data).
- **Acceptance criteria:**
  - [ ] Halaman status tidak menampilkan alamat lengkap kepada pihak tanpa token valid.

### COM-102 Checkout sebagai member atau guest
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Setting owner: `guest_checkout` = `allowed` (default) | `required_login`. Bila login wajib, checkout mengarahkan ke login/registrasi end-user lalu kembali.
- **Acceptance criteria:**
  - [ ] Setelah login, cart di-merge (COM-072) dan pembeli kembali ke langkah checkout yang sama.

---

## 12. Component commerce di library

Semua component commerce adalah component library biasa ([03](./03-components-templates.md)) — JSON berversi, punya props & variants, bisa di-style dan dirakit AI — dengan **binding bawaan** ke system collections/runtime API commerce. Di website publish mereka menjadi **islands** ([07](./07-publishing-hosting.md)). Di editor, mereka menampilkan data produk nyata site (atau data contoh bila katalog kosong).

### COM-110 Daftar component commerce
- **Prioritas:** P0 · **Fase:** M7 (ditandai ⓦ) / M8
- **Deskripsi:**

  | Component | Props utama | Island? | Fase |
  |---|---|---|---|
  | `ProductCard` | `productId` / binding item, `showCompareAt`, `showAddToCart`, `imageRatio` | ya (add to cart) | M7 ⓦ |
  | `ProductGrid` | `source` (`all`/`category`/`featured`/manual ids), `limit`, `columns {base,tablet,mobile}`, `sort` | data saat build + revalidate | M7 ⓦ |
  | `ProductDetail` | binding ke produk halaman dinamis; galeri, pilihan varian, qty, stok, deskripsi | ya | M7 ⓦ |
  | `CartDrawer` | `position`, `showNote`, `checkoutMode` (`checkout` / `whatsapp`) | ya | M7 ⓦ |
  | `MiniCartIcon` | `icon`, `showCount`, `opens` (`drawer`/`page`) | ya | M7 ⓦ |
  | `WhatsAppOrderButton` | `label`, `messageTemplate` (default dari Settings) | ya | M7 ⓦ |
  | `CheckoutForm` | `layout` (`single`/`steps`), `fields` toggle, teks | ya | M8 |
  | `OrderStatus` | dari `orderNumber` + token / member | ya | M8 |
  | `OrderList` (akun) | `pageSize` | ya | M8 |
  | `CategoryList` | `style` (chips/cards), `parentId` | data | M8 |
  | `ProductSearch` | `placeholder` | ya | P1 |

- **Acceptance criteria:**
  - [ ] Semua component di atas tersedia di panel library kategori "Toko" dengan minimal 2 variant desain masing-masing.
  - [ ] Component tetap merender keadaan kosong/loading/error yang rapi (skeleton, "Produk tidak ditemukan").
  - [ ] Format harga konsisten `Rp150.000` (locale `id-ID`, tanpa desimal) via `packages/payments/money.ts` yang sama dengan server.
  - [ ] Aksesibilitas: tombol tambah ke keranjang punya label, drawer fokus-trap (Radix Dialog), pilihan varian bisa keyboard.

### COM-111 Template toko
- **Prioritas:** P0 · **Fase:** M8 (versi WA-only: M7)
- **Deskripsi:** Minimal 3 template toko (kuliner/kue, fashion, produk lokal/kerajinan) berisi: beranda, katalog, halaman produk (dynamic), kategori, keranjang, checkout, hasil checkout, akun pembeli, halaman kebijakan (pengiriman, pengembalian, privasi — teks contoh yang wajib diperiksa owner).
- **Acceptance criteria:**
  - [ ] Memakai template membuat produk contoh (`is_sample = true`) yang mudah dihapus massal.
  - [ ] Halaman kebijakan contoh berlabel "Contoh — sesuaikan dengan toko Anda" di editor.

### COM-112 Mode commerce di editor
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Saat site memiliki commerce aktif, editor menampilkan panel "Toko" (shortcut ke produk, kategori, pesanan, Settings > Payments) dan validasi publish: peringatan bila ada `CheckoutForm` tetapi pembayaran belum dikonfigurasi, atau halaman kebijakan belum diisi.
- **Acceptance criteria:**
  - [ ] Checklist pra-publish commerce tampil di dialog publish ([07](./07-publishing-hosting.md)) — non-blocking kecuali "tidak ada metode bayar aktif" untuk toko dengan checkout.

---

## 13. Peran AI

AI asisten ([04](./04-ai-agent.md)) bekerja lewat tools ber-schema Zod ([04 §4.8](./04-ai-agent.md#48-commerce-06--entitlement-aicommerce-fase-m8)) dan skill `building-online-store`, `product-copywriting`, `order-system` ([04 AI-082](./04-ai-agent.md#ai-082-daftar-skill-awal)). Semua perubahan AI masuk draft/transaction yang bisa di-undo.

### COM-140 Setup toko dari prompt
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Prompt seperti *"Buatkan toko kue online, ada brownies dan bolu, bisa pesan via WhatsApp dan bayar QRIS"* → AI: memilih/merakit template toko, membuat kategori & produk draft (dengan harga placeholder yang ditandai untuk diperiksa), menambahkan component commerce, membuat shipping rule dasar, mengaktifkan workflow notifikasi default, lalu **mengarahkan owner** ke Settings > Payments untuk menghubungkan gateway sendiri.
- **Tools (nama resmi di [04 §4.8](./04-ai-agent.md#48-commerce-06--entitlement-aicommerce-fase-m8), di `packages/ai-tools`):** `get_commerce_overview`, `configure_store`, `create_products` (batch, status `draft`), `update_product`, `create_product_category`, `set_shipping_options`, `configure_whatsapp_order` (nomor diisi owner/konfirmasi), `create_store_pages`, `get_payment_connection_status` (hanya status: `connected`, `provider`, `mode`).
- **Acceptance criteria:**
  - [ ] Produk buatan AI berstatus `draft` sampai owner menyetujui (atau owner mengaktifkan opsi "terbitkan langsung").
  - [ ] AI tidak mengarang harga final tanpa input; harga contoh diberi flag `needs_review`.
  - [ ] Pemakaian kredit AI mengikuti [04](./04-ai-agent.md) / [08](./08-accounts-plans-admin.md).

### COM-141 Copywriting produk
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Aksi "Tulis dengan AI" di form produk: deskripsi, judul SEO, meta description, alt text gambar (melihat gambar via vision), dalam bahasa Indonesia/Inggris, dengan gaya (santai, formal, persuasif).
- **Acceptance criteria:**
  - [ ] Hasil masuk sebagai saran yang bisa diterima/ditolak, tidak langsung menimpa.
  - [ ] AI diinstruksikan (skill) untuk tidak membuat klaim kesehatan/legal yang menyesatkan (mis. "menyembuhkan").

### COM-142 AI tidak pernah membaca kredensial
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Tidak ada tool AI yang dapat membaca, menulis, atau menguji `payment_gateway_configs`; konteks yang dikirim ke model tidak memuat secret, data kartu, bukti transfer, atau data pribadi pembeli kecuali agregat (mis. "12 order minggu ini"). Bila owner menempelkan API key ke chat AI, pesan di-scan pola secret → disensor sebelum dikirim ke model, dan owner diarahkan ke Settings > Payments.
- **Acceptance criteria:**
  - [ ] Test: registry tool AI tidak memuat tool apa pun yang menyentuh modul `payments/configs`.
  - [ ] Detektor pola secret (heuristik prefix & entropi; pola per gateway = OPEN) menyensor input chat dan menampilkan peringatan.
  - [ ] Tool daftar pesanan (`list_orders`, belum ada di 04 — ❓ OPEN, P1) bila ditambahkan hanya mengembalikan field non-PII atau PII yang disamarkan.

### COM-143 Import produk (daftar teks / CSV / foto)
- **Prioritas:** P1 · **Fase:** M9
- **Deskripsi:**
  - **CSV**: template kolom (`name, price, compare_at_price, sku, stock, category, weight_grams, description, image_url, option1_name, option1_value, …`); importer deterministik (non-AI) + AI untuk memetakan header tidak standar.
  - **Daftar teks**: tempel "Brownies coklat 16cm 150rb, …" → AI mem-parse ke produk draft.
  - **Foto**: unggah foto produk/menu → AI (vision) mengusulkan nama, deskripsi, kategori; harga dari foto menu bila terbaca.
- **Acceptance criteria:**
  - [ ] Pratinjau sebelum import, baris error ditandai; import idempotent per `sku`.
  - [ ] Semua hasil impor berstatus `draft`.

---

## 14. Paket & kuota

Detail paket & harga di [08](./08-accounts-plans-admin.md) — **angka final mengikuti 08 §6.2.5** (sumber kebenaran); tabel ini ringkasan untuk commerce dan sudah diselaraskan dengan 08:

| Kemampuan | Free | Starter | Pro | Business |
|---|---|---|---|---|
| Tombol WhatsApp (link biasa) | ✅ | ✅ | ✅ | ✅ |
| Katalog statis + tombol "Pesan via WhatsApp" (`commerce.catalogWa`) | ✅ 10 produk | ✅ 50 produk | ✅ | ✅ |
| Cart + Order via WhatsApp (COM-003, butuh runtime API) | ❌ | ❓ OPEN (08 belum memisahkan dari katalog statis) | ✅ | ✅ |
| Checkout + gateway milik user (BYOG, `commerce.checkout`) | ❌ | ❌ | ✅ | ✅ |
| Transfer manual / COD | ❌ | ❓ OPEN | ✅ | ✅ |
| Batas produk (`commerce.productsMax`) | 10 | 50 | 1.000 | 10.000 |
| Batas order / bulan (`commerce.ordersMonthly`, non-test) | — | — | 1.000 | 10.000 |
| Voucher, ongkir API, invoice PDF (P1) | ❌ | ❌ | ✅ | ✅ |
| Fee transaksi Platform (`commerce.platformFeePct`) | 0% | 0% | 0% | 0% |

### COM-150 Gating commerce berdasarkan paket
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Entitlement `commerce.catalogWa`, `commerce.checkout`, `commerce.productsMax`, `commerce.ordersMonthly` (key resmi [08 §6.2.5](./08-accounts-plans-admin.md)) dibaca dari plan service. Commerce penuh memerlukan website dinamis (runtime API) — konsisten dengan aturan "dinamis hanya di paket dengan AI".
- **Acceptance criteria:**
  - [ ] Gating ditegakkan di server (API) dan UI (upsell), bukan hanya UI.
  - [ ] Melewati batas order bulanan **tidak** memblokir checkout seketika (pembeli tidak boleh dirugikan); owner diberi peringatan 80%/100% dan masa tenggang (OPEN: kebijakan setelah tenggang).

### COM-151 Downgrade & berhenti berlangganan
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Saat paket turun di bawah syarat commerce: checkout online dinonaktifkan di website (diganti pesan "Toko sedang tutup" atau fallback Order via WhatsApp bila paket mengizinkan), data produk/order **tidak dihapus**, dashboard order tetap bisa dibaca (read-only) minimal 90 hari, webhook untuk order yang sedang pending tetap diproses.
- **Acceptance criteria:**
  - [ ] Order `pending_payment` yang ada saat downgrade tetap dapat diselesaikan pembayarannya.

> ❓ OPEN: Apakah Starter mendapat Order via WhatsApp / transfer manual? Apakah ada paket khusus "Toko" di antara Starter–Pro?

### COM-152 Fee transaksi Platform
- **Prioritas:** P0 (keputusan) · **Fase:** M8
- **Deskripsi:** **Rekomendasi: tidak mengambil fee transaksi di awal.** Alasan: (1) dengan BYOG, Platform tidak berada di jalur dana sehingga fee harus ditagih terpisah (rumit, rekonsiliasi berdasarkan data order); (2) nilai jual terhadap kompetitor; (3) pendapatan dari langganan. Revisit bila mode aggregator (COM-004) diterapkan.
- **Acceptance criteria:**
  - [ ] Tidak ada logika fee di kode M8; skema menyimpan `grand_total` sehingga fee berbasis volume dapat dihitung nanti bila diputuskan.

> ❓ OPEN: Fee transaksi (0% vs persentase kecil di paket bawah) — keputusan bisnis owner.

---

## 15. Keamanan & kepatuhan

### COM-160 PCI DSS — tidak menyimpan data kartu
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Pembayaran kartu **hanya** via hosted page/popup gateway (Snap, Invoice). Platform tidak pernah menerima, memproses, atau menyimpan PAN/CVV/expiry. Tidak ada input kartu di component Platform. Ini menjaga scope PCI Platform minimal (level SAQ yang berlaku = OPEN, verifikasi dengan gateway).
- **Acceptance criteria:**
  - [ ] Tidak ada field `card_number`/`cvv` di skema maupun schema Zod mana pun (lint rule/grep di CI).
  - [ ] CSP website publish mengizinkan domain script gateway hanya pada halaman checkout (bila popup dipakai).

### COM-161 Fraud & abuse dasar
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Rate limit checkout per IP & per cart (mis. 10 order/jam/IP), maks order pending per nomor HP (mis. 5), CAPTCHA tanpa friksi (Turnstile) saat terdeteksi abuse, blokir order dengan total 0 / negatif, deteksi kartu (fraud scoring) diserahkan ke gateway. Order dengan `amount mismatch` → `needs_review`.
- **Acceptance criteria:**
  - [ ] Bot membuat 100 order palsu berturut-turut → tertahan rate limit & reservasi stok tidak habis (reservasi order pending per IP dibatasi).
  - [ ] Owner bisa memblokir nomor HP/email pembeli (P1).

### COM-162 Perlindungan data pembeli (UU PDP)
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Dalam kerangka UU No. 27/2022 tentang Pelindungan Data Pribadi, **owner adalah pengendali data** pembeli tokonya; **Platform adalah prosesor**. Konsekuensi:
  - Data pembeli (nama, HP, email, alamat) di-scope per site, terenkripsi at-rest (enkripsi disk/DB), akses dibatasi owner & role berizin.
  - Retensi: data order disimpan selama site aktif; anonimisasi PII order setelah N tahun atau atas permintaan owner (P1), dengan tetap menyimpan nilai transaksi.
  - Hak subjek data: owner bisa mengekspor/menghapus data pembeli tertentu (P1).
  - Staf Platform hanya mengakses data pembeli untuk support dengan izin owner & tercatat audit.
- **Acceptance criteria:**
  - [ ] DPA/ketentuan prosesor tercantum di syarat layanan ([08](./08-accounts-plans-admin.md)).
  - [ ] Log aplikasi tidak memuat alamat/HP lengkap (masking).

> ❓ OPEN: Kewajiban detail UU PDP (retensi, notifikasi kebocoran, penunjukan pejabat PDP) — konsultasi hukum.

### COM-163 Syarat & ketentuan
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** (a) **Ketentuan commerce Platform** yang disetujui owner saat mengaktifkan toko (BYOG, tanggung jawab owner, produk terlarang, Platform bukan pihak dalam transaksi jual-beli). (b) **Halaman kebijakan toko** (syarat, pengiriman, pengembalian, privasi) milik owner — template disediakan, owner wajib meninjau; link ditampilkan di checkout.
- **Acceptance criteria:**
  - [ ] Persetujuan owner dicatat (`terms_version`, `accepted_at`, `user_id`).
  - [ ] Checkout menampilkan link kebijakan toko; bila halaman kebijakan tidak ada, checklist publish memperingatkan.

### COM-164 Kebijakan produk terlarang & moderasi
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Daftar kategori terlarang (mis. narkotika, senjata, judi, konten dewasa, produk ilegal/palsu, obat keras tanpa izin — daftar final di [08](./08-accounts-plans-admin.md)). Gateway owner juga punya kebijakan sendiri. Mekanisme: skrining otomatis nama/deskripsi produk saat publish (keyword + klasifikasi AI ringan), laporan abuse dari publik, antrian moderasi admin, aksi: nonaktifkan checkout site, takedown produk, suspend site.
- **Acceptance criteria:**
  - [ ] Produk yang ditandai skrining masuk antrian review, tidak otomatis diblokir (kecuali skor sangat tinggi, OPEN ambang).
  - [ ] Suspend commerce site tidak menghapus data dan tercatat di audit log admin.

### COM-165 Keamanan runtime API commerce
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Endpoint runtime (publik `/_api/v1/commerce/...` → internal `/runtime/v1/commerce/...`; `siteId` hanya dari `X-Site-Token`) memvalidasi `Origin` terhadap domain site (subdomain/custom domain), same-origin tanpa CORS, Zod untuk semua input, token cart/order acak, tidak ada endpoint list order publik.
- **Acceptance criteria:**
  - [ ] Test IDOR: mengganti `siteId`/`orderNumber` tanpa token → 404.

---

## 16. Edge cases

### COM-170 Pembayaran expired
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Job `expire-orders` (tiap menit) memindahkan order `pending_payment` dengan `expires_at < now()` ke `expired` **setelah** `getStatus` memastikan belum dibayar; reservasi stok & voucher dilepas; cancel di gateway bila didukung.
- **Acceptance criteria:**
  - [ ] Tidak ada order yang di-expire bila gateway menyatakan `paid` (cek terakhir sebelum transisi).

### COM-171 Webhook terlambat (bayar setelah expired)
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Bila pembayaran sah tiba setelah order `expired`: coba re-reservasi & commit stok; bila stok cukup → order `paid` normal (dengan catatan "pembayaran terlambat"); bila stok tidak cukup → order `paid` + flag `needs_review` (`reason = 'late_payment_out_of_stock'`), owner dinotifikasi untuk memenuhi atau refund manual.
- **Acceptance criteria:**
  - [ ] Uang pembeli tidak pernah "hilang" tanpa jejak: setiap pembayaran `paid` terverifikasi selalu terkait ke order yang terlihat owner.

### COM-172 Double payment
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Dua attempt untuk order yang sama sama-sama `paid` (mis. pembeli bayar VA lama dan QR baru). Attempt pertama yang terverifikasi menjadikan order `paid`; attempt kedua dicatat `payments.status = 'paid'` dengan `is_duplicate = true`, order diberi flag `needs_review` (`reason = 'double_payment'`) agar owner me-refund kelebihan (manual/API P1).
- **Acceptance criteria:**
  - [ ] Tidak ada transisi/notifikasi `paid` ganda ke pembeli; owner menerima notifikasi khusus "pembayaran ganda".

### COM-173 Stok habis saat bayar & perubahan harga
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:**
  - Stok sudah direservasi saat order dibuat, jadi stok tidak bisa habis di tengah pembayaran kecuali owner menurunkan stok manual; penurunan stok di bawah reservasi diperingatkan di UI.
  - Perubahan harga oleh owner setelah order dibuat **tidak** mempengaruhi order (snapshot). Perubahan sebelum order dibuat → `409 price_changed` (COM-085).
- **Acceptance criteria:**
  - [ ] Owner tidak dapat menyetel stok < `stock_reserved` tanpa konfirmasi eksplisit.

### COM-174 Refund
- **Prioritas:** P0 (manual) / P1 (via API) · **Fase:** M8 / M9
- **Deskripsi:** P0: owner melakukan refund di dashboard gateway miliknya / transfer manual, lalu **mencatat** refund di Platform (jumlah, alasan, tanggal) → `payment_status` `refunded`/`partially_refunded`, opsi kembalikan stok. P1: tombol refund memanggil `provider.refund` (bila `capabilities.refund = 'api'`) dengan idempotency key; hasil final dikonfirmasi via webhook/getStatus.
- **Acceptance criteria:**
  - [ ] Total refund tidak boleh melebihi total dibayar.
  - [ ] Refund tercatat di `payment_events` dan `order_status_history`.

### COM-175 Mata uang & pembulatan
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi:** Hanya **IDR** di awal. Semua nilai uang = `bigint` integer rupiah; tidak ada float. Kolom `currency` tetap ada (`'IDR'`) untuk masa depan. Persentase diskon dibulatkan ke bawah per baris (`Math.floor`), total = jumlah baris.
- **Acceptance criteria:**
  - [ ] `money.ts` punya unit test pembulatan; lint melarang aritmetika uang dengan `number` desimal di modul commerce.

### COM-176 Kasus lain
- **Prioritas:** P0 · **Fase:** M8
- **Deskripsi & penanganan:**

  | Kasus | Penanganan |
  |---|---|
  | Owner mengganti kredensial saat ada order pending | Config lama disimpan sampai pending selesai/expired; getStatus memakai config yang dipakai saat membuat payment (`payments.config_id`). |
  | Owner belum mendaftarkan webhook URL | Reconcile job (COM-054) tetap menyelesaikan order; dashboard menampilkan peringatan "Webhook belum diterima". |
  | Gateway down saat checkout | Order tetap tercipta `pending_payment`, halaman hasil menampilkan "Coba bayar lagi" + metode offline. |
  | Pembeli menutup popup | Status tetap pending; halaman hasil menampilkan tombol lanjutkan pembayaran. |
  | Produk dihapus saat ada di cart | Cart menampilkan item tidak tersedia, dikecualikan dari total. |
  | Amount di gateway ≠ order | `needs_review`, tidak auto-paid (COM-052). |
  | Site di-suspend | Checkout off; webhook tetap diproses untuk order yang sudah ada. |

---

## 17. Skema data

Semua tabel memiliki `id uuid pk` (UUIDv7), `created_at`, `updated_at timestamptz`, dan `site_id uuid not null` (FK `sites`, index) kecuali disebut lain. Uang = `bigint` (rupiah). Definisi Drizzle di `packages/db/src/schema/commerce.ts` (`@platform/db`, satu-satunya lokasi schema — lihat [ARCHITECTURE §6.3](../ARCHITECTURE.md#63-tabel-per-domain)); Zod via drizzle-zod. Nama tabel mengikuti ARCHITECTURE.

### COM-180 Tabel commerce & payments
- **Prioritas:** P0 · **Fase:** M8 (`products`, `product_categories`, `product_category_links` sudah di M7 untuk Order via WA)
- **Deskripsi:**

```text
products
  site_id, name text, slug text, description_doc jsonb, description_html text,
  price bigint, compare_at_price bigint null, sku text null, status text('draft'|'active'|'archived'),
  track_inventory bool default true, stock int default 0, stock_reserved int default 0,
  weight_grams int null, options jsonb  -- [{name, values[]}]
  image_ids uuid[], attributes jsonb default '{}', seo jsonb, is_featured bool, is_sample bool,
  sort_index int, deleted_at timestamptz null
  UNIQUE(site_id, slug) WHERE deleted_at IS NULL; UNIQUE(site_id, sku) WHERE sku IS NOT NULL
  CHECK(price >= 0), CHECK(stock_reserved >= 0)

product_variants
  site_id, product_id fk, option_values text[], title text,  -- "20 cm / Keju"
  price bigint null (null = ikut produk), compare_at_price bigint null, sku text null,
  stock int, stock_reserved int, weight_grams int null, image_id uuid null, is_active bool, sort_index int
  UNIQUE(product_id, option_values); CHECK(stock_reserved >= 0)

product_categories            site_id, name, slug, description, image_id, parent_id null, sort_index; UNIQUE(site_id, slug)
product_category_links        product_id, category_id, sort_index; PK(product_id, category_id)

carts
  site_id, token_hash text unique, member_id uuid null, status text('active'|'converted'|'merged'|'abandoned'),
  merged_into uuid null, items jsonb  -- [{productId, variantId, qty, addedAt}]
  last_activity_at timestamptz, expires_at timestamptz
  UNIQUE(site_id, member_id) WHERE status='active' AND member_id IS NOT NULL

orders
  site_id, order_number text, access_token_hash text, member_id uuid null, is_test bool,
  status text('pending_payment'|'paid'|'processing'|'shipped'|'completed'|'cancelled'|'expired'|'refunded'),
  payment_status text('unpaid'|'pending'|'paid'|'partially_refunded'|'refunded'|'void'),
  payment_method text('midtrans'|'xendit'|'manual_transfer'|'cod'|'whatsapp_order'),
  currency char(3) default 'IDR',
  subtotal bigint, shipping_total bigint, discount_total bigint, tax_total bigint, grand_total bigint,
  refunded_total bigint default 0,
  buyer jsonb       -- {name, email, phone, note}
  shipping_address jsonb null, shipping_method jsonb  -- snapshot rule {type, label, amount}
  shipment jsonb null  -- {courier, trackingNumber, trackingUrl, shippedAt}
  discount_code text null, flags text[]  -- ['needs_review','late_payment',...]
  internal_note text, idempotency_key text, expires_at timestamptz, paid_at, cancelled_at, completed_at
  UNIQUE(site_id, order_number); UNIQUE(site_id, idempotency_key); INDEX(site_id, created_at DESC); INDEX(site_id, status)

order_items
  site_id, order_id fk, product_id uuid null, variant_id uuid null,
  name_snapshot text, variant_title_snapshot text null, sku_snapshot text null, image_snapshot text null,
  unit_price bigint, quantity int, line_discount bigint default 0, line_total bigint, weight_grams int null

order_status_history          site_id, order_id, from_status, to_status, actor_type, actor_id null, note, created_at

payments                       -- satu baris per percobaan bayar
  site_id, order_id fk, attempt_no int, config_id uuid null (fk payment_gateway_configs),
  provider text, env text('sandbox'|'production'), provider_reference text  -- mis. "TK-1042-2"
  provider_payment_id text null, method text null, amount bigint, currency char(3),
  status text('pending'|'failed_to_create'|'awaiting_confirmation'|'paid'|'failed'|'expired'|'cancelled'|'refunded'|'partially_refunded'),
  is_duplicate bool default false, action jsonb  -- redirect url / instruksi (tanpa secret)
  proof_asset_id uuid null, expires_at, paid_at, raw_redacted jsonb
  UNIQUE(order_id, attempt_no); UNIQUE(provider, provider_reference)

payment_events                 -- log append-only setiap event masuk/keluar
  site_id, payment_id uuid null, order_id uuid null, config_id uuid null, provider text,
  provider_event_id text, source text('webhook'|'reconcile'|'owner_manual'|'api_call'),
  verification text('verified'|'failed'|'unverified'|'not_applicable'),
  normalized_status text null, provider_status text null, amount bigint null,
  processing_status text('received'|'processed'|'ignored_out_of_order'|'rejected'|'error'),
  payload_redacted jsonb, error text null, received_at, processed_at
  UNIQUE(provider, provider_event_id)

payment_gateway_configs
  site_id, provider text, env text, mode text default 'byog',
  status text('not_configured'|'unverified'|'connected'|'invalid_credentials'|'unreachable'|'inactive'),
  ciphertext bytea null, nonce bytea null, encrypted_dek bytea null, kek_id text, kek_version int,
  masked_fields jsonb  -- {"serverKey":"••••a91F"}
  public_fields jsonb   -- {"clientKey":"..."} hanya field yang memang publik
  enabled_methods text[], webhook_token text unique, webhook_token_prev text null, webhook_token_prev_expires_at,
  last_tested_at, last_test_result text, last_webhook_at, deactivated_at
  UNIQUE(site_id, provider, env)

site_commerce_settings         -- 1 baris per site
  site_id unique, enabled bool, payment_mode text('sandbox'|'production'), active_provider text null,
  order_prefix text, guest_checkout text, reservation_minutes int default 60, manual_transfer_hours int default 24,
  manual_accounts jsonb, cod jsonb, whatsapp jsonb  -- {number, template, recordOrder}
  shipping_rules jsonb, tax jsonb null, auto_complete_days int default 7, low_stock_threshold int default 3,
  terms_version text, terms_accepted_at, terms_accepted_by

discount_codes (P1)            site_id, code, type, value, min_subtotal, max_discount, starts_at, ends_at, usage_limit, used_count, per_buyer_limit, scope jsonb
```

- **Acceptance criteria:**
  - [ ] Migrasi drizzle-kit untuk semua tabel P0 + index & constraint di atas.
  - [ ] Semua query repository commerce mewajibkan `site_id` (helper `scopedTo(siteId)`), di-test agar tidak ada query tanpa scope.
  - [ ] `payment_events` append-only (tanpa UPDATE pada payload; hanya `processing_status`/`processed_at`).
  - [ ] Token (`carts.token_hash`, `orders.access_token_hash`) disimpan sebagai hash SHA-256, bukan plaintext.

### 17.1 Pemetaan ke system collections (read-only)

| System collection | Sumber | Field yang diekspos | Siapa yang bisa baca |
|---|---|---|---|
| `sys_products` | `products` + varian | name, slug, price, compareAtPrice, images, categories, stockAvailable, attributes.*, url | publik (hanya `active`) |
| `sys_product_categories` | `product_categories` | name, slug, image, url, productCount | publik |
| `sys_orders` | `orders` + items | number, status, paymentStatus, totals, items, shipment, createdAt | member pemilik / owner |

---

## 18. Contoh alur lengkap: Toko Kue Bu Sari

**Konteks:** Bu Sari (paket Pro) punya website `kuebusari.platformmu.site`. Ia sudah punya akun Midtrans sendiri (KYC selesai).

1. **Setup (sekali):**
   - Bu Sari minta AI: *"Buat toko kue, produk brownies 16 cm Rp150.000 dan bolu pandan Rp85.000, kirim area Bandung Rp10.000, gratis ongkir di atas Rp300.000."* AI membuat produk draft, kategori "Kue", shipping rules `by_region` + `free_over`, halaman toko dari template kuliner, workflow notifikasi default. Bu Sari menyetujui produk → `active`.
   - Settings > Payments → pilih **Midtrans** → tempel server key & client key **Sandbox** → **Test connection** ✓ → salin Webhook URL `https://api.platformmu.com/webhooks/payments/midtrans/whk_4fQ…` ke pengaturan notifikasi di dashboard Midtrans miliknya → lakukan pembayaran uji → "Webhook diterima ✓".
   - Ulangi untuk **Production**, lalu switch mode ke Production.
2. **Belanja:** Pembeli (Rina, guest) membuka halaman produk Brownies, memilih varian "16 cm / Coklat", klik **Tambah ke keranjang** → island memanggil `POST /carts` → `MiniCartIcon` menunjukkan 1.
3. **Checkout:** Rina mengisi nama, HP `0812…` (dinormalisasi `+62812…`), email, alamat Bandung. `POST /checkout/quote` → subtotal 150.000 + ongkir 10.000 = **160.000**. Rina klik **Bayar**.
4. **Server:** dalam transaksi: hitung ulang (cocok dengan `expectedTotal`), reservasi stok varian (`stock_reserved +1`), buat order `TK-1042` (`pending_payment`, `expires_at = +60 mnt`), `payments` attempt 1. Lalu `MidtransProvider.createPayment()` dengan kredensial Bu Sari (didekripsi in-memory) → redirect URL Snap.
5. **Bayar:** Rina diarahkan ke halaman Snap, memilih **QRIS**, scan dengan aplikasi e-wallet, bayar Rp160.000. Dana masuk ke **akun Midtrans Bu Sari**. Browser kembali ke `/checkout/result?order=TK-1042&t=…` → status masih "Menunggu konfirmasi pembayaran…" (polling).
6. **Webhook:** Midtrans memanggil `POST /webhooks/payments/midtrans/whk_4fQ…` → config ditemukan → `verifyWebhook` (signature cocok) → insert `payment_events` (unik) → enqueue job → 200 OK.
7. **Worker:** lock order → `getStatus("TK-1042-1")` → `paid`, amount 160.000 = cocok → order `paid`, `payment_status = paid`, stok di-commit (`stock -1`, `stock_reserved -1`), history dicatat → emit `commerce.order.paid`.
8. **Workflow (05):** workflow default "Pesanan dibayar":
   - Email ke Rina: "Pembayaran TK-1042 diterima".
   - WA ke Rina: "Halo Rina, pembayaran pesanan TK-1042 sebesar Rp160.000 sudah kami terima. Kue akan dikirim besok. — Kue Bu Sari".
   - WA ke Bu Sari: "Pesanan baru dibayar: TK-1042 — Brownies 16 cm/Coklat x1 — Rp160.000 — Rina, Bandung".
9. **Halaman hasil** Rina berubah menjadi "Pembayaran berhasil" pada polling berikutnya.
10. **Fulfillment:** Bu Sari klik **Proses** → `processing`; besoknya isi kurir & resi → `shipped` → WA resi ke Rina; 7 hari kemudian otomatis `completed`.

Variasi: bila webhook tidak sampai (URL belum didaftarkan), langkah 7 tetap terjadi lewat reconcile job ≤ 10–15 menit (COM-054).

---

## 19. Fase & rollout

### COM-190 Rencana fase commerce
- **Prioritas:** P0 · **Fase:** M7–M9+
- **Deskripsi:**

  | Fase | Lingkup | Requirement |
  |---|---|---|
  | **M7** (bersama website dinamis) | **Commerce ringan "Order via WhatsApp"**: tabel produk & kategori, dashboard produk, `ProductCard/Grid/Detail`, `CartDrawer`, `MiniCartIcon`, `WhatsAppOrderButton`, cart lokal, template toko WA | COM-003, COM-060 (subset), COM-063, COM-065, COM-070 (lokal), COM-110 (ⓦ), COM-111 (WA) |
  | **M8 — P0** | BYOG penuh: `PaymentProvider` + Midtrans + Xendit + manual transfer + COD; Settings > Payments; vault kredensial; webhook + reconcile; varian & stok/reservasi; cart server & member; checkout + ongkir manual; order state machine, dashboard order, resi, notifikasi workflow, export CSV, ringkasan penjualan; akun pembeli; component checkout/order; AI setup toko & copywriting; gating paket; keamanan & edge cases | COM-001, 002, 020–025, 030–035, 040–044, 050–056, 060–063, 065, 070–073, 080–082, 085–086, 090–093, 095–096, 100–102, 110–112, 140–142, 150–152, 160–165, 170–176, 180 |
  | **M9 — P1** | Voucher, PPN opsional, ongkir via API pihak ketiga, invoice PDF, refund via API, import produk (CSV/teks/foto), kode unik transfer, regenerate webhook URL, alamat tersimpan, klaim pesanan, ProductSearch, inventory movements, COD per wilayah | COM-083, 084, 094, 143, bagian P1 dari COM-023/033/062/082/101/174 |
  | **M9+ — P2** | Produk digital, multi-gateway per site, mode aggregator/marketplace, subscription produk, multi-mata uang, koleksi otomatis, diskon otomatis, paylater | COM-004, COM-064, dll. |

- **Rekomendasi:** rilis **Order via WhatsApp di M7**. Alasan: nilai bisnis langsung untuk UMKM (kanal jual utama mereka), risiko teknis & legal rendah (tanpa uang/kredensial), dan menguji katalog + component + cart yang 100% dipakai ulang di M8. M8 kemudian fokus ke bagian berisiko (pembayaran, webhook, stok).
- **Acceptance criteria (definition of done M8):**
  - [ ] Alur §18 berjalan end-to-end di sandbox Midtrans **dan** Xendit, termasuk webhook duplikat, webhook hilang (reconcile), dan expiry.
  - [ ] Test konkurensi stok, test IDOR, test "secret tidak bocor ke log" lulus di CI.
  - [ ] Panduan koneksi gateway (ID/EN) selesai dan diverifikasi terhadap dashboard gateway terbaru.
  - [ ] Ketentuan commerce & kebijakan produk terlarang terbit (setelah review hukum).

---

## 20. Daftar OPEN

| # | Topik | Rujukan |
|---|---|---|
| 1 | Konfirmasi hukum: BYOG tidak memerlukan izin PJP bagi Platform | COM-001 |
| 2 | Fitur sub-merchant/split payment gateway untuk mode aggregator | COM-004 |
| 3 | Order via WhatsApp di paket mana (Free/Starter) | COM-003, §14 |
| 4 | Detail API Midtrans: endpoint, formula signature, mapping status, reuse order id, URL notifikasi per transaksi, refund, metode & biaya | COM-021 |
| 5 | Detail API Xendit: produk (Invoice/Payment Request/lainnya) & versi, verifikasi callback, URL callback per-request, mapping status, refund, metode & biaya | COM-022 |
| 6 | Matriks metode pembayaran per gateway (QRIS, VA, e-wallet, kartu, retail, paylater) | COM-024 |
| 7 | Endpoint "test connection" tanpa efek samping per gateway; pola prefix key sandbox/production | COM-030, COM-032 |
| 8 | Allowlist IP webhook gateway (bila dipublikasikan) & kebijakan retry webhook gateway | COM-051, COM-054 |
| 9 | KMS vs master key env untuk KEK pada rilis M8 | COM-040 |
| 10 | Status `clientKey` Midtrans sebagai nilai publik | COM-041 |
| 11 | Dataset wilayah Indonesia (sumber, lisensi) | COM-081 |
| 12 | Penyedia API ongkir pihak ketiga & model kredensialnya | COM-082 |
| 13 | Aturan PPN & kebutuhan PKP | COM-084 |
| 14 | Batas produk/order per paket; Starter dapat commerce?; kebijakan melewati batas order | COM-150, COM-151, §14 |
| 15 | Fee transaksi Platform (rekomendasi: 0% di awal) | COM-152 |
| 16 | Level SAQ PCI yang berlaku untuk integrasi hosted page | COM-160 |
| 17 | Kewajiban detail UU PDP (retensi, notifikasi kebocoran, DPA) | COM-162 |
| 18 | Ambang skor moderasi produk terlarang & daftar final kategori | COM-164 |
| 19 | Provider WhatsApp untuk notifikasi (didefinisikan di 05) & domain pengirim email kustom (08) | COM-056, COM-093 |
