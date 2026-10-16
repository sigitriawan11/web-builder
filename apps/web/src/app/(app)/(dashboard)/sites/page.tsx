import { getTranslations } from "next-intl/server";

// Daftar situs (ACC-050) — isi kartu & empty state di T1.14.6.
export default async function SitesPage() {
  const t = await getTranslations("dashboard.sites");
  return <h1 className="text-2xl font-semibold">{t("title")}</h1>;
}
