# Laporan Spike M0 — Canvas DOM

> Status: **GO bersyarat — ditandatangani owner 2026-10-13** (T0.8.7); syarat konfirmasi: T0.7.4 & uji manual Safari · Disusun 2026-10-13 · Rujukan: [ROADMAP §M0](../ROADMAP.md), [ADR-001](../ARCHITECTURE.md#adr-001-canvas-berbasis-dom-bukan-webgl)

Pertanyaan spike: apakah canvas berbasis DOM (ADR-001) cukup cepat dan cukup sederhana untuk editor ala Figma yang WYSIWYG terhadap situs HTML/CSS? Laporan ini merangkum hasil 42 task M0, keputusan yang diambil, dan kode mana yang dibawa ke M1.

## 1. Rekomendasi

**GO bersyarat.** Semua kriteria §M0.e terpenuhi pada pengukuran otomatis (Chromium headless di WSL2) dan semua keputusan ⚑ sudah diambil. Dua hal belum bisa diverifikasi di lingkungan ini dan menjadi syarat konfirmasi, bukan pemblokir mulai M1:

1. **T0.7.4** — `BENCH_RAW=1 pnpm bench:canvas` di laptop referensi (i5 gen-10 / M1, 8 GB, Chrome stabil). Headless membatasi rAF ke 60 fps sehingga angka di bawah tidak bisa membedakan "cukup" dari "berlebih".
2. **Safari manual** — Tiptap (ketik, IME, paste) di dalam Shadow DOM. WebKit Playwright butuh `sudo playwright install-deps webkit`.

Jika salah satunya gagal, tindakan sudah ditentukan: (1) turunkan batas node / aktifkan culling (ED-021) sesuai §M0.e; (2) mode isolasi prefix masih ada di kode sebagai cadangan (ADR-012).

## 2. Checklist go/no-go (§M0.e)

| Kriteria | GO bila | Hasil spike (headless, indikatif) | Status |
|---|---|---|---|
| Pan/zoom @ 200 node | ≥ 55 fps, tanpa jank > 50 ms | 58–60 fps, p95 16,8 ms, 0 frame > 50 ms (4 kolom varian) | ✅ · konfirmasi T0.7.4 |
| Drag/resize @ 200 node | ≥ 55 fps | drag 60 fps; resize grid wrap 100 anak 60 fps; preview tanpa Yjs/React (ED-024) | ✅ · konfirmasi T0.7.4 |
| Pan @ 2.000 node | ≥ 30 fps (baseline) | 59–60 fps; 5.000 node juga 60 fps (compositor) | ✅ |
| Tiptap di isolasi terpilih | Edit, IME, paste di Chrome & Safari | Chromium & Firefox ✅ (IME via CDP di Chromium); tersimpan ke `Y.XmlFragment` | ⏳ Safari manual |
| Undo | 1 aksi = 1 langkah, seleksi pulih | 50 aksi → 50 undo = state awal; sesi edit teks = 1 langkah; seleksi pulih (unit + E2E) | ✅ |
| Kompleksitas kode | Geometri murni teruji, state machine jelas | 19 modul logika murni, coverage ≥ 90% per file (agregat 99,8% stmt / 97,9% branch); interaction machine murni dengan efek eksplisit | ✅ |
| Gagal total (≤ 30 fps @ 200) | — | Tidak terjadi | — |

Angka lengkap: catatan T0.7.3, T0.7.5, T0.8.4, T0.8.6 di ROADMAP. Tabel hasil §M0.e diisi di T0.7.4.

## 3. Keputusan yang diambil

| Keputusan | Hasil | Rujukan |
|---|---|---|
| Isolasi style canvas | **Shadow DOM** | ADR-012, T0.8.1 |
| Breakpoint frame di canvas | **Tanpa iframe** (model Figma; style ter-resolve per frame) | ADR-013, T0.8.2 |
| Rentang zoom | **5%–1600%** (3200% lolos uji, tidak dibutuhkan) | ED-013, T0.8.3 |
| Deteksi overflow `stackRows` | **Statis + margin 0,9** (17–18/18 row benar di 3 font; 0 row meluber lolos) | DM-038, T0.8.4 |
| Rich text di Yjs | `Y.XmlFragment` + **`@tiptap/y-tiptap`**; konversi JSON ↔ fragment milik document-model (hanya `yjs`) | DM-013/058, T0.8.5 |
| Batas dokumen | node/page 2.000 / 5.000, state 8 / 16 MB; DM-076 sumber tunggal | DM-076, ED-223, T0.8.6 |
| Regex token | `{1,2}` level (DM-041/067), DM-025 diselaraskan | T0.2.x |

## 4. Kode: dipertahankan vs dibuang

Prinsip §M0.a: yang dipertahankan hanya yang lolos review — logika murni teruji, state machine, dan hasil benchmark. Komentar `SEMENTARA (spike M0)` di kode menandai bagian yang dibuang/diganti.

### Dipertahankan (pindah apa adanya ke M1/M2)

| Area | File | Catatan |
|---|---|---|
| Schema, ID, ops, cascade style | `packages/document-model/src/{schema,ids.ts,ops,query/resolve-style.ts}` | Subset M0; schema lengkap & `src/ops` vs `src/commands` (DM-073) diselaraskan di M1 |
| Mapping Yjs + rich text | `packages/document-model/src/yjs/*` | Termasuk `yNodeToJson`, konversi `Y.XmlFragment` |
| Estimator overflow `stackRows` | `packages/document-model/src/query/estimate-width.ts` | Dipindah ke `packages/renderer` saat `applyAutoResponsive` dibuat (M1) |
| Fixture & benchmark | `packages/document-model/{test/fixtures,bench}`, `apps/editor/bench/*` | Dasar regresi performa (T2.18) |
| Geometri & koordinat | `canvas/geometry/{coordinates,geometry-store}.ts`, `canvas/zoom-limits.ts` | |
| Interaksi | `canvas/interactions/{interaction-machine,pan,zoom,browser-guards}.ts` + hook `use-*` | State machine murni + adaptor DOM |
| Drag / resize / reorder | `canvas/drag/{move,resize,reorder,transform-preview}.ts`, `use-drag-sessions.ts` | |
| Hit-test, seleksi, marquee | `canvas/hit-test/hit-test.ts`, `tools/select/*`, `tools/tool-store.ts` | |
| Overlay | `canvas/overlay/*`, `MarqueeOverlay.tsx` | Visual final menyusul desain UI |
| Store | `store/{selection,hover,interaction,preview,text-editing}-store.ts` | |
| Dokumen di editor | `document/{node-store,undo-controller,undo-shortcut,use-undo-shortcuts,undo-context,use-node}.ts` | |
| Teks inline | `canvas/text-editing/*` | Butuh `richTextSchema` tunggal + lazy-load Tiptap (M2) |
| Shadow DOM | `canvas/use-shadow-root.ts`, `canvas/shadow-root-compat.ts`, `commands/is-editable-target.ts` | Aturan wajib ADR-012 |
| Font situs | `canvas/fonts/site-fonts.ts` | Ganti URL CDN `@latest` → katalog font berversi (M2) |

### Dipindah / ditulis ulang di M1

| Area | File | Tujuan |
|---|---|---|
| Renderer prototipe | `canvas/render-root/{render-node,style-to-css,rich-text,NodeView,RenderRoot,breakpoint-context}.tsx/ts` | `packages/renderer` (mode editor & publish, satu sumber — T1.10). `style-to-css` & snapshot test-nya menjadi titik awal |
| Breakpoint frame class-mode | `canvas/frames/{CanvasFrames,frame-layout}.ts(x)` | Dipertahankan polanya (ADR-013), dirapikan di M2 |

### Dibuang

| Area | File | Alasan |
|---|---|---|
| Singleton spike & `window.__spike` | `canvas/spike-document.ts`, `geometry/spike-geometry.ts`, `hit-test/spike-hit-test.ts` | Diganti lifecycle Y.Doc sungguhan (IndexedDB → Hocuspocus, T1.15.7) |
| Fixture via URL & parameter dev | `canvas/dev-fixture.ts`, `?isolation`, `?frames`, `?bpMode`, `?siteCss`, `?outline`, `?zoom/x/y` | Hanya alat uji spike |
| Mode isolasi prefix | bagian prefix di `canvas/isolation.ts` | Dihapus setelah uji Safari lulus (ADR-012) |
| Mode iframe breakpoint | `canvas/frames/IframeFrame.tsx` | ADR-013 |
| Token & asset placeholder | `render-root/{tokens,asset-url}.ts` | Diganti theme dokumen (T1.8.12) & URL asset CDN |
| `GeometryOutline.tsx`, `render-probe.ts` | | Alat debug spike (render-probe boleh dipertahankan untuk test render count) |

Penghapusan dilakukan sebagai task awal M1, bukan sekarang, agar benchmark & E2E spike tetap bisa diulang di T0.7.4.

## 5. Temuan teknis yang wajib dibawa

- **Shadow DOM (ADR-012):** `:host { all: initial }`; query & hit-test lewat `shadowRoot`; handler keyboard global memakai `isEditableEvent` (`composedPath()[0]`); CSS Tiptap disuntik manual (`injectCSS: false`); ShadowRoot diberi shim `createRange`/`getSelection` untuk y-tiptap.
- **Pointer capture** dipasang saat drag dimulai, bukan saat pointerdown (kalau tidak, dblclick rusak).
- **Cross-realm (iframe):** `instanceof HTMLElement`, `ResizeObserver`, dan `FontFace` harus berasal dari window pemilik dokumen — relevan untuk preview iframe di M2.
- **Undo:** satu `Y.UndoManager` dokumen; origin lokal = command canvas + `ySyncPluginKey`; jangan pakai extension Collaboration Tiptap (meng-`destroy()` UndoManager yang diberikan).
- **Render inkremental:** satu `observeDeep` + dispatch per ID; komponen memo bernama beda dari konstanta memo (bug shadowing).
- **Yjs:** state ≈ 1,15× JSON; commit drag ≈ 56 B; menulis preview per frame ke Yjs ≈ 3,3 KB/detik (dihindari).

## 6. Utang & pekerjaan terbuka

| Item | Kapan |
|---|---|
| T0.7.4 benchmark laptop referensi (+ cek relayout 5.000 node ≤ 50 ms, DM-076) | Sebelum/awal M1 (owner) |
| Uji manual Safari & Edge (Tiptap, IME, paste) | Sebelum M2 teks |
| Aturan CSS `fill` + `maxWidth` di kolom ber-`align: center` | T1.10 renderer |
| Selaraskan `src/ops` (ARCHITECTURE) vs `src/commands` (DM-073) | M1 |
| `richTextSchema` tunggal (align, link, list, textStyle) | Sebelum M2 teks |
| Lazy-load Tiptap (bundle 889 kB) | M2 |
| Property-based test (`fast-check`, ED-238) — butuh persetujuan dependency | M1/M2 |
| Bersihkan kode "Dibuang" (§4) | Task awal M1 |

## 7. Tanda tangan owner

- [Sudah ] Saya sudah membaca laporan ini dan menyetujui keputusan di §3.
- [GO] Go/no-go: **GO** (bersyarat T0.7.4 & Safari) / NO-GO
- [Setuju, selagi ontrack dengan requirement] Daftar kode dipertahankan/dibuang (§4) disetujui.

Owner: Sigit Riawan · Tanggal: 13/10/2026
