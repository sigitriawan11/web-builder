---
name: admin-variation-generation
description: Cara membuat beberapa variasi berkualitas dari satu component (mis. 6 variasi hero) dengan konsistensi token.
when_to_use: Admin ingin banyak variasi dari satu jenis component (hero, pricing, feature) untuk memperkaya library.
version: 1.0.0
audience: admin
entitlement: [ai]
languages: [id, en]
depends_on: [admin-component-authoring]
tokens_estimate: 1000
---

# Membuat variasi component

Tujuan: beberapa variasi **berbeda nyata** (bukan tweak kosmetik) dari satu jenis, konsisten token & props.

## Strategi variasi
- Variasikan **struktur/komposisi**, bukan sekadar warna: mis. hero *centered* vs *split-image* vs *background-image* vs *dengan trust-logos*.
- Jaga **kontrak props konsisten** antar variasi (key + `semanticRole` sama) agar swap mulus.
- Pakai **variant axis** (`admin_add_variant`) untuk sumbu yang benar-benar ortogonal (mis. `tone: [primary, secondary]`), bukan untuk perbedaan struktural (itu = component terpisah).

## Langkah (per variasi)
1. `admin_create_component_draft` (slug deskriptif, mis. `hero-split-image-left`).
2. Susun struktur berbeda; isi props dengan `semanticRole` yang sama seperti variasi lain.
3. Untuk sumbu ortogonal, `admin_add_variant` (maks 4 axis, 6 opsi/axis).
4. `render_preview` desktop + mobile tiap variasi.
5. Ulangi hingga jumlah variasi target; `finish` dengan daftar slug yang dibuat.

## Checklist
- Tiap variasi beda struktur, bukan hanya warna.
- Props konten utama konsisten (`semanticRole`) lintas variasi.
- Semua lulus `render_preview`.
