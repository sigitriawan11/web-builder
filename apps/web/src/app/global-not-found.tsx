import type { Metadata } from "next";
import "./globals.css";

// 404 global (Next 16 `global-not-found`, eksperimental — wajib karena ada dua root layout: marketing & app). STATIS:
// tanpa layout & tanpa hidrasi di host `app.` (CSP nonce), jadi halaman ini harus berfungsi tanpa JS. Tampilan &
// string i18n di T1.14.9.
export const metadata: Metadata = { title: "404" };

export default function GlobalNotFound() {
  return (
    <html lang="id">
      <body>
        <main />
      </body>
    </html>
  );
}
