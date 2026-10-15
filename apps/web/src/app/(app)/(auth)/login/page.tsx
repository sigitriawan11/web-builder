import { getTranslations } from "next-intl/server";

// Halaman login — tujuan redirect proxy (T1.14.2); form Better Auth di T1.14.4.
export default async function LoginPage() {
  const t = await getTranslations("auth");
  return (
    <main>
      <h1>{t("login.title")}</h1>
    </main>
  );
}
