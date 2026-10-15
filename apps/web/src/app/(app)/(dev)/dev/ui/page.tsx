import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  isThemePreference,
  Label,
  Separator,
  THEME_COOKIE,
  ThemeSwitcher,
} from "@platform/ui";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadWebEnv } from "../../../../../config/routing";

// Katalog komponen @platform/ui (T1.15.4, verifikasi pengganti Storybook) — hanya di luar production. Teks contoh
// sengaja literal: halaman alat dev, tidak pernah tampil ke user (allowlist rule i18n JSX, T1.15.6).
export default async function UiCatalogPage() {
  if (loadWebEnv().APP_ENV === "production") notFound();
  const t = await getTranslations("common");
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">@platform/ui</h1>
        <ThemeSwitcher
          initial={isThemePreference(theme) ? theme : "system"}
          groupLabel={t("theme.label")}
          labels={{ system: t("theme.system"), light: t("theme.light"), dark: t("theme.dark") }}
        />
      </header>

      <section className="flex flex-wrap gap-3" aria-label="Button">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
      </section>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Card</CardTitle>
          <CardDescription>Input, Label, Checkbox</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="catalog-email">Email</Label>
            <Input id="catalog-email" type="email" placeholder="nama@contoh.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="catalog-invalid">Invalid</Label>
            <Input id="catalog-invalid" aria-invalid defaultValue="salah" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="catalog-check" />
            <Label htmlFor="catalog-check">Checkbox</Label>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button>Simpan</Button>
        </CardFooter>
      </Card>

      <section className="flex flex-col gap-3" aria-label="Alert">
        <Alert>
          <AlertTitle>Default</AlertTitle>
          <AlertDescription>Informasi umum.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>Destructive</AlertTitle>
          <AlertDescription>Pesan error.</AlertDescription>
        </Alert>
        <Alert variant="success">
          <AlertTitle>Success</AlertTitle>
        </Alert>
        <Alert variant="warning">
          <AlertTitle>Warning</AlertTitle>
        </Alert>
      </section>
    </main>
  );
}
