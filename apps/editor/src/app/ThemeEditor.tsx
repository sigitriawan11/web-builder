import { isApiError } from "@platform/sdk";
import { useLibraryTheme, useSaveLibraryTheme } from "@platform/sdk/react";
import { useEffect, useMemo, useState } from "react";
import { useT } from "./i18n";
import { SiteNotFound } from "./SiteEditor";

// T3.4.16 (CMP-124): edit preset theme di Mode Admin. Form token warna + pratinjau komponen kunci + simpan
// (version naik; situs yang sudah menyalin preset tak tersentuh). Akses diverifikasi SERVER (bukan staf → 404).

// Bentuk theme yang kita butuhkan untuk mengedit warna; token lain diteruskan apa adanya saat simpan.
interface EditableTheme {
  tokens: { color: Record<string, unknown> } & Record<string, unknown>;
  [key: string]: unknown;
}

/** Hex literal token (string `#rrggbb[aa]` atau `{ value: "#..." }`); alias `{$token}` / grup bersarang → null. */
function hexOf(value: unknown): string | null {
  if (typeof value === "string") return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value) ? value : null;
  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as { value: unknown }).value;
    return typeof inner === "string" && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(inner) ? inner : null;
  }
  return null;
}

function relLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg: string, bg: string): number {
  const a = relLuminance(fg);
  const b = relLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function ThemeEditor({ slug }: { slug: string }) {
  const t = useT();
  const query = useLibraryTheme(slug);
  const status = isApiError(query.error) ? query.error.status : null;

  useEffect(() => {
    if (status === 401) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status]);

  if (query.isPending || status === 401) {
    return (
      <main className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground" aria-busy>
        {t("admin.theme.loading")}
      </main>
    );
  }
  // Bukan staf → 404; staf tanpa akses baca → 403: keduanya "tidak ditemukan" (permukaan admin tak bocor).
  if (status === 404 || status === 403) return <SiteNotFound />;
  if (query.error) throw query.error;

  return <ThemeWorkspace slug={slug} theme={query.data.theme as EditableTheme} initialVersion={query.data.version} />;
}

function ThemeWorkspace({
  slug,
  theme,
  initialVersion,
}: {
  slug: string;
  theme: EditableTheme;
  initialVersion: number;
}) {
  const t = useT();
  const save = useSaveLibraryTheme();
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  // Token warna yang bisa diedit (hex literal rata/flat). Urutan deterministik (kunci terurut).
  const colorKeys = useMemo(
    () =>
      Object.entries(theme.tokens.color)
        .filter(([, v]) => hexOf(v) !== null)
        .map(([key]) => key)
        .sort(),
    [theme],
  );
  const [colors, setColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(colorKeys.map((key) => [key, hexOf(theme.tokens.color[key]) ?? "#000000"])),
  );

  const color = (key: string): string => colors[key] ?? "#000000";
  const bg = color("background");
  const surface = colors.surface ?? bg;
  const onSurface = colors.onSurface ?? colors.text ?? "#111111";
  const primary = colors.primary ?? "#2563eb";
  const onPrimary = colors.onPrimary ?? colors.primaryForeground ?? "#ffffff";
  const border = colors.border ?? "#e5e7eb";

  const bodyContrast = contrast(onSurface, surface);
  const btnContrast = contrast(onPrimary, primary);

  const onSave = () => {
    // Rebuild theme dengan warna teredit sebagai hex literal; token & fonts lain tetap.
    const nextColor: Record<string, unknown> = { ...theme.tokens.color };
    for (const key of colorKeys) nextColor[key] = colors[key];
    const next: EditableTheme = { ...theme, tokens: { ...theme.tokens, color: nextColor } };
    save.mutate({ slug, body: { theme: next } }, { onSuccess: (summary) => setSavedVersion(summary.version) });
  };

  const canSaveError = isApiError(save.error) ? save.error.status : null;
  const readOnly = canSaveError === 403;

  return (
    <div
      className="flex h-full flex-col bg-background text-foreground"
      data-admin-mode="theme"
      data-testid="theme-editor"
    >
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <span
          className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold tracking-wide text-black"
          data-testid="admin-badge"
        >
          {t("admin.badge")}
        </span>
        <span className="text-sm font-medium">{t("admin.theme.title")}</span>
        <span className="text-xs text-muted-foreground">{slug}</span>
        <span className="ml-auto flex items-center gap-3">
          {savedVersion !== null ? (
            <span className="text-xs text-emerald-600" data-testid="theme-saved">
              {t("admin.theme.saved", { version: savedVersion })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">v{initialVersion}</span>
          )}
          <button
            type="button"
            className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
            onClick={onSave}
            disabled={save.isPending}
            data-testid="theme-save"
          >
            {save.isPending ? t("admin.theme.saving") : t("admin.theme.save")}
          </button>
        </span>
      </header>

      {readOnly ? (
        <p className="border-b bg-amber-50 px-4 py-1 text-xs text-amber-700" data-testid="theme-readonly">
          {t("admin.theme.readOnly")}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Form token warna. */}
        <section className="w-72 shrink-0 overflow-y-auto border-r p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("admin.theme.colorsHeading")}
          </h2>
          <ul className="flex flex-col gap-2">
            {colorKeys.map((key) => (
              <li key={key} className="flex items-center gap-2" data-token={key}>
                <span className="h-5 w-5 shrink-0 rounded border" style={{ backgroundColor: color(key) }} aria-hidden />
                <label className="flex-1 truncate text-xs" htmlFor={`theme-color-${key}`}>
                  {key}
                </label>
                <input
                  id={`theme-color-${key}`}
                  type="text"
                  className="w-24 rounded border px-1.5 py-0.5 font-mono text-xs"
                  value={color(key)}
                  spellCheck={false}
                  data-testid={`theme-hex-${key}`}
                  onChange={(event) => {
                    const v = event.target.value.trim();
                    setColors((prev) => ({ ...prev, [key]: v }));
                    setSavedVersion(null);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Pratinjau komponen kunci dengan warna saat ini. */}
        <section className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto bg-muted/40 p-8">
          <div
            className="w-full max-w-md rounded-lg border p-6"
            style={{ backgroundColor: bg, borderColor: border, color: onSurface }}
            data-testid="theme-preview"
          >
            <h3 className="text-xl font-bold" style={{ color: onSurface }}>
              {t("admin.theme.previewHeadingSample")}
            </h3>
            <p className="mt-2 text-sm" style={{ color: colors.muted ?? onSurface }}>
              {t("admin.theme.previewBody")}
            </p>
            {bodyContrast < 4.5 ? (
              <p className="mt-1 text-xs font-medium text-red-600" data-testid="contrast-warn-body">
                {t("admin.theme.contrastWarn", { ratio: bodyContrast.toFixed(2) })}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 rounded px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: primary, color: onPrimary }}
            >
              {t("admin.theme.previewButton")}
            </button>
            {btnContrast < 4.5 ? (
              <p className="mt-1 text-xs font-medium text-red-600" data-testid="contrast-warn-button">
                {t("admin.theme.contrastWarn", { ratio: btnContrast.toFixed(2) })}
              </p>
            ) : null}
            <div
              className="mt-4 rounded-md border p-3 text-sm"
              style={{ backgroundColor: surface, borderColor: border, color: onSurface }}
            >
              {t("admin.theme.previewCard")}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
