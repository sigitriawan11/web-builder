# `@platform/library-seed` — Panduan produksi library

Sumber awal **library platform** (component, theme, kategori, aset) sebelum Mode Admin, plus **style guide internal** untuk memproduksi component yang konsisten. Data seed (JSON) ada di `data/**`; kode skema/lint/validasi di `src/`. Paket ini **hanya untuk alat Node** (seed DB, test) — bukan untuk bundle browser.

Referensi spec: [03-components-templates.md](../../docs/specs/03-components-templates.md) (CMP-001…CMP-192).

## 1. Glosarium (CMP-001)

Istilah dipakai **sama** di kode, DB, UI (i18n ID/EN), dan dokumen.

| Istilah (ID / EN) | Identifier kode | Definisi singkat |
|---|---|---|
| Komponen utama / Main component | `ComponentDefinition` | Definisi master: tree node, props schema, variants, slot, metadata. Disimpan per versi di `component_versions.definition`. |
| Instance | node `type: "instance"` | Pemakaian component di situs: `componentId`, `version`, `variant`, `props`, `overrides`. Tree di-resolve saat render (tidak disalin). |
| Varian / Variant | `variantAxes`, `variant` | Kombinasi nilai variant axis (mis. `tone=primary, size=md`). |
| Slot | node `slot` | Area di dalam component yang boleh diisi node bebas oleh user. |
| Override | `props.overrides` | Perubahan style/konten pada node tertentu di instance, di-key oleh **ID node definisi** (bukan "nodeKey"). |
| Theme preset | tabel `themes` (`owner_type='platform'`) | Theme siap pakai; **di-copy** ke situs (bukan referensi). |
| Library global | `owner_type='platform'` | Library resmi platform (M3). `user`/`vendor` = P2/M9. |

Relasi (CMP-002): template **mereferensi** component via instance; theme preset **di-copy**; component memakai **token** (bukan nilai literal) → ganti theme situs mengubah semua instance **tanpa** menaikkan versi. Archive component **tidak** merusak situs lama (versi tetap bisa di-resolve).

## 2. Jenis component (`kind`, CMP-003)

Enum kanonik: `element | block | section | page | layout` (kontrak `@platform/shared` = DB `component_kind`; dijaga unit test). Seed subtree membatasi ke `element | block | section | layout` (page = root page node, tak boleh di subtree).

| `kind` | Muncul di | Aturan |
|---|---|---|
| `element` | Insert → Elements | Tidak wajib full-width. |
| `block` | Insert → Blocks | Dipakai dalam section mana pun. |
| `section` | "Add Section" | **Root wajib `width: fill`** (dicek `checkSubtrees`), padding vertikal dari token `space.section`. |
| `page` | "Add Page" | Root = page node. |
| `layout` | Insert → Navigation | Navbar/Footer/Sidebar; bisa ditandai global. |

## 3. Aturan desain wajib (CMP-015)

Sebagian dicek otomatis oleh `lintComponent` (`src/lint.ts`, dipakai editor & QA). Pelanggaran otomatis memblok transisi ke `in_review`.

| Kode | Aturan | Auto |
|---|---|---|
| R-TOKEN | Warna/font/size/radius/shadow/spacing pakai **token**, bukan literal (kecuali `transparent`, `currentColor`, 0). | ✔ |
| R-AUTOLAYOUT | Container frame pakai auto-layout (flex); absolut hanya dekorasi (`decorative: true`). | ✔ |
| R-RESPONSIVE | 3 breakpoint (1280/768/375): tak ada overflow horizontal, teks tak terpotong. | ✔ (Playwright) |
| R-SEMANTIC | Tag semantik benar; section 1 `h2`; `h1` hanya hero. | ✔ sebagian |
| R-A11Y | Kontras ≥ 4.5:1 (besar ≥ 3:1) di light **dan** dark; `alt` gambar; `ariaLabel` tombol ikon. | ✔ (axe) |
| R-NAMING | Nama layer bermakna EN (`Title`, `CtaPrimary`), bukan `Frame 12`. | ✔ |
| R-SIZE | JSON ≤ 200 KB; node ≤ 300 per component. | ✔ |
| R-ASSET | Gambar dari sumber berlisensi bebas komersial (§6). | field `license` |

## 4. Konvensi

- **Token, bukan literal.** Warna `{ "$token": "color.primary" }`, radius `radius.md`, spacing `space.*`. Hindari hex/px mentah kecuali 0/`transparent`/`currentColor`.
- **Prop konten utama** diekspos dengan `semanticRole` (mis. `heading`, `subheading`, `primaryCtaLabel`, `heroImage`) agar swap component & AI bekerja baik.
- **Penamaan:** file seed `kebab-case.component.json`; slug `kebab-case`; nama layer `PascalCase`/EN bermakna; label prop wajib dwibahasa `{ id, en }`.
- **Responsif** disimpan `{ base, tablet?, mobile? }`.

## 5. Struktur data seed

```
data/
  categories.json                  # CMP-150 kategori (fungsional/industri)
  components/**/<name>.component.json
  themes/                          # theme preset (CMP-120)
  assets/assets.manifest.json      # CMP-190 manifest aset + lisensi
  assets/images/*.svg|png
  fonts.json                       # CMP-191 font Google Fonts + lisensi
  lucide-icons.json                # CMP-192 snapshot nama Lucide ter-pin
```

Validasi: `validateSeedLibrary()` (schema + insert dry-run + ref aset/ikon). `$prop` hanya di ComponentDefinition; aset yang dirujuk wajib tercatat di manifest.

## 6. Lisensi aset (§19)

- **Gambar (CMP-190):** wajib bebas komersial **tanpa atribusi** (`attributionRequired: false`); `license` + `source` tercatat di manifest. Sumber: milik sendiri / CC0 / stok yang mengizinkan redistribusi dalam template.
- **Font (CMP-191):** hanya Google Fonts **OFL-1.1 / Apache-2.0** (`data/fonts.json`), self-host Fontsource, subset latin + latin-ext.
- **Ikon (CMP-192):** **Lucide** (ISC) by name, di-inline SVG saat publish; versi Lucide **di-pin** (`lucide-icons.json`); rename/hapus ditangani `LUCIDE_ALIASES` + fallback `circle-help`. Ikon merek = **Simple Icons (CC0)** (`BRAND_ICONS`), tunduk pedoman merek masing-masing.

## 7. QA checklist (CMP-133)

Sebelum publish, component lulus: aturan R-* otomatis hijau, kontras light+dark, tidak ada aset tanpa lisensi, props konten terekspos (label ID+EN), nama layer bermakna. QA penuh (visual regression 3 breakpoint, axe) dijalankan di pipeline publish/CI.

## Perintah

```bash
pnpm --filter @platform/library-seed test        # skema + lint + lisensi aset/font/ikon
pnpm db:seed --library                            # import seed ke Postgres (idempoten)
```
