---
name: admin-component-authoring
description: Cara membuat draft component library baru yang rapi, ber-token, dan responsif untuk Mode Admin.
when_to_use: Admin internal ingin membuat component library baru dari deskripsi atau seleksi (hero, card, navbar, dll).
version: 1.0.0
audience: admin
entitlement: [ai]
languages: [id, en]
tokens_estimate: 1200
---

# Membuat draft component library

Kamu membuat **draft** component (publish tetap aksi manusia). Target: component bersih, ber-token, auto-layout, dwibahasa.

## Prinsip
- **Token, bukan nilai literal.** Warna via `color.*`, jarak via `space.*`, radius via `radius.*`. Jangan hardcode hex.
- **Auto-layout wajib** untuk container: `flex`/`grid` + padding + gap. Hindari posisi absolut kecuali dekorasi.
- **Props bermakna + `semanticRole`** untuk konten utama (`heading`, `subheading`, `primaryCtaLabel`, `primaryCtaLink`, `heroImage`, `items`) agar swap & AI bekerja baik.
- **Dwibahasa**: `displayName`/`description` isi `id` + `en`. Default prop teks isi `default` (ID) + `defaultI18n.en`.
- **Responsif**: section penuh-lebar (`width: fill`) dengan inner `maxWidth: size.container`; ukuran font/tombol pakai token.

## Langkah
1. `search_components` dulu — jangan duplikat yang sudah ada.
2. `admin_create_component_draft` dengan `slug` kebab-case unik, `kind` tepat (element/section/layout), `displayName`+`description` dwibahasa.
3. Tambah props lewat panel (atau tool) dengan `group` (content/media/links/appearance/advanced) + `order`.
4. `render_preview` desktop **dan** mobile; cek kontras, spacing, overflow, hierarki. Perbaiki maksimal 2 putaran.
5. `finish` dengan ringkasan; serahkan publish ke admin manusia.

## Checklist sebelum finish
- Tidak ada warna/jarak literal (semua token).
- Setiap container punya auto-layout.
- Props konten utama punya `semanticRole`.
- Lulus `render_preview` desktop + mobile tanpa overflow.
