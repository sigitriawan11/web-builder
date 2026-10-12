# 01 — Document Model

> Status: Draft v1 · Prefix requirement: `DM-` · Paket implementasi: `packages/document-model`
> Dibaca oleh: owner & AI coding agent. Dokumen ini adalah **jantung sistem**: format data yang dipakai editor ([02-editor.md](./02-editor.md)), renderer, AI tools ([04-ai-agent.md](./04-ai-agent.md)), sistem component ([03-components-templates.md](./03-components-templates.md)), data dinamis ([05-dynamic-data.md](./05-dynamic-data.md)), publish ([07-publishing-hosting.md](./07-publishing-hosting.md)), dan nanti multiplayer/marketplace. Arsitektur keseluruhan: [../ARCHITECTURE.md](../ARCHITECTURE.md).

## Daftar isi

0. [Ringkasan keputusan](#0-ringkasan-keputusan)
1. [Prinsip desain](#1-prinsip-desain)
2. [Hierarki dokumen](#2-hierarki-dokumen)
3. [Identitas & node base](#3-identitas--node-base)
4. [Node types](#4-node-types)
5. [Value types (literal, token, prop, bind)](#5-value-types)
6. [Style model](#6-style-model)
7. [Responsif & breakpoints](#7-responsif--breakpoints)
8. [States (hover/pressed/focus/active)](#8-states)
9. [Design tokens & theme](#9-design-tokens--theme)
10. [Component definition & instance](#10-component-definition--instance)
11. [Bindings & expressions](#11-bindings--expressions)
12. [Interactions & links](#12-interactions--links)
13. [Assets reference](#13-assets-reference)
14. [Representasi Yjs](#14-representasi-yjs)
15. [Draft vs published](#15-draft-vs-published)
16. [Validasi](#16-validasi)
17. [Schema versioning & migration](#17-schema-versioning--migration)
18. [Command API](#18-command-api)
19. [Batasan & performa](#19-batasan--performa)
20. [Contoh lengkap](#20-contoh-lengkap)
21. [Mapping ke penyimpanan DB](#21-mapping-ke-penyimpanan-db)
22. [Daftar OPEN](#22-daftar-open)

---

## 0. Ringkasan keputusan

| Topik | Keputusan | Bagian |
|---|---|---|
| Sumber kebenaran | Satu `SiteDocument` per website; editor, AI, template, publish semua memanipulasi dokumen ini | §1 |
| Struktur tree | **Flat map** `nodes: Record<NodeId, Node>` + `children: NodeId[]` di container + `parentId` di setiap node | §2, §14 |
| Format ID | `nanoid` 10 karakter alfabet `0-9a-z` dengan **prefix tipe** (`n_`, `pg_`, `cmp_`, `ast_`, `ix_`); ULID hanya untuk entitas DB berurutan waktu (versi publish, snapshot) | §3 |
| Token reference | Objek `{ "$token": "color.primary" }` (bukan string `"{color.primary}"`) | §5 |
| Prop reference (dalam component) | Objek inline `{ "$prop": "title" }` | §5, §10 |
| Data binding | Map terpisah `bindings: { "<targetPath>": { "$bind": "item.price", "filters": [...] } }`; nilai statis tetap sebagai placeholder | §11 |
| Breakpoint override | **Style per node dikunci breakpoint**: `style: { base, tablet?, mobile? }`; `tablet`/`mobile` = patch parsial (sparse) | §7 |
| Cascade | Desktop-first: `base → tablet → mobile` (mobile mewarisi tablet) | §7 |
| States | `states: { hover?: { base?, tablet?, mobile? }, ... }` patch di atas style breakpoint aktif | §8 |
| Rich text | ProseMirror/Tiptap JSON di JSON; `Y.XmlFragment` di Yjs | §4.4, §14 |
| Instance | `componentId@version` + `variant` + `propValues` + `overrides` (dialamatkan by node path) + `slots` | §10 |
| Penyimpanan | Yjs binary update (append) + compaction state + JSON snapshot periodik; publish = JSON immutable berversi | §14, §15 |
| Mutasi | **Semua** perubahan lewat Command API (`packages/document-model/commands`), dipakai editor dan AI tools | §18 |

---

## 1. Prinsip desain

### DM-001 Single source of truth
- **P0 · M1**
- **Deskripsi**: Setiap website punya tepat satu `SiteDocument` (draft/working). Empat cara membuat website (template, component library, canvas bebas, AI) **hanya** menghasilkan/mengubah dokumen ini. Renderer (`packages/renderer`) adalah fungsi murni `render(document, context) → React/HTML` yang dipakai editor **dan** publish sehingga WYSIWYG.
- **Detail**:
  - Tidak ada state desain di luar dokumen (mis. tidak boleh ada CSS custom tersimpan terpisah). UI state editor (seleksi, zoom, panel terbuka) ada di Zustand, **bukan** di dokumen.
  - Dokumen tenant-agnostic: tidak berisi `userId`, `workspaceId`, domain, atau kredensial. Kepemilikan disimpan di tabel DB (lihat §21). Ini membuat dokumen bisa dipindah/diduplikasi/dijadikan template tanpa transformasi.
- **Acceptance criteria**:
  - [ ] Renderer menerima hanya `SiteDocument` (+ context: breakpoint, mode, data) dan tidak membaca sumber lain untuk tampilan.
  - [ ] Duplikasi website = copy dokumen + remap ID asset/component ref saja (tanpa perubahan struktur).
  - [ ] Grep schema: tidak ada field `userId`/`ownerId`/`domain` di `SiteDocument`.

### DM-002 Serializable, CRDT-ready, versioned
- **P0 · M1**
- **Deskripsi**: Dokumen adalah JSON murni (tanpa fungsi, `Date`, `Map`, `undefined` bermakna). Bentuknya didesain agar bisa dipetakan 1:1 ke Yjs (`Y.Map`/`Y.Array`/`Y.XmlFragment`) sejak hari pertama walaupun MVP single-user. Setiap dokumen membawa `schemaVersion` (integer).
- **Detail**:
  - Tanggal = string ISO-8601 UTC. Angka = `number` finite (tidak boleh `NaN`/`Infinity`).
  - Field opsional yang tidak dipakai **dihapus**, bukan diisi `null`, kecuali dinyatakan nullable (mis. `parentId` root = `null`).
  - Urutan key objek tidak bermakna; urutan bermakna hanya di array (`children`, `pageOrder`, `fills`).
- **Acceptance criteria**:
  - [ ] `JSON.parse(JSON.stringify(doc))` deep-equal dengan `doc` untuk semua fixture.
  - [ ] Round-trip `jsonToYDoc → yDocToJson` deep-equal untuk semua fixture (lihat DM-062).
  - [ ] Dokumen tanpa `schemaVersion` ditolak validator.

### DM-003 Token-first, breakpoint-ready, AI-friendly
- **P0 · M1**
- **Deskripsi**:
  - **Token-first**: nilai warna, font, spacing, radius, shadow sebaiknya mereferensi token theme (`{ "$token": ... }`). Ganti tema = ganti nilai token, bukan menyusuri node. Literal tetap boleh (canvas bebas ala Figma).
  - **Breakpoint-ready**: semua style disimpan dalam struktur `{ base, tablet?, mobile? }` sejak awal walau UI override manual baru penuh di fase lanjut.
  - **AI-friendly**: ID stabil (tidak berubah saat dipindah/diedit), `name` deskriptif wajib (`"Hero / Title"`, bukan `"Frame 23"`), struktur dapat diringkas (outline) untuk konteks LLM, semua mutasi lewat command bertipe Zod yang sama dengan definisi AI tools.
- **Acceptance criteria**:
  - [ ] Node baru dari command `createNode` tanpa `name` mendapat nama default deskriptif berbasis tipe + konten (`"Text / Selamat datang"`), bukan nomor urut saja.
  - [ ] Fungsi `toOutline(doc, pageId)` menghasilkan ringkasan teks (≤ 1 baris per node: id, type, name, ringkasan konten) untuk konteks AI ([04-ai-agent.md](./04-ai-agent.md)).
  - [ ] Template seed memakai token untuk ≥ 90% nilai warna & tipografi (dicek lint `tokenCoverage`).

---

## 2. Hierarki dokumen

```
SiteDocument
├── schemaVersion, siteKey (opsional), meta
├── settings        (bahasa, SEO default, favicon, breakpoints, manualResponsive, ...)
├── theme           (tokens, fonts, mode)
├── assets          (registry AssetRef ringan: assetId → meta yang dibutuhkan renderer)
├── componentDeps   (componentId → version yang dipakai; "lockfile")
├── dataSources     (rujukan collection id; detail di 05)
├── pageOrder       (PageNodeId[])
└── nodes           (Record<NodeId, Node>  — flat; page adalah node bertipe "page")
       page ── frame ── text / image / instance / ...
```

### DM-004 Struktur top-level `SiteDocument`
- **P0 · M1**
- **Detail**:

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `schemaVersion` | `number` (int ≥ 1) | ya | Versi schema dokumen (§17) |
| `meta` | `{ title: string; createdWith?: "blank" \| "template" \| "ai"; templateRef?: { templateId: string; version: number } }` | ya | Info non-visual. Tidak ada data tenant |
| `settings` | `SiteSettings` | ya | DM-005 |
| `theme` | `Theme` | ya | §9 |
| `assets` | `Record<AssetId, AssetEntry>` | ya (boleh kosong) | §13 |
| `componentDeps` | `Record<ComponentId, { version: number; source: "library" \| "site" \| "marketplace" }>` | ya | Semua component yang di-instance di dokumen + versinya. Invariant: setiap instance merujuk versi yang tercatat di sini (DM-069) |
| `localComponents` | `Record<ComponentId, ComponentDefinition>` | tidak (P1) | Component milik website (dibuat user dari seleksi) disimpan inline; library component disimpan di DB (lihat [03](./03-components-templates.md)) |
| `dataSources` | `{ collections: CollectionId[] }` | tidak (M7) | Hanya rujukan; schema collection ada di DB ([05](./05-dynamic-data.md)) |
| `pageOrder` | `PageId[]` | ya, min 1 | Urutan halaman di panel Pages |
| `nodes` | `Record<NodeId, Node>` | ya | Semua node semua halaman, flat |

```json
{
  "schemaVersion": 1,
  "meta": { "title": "Toko Kue Budi", "createdWith": "template", "templateRef": { "templateId": "tpl_bakery01", "version": 3 } },
  "settings": { "...": "lihat DM-005" },
  "theme": { "...": "lihat §9" },
  "assets": {},
  "componentDeps": { "cmp_navbar0001": { "version": 4, "source": "library" } },
  "dataSources": { "collections": [] },
  "pageOrder": ["pg_home000001"],
  "nodes": { "pg_home000001": { "id": "pg_home000001", "type": "page", "...": "..." } }
}
```

- **Acceptance criteria**:
  - [ ] Zod `SiteDocumentSchema` memvalidasi struktur di atas, `strict()` (key tak dikenal ditolak) kecuali di `metadata.ext`.
  - [ ] Dokumen kosong minimal (1 page tanpa child) valid dan bisa dirender.

### DM-005 `SiteSettings`
- **P0 · M1** (field bertanda P1/P2 menyusul)
- **Detail**:

```ts
interface SiteSettings {
  language: "id" | "en" | string;          // BCP-47 utama website (atribut <html lang>)
  alternateLanguages?: string[];           // P2: website multi-bahasa (❓ OPEN)
  seo: {
    titleTemplate: string;                 // mis. "%s · Toko Kue Budi"
    defaultTitle: string;
    defaultDescription?: string;           // ≤ 160 char disarankan
    ogImage?: AssetRef;
    noIndex?: boolean;                     // default false
  };
  favicon?: AssetRef;                      // renderer membuat varian ukuran saat publish (07)
  breakpoints: BreakpointDef[];            // §7, default 3 breakpoint
  manualResponsive: boolean;               // default false (DM-037)
  autoResponsive: AutoResponsiveConfig;    // DM-038
  defaultPageTransition?: "none" | "fade"; // P2
  customHead?: never;                      // SENGAJA tidak ada di M1–M6 (keamanan); lihat embed node P2
}
```

- **Acceptance criteria**:
  - [ ] `language` default mengikuti bahasa UI user saat membuat website (`id` jika Indonesia).
  - [ ] `seo.titleTemplate` wajib mengandung `%s`; validator menolak jika tidak.
  - [ ] Pengaturan SEO per halaman ada di `page.props.seo` dan meng-override default ini.

### DM-006 Pages adalah node
- **P0 · M1**
- **Deskripsi**: Halaman disimpan sebagai node `type: "page"` di `nodes` (root tree, `parentId: null`), urutan di `pageOrder`. Alasan: satu mekanisme (Yjs map, command, validasi) untuk semuanya; memindah section antar halaman = `moveNode` biasa.
- **Acceptance criteria**:
  - [ ] Setiap id di `pageOrder` menunjuk node `type: "page"` dan setiap page node ada di `pageOrder` (bijeksi).
  - [ ] Hanya node `page` yang boleh `parentId: null` (kecuali root component definition di §10, yang hidup di dokumen component terpisah).

---

## 3. Identitas & node base

### DM-007 Format ID
- **P0 · M1**
- **Keputusan**: `prefix_` + `nanoid(10)` dengan alfabet `0123456789abcdefghijklmnopqrstuvwxyz` (36 simbol → ~51,7 bit; peluang tabrakan dalam satu dokumen 20.000 node ≈ 10⁻⁷, plus dicek saat insert).

| Prefix | Entitas | Contoh |
|---|---|---|
| `pg_` | page node | `pg_k3m9x2a7qp` |
| `n_` | node lain (frame, text, …) | `n_a8f3k2m1zx` |
| `cmp_` | component definition | `cmp_navbar0001` (seed boleh ID manusiawi) |
| `ast_` | asset | `ast_9fk2m3x8qa` |
| `ix_` | interaction | `ix_2m8f9k3a1c` |
| `tpl_` | template | `tpl_bakery01` |
| `col_` | collection (05) | `col_products01` |

- **Alasan**:
  - Pendek → hemat token LLM (ID muncul ratusan kali di konteks AI) dan enak dibaca di DevTools.
  - Prefix → AI & manusia langsung tahu jenis entitas; validator bisa cek kategori via regex.
  - Lowercase alfanumerik → aman sebagai atribut HTML (`data-node-id`), selector CSS (`.n_a8f3k2m1zx` valid karena diawali huruf), path override (`/` sebagai separator tidak bentrok).
  - Bukan ULID untuk node karena urutan waktu tidak berguna di tree (urutan ditentukan `children`) dan ULID 26 char lebih boros. ULID dipakai untuk baris DB yang perlu sortable (snapshot, published version) — lihat [../ARCHITECTURE.md](../ARCHITECTURE.md).
  - ID dibuat **di client** (editor/AI tool) agar operasi offline/CRDT tidak perlu round-trip server.
- **Regex**: `^(pg|n|cmp|ast|ix|tpl|col)_[0-9a-z]{6,24}$` (min 6 agar ID seed manusiawi seperti `cmp_navbar0001` lolos).
- **Acceptance criteria**:
  - [ ] `createId("n")` menghasilkan string sesuai regex; uji 1 juta ID tanpa duplikat.
  - [ ] ID **tidak pernah** berubah karena move, rename, restyle, atau perubahan breakpoint.
  - [ ] Duplikasi node (copy/paste, duplicate page, instantiate template) **selalu** membuat ID baru dan me-remap semua referensi internal (children, parentId, interaction target, anchor link, overrides path).

### DM-008 Node base
- **P0 · M1**
- **Detail**: Semua node berbagi field berikut. Field spesifik tipe ada di `props` (discriminated by `type`).

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `id` | `NodeId` | ya | DM-007 |
| `type` | `NodeType` | ya | §4 |
| `name` | `string` (1–80) | ya | Nama layer deskriptif. Konvensi: `"Section / Sub"` |
| `parentId` | `NodeId \| null` | ya | `null` hanya untuk `page`. **Sumber kebenaran relasi parent** (DM-063) |
| `children` | `NodeId[]` | hanya tipe container | Urutan render (index 0 = pertama di DOM = paling bawah secara z-order bila absolute) |
| `visible` | `boolean` | ya (default `true`) | Hide global (mata di layer panel). Hide per breakpoint pakai `style.*.display = "none"` |
| `locked` | `boolean` | ya (default `false`) | Tidak bisa dipilih/digeser di canvas; AI tools menghormati lock (tidak mengubah tanpa `force`) |
| `tag` | `SemanticTag` | tidak | Tag HTML semantik; default per tipe (DM-009) |
| `style` | `ResponsiveStyle` | ya | §6–§7. Layout (auto-layout/grid) adalah bagian dari style agar bisa di-override per breakpoint |
| `states` | `StateStyles` | tidak | §8 |
| `props` | per tipe | ya (boleh `{}`) | §4 |
| `bindings` | `Record<TargetPath, BindExpr>` | tidak (M7) | §11 |
| `visibleWhen` | `VisibleWhen` | tidak (M7) | Kondisi tampil berbasis auth/role/data; perilaku di [05 DATA-083](./05-dynamic-data.md#data-083-conditional-visibility). UX saja, bukan keamanan |
| `interactions` | `Interaction[]` | tidak | §12 |
| `a11y` | `{ label?: string; role?: string; hiddenFromScreenReader?: boolean }` | tidak | `aria-label`, dsb |
| `htmlId` | `string` | tidak | Anchor publik (`#tentang-kami`), unik per page, slug `[a-z0-9-]` |
| `metadata` | `NodeMetadata` | tidak | Editor/AI-only, di-strip saat publish |

```ts
type VisibleWhen = { any: VisibleCond[] } | { all: VisibleCond[] };   // maks 10 kondisi
type VisibleCond =
  | { type: "auth"; is: "loggedIn" | "loggedOut" }
  | { type: "role"; in: string[] }                                   // role member site (05 §8)
  | { type: "expr"; left: string /* path binding, mis. "item.stok" */; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "isEmpty" | "isNotEmpty"; right?: string | number | boolean };
// `bindings.visible` tetap boleh untuk bind langsung ke field boolean; kondisi gabungan memakai visibleWhen.

interface NodeMetadata {
  createdBy?: "user" | "ai" | "system" | "template";
  aiNote?: string;                 // catatan AI tentang tujuan node (≤ 200 char), bantu AI berikutnya
  fromTemplate?: { templateId: string; version: number; nodeId: string };
  detachedFrom?: { componentId: string; version: number }; // setelah detach (DM-050)
  editor?: { collapsed?: boolean; colorLabel?: string };
  ext?: Record<string, unknown>;   // namespace eksperimen; tidak divalidasi ketat, di-strip saat publish
}
```

- **Acceptance criteria**:
  - [ ] Node non-container yang punya `children` ditolak validator.
  - [ ] `metadata` tidak muncul di output publish (cek di test compile).
  - [ ] `htmlId` duplikat dalam satu page ditolak.

### DM-009 Semantic tag
- **P0 · M1**
- **Detail**: Allowed tag per tipe (renderer memakai `tag` jika ada, jika tidak default):

| Tipe | Default | Allowed |
|---|---|---|
| `page` | `main` (wrapper body) | `main` |
| `frame` | `div` | `div, section, header, footer, nav, article, aside, main, ul, ol, li, figure, form*, a**, button**` |
| `text` | `p` | `p, h1–h6, span, blockquote, li, label, figcaption` |
| `image` | `img` (dibungkus `figure` jika ada caption P2) | `img` |
| `group` | `div` | `div` |
| `shape` | `div` (rect/ellipse) / `svg` (line) | — |

`*` `form` hanya via node `form` (§4.12). `**` frame dengan link interaction otomatis dirender `a`; frame dengan click action non-navigasi dirender `button` — tidak boleh nested interactive (validator memberi warning, renderer mengubah anak `a` jadi `span`).
- **Acceptance criteria**:
  - [ ] Validator menolak tag di luar daftar allowed.
  - [ ] Lint (warning, bukan error): >1 `h1` per page; heading melompat level; gambar tanpa `alt` (kecuali `decorative: true`).

---

## 4. Node types

Ringkasan:

| Type | Container | Fase | Ringkas |
|---|---|---|---|
| `page` | ya | M1 | Root halaman |
| `frame` | ya | M1 | Kotak serbaguna: section, auto-layout (flex), grid |
| `group` | ya | M2 | Pengelompokan tanpa layout sendiri (seperti Figma group) |
| `text` | tidak | M1 | Rich text Tiptap |
| `image` | tidak | M1 | Gambar dari asset |
| `icon` | tidak | M2 | Ikon dari set (Lucide) |
| `shape` | tidak | M2 | rect / ellipse / line |
| `vector` | tidak | P2 · M9 | Path SVG bebas (pen tool) |
| `instance` | slot saja | M3 | Instance component |
| `slot` | ya | M3 | Placeholder di dalam component definition |
| `embed` | tidak | P2 · M9 | HTML/iframe terbatas |
| `video` | tidak | P1 · M4 | Embed YouTube/Vimeo/asset video |
| `form`, `formField` | ya / tidak | M7 | Rujuk 05 |
| `dataList` | ya | M7 | Repeater bound ke collection |
| `dataTable` | tidak | M7 | Tabel bound ke collection |
| `authBlock` | tidak | M7 | Login/register/logout/member-gate |

### DM-010 `page`
- **P0 · M1**
- **Props**:

```ts
interface PageProps {
  path: string;                    // "/" untuk home, "/tentang", "/produk/[slug]" (dynamic M7)
  title: string;                   // judul di panel Pages
  seo?: { title?: string; description?: string; ogImage?: AssetRef; noIndex?: boolean; canonical?: string };
  isHome?: boolean;                // tepat satu page isHome = true
  access?: { type: "public" } | { type: "members"; redirectTo?: string }; // M7, rujuk 05
  dynamic?: { collectionId: string; slugField: string };                   // M7 template halaman item
  canvas?: { width?: number };     // editor-only: lebar artboard desktop default 1440
  drafts?: NodeId[];               // P1 · M4: node "draft area" (scratch) di luar breakpoint frame — DM-080, tidak dipublish
}
```

- **Contoh**:

```json
{
  "id": "pg_home000001", "type": "page", "name": "Home", "parentId": null,
  "children": ["n_nav0000001", "n_hero000001"], "visible": true, "locked": false,
  "style": { "base": { "layout": { "mode": "flex", "direction": "column" }, "fills": [{ "type": "solid", "color": { "$token": "color.background" } }] } },
  "props": { "path": "/", "title": "Home", "isHome": true, "seo": { "title": "Beranda" } }
}
```

- **Acceptance criteria**:
  - [ ] `path` unik per site, lowercase, `^/([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\])*(/([a-z0-9-]+|\[[a-z][a-zA-Z0-9]*\]))*$|^/$`.
  - [ ] Tepat satu page `isHome: true` dengan `path: "/"`.
  - [ ] Page selalu `layout.mode = "flex"`, `direction = "column"` (section bertumpuk vertikal), width `fill`.

### DM-080 Draft area (scratch) per page
- **P1 · M4** — UX di [02 ED-035](./02-editor.md#ed-035-draft-area-node-di-luar-page).
- **Detail**: Node draft adalah subtree biasa yang root-nya tercantum di `page.props.drafts` (bukan di `page.children`), dengan `parentId = <pageId>` dan `style.base.position = { type: "absolute", x, y }` dalam koordinat canvas relatif terhadap pojok kiri atas breakpoint frame Desktop. Turunannya memakai aturan node biasa.
- **Aturan**:
  - `compileSite` (DM-065) dan renderer publish **mengabaikan** `drafts`; snapshot JSON tetap menyimpannya (ikut history/undo).
  - `repairStructure` (DM-063) memperlakukan `drafts` sebagai daftar anak kedua page: node dengan `parentId = pageId` yang tercantum di `drafts` tidak di-append ke `children`.
  - Node live tidak boleh mereferensikan node draft (link anchor, interaction `targetId`, binding) — validator mode `publish` error, mode `edit` warning.
  - Memindah node antara page dan draft area = command `moveNode` dengan `newParentId = pageId` dan `area: "drafts" | "children"`.
  - AI tools tidak menulis ke `drafts` kecuali diminta eksplisit (04).
- **Acceptance criteria**:
  - [ ] Output publish page dengan draft identik dengan page tanpa draft.
  - [ ] Undo memindah node kembali dari drafts ke page dalam satu langkah.

### DM-011 `frame` (termasuk auto-layout & grid)
- **P0 · M1** (grid: P1 · M2)
- **Deskripsi**: Container utama. Perilaku layout ditentukan `style.*.layout` (§6.1): `none` (anak absolute bebas, seperti Figma frame biasa), `flex` (auto-layout), `grid`.
- **Props**:

```ts
interface FrameProps {
  role?: "section" | "container" | "card" | "button" | "list" | "generic"; // petunjuk semantik untuk AI & lint
  clipContent?: boolean;   // alias editor untuk overflow hidden (disinkronkan ke style.overflow)
  link?: LinkValue;        // jika diisi, frame dirender <a> (§12.2)
}
```

- **Contoh (hero auto-layout)**:

```json
{
  "id": "n_hero000001", "type": "frame", "name": "Hero", "parentId": "pg_home000001",
  "children": ["n_herottl001", "n_herosub001", "n_herocta001"],
  "visible": true, "locked": false, "tag": "section",
  "style": {
    "base": {
      "layout": { "mode": "flex", "direction": "column", "gap": { "$token": "space.6" }, "align": "center", "justify": "center",
                  "padding": { "top": { "$token": "space.16" }, "right": { "$token": "space.8" }, "bottom": { "$token": "space.16" }, "left": { "$token": "space.8" } } },
      "size": { "width": { "mode": "fill" }, "height": { "mode": "hug" }, "minHeight": { "value": 560, "unit": "px" } },
      "fills": [{ "type": "solid", "color": { "$token": "color.surface" } }]
    },
    "mobile": {
      "layout": { "padding": { "top": { "$token": "space.10" }, "bottom": { "$token": "space.10" } } },
      "size": { "minHeight": { "value": 420, "unit": "px" } }
    }
  },
  "props": { "role": "section" }
}
```

- **Contoh (grid 3 kolom)**:

```json
{ "layout": { "mode": "grid", "columns": { "type": "repeat", "count": 3, "min": { "value": 240, "unit": "px" } }, "rows": { "type": "auto" }, "gap": { "$token": "space.6" } } }
```

- **Acceptance criteria**:
  - [ ] Frame `layout.mode = "none"` merender anak dengan `position: absolute` + constraints (§6.3).
  - [ ] Frame flex dirender sebagai CSS flexbox 1:1 (tidak ada JS layout di runtime publish).
  - [ ] Ganti `mode` dari `none` ke `flex` lewat command `setLayoutMode` mengurutkan `children` berdasarkan posisi visual (y lalu x) dan menghapus `position` absolute anak.

### DM-012 `group`
- **P1 · M2**
- **Deskripsi**: Pembungkus tanpa style visual sendiri (seperti group Figma). Bounding box = gabungan anak. Tidak punya fills/padding/layout. Dipakai untuk memindah beberapa layer bersamaan di frame `layout: none`.
- **Props**: `{}`. Style yang diizinkan: `position`, `opacity`, `transform`, `display`. Validator menolak `fills`, `layout`, `strokes`.
- **Acceptance criteria**:
  - [ ] Group dirender sebagai `div` berukuran hug (bukan `display: contents`) agar bounding box konsisten dengan editor; anak group selalu `position.type = "absolute"` relatif ke group.
  - [ ] Ungroup memindahkan anak ke parent group pada index yang sama, mempertahankan posisi visual.

### DM-013 `text` (rich text)
- **P0 · M1**
- **Deskripsi**: Konten disimpan sebagai **ProseMirror/Tiptap JSON** dengan schema terbatas yang didefinisikan di `packages/document-model/richtext` (schema yang sama dipakai editor Tiptap dan renderer).
- **Props**:

```ts
interface TextProps {
  content: RichTextDoc;          // { type: "doc", content: Block[] }
  autoSize?: "width" | "height" | "none"; // seperti Figma: hug lebar / tinggi / fixed
  truncate?: { lines: number };  // line-clamp
}
type Block =
  | { type: "paragraph"; attrs?: { align?: "left"|"center"|"right"|"justify" }; content?: Inline[] }
  | { type: "heading"; attrs: { level: 1|2|3|4|5|6; align?: ... }; content?: Inline[] }   // P1 untuk multi-block heading
  | { type: "bulletList" | "orderedList"; content: { type: "listItem"; content: Block[] }[] }
  | { type: "hardBreak" };
type Inline = { type: "text"; text: string; marks?: Mark[] } | { type: "hardBreak" };
type Mark =
  | { type: "bold" } | { type: "italic" } | { type: "underline" } | { type: "strike" }
  | { type: "link"; attrs: { link: LinkValue } }
  | { type: "textStyle"; attrs: { color?: ColorValue; fontWeight?: number; fontSize?: LengthValue; fontFamily?: TokenRef | string } };
```

- **Aturan**: tipografi dasar seluruh node ada di `style.typography`; `marks` hanya untuk sebagian teks (span). Mark `textStyle` hanya boleh ≤ 4 atribut di atas. Tidak ada HTML mentah.
- **Contoh**:

```json
{
  "id": "n_herottl001", "type": "text", "name": "Hero / Title", "parentId": "n_hero000001",
  "visible": true, "locked": false, "tag": "h1",
  "style": { "base": { "typography": { "$token": "type.display" }, "color": { "$token": "color.onSurface" } },
             "mobile": { "typography": { "$token": "type.h1" } } },
  "props": { "autoSize": "height", "content": { "type": "doc", "content": [
    { "type": "paragraph", "attrs": { "align": "center" }, "content": [
      { "type": "text", "text": "Kue rumahan, " },
      { "type": "text", "text": "fresh setiap hari", "marks": [{ "type": "textStyle", "attrs": { "color": { "$token": "color.primary" } } }] }
    ] } ] } }
}
```

- **Acceptance criteria**:
  - [ ] Tiptap editor & renderer memakai schema yang sama (`richTextSchema`), satu sumber di package.
  - [ ] Konten di luar schema (mis. node `image` di dalam text) ditolak validator.
  - [ ] `plainText(content)` util tersedia (untuk outline AI, SEO description otomatis, search).

### DM-014 `image`
- **P0 · M1**
- **Props**:

```ts
interface ImageProps {
  image: AssetRef;                     // §13 (alt, focalPoint, crop di sini)
  fit: "cover" | "contain" | "fill";   // object-fit
  decorative?: boolean;                // true → alt="" (lint tidak protes)
  loading?: "lazy" | "eager";          // default lazy; hero di atas fold → eager (renderer bisa auto)
  link?: LinkValue;
}
```

- **Contoh**:

```json
{ "id": "n_heroimg001", "type": "image", "name": "Hero / Photo", "parentId": "n_hero000001", "visible": true, "locked": false,
  "style": { "base": { "size": { "width": { "mode": "fill" }, "height": { "mode": "fixed", "value": 420, "unit": "px" } }, "radius": { "$token": "radius.lg" } } },
  "props": { "fit": "cover", "image": { "assetId": "ast_cake000001", "alt": "Kue cokelat di meja kayu", "focalPoint": { "x": 0.5, "y": 0.4 } } } }
```

- **Acceptance criteria**:
  - [ ] `image.assetId` harus ada di `doc.assets` (invariant DM-069).
  - [ ] Renderer menghasilkan `srcset` dari varian asset (07) dan `object-position` dari `focalPoint`.

### DM-015 `icon`
- **P1 · M2**
- **Props**: `{ set: "lucide"; name: string; strokeWidth?: number }`. Warna = `style.color`; ukuran = `style.size` (square).
- **Acceptance criteria**:
  - [ ] `name` divalidasi terhadap daftar ikon Lucide versi yang di-pin (`lucide-static@x.y.z`).
  - [ ] Publish meng-inline SVG (bukan memuat seluruh library).
  - [ ] ❓ OPEN: set ikon tambahan (brand icons: WhatsApp, Instagram, TikTok) — Lucide tidak menyediakan logo brand; kandidat Simple Icons dengan `set: "brands"`.

### DM-016 `shape`
- **P1 · M2**
- **Props**: `{ shape: "rect" | "ellipse" | "line"; line?: { cap: "butt"|"round"|"square"; arrowStart?: boolean; arrowEnd?: boolean } }`.
- Rect/ellipse memakai `fills`, `strokes`, `radius` (rect). Line memakai `strokes[0]` dan `size.width`; rotasi via `transform.rotate`.
- **Acceptance criteria**:
  - [ ] Rect & ellipse dirender `div` + CSS (bukan SVG) untuk performa; line/arrow dirender inline SVG.

### DM-017 `vector`
- **P2 · M9**
- **Props**: `{ paths: { d: string; fillRule?: "nonzero" | "evenodd" }[]; viewBox: [number, number, number, number] }`.
- `d` divalidasi parser SVG path (hanya perintah M,L,H,V,C,S,Q,T,A,Z), maks 20 KB per node.
- **Acceptance criteria**:
  - [ ] String `d` dengan karakter di luar grammar path ditolak (mencegah injeksi).

### DM-018 `instance`
- **P0 · M3** — detail format dan resolusi di §10.
- **Props**:

```ts
interface InstanceProps {
  componentId: ComponentId;
  version: number;                              // pinned; harus = componentDeps[componentId].version
  variant?: Record<string, string>;             // { size: "lg", tone: "primary" }
  propValues?: Record<string, PropValue>;       // nilai props component
  overrides?: Record<NodePath, NodePatch>;      // §10.4
  slots?: Record<string, NodeId[]>;             // isi slot; node-node ini parentId = id instance
}
```

- Instance **tidak** punya `children`. `style` instance hanya berlaku pada **root** component (ukuran/posisi di parent), di-merge di atas style root definisi.
- **Contoh**:

```json
{ "id": "n_nav0000001", "type": "instance", "name": "Navbar", "parentId": "pg_home000001", "visible": true, "locked": false,
  "style": { "base": { "size": { "width": { "mode": "fill" } } } },
  "props": { "componentId": "cmp_navbar0001", "version": 4, "variant": { "layout": "logoLeft" },
    "propValues": { "brandName": "Toko Kue Budi", "ctaLabel": "Pesan via WA",
      "ctaLink": { "type": "whatsapp", "phone": "6281234567890", "message": "Halo, saya mau pesan kue" } },
    "overrides": { "n_ctabtn0001": { "style": { "base": { "fills": [{ "type": "solid", "color": { "$token": "color.accent" } }] } } } } } }
```

### DM-019 `slot`
- **P0 · M3**
- **Deskripsi**: Hanya ada di dalam `ComponentDefinition`. Menandai area yang isinya diisi oleh instance (`instance.props.slots[name]`). Merupakan container dengan style (layout) sendiri; `children` di definisi = **isi default** slot.
- **Props**: `{ slotName: string; allowedTypes?: NodeType[]; allowedComponents?: ComponentId[]; maxChildren?: number }`.
- **Acceptance criteria**:
  - [ ] Validator menolak node `slot` di luar component definition.
  - [ ] Jika instance tidak mengisi slot, isi default dirender.
  - [ ] `slotName` unik dalam satu component.

### DM-020 `video`
- **P1 · M4**
- **Props**: `{ source: { type: "youtube" | "vimeo"; videoId: string } | { type: "asset"; assetId: AssetId }; autoplay?: boolean; muted?: boolean; loop?: boolean; controls?: boolean; poster?: AssetRef }`.
- `videoId` divalidasi regex (`^[A-Za-z0-9_-]{6,20}$`), URL embed dibangun renderer (bukan disimpan) → mencegah iframe arbitrer.
- **Acceptance criteria**:
  - [ ] Autoplay hanya diizinkan bila `muted: true` (aturan browser) — validator memaksa.

### DM-021 `embed` (HTML terbatas)
- **P2 · M9**
- **Props**: `{ kind: "iframe"; src: string; allowlistKey: string } | { kind: "html"; html: string }`.
- **Batasan**: `iframe` hanya untuk domain di allowlist platform (Google Maps, Spotify, dsb). `html` dirender di **iframe sandbox** (`sandbox="allow-scripts"`, origin terpisah), tidak pernah inline di halaman. Hanya untuk paket tertentu ([08](./08-accounts-plans-admin.md)). AI tidak boleh membuat `embed.html` (lihat [04](./04-ai-agent.md)).
- **Acceptance criteria**:
  - [ ] Renderer tidak pernah meng-inject `html` ke DOM halaman utama.
  - [ ] ❓ OPEN: apakah Google Maps embed disediakan sebagai node khusus `map` (lebih aman) alih-alih `embed`.

### DM-022 `form` & `formField`
- **P0 · M7** — bentuk node saja; perilaku submit, validasi server, dan mapping ke collection di [05-dynamic-data.md](./05-dynamic-data.md).
- **Props**:

```ts
interface FormProps {
  formKey: string;                                  // stabil, dipakai di submissions & URL /_api/v1/forms/:formId/submit (05)
  mode?: "create" | "update" | "standalone";        // default "create" (standalone bila target email); perilaku di 05 DATA-111
  target: { type: "collection"; collectionId: string } | { type: "workflow"; workflowId: string } | { type: "email"; to: "owner" };
  recordSource?: BindExpr;                          // mode update: record yang diedit, mis. { $bind: "page.item.id" }
  hiddenValues?: Record<string, string | number | boolean | BindExpr>;  // nilai tersembunyi yang ikut submit
  successAction?:                                   // perilaku di 05 DATA-116
    | { type: "message"; message: string; resetForm?: boolean }
    | { type: "redirect"; link: LinkValue }
    | { type: "redirectToRecord" }
    | { type: "showNode"; nodeId: NodeId }
    | { type: "toast"; message: string };
  spamProtection?: "honeypot" | "turnstile";        // honeypot + minSubmitMs selalu aktif (05 DATA-113)
  requireAuth?: boolean;                            // hanya member login
}
interface FormFieldProps {
  fieldKey: string;                                 // nama field submit; map ke field collection
  inputType: "text" | "email" | "tel" | "number" | "textarea" | "select" | "checkbox" | "radio" | "date" | "file";
  label: string; placeholder?: string; helpText?: string;
  required?: boolean; options?: { value: string; label: string }[];
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: "phoneID" | "email" | "url" };
}
```

- `formField` dirender sebagai label+input; style input via `states` & sub-style P1 (❓ OPEN: model style untuk bagian internal input — label/input/error).
- `submit` button = `frame`/instance dengan interaction `{ trigger: "click", actions: [{ type: "submitForm" }] }` di dalam form.
- **Acceptance criteria**:
  - [ ] `fieldKey` unik per form; `formField` hanya valid sebagai keturunan `form`.
  - [ ] `pattern` hanya dari enum (tidak ada regex bebas dari user/AI).

### DM-023 `dataList` (repeater) & `dataTable`
- **P0 · M7** — semantik query di [05](./05-dynamic-data.md).
- **Props**:

```ts
interface DataListProps {
  source: { collectionId: string; filter?: QueryFilter; sort?: QuerySort[]; limit?: number; pagination?: "none" | "loadMore" | "pages" };
  itemAlias: string;          // default "item" → dipakai di $bind "item.price"
  emptyState?: NodeId;        // child khusus yang tampil jika kosong
}
// children[0] = template item (satu subtree, diulang per record). children lain: emptyState.
interface DataTableProps {
  source: DataListProps["source"];
  columns: { fieldKey: string; label: string; format?: Filter[]; width?: LengthValue }[];
  actions?: ("view" | "edit" | "delete")[];   // CRUD M7, butuh authBlock/akses
  searchable?: boolean;
}
```

- **Acceptance criteria**:
  - [ ] `dataList` tanpa template item ditolak.
  - [ ] Di editor, `dataList` dirender dengan data contoh (sample records) atau placeholder statis.

### DM-024 `authBlock`
- **P0 · M7** — end-user auth per website, detail di [05](./05-dynamic-data.md).
- **Props**: `{ kind: "login" | "register" | "logout" | "resetPassword" | "memberGate"; redirectTo?: LinkValue; methods?: ("emailPassword" | "emailOtp" | "google")[] }`. `memberGate` adalah container (punya `children`) yang hanya tampil untuk member login.
- **Acceptance criteria**:
  - [ ] Hanya bisa ditambahkan bila website punya fitur dinamis aktif (dicek command, bukan schema).

---

## 5. Value types

### DM-025 Literal vs reference
- **P0 · M1**
- **Keputusan**: Referensi direpresentasikan sebagai **objek satu-key ber-prefix `$`**:

| Bentuk | Arti | Boleh di |
|---|---|---|
| literal (`"#FF5A1F"`, `16`, `{ "value": 16, "unit": "px" }`) | nilai langsung | semua |
| `{ "$token": "color.primary" }` | referensi design token (path dot) | style, theme alias, textStyle mark |
| `{ "$prop": "title" }` | referensi prop component | **hanya** di dalam `ComponentDefinition` (props, style, visible) |
| `{ "$bind": "item.price", "filters": [...] }` | data binding | **hanya** sebagai nilai di `node.bindings` (§11) |

- **Alasan** memilih objek `{ "$token": ... }` dibanding string `"{color.primary}"` atau `"var(--color-primary)"`:
  1. Tidak ambigu dengan teks literal (string `"{...}"` bisa saja konten user).
  2. Mudah divalidasi Zod (`z.union([literal, TokenRefSchema])`) dan di-autocomplete di tool schema AI.
  3. Konsisten dengan `$prop`/`$bind` → satu fungsi `resolveValue(v, ctx)`.
  4. Nama token bisa di-rename dengan scan sederhana `$token === old`.
  5. Prefix `$` tidak bisa bentrok dengan key style karena key style tidak pernah diawali `$`.
- **Tipe dasar**:

```ts
type TokenRef = { $token: string };             // regex ^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9-]+)+$
type PropRef  = { $prop: string; fallback?: unknown };
type V<T>     = T | TokenRef;                   // style value
type CV<T>    = T | TokenRef | PropRef;         // style/prop value di dalam component definition
type Unit = "px" | "%" | "vw" | "vh" | "rem" | "em" | "fr";
type LengthValue = { value: number; unit: Unit } | TokenRef;
type ColorValue  = string /* #RRGGBB | #RRGGBBAA */ | TokenRef | { $token: string; alpha: number };
```

- Warna literal **hanya** hex (`#RRGGBB`/`#RRGGBBAA`) — tidak `rgb()`/nama warna — agar diff & AI konsisten. `{ $token, alpha }` = token dengan opasitas override.
- Angka tanpa unit (mis. `gap: 16`) **tidak** diizinkan; selalu `{ value, unit }` atau token. Pengecualian: `opacity`, `zIndex`, `fontWeight`, `lineHeight` (multiplier), `flexGrow`.
- **Acceptance criteria**:
  - [ ] `resolveValue(v, { theme, props, mode })` mengembalikan literal final; token tidak ditemukan → fallback ke default theme + warning (tidak crash).
  - [ ] Validator menolak `$prop` di dokumen site (di luar component) dan `$bind` di luar `bindings`.
  - [ ] Validator menolak warna non-hex literal.

---

## 6. Style model

`ResponsiveStyle = { base: Style; tablet?: StylePatch; mobile?: StylePatch; [customBpId]?: StylePatch }` (§7). Di bawah ini adalah isi `Style`. Semua field opsional; nilai tidak ada = default CSS/renderer yang dinyatakan.

```ts
interface Style {
  layout?: LayoutStyle;        // §6.1  (container saja)
  size?: SizeStyle;            // §6.2
  position?: PositionStyle;    // §6.3
  flexChild?: FlexChildStyle;  // §6.1  (berlaku saat parent flex/grid)
  display?: "auto" | "none";   // "none" = sembunyi di breakpoint ini
  fills?: Fill[];              // §6.4
  strokes?: Stroke[];          // §6.5
  radius?: RadiusValue;        // §6.5
  effects?: Effect[];          // §6.6
  opacity?: number;            // 0..1
  blendMode?: BlendMode;
  overflow?: "visible" | "hidden" | "scroll" | "auto";
  typography?: TypographyStyle | TokenRef;   // §6.7
  color?: ColorValue;          // warna teks/ikon
  cursor?: "auto" | "pointer" | "default" | "text" | "not-allowed";
  zIndex?: number;             // int -100..1000
  transform?: TransformStyle;  // §6.8
  transition?: { durationMs: number; easing: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear" }; // untuk states
}
```

### DM-026 Layout (auto-layout & grid)
- **P0 · M1** (grid P1 · M2)
- **Detail**:

```ts
type LayoutStyle =
  | { mode: "none" }
  | { mode: "flex";
      direction: "row" | "column";
      wrap?: boolean;                                   // default false
      gap?: LengthValue;                                // main-axis gap
      crossGap?: LengthValue;                           // row-gap saat wrap
      padding?: Padding;
      align?: "start" | "center" | "end" | "stretch" | "baseline";   // cross axis (align-items)
      justify?: "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly"; // main axis
      reverse?: boolean;                                // P2
    }
  | { mode: "grid";
      columns: GridTrack; rows?: GridTrack;
      gap?: LengthValue; columnGap?: LengthValue; rowGap?: LengthValue;
      padding?: Padding;
      alignItems?: "start" | "center" | "end" | "stretch";
      justifyItems?: "start" | "center" | "end" | "stretch";
    };
type Padding = { top?: LengthValue; right?: LengthValue; bottom?: LengthValue; left?: LengthValue };
type GridTrack =
  | { type: "auto" }
  | { type: "repeat"; count: number; min?: LengthValue }          // repeat(count, minmax(min, 1fr))
  | { type: "autoFill"; min: LengthValue }                         // repeat(auto-fill, minmax(min, 1fr))
  | { type: "explicit"; tracks: (LengthValue | { min: LengthValue; max: LengthValue })[] };
interface FlexChildStyle {
  alignSelf?: "auto" | "start" | "center" | "end" | "stretch";
  grow?: number; shrink?: number;     // biasanya diturunkan dari size mode "fill"; manual = advanced
  order?: number;                     // P2: urutan visual berbeda per breakpoint
  gridColumn?: { start?: number; span?: number }; gridRow?: { start?: number; span?: number };
}
```

- **Patch semantics** untuk `layout`: di breakpoint override, `layout` di-merge per field (bukan replace) **kecuali** `mode` berubah → objek layout breakpoint dianggap lengkap untuk mode baru (field mode lama diabaikan).
- **Acceptance criteria**:
  - [ ] Mapping CSS terdokumentasi di renderer: `justify: "spaceBetween"` → `justify-content: space-between`, dst. Uji snapshot per nilai enum.
  - [ ] `padding` sebagian (mis. hanya `top`) valid; sisi lain default 0.

### DM-027 Sizing
- **P0 · M1**

```ts
type Dimension =
  | { mode: "fixed"; value: number; unit: "px" | "%" | "vw" | "vh" | "rem" }
  | { mode: "hug" }        // fit-content
  | { mode: "fill" };      // mengisi sisa ruang parent (flex: 1 1 0 / width:100% di kolom)
interface SizeStyle {
  width?: Dimension; height?: Dimension;
  minWidth?: LengthValue; maxWidth?: LengthValue; minHeight?: LengthValue; maxHeight?: LengthValue;
  aspectRatio?: number;    // w/h, mis. 1.7778
}
```

- **Aturan renderer** (diringkas; detail di 02/renderer):

| Kondisi | width CSS |
|---|---|
| `fixed` | `width: {value}{unit}; flex-shrink: 0` (shrink 1 bila `maxWidth` ada) |
| `hug` | `width: fit-content` |
| `fill` di parent flex row | `flex: 1 1 0; min-width: 0` |
| `fill` di parent flex column / block | `align-self: stretch; width: auto` |
| `fill` di parent `layout: none` | `left/right` constraints `stretch` (lihat §6.3) |

- **Acceptance criteria**:
  - [ ] `hug` pada node non-container non-text ditolak (image/shape harus fixed/fill).
  - [ ] Default node baru: frame `width: fill, height: hug`; text `width: fill, height: hug`; image `width: fill, height: fixed 240px`.

### DM-028 Position & constraints
- **P0 · M1**

```ts
type PositionStyle =
  | { type: "flow" }                                      // default: ikut layout parent
  | { type: "absolute";                                  // parent layout none, atau "absolute di dalam auto-layout" (seperti Figma)
      x: number; y: number;                              // px relatif ke parent (desain)
      constraints?: { horizontal: "left" | "right" | "leftRight" | "center" | "scale"; vertical: "top" | "bottom" | "topBottom" | "center" | "scale" };
    }
  | { type: "fixed"; anchor: "top" | "bottom"; offset?: LengthValue }   // P1: sticky header/WA button
  | { type: "sticky"; top: LengthValue };                               // P1
```

- Renderer: constraints → kombinasi `left/right/top/bottom/%`; `scale` → persentase.
- **Acceptance criteria**:
  - [ ] Node absolute di parent flex tidak memengaruhi layout saudara (CSS `position:absolute`).
  - [ ] Konversi absolute → flow menghapus `x/y`.

### DM-029 Fills
- **P0 · M1** (gradient P1 · M2)

```ts
type Fill =
  | { type: "solid"; color: ColorValue; opacity?: number; visible?: boolean }
  | { type: "linearGradient"; angle: number; stops: { offset: number; color: ColorValue }[]; visible?: boolean }
  | { type: "radialGradient"; center?: { x: number; y: number }; stops: { offset: number; color: ColorValue }[]; visible?: boolean }
  | { type: "image"; image: AssetRef; fit: "cover" | "contain" | "tile"; visible?: boolean };
```

- Urutan array = urutan layer Figma: **index 0 paling bawah**. Renderer membalik untuk CSS `background` (layer pertama CSS = paling atas).
- **Acceptance criteria**:
  - [ ] Maks 8 fills per node; stops 2–10; offset 0..1 menaik.
  - [ ] Fill dengan `visible: false` tidak dirender tetapi tetap tersimpan.

### DM-030 Strokes & radius
- **P0 · M1**

```ts
type Stroke = { color: ColorValue; width: LengthValue; style?: "solid" | "dashed" | "dotted"; position?: "inside" | "outside" | "center"; sides?: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean }; visible?: boolean };
type RadiusValue = LengthValue | { topLeft?: LengthValue; topRight?: LengthValue; bottomRight?: LengthValue; bottomLeft?: LengthValue };
```

- `inside` → `box-shadow inset` atau `border` dengan `box-sizing: border-box`; `outside` → `outline`/box-shadow. Maks 1 stroke di M1 (array untuk masa depan), maks 4 di P2.
- **Acceptance criteria**:
  - [ ] Stroke `inside` tidak mengubah ukuran node (diuji di renderer).

### DM-031 Effects, opacity, blend
- **P1 · M2**

```ts
type Effect =
  | { type: "dropShadow" | "innerShadow"; x: number; y: number; blur: number; spread?: number; color: ColorValue; visible?: boolean }
  | { type: "layerBlur" | "backgroundBlur"; radius: number; visible?: boolean }
  | { $token: string };                    // token shadow (mis. "shadow.md") — isinya array shadow
type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "colorDodge" | "colorBurn" | "difference" | "luminosity";
```

- **Acceptance criteria**:
  - [ ] Maks 6 effects; renderer menggabung shadow ke satu `box-shadow`.

### DM-032 Typography
- **P0 · M1**

```ts
interface TypographyStyle {
  fontFamily?: TokenRef | string;     // string = family name yang terdaftar di theme.fonts
  fontSize?: LengthValue;
  fontWeight?: 100|200|300|400|500|600|700|800|900;
  lineHeight?: number | LengthValue;  // number = multiplier
  letterSpacing?: LengthValue;        // em disarankan
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: "none" | "underline" | "lineThrough";
  textAlign?: "left" | "center" | "right" | "justify";   // fallback; align per paragraph di rich text menang
  fontStyle?: "normal" | "italic";
}
```

- `typography` boleh berupa `{ $token: "type.h1" }` (text style token komposit) **atau** objek dengan field yang sebagian token. Jika ingin "pakai type.h1 tapi warna/size beda", gunakan `{ "$token": "type.h1" }` di base dan patch field di breakpoint/override → merge rule: token komposit di-expand dulu lalu field patch di-merge (DM-036).
- **Acceptance criteria**:
  - [ ] Font yang tidak ada di `theme.fonts` ditolak validator (mencegah font tidak termuat saat publish).

### DM-033 Transform
- **P1 · M2**

```ts
interface TransformStyle { rotate?: number /*deg*/; scaleX?: number; scaleY?: number; translateX?: LengthValue; translateY?: LengthValue; flipX?: boolean; flipY?: boolean; origin?: "center" | "topLeft" }
```

- **Acceptance criteria**:
  - [ ] Rotasi tidak memengaruhi layout flex (sesuai CSS); editor menampilkan bounding box ter-rotate.

### DM-034 Style yang dilarang & escape hatch
- **P0 · M1**
- **Deskripsi**: Tidak ada `customCss` atau `className` bebas di M1–M8 (konsistensi, keamanan, AI tidak bisa "curang"). Kebutuhan baru = tambah field schema + migration.
- ❓ OPEN: P2 "Custom CSS" untuk paket Pro di level site (scoped, disanitasi) — lihat [07](./07-publishing-hosting.md).
- **Acceptance criteria**:
  - [ ] Zod `StyleSchema.strict()` menolak key tak dikenal.

---

## 7. Responsif & breakpoints

### DM-035 Definisi breakpoint
- **P0 · M1** (custom breakpoint P2 · M9)
- **Detail**:

```ts
interface BreakpointDef {
  id: "base" | "tablet" | "mobile" | `bp_${string}`;   // custom P2
  label: { id: string; en: string };
  maxWidth: number | null;     // base = null (desktop, ≥ breakpoint di atas tablet)
  previewWidth: number;        // lebar artboard default di editor
}
```

Default (disimpan di `settings.breakpoints`, bisa diubah nilainya, tidak bisa dihapus):

| id | Label | `maxWidth` (media query) | `previewWidth` |
|---|---|---|---|
| `base` | Desktop | `null` | 1440 |
| `tablet` | Tablet | 991 | 768 |
| `mobile` | Mobile | 479 | 390 |

- **Desktop-first**: CSS dihasilkan sebagai style base tanpa media query, lalu `@media (max-width: 991px)` untuk tablet, `@media (max-width: 479px)` untuk mobile. Alasan: mayoritas template & desain dibuat di artboard desktop (ala Figma/Webflow); konsisten dengan nama `base`.
- **Acceptance criteria**:
  - [ ] `maxWidth` mobile < tablet; validator menolak urutan terbalik.
  - [ ] Preview custom width di editor ([02](./02-editor.md)) memilih breakpoint efektif berdasarkan `maxWidth` yang sama dengan publish.

### DM-036 Format override: style dikunci breakpoint (per node)
- **P0 · M1**
- **Keputusan**: `node.style = { base: Style, tablet?: StylePatch, mobile?: StylePatch }`. `StylePatch` = `DeepPartial<Style>` (sparse: hanya field yang berbeda).
- **Trade-off** (alternatif yang ditolak: per-properti `{ width: { base, tablet, mobile } }` dan map global `overrides[bp][nodeId]`):

| Kriteria | **Per-node breakpoint map (dipilih)** | Per-properti | Map global per breakpoint |
|---|---|---|---|
| Kesesuaian brief `{ base, tablet, mobile }` | ✅ langsung | ✅ | ❌ |
| Membaca "apa yang beda di mobile untuk node ini" | ✅ satu objek | ❌ tersebar di setiap properti | ✅ |
| Schema Zod | ✅ `Style` + `Partial<Style>` | ❌ setiap tipe dibungkus `Responsive<T>` → schema & tipe membengkak | ✅ |
| Yjs granularity / konflik | ✅ `Y.Map` per breakpoint per node | ✅ | ❌ map besar hot-spot |
| Hapus node = hapus override-nya | ✅ otomatis | ✅ | ❌ perlu cleanup |
| AI tools (`setStyle(nodeId, bp, patch)`) | ✅ sederhana | ⚠️ path panjang | ⚠️ |

- **Cascade (resolusi)**: `effective(bp) = merge(base, tablet if bp ∈ {tablet, mobile}, mobile if bp = mobile)`. Custom breakpoint (P2) disisipkan sesuai urutan `maxWidth` menurun.
- **Merge rules** (`mergeStyle(a, patch)`):
  1. Objek biasa (`size`, `layout`, `padding`, `typography`, `position`, `transform`) → deep merge per key.
  2. **Array** (`fills`, `strokes`, `effects`) → **replace** utuh (tidak di-merge per index).
  3. Reference (`{ $token }`) dan `Dimension`/`LengthValue` → **atomik** (replace).
  4. `layout` dengan `mode` berbeda → replace (DM-026); `position` dengan `type` berbeda → replace.
  5. Nilai `null` di patch = **hapus override** (kembali mewarisi). Hanya diizinkan di patch, tidak di `base`.
- **Contoh**:

```json
"style": {
  "base":   { "layout": { "mode": "flex", "direction": "row", "gap": { "value": 32, "unit": "px" } }, "size": { "width": { "mode": "fill" } } },
  "tablet": { "layout": { "gap": { "value": 24, "unit": "px" } } },
  "mobile": { "layout": { "direction": "column" }, "display": "auto" }
}
```

Efektif mobile: `{ mode: flex, direction: column, gap: 24px }`, width fill.
- **Acceptance criteria**:
  - [ ] `resolveStyle(node, bp, ctx)` murni, ter-memoize per (nodeId, bp, docRevision), diuji untuk kelima aturan merge.
  - [ ] Patch kosong (`{}`) dinormalisasi menjadi field tidak ada (command menghapusnya).
  - [ ] Override yang nilainya sama dengan nilai warisan dihapus oleh `normalizeOverrides()` (dipanggil setelah command).

### DM-037 `manualResponsive`
- **P0 · M1** (UI penuh override P1 · M4–M9)
- **Deskripsi**: `settings.manualResponsive` (default `false`).
  - `false`: editor hanya mengedit `base` (tab tablet/mobile = **preview**); renderer menerapkan auto-responsive rules (DM-038). Override yang sudah ada di dokumen (mis. dari template/AI) **tetap** diterapkan.
  - `true`: editor mengizinkan memilih breakpoint aktif; edit style menulis ke patch breakpoint itu. Auto-responsive rules tetap jalan sebagai default, tetapi override manual menang.
- **Acceptance criteria**:
  - [ ] Template & component library boleh membawa override mobile walaupun user `manualResponsive: false`.
  - [ ] Mematikan `manualResponsive` **tidak** menghapus override (hanya UI yang berubah); ada command terpisah `clearBreakpointOverrides(scope)`.

### DM-038 Auto-responsive rules (transformasi renderer)
- **P0 · M1**
- **Deskripsi**: Aturan deterministik yang diterapkan renderer **di atas style efektif** untuk breakpoint `tablet`/`mobile` jika properti terkait **tidak** di-override eksplisit di breakpoint itu (atau breakpoint yang diwarisinya). Aturan tidak mengubah dokumen; murni transformasi render sehingga bisa diperbaiki tanpa migration.
- **Config** (`settings.autoResponsive`):

```ts
interface AutoResponsiveConfig {
  enabled: boolean;                       // default true
  rules: { [ruleId in AutoRuleId]?: boolean };  // semua default true
  mobileScale?: { fontMin: number /*px*/; spacingFactor: number };  // default { fontMin: 14, spacingFactor: 0.6 }
}
```

| Rule ID | Berlaku pada | Transformasi (mobile; tablet jika disebut) |
|---|---|---|
| `stackRows` | frame flex `row` dengan ≥ 2 anak dan lebar total konten > previewWidth breakpoint | `direction: column`, `align: stretch`, anak `fill` lebar. Tidak berlaku jika `props.role` ∈ {`button`} atau semua anak `hug` dan muat satu baris (mis. navbar ikon) |
| `wrapRowsTablet` | sama, di tablet | `wrap: true` (bukan stack) |
| `gridColumns` | grid `repeat` count > 2 | tablet: `min(count, 2)`; mobile: 1 |
| `fixedToFluid` | width `fixed` px > previewWidth | `width: fill`, `maxWidth` = nilai asli |
| `absoluteToFlow` | anak absolute di frame `layout: none` lebar > previewWidth | frame dirender flex column, anak diurutkan y lalu x |
| `scaleSpacing` | padding/gap literal px > 24 | dikali `spacingFactor` (token spacing: pakai token mobile jika didefinisikan di theme, §9) |
| `scaleType` | fontSize literal > 32px | skala `clamp()` ke min `fontMin`; token typography memakai nilai mobile token jika ada |
| `hideDecorative` | — (tidak ada; sengaja tidak menyembunyikan otomatis) | — |

- **Acceptance criteria**:
  - [ ] Setiap rule punya unit test input→output di `packages/renderer` dengan fixture.
  - [ ] Render editor & publish memanggil fungsi yang sama `applyAutoResponsive(resolvedTree, bp, config)`.
  - [ ] User bisa melihat "properti ini diatur otomatis" di panel (02) — renderer mengekspos `autoApplied: RuleId[]` per node di mode editor.
  - [ ] ❓ OPEN: threshold "lebar konten > previewWidth" dihitung statis dari nilai style (tanpa DOM) — perlu validasi di spike M0 apakah cukup akurat; alternatif: selalu stack row di mobile kecuali ditandai `keepRowOnMobile`.

### DM-039 Visibility per breakpoint
- **P0 · M1**
- `style.<bp>.display = "none"` menyembunyikan node di breakpoint itu (dan turunan cascade). `visible: false` (node base) menyembunyikan di semua breakpoint dan **tidak** dipublish sama sekali.
- **Acceptance criteria**:
  - [ ] Node `visible: false` tidak ada di HTML publish; node `display: none` ada di HTML dengan CSS media query.

---

## 8. States

### DM-040 Interaction states sebagai style variant
- **P0 · M2** (hover, pressed) · P1 (focus, active, disabled)
- **Detail**:

```ts
type StateName = "hover" | "pressed" | "focus" | "active" | "disabled";
type StateStyles = { [S in StateName]?: { base?: StylePatch; tablet?: StylePatch; mobile?: StylePatch } };
```

- Mapping CSS: `hover` → `:hover` (dibungkus `@media (hover: hover)`), `pressed` → `:active`, `focus` → `:focus-visible`, `active` → kelas `.is-active` (mis. link nav yang menunjuk halaman saat ini; renderer menambahkan otomatis), `disabled` → `[aria-disabled=true]`.
- Resolusi: `effective(bp, state) = merge(effective(bp), states[state].base, states[state].tablet?, states[state].mobile?)` dengan cascade breakpoint yang sama.
- Property yang diizinkan di state: `fills, strokes, effects, opacity, color, typography (textDecoration, fontWeight), transform, cursor`. **Tidak** boleh `layout`, `size`, `position` (mencegah layout shift). Validator menolak.
- `style.transition` di base menentukan animasi antar state.
- **Contoh**:

```json
"states": { "hover": { "base": { "fills": [{ "type": "solid", "color": { "$token": "color.primaryHover" } }], "transform": { "translateY": { "value": -2, "unit": "px" } } } } }
```

- **Acceptance criteria**:
  - [ ] Editor dapat mem-preview state (force state) tanpa mengubah dokumen.
  - [ ] Hover style tidak diterapkan di perangkat sentuh (media `hover: hover`).
  - [ ] Component variant (§10.3) dapat memiliki states sendiri; states instance di-merge setelah variant.

---

## 9. Design tokens & theme

### DM-041 Struktur theme
- **P0 · M1**

```ts
interface Theme {
  tokens: {
    color:      Record<string, TokenValue<ColorLiteral>>;     // primary, primaryHover, onPrimary, background, surface, onSurface, muted, border, accent, success, warning, danger
    typography: Record<string, TokenValue<TypographyLiteral>>; // display, h1..h4, body, bodySm, caption, button, overline
    fontFamily: Record<string, TokenValue<string>>;           // heading, body, mono
    space:      Record<string, TokenValue<LengthLiteral>>;    // 0,1,2,3,4,5,6,8,10,12,16,20,24 (skala 4px)
    radius:     Record<string, TokenValue<LengthLiteral>>;    // none, sm, md, lg, xl, full
    shadow:     Record<string, TokenValue<ShadowLiteral[]>>;  // sm, md, lg
    size?:      Record<string, TokenValue<LengthLiteral>>;    // container (1200px), contentNarrow (720px)
  };
  fonts: FontDef[];
  modes?: { default: "light"; available: ("light" | "dark")[] };   // P2
}
type TokenValue<T> =
  | T                                          // nilai langsung
  | { $token: string }                         // alias ke token lain (mis. color.primaryHover → color.brand.600)
  | { value: T | { $token: string }; mobile?: T; tablet?: T; dark?: T | { $token: string }; description?: string };
interface FontDef { family: string; source: "google" | "fontsource" | "upload"; weights: number[]; italic?: boolean; assetId?: string; fallback: "sans-serif" | "serif" | "monospace" }
```

- **Path token**: `<group>.<name>` (`color.primary`, `type.h1` → alias pendek `type` untuk group `typography`, `space.6`). Nama group tetap; nama di dalam group bebas `[a-zA-Z0-9-]+`, nested 1 level opsional (`color.brand.600`).
- Token `typography` adalah token komposit (objek). Token dengan `mobile`/`tablet` = **responsive token** — dipakai rule `scaleType`/`scaleSpacing` dan renderer mengeluarkannya sebagai CSS variable yang di-override di media query.
- **Acceptance criteria**:
  - [ ] Renderer menghasilkan CSS variables: `--color-primary`, `--space-6`, `--type-h1-font-size`, dst.; node merujuk `var(--…)` (bukan nilai literal) sehingga ganti tema tidak perlu re-render node.
  - [ ] Set token default (`defaultTheme`) tersedia di package dan dipakai website blank.

### DM-042 Alias token
- **P0 · M1**
- Alias = `{ $token: "color.brand.600" }` sebagai nilai token. Resolusi rekursif maks kedalaman 5; cycle ditolak validator. Alias lintas group hanya diizinkan jika tipe kompatibel (color→color, fontFamily dipakai di typography).
- **Acceptance criteria**:
  - [ ] `resolveToken(theme, path)` mendeteksi cycle & path hilang dengan error bertipe (`TokenCycleError`, `TokenNotFoundError`).

### DM-043 Mode light/dark
- **P2 · M9**
- Token boleh punya `dark`. Renderer mengeluarkan `[data-theme=dark]` + `prefers-color-scheme`. Site setting memilih `light only | dark only | auto | toggle`.
- ❓ OPEN: apakah toggle dark mode untuk pengunjung website merupakan fitur yang dibutuhkan UMKM.

### DM-044 Aturan ganti tema
- **P0 · M3** (theme preset), P1 (AI generate theme · M6)
- **Deskripsi**: "Ganti tema" = mengganti `theme.tokens` (sebagian/seluruhnya) lewat command `applyThemePreset(presetId, { keep?: TokenGroup[] })`. Node tidak disentuh. Token yang hilang di tema baru → diisi dari tema lama (tidak boleh ada referensi patah).
- Component library hanya boleh memakai **nama token standar** (daftar tetap di `packages/document-model/tokens/standard.ts`) agar component cocok dengan tema apa pun. Token kustom user diperbolehkan untuk node website.
- **Acceptance criteria**:
  - [ ] Setelah `applyThemePreset`, `validateDocument` tidak menghasilkan `TokenNotFound`.
  - [ ] Linter component (03) menolak publish component yang merujuk token non-standar.
  - [ ] Ganti tema adalah satu transaksi (satu undo).

---

## 10. Component definition & instance

Lifecycle (buat, publish versi, update instance, library, mode admin) ada di [03-components-templates.md](./03-components-templates.md). Bagian ini mendefinisikan **format data persis** dan **algoritma resolusi**.

### DM-045 `ComponentDefinition`
- **P0 · M3**

```ts
interface ComponentDefinition {
  schemaVersion: number;
  id: ComponentId;               // cmp_…; sama untuk semua versi
  version: number;               // int ≥ 1; satu baris DB per (id, version), IMMUTABLE setelah publish
  name: string;                  // "Navbar / Logo kiri"
  category: "navbar" | "hero" | "section" | "card" | "button" | "form" | "footer" | "pricing" | "testimonial" | "gallery" | "table" | "dashboard" | "sidebar" | "icon" | "other";
  description?: string;          // dipakai AI untuk memilih component (wajib untuk library)
  tags?: string[];
  aiHints?: { whenToUse: string; doNot?: string };  // untuk skill/tool AI (04)
  propsSchema: PropDef[];        // DM-046
  variantAxes?: VariantAxis[];   // DM-048
  variants?: VariantRule[];
  rootId: NodeId;
  nodes: Record<NodeId, Node>;   // flat, sama dengan site; root.parentId = null
  thumbnail?: AssetRef;
  requires?: { dynamic?: boolean; commerce?: boolean };   // gating paket
  // + semver, nodeAccess, migration — DM-079
}
```

- Node di dalam definisi boleh memakai `$prop` dan node `slot`. ID node di dalam definisi **stabil antar versi** (versi baru mempertahankan ID node yang "sama") — ini memungkinkan override instance tetap berlaku setelah update versi.
- **Acceptance criteria**:
  - [ ] Versi yang sudah dipublish tidak bisa diubah (enforce di DB + service, lihat 03).
  - [ ] Validator component: tidak ada instance dirinya sendiri (langsung/tidak langsung), semua `$prop` merujuk prop di `propsSchema`, semua token standar (DM-044).

### DM-046 Props schema
- **P0 · M3**

```ts
type PropDef = {
  key: string;                       // camelCase, unik
  label: { id: string; en: string };
  description?: string;
  required?: boolean;
  group?: string;                    // pengelompokan di panel
} & (
  | { type: "text"; default: string; maxLength?: number; multiline?: boolean }
  | { type: "richText"; default: RichTextDoc }
  | { type: "number"; default: number; min?: number; max?: number; step?: number }
  | { type: "boolean"; default: boolean }
  | { type: "enum"; default: string; options: { value: string; label: { id: string; en: string } }[] }
  | { type: "image"; default?: AssetRef }
  | { type: "link"; default?: LinkValue }
  | { type: "color"; default: ColorValue }
  | { type: "icon"; default: { set: "lucide"; name: string } }
  | { type: "slot"; allowedTypes?: NodeType[] }                 // dideklarasikan + ada node slot dengan slotName = key
  | { type: "list"; itemSchema: PropDef[]; default: Record<string, PropValue>[]; minItems?: number; maxItems?: number }  // P0 · M3 (03 CMP-022): menu items, FAQ, fitur pricing
  | { type: "collectionBinding"; default?: null }                // M7: nilai = DataListProps["source"] (DM-023), lihat DM-079
) & PropDefExtra;                                                // semanticRole, hiddenInSimple, order — DM-079
```

- **Acceptance criteria**:
  - [ ] `propValues` instance divalidasi terhadap `propsSchema` versi yang dirujuk (Zod schema dibangkitkan dinamis: `propsSchemaToZod(defs)`).
  - [ ] Prop yang hilang memakai `default`; prop tak dikenal di `propValues` → warning + diabaikan (bukan error, agar update versi tidak merusak).

### DM-047 Binding node ke props (`$prop`)
- **P0 · M3**
- `$prop` boleh muncul di: nilai di `props` node (mis. `text.props.content`, `image.props.image`, `frame.props.link`), nilai style (mis. `fills[0].color`), `visible` (`{ "$prop": "showBadge" }`).
- Tipe harus kompatibel: `text`→string (dipasang sebagai paragraf tunggal di text node), `richText`→`content`, `image`→`AssetRef`, `color`→`ColorValue`, `boolean`→`visible`, `enum`→ dipakai via variant axis (DM-048) atau `visible` dengan `{ "$prop": "align", "eq": "left" }`.
- Untuk `list`: frame bertanda `props.repeatProp: "menuItems"` mengulang child template-nya per item; di dalamnya `{ "$prop": "menuItems[].label" }` (scope item).
- **Contoh** (di definisi navbar):

```json
{ "id": "n_brandtxt01", "type": "text", "name": "Brand", "parentId": "n_navroot001", "visible": true, "locked": false,
  "style": { "base": { "typography": { "$token": "type.h4" } } },
  "props": { "content": { "$prop": "brandName" } } }
```

- **Acceptance criteria**:
  - [ ] Validator memeriksa kompatibilitas tipe `$prop` ↔ `PropDef.type`.

### DM-048 Variants
- **P0 · M3**

```ts
interface VariantAxis { name: string; options: string[]; default: string }   // mis. size: [sm, md, lg]
interface VariantRule {
  when: Record<string, string>;             // subset kombinasi axis; {} tidak boleh
  overrides: Record<NodePath, NodePatch>;   // format sama dengan override instance (DM-049)
}
```

- Base definisi = tampilan untuk kombinasi default. Rule diterapkan **berurutan**; rule yang lebih spesifik (lebih banyak key di `when`) diterapkan setelah yang kurang spesifik (sort stabil by `Object.keys(when).length`).
- **Contoh** (button):

```json
"variantAxes": [ { "name": "tone", "options": ["primary", "secondary"], "default": "primary" }, { "name": "size", "options": ["md", "lg"], "default": "md" } ],
"variants": [
  { "when": { "tone": "secondary" }, "overrides": { "n_btnroot001": { "style": { "base": { "fills": [], "strokes": [{ "color": { "$token": "color.primary" }, "width": { "value": 1, "unit": "px" } }] } } }, "n_btnlabel01": { "style": { "base": { "color": { "$token": "color.primary" } } } } } },
  { "when": { "size": "lg" }, "overrides": { "n_btnroot001": { "style": { "base": { "layout": { "padding": { "top": { "$token": "space.4" }, "bottom": { "$token": "space.4" } } } } } } } }
]
```

- **Acceptance criteria**:
  - [ ] Maks 4 axis, maks 6 option per axis, maks 32 rules.
  - [ ] `instance.props.variant` dengan option tak dikenal → fallback default + warning.

### DM-049 Instance overrides & addressing
- **P0 · M3**
- **NodePath**: ID node di dalam definisi component. Untuk instance bersarang: gabung ID dengan `/`: `"n_cardinst01/n_price00001"` = node `n_price00001` di dalam component yang di-instance oleh node `n_cardinst01` (yang ada di definisi component luar). Path relatif terhadap component yang di-instance oleh instance pemilik override.
- **NodePatch**:

```ts
interface NodePatch {
  style?: { base?: StylePatch; tablet?: StylePatch; mobile?: StylePatch };
  states?: StateStyles;
  props?: Record<string, unknown>;     // hanya key tertentu per tipe: text.content, image.image, frame.link, icon.name, instance.propValues/variant (nested)
  visible?: boolean;
  name?: never;                        // nama layer tidak bisa di-override
}
```

- **Yang tidak bisa di-override**: struktur (tambah/hapus/pindah node), `type`, `tag`, interaksi (❓ OPEN: override link/interaction target — usulan: link via prop saja). Perubahan struktur = isi slot atau Detach.
- **Prioritas** (rendah → tinggi): definisi base → variant rules → `propValues` (`$prop`) → `overrides` instance → breakpoint cascade di setiap lapis → states.
- **Acceptance criteria**:
  - [ ] Override dengan path yang tidak lagi ada di versi baru → disimpan tetapi ditandai `orphaned` oleh `checkInstanceOverrides()`; UI update (03) menampilkan daftar override yang hilang.
  - [ ] `resetOverride(instanceId, path, field?)` tersedia.

### DM-050 Detach
- **P0 · M3**
- `detachInstance(instanceId)`: menghasilkan subtree node biasa hasil resolusi (variant + props + overrides diterapkan; `$prop` diganti literal; token tetap token), ID baru, `metadata.detachedFrom` diisi. Slot content dipindah ke posisi slot. Instance bersarang **tetap instance** (detach satu level). Hapus entri `componentDeps` jika tidak ada instance lain.
- **Acceptance criteria**:
  - [ ] Render sebelum & sesudah detach identik (snapshot test pixel/HTML).
  - [ ] Satu transaksi, satu undo.

### DM-051 Algoritma resolusi instance
- **P0 · M3**
- **Pseudo-code** (`packages/document-model/resolve/resolveInstance.ts`; dipakai renderer & AI outline):

```ts
function resolveInstance(inst: InstanceNode, ctx: ResolveCtx, depth = 0): ResolvedNode {
  if (depth > MAX_INSTANCE_DEPTH /* 8 */) throw new ResolveError("INSTANCE_DEPTH");
  const def = ctx.getComponent(inst.props.componentId, inst.props.version);   // cache; versi wajib ada
  if (!def) return placeholderMissingComponent(inst);                          // render kotak abu + warning

  // 1. Hitung variant aktif & props efektif
  const variant = { ...defaultsOf(def.variantAxes), ...sanitizeVariant(inst.props.variant, def) };
  const props   = { ...defaultsOf(def.propsSchema), ...pickKnown(inst.props.propValues, def.propsSchema) };

  // 2. Kumpulkan patch: variant rules (urut spesifisitas) lalu override instance
  const patches: Map<NodePath, NodePatch[]> = new Map();
  for (const rule of sortBySpecificity(def.variants ?? []))
    if (matches(rule.when, variant)) addAll(patches, rule.overrides);
  addAll(patches, inst.props.overrides ?? {});

  // 3. Clone tree definisi dengan ID ter-scope: `${inst.id}:${defNodeId}` (hanya di tree hasil resolve, bukan di dokumen)
  function walk(defNodeId: NodeId, pathPrefix: string): ResolvedNode {
    const src  = def.nodes[defNodeId];
    const path = pathPrefix + defNodeId;
    let node   = applyPatches(src, patches.get(path));                 // deep merge sesuai DM-036
    node       = substituteProps(node, props);                         // ganti {$prop} → nilai
    if (node.type === "slot") {
      const fill = inst.props.slots?.[node.props.slotName];
      const kids = fill?.length ? fill.map(id => ctx.resolveSiteNode(id)) // node milik site
                                : (node.children ?? []).map(c => walk(c, pathPrefix));
      return { ...asFrame(node), children: kids };
    }
    if (node.type === "instance") {
      // override milik instance luar yang menembus ke dalam instance bersarang
      const nested = extractNestedOverrides(patches, path + "/");      // "n_card/n_price" → "n_price"
      return resolveInstance(mergeNestedOverrides(node, nested), ctx, depth + 1);
    }
    return { ...node, children: node.children?.map(c => walk(c, pathPrefix)) };
  }
  const root = walk(def.rootId, "");
  // 4. Style instance (size/position di parent) di-merge ke root
  root.style = mergeResponsiveStyle(root.style, inst.style);
  root.sourceInstanceId = inst.id;     // untuk seleksi di editor (klik → pilih instance / double-click → masuk)
  return root;
}
```

- **Acceptance criteria**:
  - [ ] Resolusi deterministik & murni; hasil di-cache per `(instanceId, componentVersion, hash(props, overrides, variant))`.
  - [ ] Component hilang/versi hilang tidak membuat halaman crash (placeholder + error di panel).
  - [ ] Test fixture: instance bersarang 3 level dengan override menembus 2 level.

### DM-079 Metadata library pada `ComponentDefinition`
- **P0 · M3** (`collectionBinding`: M7) — lifecycle & UI di [03-components-templates.md](./03-components-templates.md); di sini **format data**.
- **Pemetaan istilah 03 → 01**:

| Istilah di 03 | Format di 01 |
|---|---|
| ID node stabil (dulu disebut `nodeKey`) | `NodeId` di `ComponentDefinition.nodes`, stabil antar versi (DM-045); alamat override = `NodePath` (DM-049) |
| Varian sebagai delta | `variantAxes` + `variants: VariantRule[]` (DM-048) — patch per ID node, bukan tree terpisah |
| Binding prop → node | `{ "$prop": "<key>" }` di nilai node (DM-047) |
| `simpleAccess` / `hardLocked` (editable vs locked) | `ComponentDefinition.nodeAccess` (di bawah) |
| `semanticRole` | `PropDef.semanticRole` (di bawah) |
| `migration` antar versi MAJOR | `ComponentDefinition.migration` (di bawah) |
| Prop `list`, `collectionBinding` | `PropDef` DM-046 |
| Versi semver `1.2.0` | `version` (int, = `version_seq` 03) + `semver` (label) |

```ts
// Tambahan field ComponentDefinition (DM-045)
interface ComponentDefinitionLibraryFields {
  semver?: string;                                     // "1.2.0" — label tampilan; referensi tetap `version` int
  nodeAccess?: Record<NodeId, NodeAccess>;             // default: semua node "locked" di Simple mode kecuali yang ber-$prop
  migration?: ComponentMigration;                      // wajib pada versi MAJOR (03 CMP-054)
}
interface NodeAccess {
  simpleAccess?: "locked" | "content" | "visibility" | "style-basic";   // 03 CMP-024
  hardLocked?: boolean;                                // tidak bisa di-override bahkan di Design mode
}

// Tambahan field PropDef (DM-046)
type PropDefExtra = {
  semanticRole?: SemanticRole;                         // dipakai swap component (03 CMP-074), onboarding, AI (04)
  hiddenInSimple?: boolean;
  order?: number;
};
type SemanticRole =
  | "brandName" | "tagline" | "logo"
  | "heading" | "subheading" | "body"
  | "primaryCtaLabel" | "primaryCtaLink" | "secondaryCtaLabel" | "secondaryCtaLink"
  | "heroImage" | "image" | "items" | "price"
  | "contactPhone" | "contactEmail" | "contactWhatsapp" | "address";    // daftar awal; menambah nilai = minor

// Prop collectionBinding: nilai di instance.propValues = DataListProps["source"]
//   { collectionId, filter?, sort?, limit?, pagination? }; dipakai di definisi via
//   dataList.props.source = { "$prop": "<key>" }. Semantik query & izin: 05.

interface ComponentMigration {
  fromMajor: number;                                   // major semver asal; berantai 1→2→3
  props?: Record<string,
    | { rename: string }
    | { mapValues: Record<string, string> }
    | { moveInto: string }                             // ke sub-field list/object, mis. "primaryCta.label"
    | { setDefault: PropValue }
    | { drop: true; note?: { id: string; en: string } }
    | { transform: "stringToRichText" | "richTextToString" | "linkUrlToLinkValue" }>;  // fungsi terdaftar, bukan kode bebas
  variants?: Record<string, { rename?: string; mapValues?: Record<string, string> }>;
  nodeIds?: Record<NodeId, NodeId>;                    // remap target override (ID lama → baru)
  slots?: Record<string, string>;
}
```

- `migrateInstance(instance, fromDef, toDef, migrations) → { instance, warnings[] }` di `packages/document-model`, pure (03 CMP-054).
- **Acceptance criteria**:
  - [ ] `ComponentDefinitionSchema` memvalidasi `nodeAccess` (key harus ID node yang ada) dan `semanticRole` (enum).
  - [ ] Versi MAJOR tanpa `migration` yang mencakup prop/variant/slot/ID node yang hilang ditolak validator publish.
  - [ ] Override instance pada node `hardLocked` dibuang saat resolusi (DM-051) dengan warning.

---

## 11. Bindings & expressions

Semantik data (collection, query, scope record, permission) di [05-dynamic-data.md](./05-dynamic-data.md). Di sini hanya **format**.

### DM-052 Format binding
- **P0 · M7**
- **Detail**: `node.bindings: Record<TargetPath, BindExpr>`; `TargetPath` = path dot ke field node yang diisi data: `props.content`, `props.image`, `props.link`, `style.base.fills.0.color` (P2), `visible`.
- **Alasan map terpisah** (bukan inline seperti `$token`): nilai statis di `props` tetap ada sebagai **placeholder desain** (tampil di editor tanpa data, dan menjadi fallback saat data kosong); mudah mendeteksi "node ini dinamis" (renderer publish memutuskan island hanya dari `bindings`); melepas binding tidak menghilangkan desain.

```ts
type BindExpr =
  | { $bind: string; filters?: Filter[]; fallback?: unknown }         // path: "item.price", "page.item.name", "user.name", "site.title"
  | { $template: string; fallback?: string };                          // "Rp {{ item.price | currency }} / {{ item.unit }}"
type Filter = { fn: FilterFn; args?: Record<string, string | number | boolean> };
type FilterFn = "currency" | "number" | "date" | "datetime" | "relativeTime" | "uppercase" | "lowercase" | "capitalize" | "truncate" | "default" | "plural" | "join" | "boolean" | "selectLabel" | "fileSize" | "imageVariant";
```

- **Scope root yang valid**: `item` (alias `dataList.itemAlias`; plus `index`, `list.total`, `parent.item` untuk repeater bersarang), `page.item` (halaman dinamis), `page.params` (route param), `user` (member login, field terbatas), `site` (settings publik), `now`, `form` (state form, P1), `query` (URL query param, string saja). Nama root ini dipakai juga oleh 05 (konteks server access rule/workflow menyebut `user` sebagai `currentUser`).
- **Contoh**:

```json
"bindings": {
  "props.content": { "$template": "{{ item.price | currency }}", "fallback": "Rp 0" },
  "props.image":   { "$bind": "item.photo", "filters": [{ "fn": "imageVariant", "args": { "width": 600 } }] }
}
```

- **Acceptance criteria**:
  - [ ] Bind ke `props.content` text node menghasilkan paragraf tunggal plain text (marks dari placeholder pertama dipertahankan).
  - [ ] Path divalidasi terhadap schema collection saat simpan (warning) dan saat publish (error) — rujuk 05.

### DM-053 Filter/formatter
- **P0 · M7**

| fn | args | Contoh hasil |
|---|---|---|
| `currency` | `currency="IDR"` (default IDR), `decimals=0`, `locale="id-ID"` | `Rp 125.000` |
| `number` | `decimals`, `locale` | `1.250,5` |
| `date` | `format="d MMM yyyy"` (token terbatas: d, dd, MMM, MMMM, yyyy, HH, mm), `locale`, `tz="Asia/Jakarta"` | `12 Okt 2026` |
| `relativeTime` | `locale` | `3 hari lalu` |
| `uppercase`/`lowercase`/`capitalize` | — | |
| `truncate` | `length`, `suffix="…"` | |
| `default` | `value` | |
| `plural` | `one`, `other` | `1 produk` / `5 produk` |
| `datetime` | `format`, `locale`, `tz` | `12 Okt 2026 14.30` |
| `boolean` | `yes="Ya"`, `no="Tidak"` | `Ya` |
| `selectLabel` | — | label option select (bukan value) |
| `fileSize` | — | `2,4 MB` |
| `join` | `separator=", "` | |
| `imageVariant` | `width`, `height?`, `fit?` | URL varian asset |

- **Acceptance criteria**:
  - [ ] Implementasi filter **sama** di renderer server (publish) dan island client (satu modul `packages/document-model/expr`).
  - [ ] Default locale mengikuti `settings.language`.

### DM-054 Keamanan expression
- **P0 · M7**
- **Aturan**: Tidak ada `eval`, `new Function`, atau JS bebas. `$template` diparse oleh parser kecil buatan sendiri dengan grammar: `text ( "{{" path ( "|" fn ( ":" arg ( "," arg )* )? )* "}}" text )*`. Path hanya `[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+|\[\d+\])*`. Tanpa operator aritmatika/kondisional di M7 (kondisi = `visible` binding + filter `default`).
- Output selalu di-escape sebagai teks; binding ke `props.link` divalidasi skema URL (`https:`, `mailto:`, `tel:`, path internal) — `javascript:` ditolak.
- **Acceptance criteria**:
  - [ ] Fuzz test parser: input acak tidak pernah melempar exception tak tertangani; panjang template maks 500 char, maks 10 placeholder.
  - [ ] Test XSS: nilai data `<script>` dirender sebagai teks.
  - [ ] ❓ OPEN: perlu ekspresi kondisional sederhana (`if stock > 0`) di M7 atau cukup filter.

---

## 12. Interactions & links

### DM-055 Interactions
- **P0 · M2** (navigate, scrollTo) · P1 (toggle, modal, setVariant) · M7 (submitForm, runWorkflow, logout)

```ts
interface Interaction {
  id: string;                        // ix_…
  trigger: "click" | "hover" | "pageLoad" | "scrollIntoView" | "submit";
  actions: InteractionAction[];      // dieksekusi berurutan, maks 5
}
type InteractionAction =
  | { type: "navigate"; link: LinkValue }
  | { type: "scrollTo"; targetId: NodeId; offset?: number; smooth?: boolean }
  | { type: "toggleVisibility"; targetId: NodeId }
  | { type: "openOverlay"; targetId: NodeId }          // frame overlay/modal (P1) — node dengan props.role "overlay"
  | { type: "closeOverlay" }
  | { type: "setVariant"; targetId: NodeId; variant: Record<string, string> }   // instance target
  | { type: "animate"; preset: "fadeIn" | "slideUp" | "zoomIn"; durationMs?: number; delayMs?: number } // P1, trigger scrollIntoView
  | { type: "submitForm" }                              // M7, rujuk 05
  | { type: "runWorkflow"; workflowId: string }         // M7, rujuk 05
  | { type: "logout" }                                  // M7
  | { type: "addToCart"; productBind: BindExpr }        // M8, rujuk 06-commerce-payments.md
  | { type: "copyToClipboard"; text: string };          // P2
```

- `targetId` harus node di **page yang sama** (atau node site-level overlay P2). Renderer publish mengubah interaksi ke JS runtime kecil (deklaratif, data attribute) — bukan kode per-website.
- **Acceptance criteria**:
  - [ ] Validator menolak `targetId` yang tidak ada/di page lain.
  - [ ] Hapus node target → command `deleteNode` membersihkan interaction yang merujuknya (dan melaporkannya ke caller/AI).
  - [ ] Halaman tanpa interaction non-navigasi tidak memuat JS runtime interaksi (07).

### DM-056 `LinkValue`
- **P0 · M1**

```ts
type LinkValue =
  | { type: "page"; pageId: PageId; anchorNodeId?: NodeId }
  | { type: "url"; href: string; newTab?: boolean }          // https:// atau http:// saja
  | { type: "anchor"; nodeId: NodeId }                       // di page yang sama
  | { type: "email"; to: string; subject?: string }
  | { type: "phone"; phone: string }                         // E.164 tanpa '+', mis. 6281234567890
  | { type: "whatsapp"; phone: string; message?: string }    // → https://wa.me/<phone>?text=…
  | { type: "asset"; assetId: AssetId };                     // download file (PDF menu, katalog)
```

- Link ke page memakai `pageId` (bukan path) agar rename path tidak merusak link.
- **Acceptance criteria**:
  - [ ] Normalisasi nomor Indonesia: input `0812…`/`+62812…` disimpan `62812…` (oleh command, bukan renderer).
  - [ ] `href` `javascript:`/`data:` ditolak.

---

## 13. Assets reference

### DM-057 `AssetRef` & registry
- **P0 · M1**
- **Detail**: File fisik & metadata lengkap ada di tabel `assets` + object storage (R2/MinIO), lihat [../ARCHITECTURE.md](../ARCHITECTURE.md) & [07](./07-publishing-hosting.md). Dokumen menyimpan:

```ts
interface AssetRef {
  assetId: AssetId;
  alt?: string;                                   // per pemakaian (gambar sama bisa beda alt)
  focalPoint?: { x: number; y: number };          // 0..1, default 0.5,0.5 → object-position
  crop?: { x: number; y: number; width: number; height: number };  // normalized 0..1 terhadap gambar asli; non-destruktif
}
interface AssetEntry {                            // doc.assets[assetId] — cache ringan untuk render tanpa query DB
  kind: "image" | "video" | "file" | "font" | "svg";
  width?: number; height?: number;                // piksel asli
  mime: string;
  blurhash?: string;                              // placeholder
  libraryShared?: boolean;                        // asset milik library platform (stok/template), bukan upload user
}
```

- URL **tidak** disimpan di dokumen (dibangun dari `assetId` + CDN base + varian) agar ganti CDN/domain tidak perlu migrasi dokumen.
- `crop` diterapkan renderer via varian image (server-side) saat publish; di editor via CSS (`object-view-box`/wrapper).
- SVG upload disanitasi saat upload (bukan di dokumen) — lihat 07.
- **Acceptance criteria**:
  - [ ] Setiap `assetId` yang dirujuk node/theme/settings ada di `doc.assets`; `doc.assets` tidak memuat entri yang tidak dirujuk setelah `gcAssets()` (dipanggil saat publish & snapshot).
  - [ ] Copy dokumen antar website (template → user) menyalin/merujuk asset library tanpa duplikasi file (`libraryShared: true`).

---

## 14. Representasi Yjs

### DM-058 Mapping JSON ↔ Y.Doc
- **P0 · M1**
- **Struktur** (satu `Y.Doc` per website):

```
Y.Doc (guid = siteId)
├─ "meta"          Y.Map   { schemaVersion: number, title, createdWith, templateRef }
├─ "settings"      Y.Map   key → JSON (seo, breakpoints, autoResponsive: atomik per key)
├─ "theme"         Y.Map   { tokens: Y.Map<group, Y.Map<name, JSON>>, fonts: Y.Array<JSON>, modes: JSON }
├─ "assets"        Y.Map<AssetId, JSON>
├─ "componentDeps" Y.Map<ComponentId, JSON>
├─ "localComponents" Y.Map<ComponentId, JSON>     (P1; atomik per component)
├─ "dataSources"   Y.Map   { collections: JSON }
├─ "pageOrder"     Y.Array<PageId>
└─ "nodes"         Y.Map<NodeId, Y.Map>
       node Y.Map:
         id, type, name, parentId, visible, locked, tag, htmlId   → primitif
         children     → Y.Array<NodeId>              (container saja)
         style        → Y.Map<bp, Y.Map<styleGroup, JSON>>   (styleGroup = layout|size|position|fills|...)
         states       → Y.Map<state, JSON>
         props        → Y.Map<key, JSON>             (text: key "content" = Y.XmlFragment)
         bindings     → Y.Map<path, JSON>
         interactions → Y.Array<JSON>
         a11y, metadata → JSON (atomik)
```

- **Granularitas**: daun (`JSON`) diperlakukan atomik (last-writer-wins). Pemisahan sampai level `styleGroup` per breakpoint berarti dua user yang mengubah `fills` dan `layout` node yang sama tidak konflik, tetapi dua user yang mengubah `layout.gap` dan `layout.padding` bersamaan → salah satu menang (dapat diterima; ❓ OPEN: pecah `layout` lebih halus jika multiplayer menunjukkan masalah).
- **Rich text**: `props.content` text node = `Y.XmlFragment` yang di-bind ke Tiptap via `y-prosemirror` (extension Collaboration) — editing teks per karakter ter-merge. Konversi JSON ↔ fragment memakai `prosemirrorJSONToYXmlFragment` / `yXmlFragmentToProseMirrorRootNode` dengan `richTextSchema`.
- **Acceptance criteria**:
  - [ ] `jsonToYDoc(doc)` & `yDocToJson(ydoc)` di `packages/document-model/yjs`, round-trip lossless untuk semua fixture.
  - [ ] Editor membaca dokumen via selector ter-memoize dari Y.Doc (observeDeep → invalidasi per nodeId), bukan `yDocToJson` penuh per perubahan.

### DM-059 Kenapa flat map (bukan nested tree)
- **P0 · M1**
- **Alasan**:
  1. **Move = O(1) & aman CRDT**: di Yjs, memindah subtree nested berarti delete + re-insert (kehilangan identitas, konflik edit konkuren di subtree hilang). Dengan flat map, move hanya mengubah `parentId` + dua `children` array.
  2. **Lookup by id O(1)** untuk command, AI tools (`getNode(id)`), seleksi, dan observer per node.
  3. **Observer granular**: perubahan node X hanya memicu re-render komponen React node X.
  4. **Konsisten** antara site, component definition, dan published snapshot (yang nested hanya hasil resolve).
- **Konsekuensi**: perlu invariant & repair (DM-063) karena relasi tersimpan dua sisi.

### DM-060 Transaction origin & undo grouping
- **P0 · M1** (AI origin M6, remote M9)

```ts
type TxOrigin =
  | { kind: "user"; sessionId: string; label?: string }      // label: "Ubah warna", untuk history UI
  | { kind: "ai"; runId: string; stepLabel?: string }        // satu agent run (04)
  | { kind: "system"; reason: "migration" | "repair" | "componentUpdate" | "gc" | "import" }
  | { kind: "remote" };                                      // update dari provider (Hocuspocus)
```

- Setiap command menjalankan `ydoc.transact(fn, origin)`. `Y.UndoManager` dibuat dengan `trackedOrigins` = origin objek milik session lokal (user **dan** AI di session yang sama), sehingga:
  - Edit user digabung per `captureTimeout` 500 ms (drag = satu undo).
  - **Satu run AI = satu undo**: agent bekerja di **fork Y.Doc per run** (draft, bukan dokumen utama). Saat user klik **Terapkan**, editor memanggil `undoManager.stopCapturing()`, menerapkan seluruh update draft dalam **satu** `ydoc.transact(..., aiOrigin)`, lalu `stopCapturing()` lagi. Tombol "Batalkan perubahan AI" = `undo()` sekali ([04 §7](./04-ai-agent.md#7-draft--transaction-model)).
  - **Notasi**: dokumen lain menulis origin AI sebagai `ai:<runId>` — artinya `{ kind: "ai", runId }` di atas. Editor memakai **satu instance objek origin per run** (cache `aiOrigin(runId)`) agar cocok dengan `trackedOrigins` (Yjs membandingkan origin per referensi); kolom `document_updates.origin` menyimpan `ai` + `ai_run_id`.
  - `system` (migration/repair) & `remote` **tidak** di-track (tidak bisa di-undo user).
- **Acceptance criteria**:
  - [ ] Test: AI run 25 command → satu `undo()` mengembalikan dokumen identik dengan sebelum run.
  - [ ] Undo user tidak membatalkan perubahan remote (multiplayer, M9).
  - [ ] History panel menampilkan label origin (user/AI) per entri undo stack.

### DM-061 Penyimpanan & encoding
- **P0 · M1**
- **Alur**:
  1. Editor mengirim **binary update** Yjs incremental ke server lewat **Hocuspocus** (`HocuspocusProvider` → `apps/realtime`) **sejak M1** — single-editor dulu, multiplayer M9+ ([ARCHITECTURE §7.2](../ARCHITECTURE.md#72-write-path-autosave)). Tidak ada endpoint autosave HTTP terpisah.
  2. `apps/realtime` mem-buffer lalu meng-append update ke `document_updates` (bytea) — cepat, tanpa decode.
  3. **Compaction/snapshot state**: state ter-merge disimpan sebagai `document_snapshots.state` (`Y.encodeStateAsUpdate`) sesuai ambang di ARCHITECTURE §7.2–7.4 (sumber kebenaran untuk angka flush/snapshot/retensi); update lama dibersihkan oleh queue `cleanup`.
  4. **JSON snapshot** (`yDocToJson` + validasi) disimpan ke `document_snapshots.json` setiap: 10 menit aktif, sebelum & sesudah AI run, sebelum publish, sebelum migration, dan manual "Simpan versi". Dipakai untuk version history, restore, search, analisis, dan fallback korupsi.
- **Restore** = membuat Y.Doc baru dari snapshot JSON lalu menerapkannya sebagai transaksi `system` ke dokumen aktif (diff-apply, bukan mengganti Y.Doc, agar klien terhubung tetap sinkron).
- **Acceptance criteria**:
  - [ ] Load editor = snapshot `state` terbaru + update tersisa; waktu load dokumen 5.000 node < 500 ms decode di laptop menengah.
  - [ ] Snapshot JSON gagal validasi → tetap disimpan dengan flag `invalid=true` + alert Sentry (tidak memblokir user).
  - [ ] Update ditolak server jika ukuran state setelah apply > batas (DM-076).

### DM-062 Garbage collection
- **P0 · M1**
- `ydoc.gc = true` (default). Version history **tidak** memakai `Y.snapshot` (yang butuh gc off) melainkan JSON snapshot (DM-061) — memori & storage tetap kecil.
- Hapus node = `nodes.delete(id)` untuk node **dan seluruh turunannya** + hapus dari `children` parent, dalam satu transaksi. Asset tidak dihapus dari storage (asset GC adalah proses DB terpisah, 07/08).
- **Acceptance criteria**:
  - [ ] Setelah 10.000 operasi edit acak + compaction, ukuran snapshot `state` Yjs ≤ 3× ukuran JSON snapshot.

### DM-063 Normalisasi konflik struktur (multiplayer-ready)
- **P1 · M1** (wajib sebelum M9)
- **Masalah**: dua klien memindah node yang sama secara konkuren → node bisa muncul di dua `children` array, atau membentuk cycle.
- **Aturan**: `parentId` adalah **sumber kebenaran**. `repairStructure(ydoc)` (dijalankan setelah apply update remote dan saat load):
  1. Hapus id dari `children` parent mana pun yang `parentId` node-nya bukan parent tersebut.
  2. Node yang `parentId`-nya menunjuk ke parent yang ada tetapi tidak tercantum di `children` → append ke akhir.
  3. Cycle → putus di node dengan id leksikografis terkecil, pindah ke page asal terakhir yang diketahui (atau page pertama).
  4. Node yatim (parent tidak ada) → pindahkan ke page pertama di frame "Recovered" (dibuat jika perlu).
  5. Duplikat id di `children` → sisakan kemunculan pertama.
- Dijalankan dengan origin `system/repair`, idempoten.
- **Acceptance criteria**:
  - [ ] Property-based test (fast-check): dua replika menerapkan move acak konkuren → setelah sync + repair, kedua replika identik dan semua invariant DM-069 lolos.

---

## 15. Draft vs published

### DM-064 Working doc vs published snapshot
- **P0 · M4**

| | Draft (working) | Published |
|---|---|---|
| Format | Y.Doc (binary) + JSON snapshot | `PublishedSite` JSON (+ HTML/CSS hasil build di R2) |
| Mutabilitas | mutable, Yjs | **immutable**, satu baris per versi |
| ID | — | ULID `versionId` |
| Isi | semua: metadata editor, override, instance ref | hasil compile: instance ter-resolve, metadata di-strip |
| Dipakai oleh | editor, AI, preview | site-host, rollback, island runtime |

- Publish tidak pernah membaca Y.Doc langsung; ia mengambil **snapshot JSON tervalidasi** pada saat tombol publish ditekan (`document_snapshots` dengan `kind="publish"`).

### DM-065 Compile step
- **P0 · M4**
- `compileSite(doc, { components, assetsMeta, collectionsSchema }) → PublishedSite`, murni (tanpa I/O; dependensi disuntikkan), dijalankan worker (07):
  1. `validateDocument(doc, { mode: "publish" })` — error = gagal publish dengan daftar masalah.
  2. Pin component: muat semua `componentDeps` (id@version).
  3. Per page: resolve instance (DM-051) → tree nested; strip `visible:false`, `metadata`, `locked`, `name` (opsional disimpan sebagai `data-name` hanya di preview).
  4. Resolve token → CSS variables (theme stylesheet) ; style node → class atomik/per-node CSS (strategi di 07).
  5. Kumpulkan `bindings`/interaksi dinamis → manifest islands.
  6. `gcAssets`, hitung asset yang dibutuhkan + varian.
  7. Hasil: `PublishedSite` + hash konten (untuk cache/CDN invalidation).

```ts
interface PublishedSite {
  schemaVersion: number;          // versi format PublishedSite (terpisah dari SiteDocument)
  versionId: string;              // ULID
  sourceSnapshotId: string;
  compiledAt: string;
  settings: Pick<SiteSettings, "language" | "seo" | "favicon" | "breakpoints">;
  themeCss: string;
  pages: { pageId: string; path: string; seo: ResolvedSeo; tree: ResolvedNode; access: PageProps["access"] }[];
  islands: IslandManifest[];      // 05/07
  assets: Record<AssetId, AssetEntry>;
  contentHash: string;
}
```

- **Acceptance criteria**:
  - [ ] `compileSite` deterministik: input sama → `contentHash` sama.
  - [ ] Rollback = menunjuk `sites.published_version_id` ke versi lama (tanpa recompile).

### DM-066 Preview
- **P1 · M4**
- Preview (link share sebelum publish) = compile on-the-fly dari snapshot draft terbaru, disimpan sementara (TTL 7 hari), `noIndex`. Lihat 07.

---

## 16. Validasi

### DM-067 Zod schemas (skeleton)
- **P0 · M1**
- Lokasi: `packages/document-model/src/schema/*.ts`. Semua tipe TS di-**infer** dari Zod (`z.infer`), tidak ditulis ganda.

```ts
import { z } from "zod";

export const NodeIdSchema = z.string().regex(/^(pg|n)_[0-9a-z]{6,24}$/);
export const TokenRefSchema = z.object({ $token: z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9-]+){1,2}$/) }).strict();
export const PropRefSchema  = z.object({ $prop: z.string(), fallback: z.unknown().optional(), eq: z.string().optional() }).strict();
export const tv = <T extends z.ZodTypeAny>(t: T) => z.union([t, TokenRefSchema]);           // value-or-token

export const UnitSchema = z.enum(["px", "%", "vw", "vh", "rem", "em", "fr"]);
export const LengthSchema = tv(z.object({ value: z.number().finite(), unit: UnitSchema }).strict());
export const HexSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
export const ColorSchema = z.union([HexSchema, TokenRefSchema, z.object({ $token: z.string(), alpha: z.number().min(0).max(1) }).strict()]);

export const DimensionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("fixed"), value: z.number().nonnegative(), unit: z.enum(["px", "%", "vw", "vh", "rem"]) }),
  z.object({ mode: z.literal("hug") }),
  z.object({ mode: z.literal("fill") }),
]);
export const LayoutSchema = z.discriminatedUnion("mode", [ /* none | flex | grid — DM-026 */ ]);
export const FillSchema   = z.discriminatedUnion("type", [ /* solid | linearGradient | radialGradient | image — DM-029 */ ]);

export const StyleSchema = z.object({
  layout: LayoutSchema.optional(),
  size: z.object({ width: DimensionSchema, height: DimensionSchema, minWidth: LengthSchema, maxWidth: LengthSchema,
                   minHeight: LengthSchema, maxHeight: LengthSchema, aspectRatio: z.number().positive() }).partial().strict().optional(),
  position: PositionSchema.optional(),
  flexChild: FlexChildSchema.optional(),
  display: z.enum(["auto", "none"]).optional(),
  fills: z.array(FillSchema).max(8).optional(),
  strokes: z.array(StrokeSchema).max(4).optional(),
  radius: RadiusSchema.optional(),
  effects: z.array(EffectSchema).max(6).optional(),
  opacity: z.number().min(0).max(1).optional(),
  blendMode: BlendModeSchema.optional(),
  overflow: z.enum(["visible", "hidden", "scroll", "auto"]).optional(),
  typography: z.union([TypographySchema, TokenRefSchema]).optional(),
  color: ColorSchema.optional(),
  cursor: CursorSchema.optional(),
  zIndex: z.number().int().min(-100).max(1000).optional(),
  transform: TransformSchema.optional(),
  transition: TransitionSchema.optional(),
}).strict();
export const StylePatchSchema = deepPartialNullable(StyleSchema);   // null = hapus override (DM-036)
export const ResponsiveStyleSchema = z.object({
  base: StyleSchema, tablet: StylePatchSchema.optional(), mobile: StylePatchSchema.optional(),
}).catchall(StylePatchSchema);   // custom breakpoint bp_* (P2) — key divalidasi superRefine

const base = {
  id: NodeIdSchema,
  name: z.string().min(1).max(80),
  parentId: NodeIdSchema.nullable(),
  visible: z.boolean(),
  locked: z.boolean(),
  tag: SemanticTagSchema.optional(),
  style: ResponsiveStyleSchema,
  states: StateStylesSchema.optional(),
  bindings: z.record(z.string(), BindExprSchema).optional(),
  visibleWhen: VisibleWhenSchema.optional(),         // M7 (DM-008)
  interactions: z.array(InteractionSchema).max(10).optional(),
  a11y: A11ySchema.optional(),
  htmlId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/).optional(),
  metadata: NodeMetadataSchema.optional(),
};
const children = { children: z.array(NodeIdSchema).max(500) };

export const NodeSchema = z.discriminatedUnion("type", [
  z.object({ ...base, ...children, type: z.literal("page"),     props: PagePropsSchema }).strict(),
  z.object({ ...base, ...children, type: z.literal("frame"),    props: FramePropsSchema }).strict(),
  z.object({ ...base, ...children, type: z.literal("group"),    props: z.object({}).strict() }).strict(),
  z.object({ ...base,              type: z.literal("text"),     props: TextPropsSchema }).strict(),
  z.object({ ...base,              type: z.literal("image"),    props: ImagePropsSchema }).strict(),
  z.object({ ...base,              type: z.literal("icon"),     props: IconPropsSchema }).strict(),
  z.object({ ...base,              type: z.literal("shape"),    props: ShapePropsSchema }).strict(),
  z.object({ ...base,              type: z.literal("video"),    props: VideoPropsSchema }).strict(),
  z.object({ ...base,              type: z.literal("instance"), props: InstancePropsSchema }).strict(),
  z.object({ ...base, ...children, type: z.literal("slot"),     props: SlotPropsSchema }).strict(),
  z.object({ ...base, ...children, type: z.literal("form"),     props: FormPropsSchema }).strict(),
  z.object({ ...base,              type: z.literal("formField"), props: FormFieldPropsSchema }).strict(),
  z.object({ ...base, ...children, type: z.literal("dataList"), props: DataListPropsSchema }).strict(),
  z.object({ ...base,              type: z.literal("dataTable"), props: DataTablePropsSchema }).strict(),
  z.object({ ...base, children: z.array(NodeIdSchema).optional(), type: z.literal("authBlock"), props: AuthBlockPropsSchema }).strict(),
  // vector, embed: ditambahkan saat fasenya (P2) via migration
]);

export const SiteDocumentSchema = z.object({
  schemaVersion: z.number().int().positive(),
  meta: SiteMetaSchema,
  settings: SiteSettingsSchema,
  theme: ThemeSchema,
  assets: z.record(AssetIdSchema, AssetEntrySchema),
  componentDeps: z.record(ComponentIdSchema, z.object({ version: z.number().int().positive(), source: z.enum(["library", "site", "marketplace"]) })),
  localComponents: z.record(ComponentIdSchema, ComponentDefinitionSchema).optional(),
  dataSources: z.object({ collections: z.array(z.string()) }).optional(),
  pageOrder: z.array(NodeIdSchema).min(1).max(200),
  nodes: z.record(NodeIdSchema, NodeSchema),
}).strict().superRefine(checkInvariants);   // DM-069
```

- **Acceptance criteria**:
  - [ ] Semua tipe publik diekspor dari `@platform/document-model` (`SiteDocument`, `Node`, `Style`, …) sebagai `z.infer`.
  - [ ] JSON Schema dibangkitkan dari Zod (`zod-to-json-schema`) untuk definisi tool AI (04) — satu sumber.

### DM-068 Mode validasi
- **P0 · M1**
- `validateDocument(doc, { mode })` dengan `mode`: `"edit"` (struktur + invariant; referensi hilang = warning), `"publish"` (semua referensi wajib valid, lint a11y error-level tertentu), `"ai"` (DM-070). Hasil: `{ ok: boolean; errors: Issue[]; warnings: Issue[] }` dengan `Issue = { code, path, nodeId?, message: { id, en } }`.
- **Acceptance criteria**:
  - [ ] Kode issue stabil (enum `IssueCode`) agar AI bisa memperbaiki berdasarkan kode.
  - [ ] Validasi dokumen 5.000 node < 100 ms (Node 20, laptop menengah).

### DM-069 Invariants
- **P0 · M1**

| Kode | Invariant |
|---|---|
| `DUPLICATE_ID` | Key `nodes` = `node.id`; id unik lintas dokumen (termasuk vs id page) |
| `PARENT_MISSING` | `parentId` non-null harus ada di `nodes` |
| `CHILD_MISMATCH` | `x ∈ parent.children ⇔ x.parentId = parent.id` (instance: slot fill via `slots`) |
| `CYCLE` | Tidak ada cycle mengikuti `parentId` |
| `ROOT_NOT_PAGE` | `parentId = null` hanya untuk `page`; setiap page ada di `pageOrder` |
| `CONTAINER_TYPE` | Hanya tipe container punya `children`; parent harus container atau instance (slot) |
| `INSTANCE_DEP` | `instance.props.version === componentDeps[componentId].version` dan versi ada di registry (cek async saat publish) |
| `ASSET_REF` | Semua `assetId` ada di `doc.assets` |
| `TOKEN_REF` | Semua `$token` ter-resolve di theme |
| `PROP_REF_SCOPE` | `$prop` hanya di component definition; `$bind` hanya di `bindings` |
| `INTERACTION_TARGET` | `targetId`/`anchor` menunjuk node di page yang sama |
| `HOME_PAGE` | Tepat satu home `/`; path unik |
| `FORM_SCOPE` | `formField` keturunan `form`; `slot` hanya di component |
| `LIMITS` | Batas DM-076 |
| `DEPTH` | Kedalaman tree ≤ 32 |

- **Acceptance criteria**:
  - [ ] Setiap invariant punya fixture `invalid/<code>.json` yang gagal dengan kode tersebut.
  - [ ] Command API menjamin invariant (test: 10.000 command acak → dokumen tetap valid).

### DM-070 Validasi output AI
- **P0 · M6**
- AI **tidak pernah** menulis JSON dokumen mentah; ia memanggil command (DM-073) via tools. Pertahanan berlapis:
  1. Input tool divalidasi Zod command (tipe, enum, batas).
  2. Command memeriksa izin semantik: node `locked` (tolak tanpa `force`), fitur paket (dynamic/commerce), tipe terlarang untuk AI (`embed.html`).
  3. Setelah run, `validateDocument(doc, { mode: "ai" })`; error → run di-rollback (undo satu langkah) dan issue dikembalikan ke agent untuk diperbaiki (maks 2 putaran, lihat 04).
  4. Lint kualitas (warning ke agent): node tanpa nama deskriptif, literal warna padahal token tersedia, teks Lorem ipsum, gambar tanpa alt.
- Untuk konten besar (mis. AI membuat satu section), tersedia command `insertSubtree(parentId, index, subtreeJson)` yang menerima **subtree JSON** tervalidasi `SubtreeSchema` (node dengan ID sementara `tmp_*` yang di-remap ke ID asli) — dokumen keseluruhan tetap tidak ditulis langsung.
- **Acceptance criteria**:
  - [ ] Subtree AI dengan `$prop`, `embed`, atau `bindings` ke collection yang tidak ada ditolak dengan issue terstruktur.
  - [ ] Peta `tmp_* → id` dikembalikan ke agent agar langkah berikutnya bisa merujuk node baru.

---

## 17. Schema versioning & migration

### DM-071 `schemaVersion` & migrasi berurutan
- **P0 · M1**
- `CURRENT_SCHEMA_VERSION` (int) di package. Migrasi: `migrations: Record<number, (doc: any) => any>` di mana `migrations[n]` mengubah vN → vN+1. `migrate(doc)` menerapkan berurutan sampai versi terkini, murni, tanpa I/O.
- Berlaku juga untuk `ComponentDefinition` (field `schemaVersion` sendiri) dan `PublishedSite` (versi format terpisah; published lama **tidak** dimigrasi — site-host/renderer runtime harus kompatibel mundur atau publish ulang).
- **Kapan migrasi dijalankan**:
  - Saat load dokumen di server (API) sebelum dikirim ke editor: jika `schemaVersion < CURRENT`, server memuat Y.Doc → `yDocToJson` → `migrate` → terapkan diff sebagai transaksi `system/migration` → simpan snapshot `reason="migration"` sebelum & sesudah.
  - Component version lama dimigrasi **saat dibaca** (in-memory), record DB tidak diubah (immutable).
  - Editor versi lama (tab terbuka) yang menerima dokumen versi lebih baru → paksa reload.
- **Aturan perubahan schema**:
  - Menambah field opsional = **tidak** perlu bump versi (minor). Mengubah arti/menghapus/me-rename field atau menambah nilai enum yang harus dipahami renderer lama = **bump** + migration.
  - Migration tidak boleh menghapus data user tanpa jejak (pindahkan ke `metadata.ext.migrated` bila tidak bisa dipetakan).
- **Acceptance criteria**:
  - [ ] `migrate` idempoten untuk dokumen yang sudah versi terkini.
  - [ ] CI menolak PR yang mengubah `SiteDocumentSchema` tanpa bump versi atau tanpa label `schema-additive` (cek hash schema yang di-commit di `schema.lock.json`).

### DM-072 Test fixtures migrasi
- **P0 · M1**
- `packages/document-model/fixtures/v<N>/*.json` — fixture representatif per versi (blank, template besar, component bersarang, dinamis). Test: setiap fixture vN → `migrate` → lolos `SiteDocumentSchema` terkini + snapshot render HTML sama (atau beda yang di-approve).
- Fixture tidak pernah dihapus.
- **Acceptance criteria**:
  - [ ] Bump versi baru wajib menambah fixture `v<N+1>` dan migration test dari **setiap** versi lama.

---

## 18. Command API

### DM-073 Semua mutasi lewat command
- **P0 · M1**
- **Deskripsi**: `packages/document-model/src/commands/` berisi command murni-terhadap-Y.Doc. Editor (UI), AI tools ([04](./04-ai-agent.md)), template instantiation, migration, dan seed library memakai command yang sama. Komponen UI **dilarang** menulis ke Y.Doc langsung (lint rule `no-direct-ydoc-mutation` di `apps/editor`).
- **Bentuk**:

```ts
interface CommandContext { doc: Y.Doc; origin: TxOrigin; registry: ComponentRegistry; now: () => string; idGen: (prefix: string) => string; plan?: PlanCapabilities }
type CommandResult<T = void> =
  | { ok: true; value: T; affected: NodeId[]; warnings?: Issue[] }
  | { ok: false; error: Issue };
interface CommandDef<I extends z.ZodTypeAny, O> {
  name: string;                     // "createNode"
  input: I;                         // Zod → juga jadi JSON Schema tool AI
  description: { id: string; en: string };
  aiExposed: boolean;               // apakah tersedia sebagai AI tool
  run(ctx: CommandContext, input: z.infer<I>): CommandResult<O>;
}
// Eksekusi: runCommand(ctx, def, input) = validate input → ydoc.transact(() => def.run(...), origin) → normalize (DM-036) → invariant check ringan pada `affected`
// Batch: runCommands(ctx, [...]) dalam satu transact (atomik; gagal satu = tidak ada yang diterapkan — dicapai dengan validasi dulu, lalu apply).
```

- **Acceptance criteria**:
  - [ ] Setiap command punya Zod input, unit test, dan deskripsi dwibahasa.
  - [ ] Command gagal tidak meninggalkan perubahan parsial (test: inject error di tengah batch).

### DM-074 Daftar command (signature)
- **P0 · M1–M3** (sesuai fase fitur), command data/commerce M7–M8.

```ts
// ── Node & tree ───────────────────────────────────────────────
createNode(i: { parentId: NodeId; index?: number; type: NodeType; name?: string; style?: ResponsiveStylePatch; props?: object; tempId?: string }): NodeId
insertSubtree(i: { parentId: NodeId; index?: number; subtree: Subtree /* tmp_* ids */ }): { idMap: Record<string, NodeId> }
deleteNodes(i: { ids: NodeId[] }): { removedInteractions: string[] }
duplicateNodes(i: { ids: NodeId[]; offset?: { x: number; y: number } }): { idMap: Record<NodeId, NodeId> }
moveNode(i: { id: NodeId; newParentId: NodeId; index: number; keepVisualPosition?: boolean; area?: "children" | "drafts" /* hanya bila newParentId = page, DM-080 */ }): void
reorderNode(i: { id: NodeId; index: number }): void
renameNode(i: { id: NodeId; name: string }): void
setVisible(i: { ids: NodeId[]; visible: boolean }): void
setLocked(i: { ids: NodeId[]; locked: boolean }): void
setTag(i: { id: NodeId; tag: SemanticTag }): void
wrapInFrame(i: { ids: NodeId[]; layout?: LayoutStyle; name?: string }): NodeId     // ids harus sibling
unwrap(i: { id: NodeId }): NodeId[]                                                // ungroup/unframe
groupNodes(i: { ids: NodeId[]; name?: string }): NodeId

// ── Style & layout ────────────────────────────────────────────
updateStyle(i: { ids: NodeId[]; breakpoint?: BreakpointId /* default "base" */; state?: StateName; patch: StylePatch }): void
setLayoutMode(i: { id: NodeId; layout: LayoutStyle; breakpoint?: BreakpointId }): void
setBreakpointOverride(i: { id: NodeId; breakpoint: Exclude<BreakpointId, "base">; patch: StylePatch }): void
clearBreakpointOverrides(i: { ids?: NodeId[]; breakpoint?: BreakpointId; fields?: string[] }): void
applyTextStyleToken(i: { ids: NodeId[]; token: string }): void
setSettings(i: { patch: Partial<SiteSettings> }): void

// ── Konten ────────────────────────────────────────────────────
setTextContent(i: { id: NodeId; content: RichTextDoc | string }): void            // string → satu paragraf
replaceText(i: { id: NodeId; find: string; replace: string }): void              // pertahankan marks
setImage(i: { id: NodeId; image: AssetRef; fit?: ImageFit }): void
setLink(i: { id: NodeId; link: LinkValue | null }): void
setNodeProps(i: { id: NodeId; patch: object }): void                              // props spesifik tipe, divalidasi per tipe

// ── Page ──────────────────────────────────────────────────────
createPage(i: { title: string; path: string; fromTemplatePageId?: string; index?: number }): PageId
updatePage(i: { id: PageId; patch: Partial<PageProps> }): void
reorderPages(i: { order: PageId[] }): void
deletePage(i: { id: PageId }): void                                               // tidak boleh hapus home

// ── Theme & tokens ────────────────────────────────────────────
setToken(i: { path: string; value: TokenValue<unknown> }): void
renameToken(i: { from: string; to: string }): { updatedRefs: number }
deleteToken(i: { path: string; replaceWith: TokenRef | unknown }): void
applyThemePreset(i: { presetId: string; keep?: TokenGroup[] }): void
addFont(i: FontDef): void

// ── Component & instance ──────────────────────────────────────
createInstance(i: { parentId: NodeId; index?: number; componentId: ComponentId; version?: number /* default latest */; variant?: Record<string,string>; propValues?: object }): NodeId
setProp(i: { instanceId: NodeId; key: string; value: PropValue }): void
setVariant(i: { instanceId: NodeId; variant: Record<string, string> }): void
setInstanceOverride(i: { instanceId: NodeId; path: NodePath; patch: NodePatch }): void
resetOverride(i: { instanceId: NodeId; path?: NodePath; field?: string }): void
setSlotContent(i: { instanceId: NodeId; slot: string; nodeIds: NodeId[] }): void
detachInstance(i: { instanceId: NodeId }): NodeId
updateInstanceVersion(i: { instanceIds: NodeId[] | "all"; componentId: ComponentId; toVersion: number }): { orphanedOverrides: { instanceId: NodeId; path: NodePath }[] }
createComponentFromNodes(i: { ids: NodeId[]; name: string; scope: "site" | "library" }): ComponentId   // P1; library hanya mode admin (03)

// ── Interactions ──────────────────────────────────────────────
addInteraction(i: { id: NodeId; interaction: Omit<Interaction, "id"> }): string
updateInteraction(i: { id: NodeId; interactionId: string; patch: Partial<Interaction> }): void
removeInteraction(i: { id: NodeId; interactionId: string }): void

// ── Data (M7, rujuk 05) ───────────────────────────────────────
setBinding(i: { id: NodeId; target: TargetPath; expr: BindExpr | null }): void
setDataSource(i: { id: NodeId /* dataList|dataTable */; source: DataListProps["source"] }): void
createForm(i: { parentId: NodeId; index?: number; target: FormProps["target"]; fields: FormFieldProps[] }): NodeId

// ── Assets ────────────────────────────────────────────────────
registerAsset(i: { assetId: AssetId; entry: AssetEntry }): void                    // setelah upload sukses (API)
```

- **Query (read-only, juga AI tools)**: `getNode(id)`, `getSubtree(id, { depth })`, `toOutline(pageId)`, `findNodes({ type?, nameContains?, text? })`, `resolveStyle(id, bp)`, `listTokens()`, `listComponents(filter)` (registry), `validate()`.
- **Acceptance criteria**:
  - [ ] Setiap command `aiExposed: true` otomatis muncul di `packages/ai-tools` tanpa definisi ganda.
  - [ ] `moveNode` dengan `keepVisualPosition` menghitung `x/y` baru jika parent tujuan `layout: none`.
  - [ ] `moveNode` ke turunan dirinya sendiri ditolak (`CYCLE`).

### DM-075 Command & lock/permission
- **P0 · M2**
- Command menolak mengubah node `locked` (kecuali `setLocked` dan `force: true` dari UI dengan konfirmasi). Command yang butuh fitur paket (dynamic/commerce/embed) memeriksa `ctx.plan` dan mengembalikan `PLAN_FEATURE` (lihat [08](./08-accounts-plans-admin.md)). Server juga memvalidasi ulang saat publish (klien tidak dipercaya).
- **Acceptance criteria**:
  - [ ] Issue `PLAN_FEATURE` (kode error 08) membawa `feature` sehingga UI bisa menampilkan upsell.

---

## 19. Batasan & performa

### DM-076 Batas dokumen
- **P0 · M1** (angka bisa disesuaikan per paket, lihat 08)

| Batas | Nilai default | Alasan |
|---|---|---|
| Node per page | 3.000 (soft warning 1.500) | Performa canvas DOM & ukuran HTML |
| Node per site | 20.000 | Memori editor, ukuran Y.Doc |
| Page per site | 100 (Free: ❓ OPEN, lihat 08) | |
| Kedalaman tree | 32 | Rekursi renderer, CSS specificity |
| Kedalaman instance bersarang | 8 | DM-051 |
| Children per container | 500 | |
| JSON snapshot | 8 MB (soft 4 MB) | Waktu load & snapshot |
| Y.Doc state | 16 MB | |
| Text content per node | 20.000 karakter | Gunakan collection untuk konten panjang (blog, 05) |
| Fills/strokes/effects | 8 / 4 / 6 | |
| Interactions per node / actions | 10 / 5 | |
| Overrides per instance | 200 path | |
| Token total | 500 | |

- **Acceptance criteria**:
  - [ ] Command yang melanggar batas mengembalikan `LIMIT_EXCEEDED` dengan nama batas; tidak ada penulisan parsial.
  - [ ] Server menolak update Yjs yang membuat state > batas (DM-061).

### DM-077 Target performa
- **P0 · M1–M2**
- `resolveStyle` + render ulang satu node setelah `updateStyle` < 16 ms (60 fps saat drag slider).
- Observer granular: perubahan satu node tidak memicu re-render >1 komponen node + overlay.
- Cache resolusi instance & style di-invalidasi per node id + versi dokumen.
- `toOutline` untuk page 1.500 node < 20 ms dan ≤ 25.000 token LLM (dengan pemotongan teks 60 char/node).
- **Acceptance criteria**:
  - [ ] Benchmark otomatis (Vitest bench) untuk: validasi 5k node, round-trip Yjs 5k node, resolve 200 instance, compile site 10 page.

---

## 20. Contoh lengkap

Site kecil: 1 page, navbar instance, hero frame auto-layout, product grid instance yang di dalamnya ada `dataList` bound ke collection (component `cmp_prodgrid01` adalah component dinamis library; isinya ditampilkan di bawah sebagai definisi).

### 20.1 `SiteDocument`

```json
{
  "schemaVersion": 1,
  "meta": { "title": "Toko Kue Budi", "createdWith": "ai" },
  "settings": {
    "language": "id",
    "seo": { "titleTemplate": "%s · Toko Kue Budi", "defaultTitle": "Toko Kue Budi", "defaultDescription": "Kue rumahan fresh setiap hari di Bandung." },
    "favicon": { "assetId": "ast_favicon001" },
    "breakpoints": [
      { "id": "base", "label": { "id": "Desktop", "en": "Desktop" }, "maxWidth": null, "previewWidth": 1440 },
      { "id": "tablet", "label": { "id": "Tablet", "en": "Tablet" }, "maxWidth": 991, "previewWidth": 768 },
      { "id": "mobile", "label": { "id": "Ponsel", "en": "Mobile" }, "maxWidth": 479, "previewWidth": 390 }
    ],
    "manualResponsive": false,
    "autoResponsive": { "enabled": true, "rules": {} }
  },
  "theme": {
    "tokens": {
      "color": {
        "brand": { "value": "#C2410C" },
        "primary": { "$token": "color.brand" },
        "primaryHover": "#9A3412",
        "onPrimary": "#FFFFFF",
        "background": "#FFFBF5",
        "surface": "#FFF1E6",
        "onSurface": "#1C1917",
        "muted": "#78716C",
        "border": "#E7E5E4",
        "accent": "#16A34A"
      },
      "fontFamily": { "heading": "Playfair Display", "body": "Inter" },
      "typography": {
        "display": { "value": { "fontFamily": { "$token": "fontFamily.heading" }, "fontSize": { "value": 64, "unit": "px" }, "fontWeight": 700, "lineHeight": 1.1 },
                     "mobile": { "fontFamily": "Playfair Display", "fontSize": { "value": 40, "unit": "px" }, "fontWeight": 700, "lineHeight": 1.15 } },
        "h1": { "fontFamily": { "$token": "fontFamily.heading" }, "fontSize": { "value": 44, "unit": "px" }, "fontWeight": 700, "lineHeight": 1.2 },
        "h4": { "fontFamily": { "$token": "fontFamily.heading" }, "fontSize": { "value": 22, "unit": "px" }, "fontWeight": 700, "lineHeight": 1.3 },
        "body": { "fontFamily": { "$token": "fontFamily.body" }, "fontSize": { "value": 16, "unit": "px" }, "fontWeight": 400, "lineHeight": 1.6 },
        "button": { "fontFamily": { "$token": "fontFamily.body" }, "fontSize": { "value": 16, "unit": "px" }, "fontWeight": 600, "lineHeight": 1.2 }
      },
      "space": { "2": { "value": 8, "unit": "px" }, "4": { "value": 16, "unit": "px" }, "6": { "value": 24, "unit": "px" }, "8": { "value": 32, "unit": "px" },
                 "10": { "value": 40, "unit": "px" }, "16": { "value": 64, "unit": "px" } },
      "radius": { "md": { "value": 8, "unit": "px" }, "lg": { "value": 16, "unit": "px" }, "full": { "value": 9999, "unit": "px" } },
      "shadow": { "md": [{ "type": "dropShadow", "x": 0, "y": 4, "blur": 16, "color": "#0000001A" }] },
      "size": { "container": { "value": 1200, "unit": "px" } }
    },
    "fonts": [
      { "family": "Playfair Display", "source": "google", "weights": [700], "fallback": "serif" },
      { "family": "Inter", "source": "google", "weights": [400, 600], "fallback": "sans-serif" }
    ]
  },
  "assets": {
    "ast_favicon001": { "kind": "image", "mime": "image/png", "width": 512, "height": 512 },
    "ast_cake000001": { "kind": "image", "mime": "image/webp", "width": 2400, "height": 1600, "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj" }
  },
  "componentDeps": {
    "cmp_navbar0001": { "version": 4, "source": "library" },
    "cmp_prodgrid01": { "version": 2, "source": "library" }
  },
  "dataSources": { "collections": ["col_products01"] },
  "pageOrder": ["pg_home000001"],
  "nodes": {
    "pg_home000001": {
      "id": "pg_home000001", "type": "page", "name": "Home", "parentId": null, "visible": true, "locked": false,
      "children": ["n_nav0000001", "n_hero000001", "n_products01"],
      "style": { "base": { "layout": { "mode": "flex", "direction": "column" }, "size": { "width": { "mode": "fill" } },
                           "fills": [{ "type": "solid", "color": { "$token": "color.background" } }],
                           "typography": { "$token": "type.body" }, "color": { "$token": "color.onSurface" } } },
      "props": { "path": "/", "title": "Home", "isHome": true, "seo": { "title": "Beranda" } }
    },
    "n_nav0000001": {
      "id": "n_nav0000001", "type": "instance", "name": "Navbar", "parentId": "pg_home000001", "visible": true, "locked": false,
      "style": { "base": { "size": { "width": { "mode": "fill" } }, "position": { "type": "sticky", "top": { "value": 0, "unit": "px" } }, "zIndex": 50 } },
      "props": {
        "componentId": "cmp_navbar0001", "version": 4, "variant": { "layout": "logoLeft" },
        "propValues": {
          "brandName": "Toko Kue Budi",
          "menuItems": [
            { "label": "Produk", "link": { "type": "anchor", "nodeId": "n_products01" } },
            { "label": "Tentang", "link": { "type": "anchor", "nodeId": "n_hero000001" } }
          ],
          "ctaLabel": "Pesan via WA",
          "ctaLink": { "type": "whatsapp", "phone": "6281234567890", "message": "Halo, saya mau pesan kue" }
        },
        "overrides": {}
      },
      "metadata": { "createdBy": "ai" }
    },
    "n_hero000001": {
      "id": "n_hero000001", "type": "frame", "name": "Hero", "parentId": "pg_home000001", "visible": true, "locked": false, "tag": "section",
      "htmlId": "tentang",
      "children": ["n_herotxt001", "n_heroimg001"],
      "style": {
        "base": {
          "layout": { "mode": "flex", "direction": "row", "gap": { "$token": "space.10" }, "align": "center", "justify": "spaceBetween",
                      "padding": { "top": { "$token": "space.16" }, "right": { "$token": "space.8" }, "bottom": { "$token": "space.16" }, "left": { "$token": "space.8" } } },
          "size": { "width": { "mode": "fill" }, "height": { "mode": "hug" }, "maxWidth": { "$token": "size.container" } },
          "flexChild": { "alignSelf": "center" }
        },
        "mobile": { "layout": { "padding": { "top": { "$token": "space.10" }, "bottom": { "$token": "space.10" }, "left": { "$token": "space.4" }, "right": { "$token": "space.4" } } } }
      },
      "props": { "role": "section" },
      "metadata": { "createdBy": "ai", "aiNote": "Hero utama: headline + CTA kiri, foto kanan. Auto-responsive menumpuk vertikal di mobile." }
    },
    "n_herotxt001": {
      "id": "n_herotxt001", "type": "frame", "name": "Hero / Copy", "parentId": "n_hero000001", "visible": true, "locked": false,
      "children": ["n_herottl001", "n_herosub001", "n_herocta001"],
      "style": { "base": { "layout": { "mode": "flex", "direction": "column", "gap": { "$token": "space.6" }, "align": "start" },
                           "size": { "width": { "mode": "fill" }, "height": { "mode": "hug" } } } },
      "props": { "role": "container" }
    },
    "n_herottl001": {
      "id": "n_herottl001", "type": "text", "name": "Hero / Title", "parentId": "n_herotxt001", "visible": true, "locked": false, "tag": "h1",
      "style": { "base": { "typography": { "$token": "type.display" }, "size": { "width": { "mode": "fill" }, "height": { "mode": "hug" } } } },
      "props": { "autoSize": "height", "content": { "type": "doc", "content": [ { "type": "paragraph", "content": [
        { "type": "text", "text": "Kue rumahan, " },
        { "type": "text", "text": "fresh setiap hari", "marks": [{ "type": "textStyle", "attrs": { "color": { "$token": "color.primary" } } }] } ] } ] } }
    },
    "n_herosub001": {
      "id": "n_herosub001", "type": "text", "name": "Hero / Subtitle", "parentId": "n_herotxt001", "visible": true, "locked": false,
      "style": { "base": { "color": { "$token": "color.muted" }, "size": { "width": { "mode": "fill" }, "height": { "mode": "hug" }, "maxWidth": { "value": 520, "unit": "px" } } } },
      "props": { "autoSize": "height", "content": { "type": "doc", "content": [ { "type": "paragraph", "content": [
        { "type": "text", "text": "Dipanggang tiap pagi di Bandung. Pesan sebelum jam 10, dikirim di hari yang sama." } ] } ] } }
    },
    "n_herocta001": {
      "id": "n_herocta001", "type": "frame", "name": "Hero / CTA Button", "parentId": "n_herotxt001", "visible": true, "locked": false,
      "children": ["n_herocta002"],
      "style": {
        "base": { "layout": { "mode": "flex", "direction": "row", "align": "center", "justify": "center",
                              "padding": { "top": { "value": 14, "unit": "px" }, "right": { "$token": "space.6" }, "bottom": { "value": 14, "unit": "px" }, "left": { "$token": "space.6" } } },
                  "size": { "width": { "mode": "hug" }, "height": { "mode": "hug" } },
                  "fills": [{ "type": "solid", "color": { "$token": "color.primary" } }], "radius": { "$token": "radius.full" },
                  "cursor": "pointer", "transition": { "durationMs": 150, "easing": "ease-out" } }
      },
      "states": { "hover": { "base": { "fills": [{ "type": "solid", "color": { "$token": "color.primaryHover" } }] } } },
      "props": { "role": "button", "link": { "type": "anchor", "nodeId": "n_products01" } }
    },
    "n_herocta002": {
      "id": "n_herocta002", "type": "text", "name": "Hero / CTA Label", "parentId": "n_herocta001", "visible": true, "locked": false, "tag": "span",
      "style": { "base": { "typography": { "$token": "type.button" }, "color": { "$token": "color.onPrimary" }, "size": { "width": { "mode": "hug" }, "height": { "mode": "hug" } } } },
      "props": { "autoSize": "width", "content": { "type": "doc", "content": [ { "type": "paragraph", "content": [ { "type": "text", "text": "Lihat menu" } ] } ] } }
    },
    "n_heroimg001": {
      "id": "n_heroimg001", "type": "image", "name": "Hero / Photo", "parentId": "n_hero000001", "visible": true, "locked": false,
      "style": { "base": { "size": { "width": { "mode": "fill" }, "height": { "mode": "fixed", "value": 440, "unit": "px" } }, "radius": { "$token": "radius.lg" },
                           "effects": [{ "$token": "shadow.md" }] },
                 "mobile": { "size": { "height": { "mode": "fixed", "value": 280, "unit": "px" } } } },
      "props": { "fit": "cover", "loading": "eager",
                 "image": { "assetId": "ast_cake000001", "alt": "Kue cokelat dan croissant di atas meja kayu", "focalPoint": { "x": 0.5, "y": 0.45 } } }
    },
    "n_products01": {
      "id": "n_products01", "type": "instance", "name": "Produk / Grid", "parentId": "pg_home000001", "visible": true, "locked": false,
      "htmlId": "produk",
      "style": { "base": { "size": { "width": { "mode": "fill" } } } },
      "props": {
        "componentId": "cmp_prodgrid01", "version": 2, "variant": { "columns": "3" },
        "propValues": {
          "heading": "Menu hari ini",
          "collectionId": "col_products01",
          "limit": 6,
          "ctaLabel": "Pesan"
        },
        "overrides": {
          "n_pgcard0001/n_pcprice001": { "style": { "base": { "color": { "$token": "color.accent" } } } }
        }
      }
    }
  }
}
```

### 20.2 Definisi `cmp_prodgrid01@2` (ringkas, menunjukkan `$prop` + `dataList` + binding)

```json
{
  "schemaVersion": 1, "id": "cmp_prodgrid01", "version": 2, "name": "Product Grid", "category": "section",
  "description": "Grid kartu produk dari collection, judul section, tombol pesan per item.",
  "aiHints": { "whenToUse": "Menampilkan daftar produk/menu dari collection produk." },
  "requires": { "dynamic": true },
  "propsSchema": [
    { "key": "heading", "type": "text", "label": { "id": "Judul", "en": "Heading" }, "default": "Produk kami" },
    { "key": "collectionId", "type": "text", "label": { "id": "Collection", "en": "Collection" }, "default": "" },
    { "key": "limit", "type": "number", "label": { "id": "Jumlah", "en": "Limit" }, "default": 6, "min": 1, "max": 48 },
    { "key": "ctaLabel", "type": "text", "label": { "id": "Label tombol", "en": "Button label" }, "default": "Beli" }
  ],
  "variantAxes": [ { "name": "columns", "options": ["2", "3", "4"], "default": "3" } ],
  "variants": [
    { "when": { "columns": "2" }, "overrides": { "n_pglist0001": { "style": { "base": { "layout": { "mode": "grid", "columns": { "type": "repeat", "count": 2 } } } } } } },
    { "when": { "columns": "4" }, "overrides": { "n_pglist0001": { "style": { "base": { "layout": { "mode": "grid", "columns": { "type": "repeat", "count": 4 } } } } } } }
  ],
  "rootId": "n_pgroot0001",
  "nodes": {
    "n_pgroot0001": { "id": "n_pgroot0001", "type": "frame", "name": "Product Grid", "parentId": null, "visible": true, "locked": false, "tag": "section",
      "children": ["n_pgtitle001", "n_pglist0001"],
      "style": { "base": { "layout": { "mode": "flex", "direction": "column", "gap": { "$token": "space.8" }, "padding": { "top": { "$token": "space.16" }, "bottom": { "$token": "space.16" }, "left": { "$token": "space.8" }, "right": { "$token": "space.8" } } },
                           "size": { "width": { "mode": "fill" }, "height": { "mode": "hug" } } } },
      "props": { "role": "section" } },
    "n_pgtitle001": { "id": "n_pgtitle001", "type": "text", "name": "Product Grid / Heading", "parentId": "n_pgroot0001", "visible": true, "locked": false, "tag": "h2",
      "style": { "base": { "typography": { "$token": "type.h1" } } }, "props": { "content": { "$prop": "heading" } } },
    "n_pglist0001": { "id": "n_pglist0001", "type": "dataList", "name": "Product Grid / List", "parentId": "n_pgroot0001", "visible": true, "locked": false, "tag": "ul",
      "children": ["n_pgcard0001"],
      "style": { "base": { "layout": { "mode": "grid", "columns": { "type": "repeat", "count": 3, "min": { "value": 240, "unit": "px" } }, "gap": { "$token": "space.6" } } } },
      "props": { "source": { "collectionId": { "$prop": "collectionId" }, "limit": { "$prop": "limit" }, "sort": [{ "field": "createdAt", "dir": "desc" }] }, "itemAlias": "item" } },
    "n_pgcard0001": { "id": "n_pgcard0001", "type": "instance", "name": "Product Card", "parentId": "n_pglist0001", "visible": true, "locked": false,
      "style": { "base": {} },
      "props": { "componentId": "cmp_prodcard01", "version": 1, "propValues": { "ctaLabel": { "$prop": "ctaLabel" } } },
      "bindings": {
        "props.propValues.name":  { "$bind": "item.name" },
        "props.propValues.price": { "$template": "{{ item.price | currency }}" },
        "props.propValues.photo": { "$bind": "item.photo", "filters": [{ "fn": "imageVariant", "args": { "width": 600 } }] },
        "props.propValues.link":  { "$bind": "item.waOrderLink" }
      } }
  }
}
```

> Catatan: `n_pgcard0001` adalah instance bersarang `cmp_prodcard01@1` (punya node `n_pcprice001`), sehingga override di site memakai path `n_pgcard0001/n_pcprice001` (DM-049). `cmp_prodcard01` ikut tercatat sebagai dependensi transitif di registry component (03); `componentDeps` site hanya mencatat dependensi langsung — ❓ OPEN: apakah dependensi transitif juga dicatat di `componentDeps` untuk publish offline/deterministik (usulan: ya, field `transitive: true`).

---

## 21. Mapping ke penyimpanan DB

### DM-078 Tabel terkait dokumen (ringkas)
- **P0 · M1** — definisi kolom final & index ada di [../ARCHITECTURE.md](../ARCHITECTURE.md).

| Tabel | Isi | Kolom kunci (snake_case) |
|---|---|---|
| `sites` | Kepemilikan & status website | `id`, `workspace_id`, `document_id`, `live_deployment_id` (subdomain di `site_domains`) |
| `documents` | 1 baris per Y.Doc (site / component draft / template draft) | `id`, `site_id`, `kind`, `schema_version`, `last_seq`, `last_snapshot_id` |
| `document_updates` | Update Yjs append-only | `id bigint`, `document_id`, `seq`, `update bytea`, `origin` (`local`/`ai`/`server`/`migration`), `ai_run_id`, `created_at` |
| `document_snapshots` | State Yjs + JSON snapshot (history, restore, publish source) | `id`, `document_id`, `upto_seq`, `state bytea`, `json jsonb`, `kind` (`auto`/`named`/`publish`/`pre_ai`), `label`, `created_by` |
| `deployments` | Hasil publish immutable (07) | `id`, `site_id`, `snapshot_id`, `manifest jsonb`, `status` |
| `components` / `component_versions` | Definisi component (library/site/marketplace) | `component_versions(component_id, version, definition jsonb, schema_version, published_at)` immutable |
| `assets` | File & metadata | `id` (= `assetId`), `site_id`/`library`, `storage_key`, `mime`, `width`, `height`, `variants jsonb` |
| `collections` | Schema & data dinamis (rujuk 05) | — |

- **Aturan**: query lintas website (mis. "website mana memakai component X@3") memakai tabel turunan `site_component_usage` ([03 CMP-156](./03-components-templates.md#cmp-156-tabel-site_component_usage)) yang diisi saat snapshot (bukan scan JSONB) — detail 03/ARCHITECTURE.
- **Acceptance criteria**:
  - [ ] Tidak ada kolom yang menduplikasi isi dokumen kecuali index turunan yang ditandai "derived" dan bisa dibangun ulang dari snapshot.

---

## 22. Daftar OPEN

> ❓ OPEN-DM-1: Website multi-bahasa (`alternateLanguages`) — struktur konten per bahasa (duplikasi page vs field terjemahan per text node). (DM-005)
> ❓ OPEN-DM-2: Set ikon brand (WhatsApp/Instagram/TikTok) — Simple Icons sebagai `set: "brands"`? Lisensi logo perlu dicek. (DM-015)
> ❓ OPEN-DM-3: Node khusus `map` (Google Maps) vs `embed` iframe allowlist. (DM-021)
> ❓ OPEN-DM-4: Model style untuk bagian internal `formField` (label/input/error/placeholder). (DM-022)
> ❓ OPEN-DM-5: Akurasi deteksi "konten melebihi lebar" untuk rule `stackRows` tanpa DOM; alternatif selalu stack + flag `keepRowOnMobile`. Validasi di spike M0. (DM-038)
> ❓ OPEN-DM-6: Kebutuhan dark mode untuk pengunjung website UMKM. (DM-043)
> ❓ OPEN-DM-7: Apakah instance boleh meng-override link/interaction target, atau hanya via prop `link`. (DM-049)
> ❓ OPEN-DM-8: Ekspresi kondisional sederhana di template binding (`if stock > 0`) pada M7. (DM-054)
> ❓ OPEN-DM-9: Granularitas Yjs untuk `layout` (satu daun atomik vs per field) bila multiplayer menunjukkan konflik. (DM-058)
> ❓ OPEN-DM-10: Custom CSS level site untuk paket Pro (scoped & disanitasi). (DM-034)
> ❓ OPEN-DM-11: Dependensi component transitif dicatat di `componentDeps` (`transitive: true`)? (§20.2)
> ❓ OPEN-DM-12: Batas page per site untuk paket Free. (DM-076, rujuk 08)
