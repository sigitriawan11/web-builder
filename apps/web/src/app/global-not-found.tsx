import { t } from "@platform/i18n";
import type { Metadata } from "next";
import "./globals.css";

// 404 global (Next 16 `global-not-found`, eksperimental — wajib karena ada dua root layout: marketing & app). STATIS &
// tanpa JS: di host `app.` script-nya tidak mendapat nonce CSP (PUB-211), dan halaman statis tidak tahu bahasa user →
// teks ID dengan EN di bawahnya; tautan ke beranda host yang sama (`/` → dashboard di `app.`, landing di apex).
export const metadata: Metadata = { title: `404 — ${t("id", "common", "notFound.title")}` };

export default function GlobalNotFound() {
  return (
    <html lang="id">
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-6xl font-bold text-muted-foreground">404</p>
          <h1 className="text-2xl font-semibold">{t("id", "common", "notFound.title")}</h1>
          <p className="max-w-md text-muted-foreground">{t("id", "common", "notFound.description")}</p>
          <p lang="en" className="max-w-md text-sm text-muted-foreground">
            {t("en", "common", "notFound.title")} — {t("en", "common", "notFound.description")}
          </p>
          <a
            href="/"
            className="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("id", "common", "notFound.home")} / {t("en", "common", "notFound.home")}
          </a>
        </main>
      </body>
    </html>
  );
}
