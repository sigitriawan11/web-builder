import { type Theme, TOKEN_GROUPS, TOKEN_LITERAL_SCHEMAS, type TokenGroup } from "../schema/theme";
import { isTokenRef } from "../schema/values";
import type { IssueReporter } from "../validate/issues";
import type { Breakpoint } from "./resolve-style";

// Resolver token theme (DM-041, DM-042): alias rekursif maks 5 langkah, error bertipe untuk siklus & path hilang.

export const MAX_ALIAS_DEPTH = 5;

export type TokenErrorCode = "TOKEN_NOT_FOUND" | "TOKEN_CYCLE" | "TOKEN_DEPTH" | "TOKEN_GROUP_MISMATCH";

export class TokenResolveError extends Error {
  constructor(
    readonly code: TokenErrorCode,
    readonly path: string,
    readonly chain: readonly string[],
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class TokenNotFoundError extends TokenResolveError {
  constructor(path: string, chain: readonly string[]) {
    super("TOKEN_NOT_FOUND", path, chain, `Token "${path}" tidak ada di theme`);
  }
}

export class TokenCycleError extends TokenResolveError {
  constructor(path: string, chain: readonly string[]) {
    super("TOKEN_CYCLE", path, chain, `Alias token membentuk siklus: ${[...chain, path].join(" → ")}`);
  }
}

export type TokenContext = { breakpoint?: Breakpoint; mode?: "light" | "dark" };

// `type.*` = alias pendek grup `typography` (DM-041).
const GROUP_ALIASES: Record<string, TokenGroup> = { type: "typography" };

export function tokenGroupOf(path: string): TokenGroup | undefined {
  const head = path.split(".")[0] ?? "";
  const group = GROUP_ALIASES[head] ?? head;
  return (TOKEN_GROUPS as readonly string[]).includes(group) ? (group as TokenGroup) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Token responsif `{ value, tablet?, mobile?, dark? }` — dibedakan dari literal Length (`{ value, unit }`).
function isResponsiveToken(
  value: unknown,
): value is { value: unknown; tablet?: unknown; mobile?: unknown; dark?: unknown } {
  return isRecord(value) && "value" in value && !("unit" in value);
}

// Daun = alias, token responsif, atau literal valid untuk grupnya; selain itu grup bersarang (`color.brand`).
function isLeaf(group: TokenGroup, value: unknown): boolean {
  return isTokenRef(value) || isResponsiveToken(value) || TOKEN_LITERAL_SCHEMAS[group].safeParse(value).success;
}

/** Entri mentah token (tanpa mengikuti alias), atau `undefined` bila path tidak ada / bukan daun. */
export function tokenEntry(theme: Theme, path: string): unknown {
  const group = tokenGroupOf(path);
  const [, ...names] = path.split(".");
  if (!group || names.length === 0 || names.length > 2) return undefined;
  let current: unknown = theme.tokens[group];
  for (const [index, name] of names.entries()) {
    if (!isRecord(current) || (index > 0 && isLeaf(group, current))) return undefined;
    current = current[name];
  }
  return current !== undefined && isLeaf(group, current) ? current : undefined;
}

function pickVariant(entry: unknown, ctx: TokenContext): unknown {
  if (!isResponsiveToken(entry)) return entry;
  if (ctx.mode === "dark" && entry.dark !== undefined) return entry.dark;
  if (ctx.breakpoint === "mobile") return entry.mobile ?? entry.tablet ?? entry.value;
  if (ctx.breakpoint === "tablet") return entry.tablet ?? entry.value;
  return entry.value;
}

/**
 * Nilai literal token di `path` setelah mengikuti alias (maks {@link MAX_ALIAS_DEPTH}). Varian responsif/dark dipilih
 * dari `ctx`. Alias wajib ke grup yang sama (DM-042). Melempar {@link TokenNotFoundError} / {@link TokenCycleError}.
 */
export function resolveToken(theme: Theme, path: string, ctx: TokenContext = {}): unknown {
  const chain: string[] = [];
  let current = path;
  const group = tokenGroupOf(path);
  for (;;) {
    if (chain.includes(current)) throw new TokenCycleError(current, chain);
    if (chain.length > MAX_ALIAS_DEPTH) {
      throw new TokenResolveError(
        "TOKEN_DEPTH",
        path,
        chain,
        `Alias token "${path}" lebih dari ${MAX_ALIAS_DEPTH} langkah`,
      );
    }
    const entry = tokenEntry(theme, current);
    if (entry === undefined) throw new TokenNotFoundError(current, chain);
    if (tokenGroupOf(current) !== group) {
      throw new TokenResolveError(
        "TOKEN_GROUP_MISMATCH",
        current,
        chain,
        `Alias "${chain.at(-1) ?? path}" → "${current}" beda grup (${group} ≠ ${tokenGroupOf(current)})`,
      );
    }
    chain.push(current);
    const value = pickVariant(entry, ctx);
    if (!isTokenRef(value)) return value;
    current = value.$token;
  }
}

/** Semua path token daun di theme (termasuk grup bersarang satu tingkat), untuk validasi & generator CSS variable. */
export function listTokenPaths(theme: Theme): string[] {
  const paths: string[] = [];
  for (const group of TOKEN_GROUPS) {
    for (const [name, entry] of Object.entries(theme.tokens[group] ?? {})) {
      const path = `${group}.${name}`;
      if (tokenEntry(theme, path) !== undefined) paths.push(path);
      else if (isRecord(entry)) for (const child of Object.keys(entry)) paths.push(`${path}.${child}`);
    }
  }
  return paths;
}

const LENGTH_GROUPS: readonly TokenGroup[] = ["space", "radius", "size"];

// Pesan EN untuk issue validasi (pesan ID ada di error).
const TOKEN_ERROR_EN: Record<TokenErrorCode, (error: TokenResolveError) => string> = {
  TOKEN_NOT_FOUND: (e) => `Token "${e.path}" does not exist in the theme`,
  TOKEN_CYCLE: (e) => `Token aliases form a cycle: ${[...e.chain, e.path].join(" → ")}`,
  TOKEN_DEPTH: (e) => `Token alias "${e.path}" exceeds ${MAX_ALIAS_DEPTH} steps`,
  TOKEN_GROUP_MISMATCH: (e) => `Alias "${e.path}" points to a different token group`,
};

/**
 * Validasi theme (DM-041/DM-042) untuk `validateDocument`: setiap alias ter-resolve (tanpa siklus, path hilang,
 * > 5 langkah, atau lintas grup), field token di dalam literal typography merujuk grup yang cocok, dan family di
 * grup `fontFamily` terdaftar di `theme.fonts`.
 */
export function checkThemeTokens(theme: Theme, report: IssueReporter): void {
  const families = new Set(theme.fonts.map((font) => font.family));
  const refersTo = (ref: unknown, groups: readonly TokenGroup[], at: (string | number)[]) => {
    if (!isTokenRef(ref)) return;
    const group = tokenGroupOf(ref.$token);
    if (!group || !groups.includes(group)) {
      report("TOKEN_REF", at, {
        id: `Token "${ref.$token}" harus dari grup ${groups.join("/")}`,
        en: `Token "${ref.$token}" must belong to group ${groups.join("/")}`,
      });
    } else if (tokenEntry(theme, ref.$token) === undefined) {
      report("TOKEN_REF", at, {
        id: `Token "${ref.$token}" tidak ada di theme`,
        en: `Token "${ref.$token}" does not exist in the theme`,
      });
    }
  };

  for (const path of listTokenPaths(theme)) {
    const at = ["theme", "tokens", ...path.split(".")];
    for (const mode of ["light", "dark"] as const) {
      try {
        const value = resolveToken(theme, path, { mode });
        if (path.startsWith("fontFamily.") && typeof value === "string" && !families.has(value)) {
          report("FONT_REF", at, {
            id: `Font "${value}" tidak terdaftar di theme.fonts`,
            en: `Font "${value}" is not registered in theme.fonts`,
          });
        }
      } catch (error) {
        if (!(error instanceof TokenResolveError)) throw error;
        report("TOKEN_REF", at, { id: error.message, en: TOKEN_ERROR_EN[error.code](error) });
        break;
      }
    }
    const entry = tokenEntry(theme, path);
    if (path.startsWith("typography.") && isRecord(entry) && !isTokenRef(entry)) {
      const literal = isResponsiveToken(entry) ? entry.value : entry;
      if (isRecord(literal)) {
        refersTo(literal.fontFamily, ["fontFamily"], [...at, "fontFamily"]);
        for (const field of ["fontSize", "letterSpacing", "lineHeight"]) {
          refersTo(literal[field], LENGTH_GROUPS, [...at, field]);
        }
      }
    }
  }
}

export type ResolveValueContext = TokenContext & {
  theme: Theme;
  /** Theme cadangan bila token tidak ada (biasanya `defaultTheme()`), AC DM-025. */
  fallbackTheme?: Theme;
  /** Nilai prop instance; hanya relevan di dalam ComponentDefinition (M3). */
  props?: Record<string, unknown>;
  onWarning?: (warning: { code: TokenErrorCode; path: string; message: string }) => void;
};

function applyAlpha(color: unknown, alpha: number): unknown {
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) return color;
  const base = color.length === 9 ? Number.parseInt(color.slice(7), 16) / 255 : 1;
  const channel = Math.round(base * alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color.slice(0, 7)}${channel}`;
}

/**
 * Nilai literal final dari literal | `{ $token }` | `{ $token, alpha }` | `{ $prop }` (DM-025). Token yang tidak
 * ter-resolve tidak membuat crash: coba `fallbackTheme`, laporkan warning, dan kembalikan `undefined` bila tetap gagal.
 */
export function resolveValue(value: unknown, ctx: ResolveValueContext): unknown {
  if (isRecord(value) && typeof value.$prop === "string") {
    const fromProps = ctx.props?.[value.$prop];
    // Prop bisa berisi token (mis. warna dari theme), tapi tidak berisi `$prop` lagi.
    const { props: _, ...withoutProps } = ctx;
    return resolveValue(fromProps === undefined ? value.fallback : fromProps, withoutProps);
  }
  if (!isTokenRef(value)) return value;
  const alpha = "alpha" in value && typeof value.alpha === "number" ? value.alpha : undefined;
  const withAlpha = (resolved: unknown) => (alpha === undefined ? resolved : applyAlpha(resolved, alpha));
  try {
    return withAlpha(resolveToken(ctx.theme, value.$token, ctx));
  } catch (error) {
    if (!(error instanceof TokenResolveError)) throw error;
    ctx.onWarning?.({ code: error.code, path: value.$token, message: error.message });
    if (!ctx.fallbackTheme) return undefined;
    try {
      return withAlpha(resolveToken(ctx.fallbackTheme, value.$token, ctx));
    } catch (fallbackError) {
      if (!(fallbackError instanceof TokenResolveError)) throw fallbackError;
      return undefined;
    }
  }
}
