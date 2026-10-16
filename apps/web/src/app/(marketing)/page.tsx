import { t } from "@platform/i18n";
import { Button } from "@platform/ui";
import { loadWebEnv } from "../../config/routing";

// Landing marketing (host apex, ARCHITECTURE §5.1) — placeholder M1, STATIS (SSG): bahasa default `id`. Versi EN &
// switcher bahasa di footer (ACC-009) menunggu konten marketing (path/host EN terpisah, karena halaman statis tidak
// membaca cookie). Isi galeri template/pricing menyusul (M4).
export default function MarketingHome() {
  const app = loadWebEnv().PUBLIC_APP_URL.replace(/\/$/, "");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold">Platform</span>
        <Button asChild variant="ghost">
          <a href={`${app}/login`}>{t("id", "common", "landing.login")}</a>
        </Button>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          {t("id", "common", "landing.tagline")}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">{t("id", "common", "landing.description")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href={`${app}/register`}>{t("id", "common", "landing.register")}</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`${app}/login`}>{t("id", "common", "landing.login")}</a>
          </Button>
        </div>
      </main>
      <footer className="px-6 py-4 text-sm text-muted-foreground">
        {t("id", "common", "landing.footer", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
