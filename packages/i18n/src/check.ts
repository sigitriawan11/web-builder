import { IntlMessageFormat } from "intl-messageformat";

// Pemeriksa katalog (ACC-290, `pnpm i18n:check`): setiap key ada di semua bahasa, setiap pesan valid ICU, dan
// argumen `{nama}`/plural/select sama antar bahasa (terjemahan tidak boleh menghilangkan/menambah variabel).

export interface MessageIssue {
  kind: "missing" | "not_string" | "invalid_icu" | "placeholder_mismatch";
  namespace: string;
  key: string;
  locale: string;
  detail?: string;
}

type Tree = { readonly [key: string]: unknown };

function flatten(tree: Tree, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}${key}`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, leaf] of flatten(value as Tree, `${path}.`)) out.set(inner, leaf);
    } else out.set(path, value);
  }
  return out;
}

// Bentuk minimal elemen AST ICU (formatjs): argumen punya `value` (nama), plural/select punya `options`, tag `children`.
interface AstElement {
  type: number;
  value?: unknown;
  options?: Record<string, { value: AstElement[] }>;
  children?: AstElement[];
}
// TYPE formatjs: 1 argument, 2 number, 3 date, 4 time, 5 select, 6 plural, 8 tag.
const ARGUMENT_TYPES = new Set([1, 2, 3, 4, 5, 6]);

function argumentNames(elements: readonly AstElement[], into = new Set<string>()): Set<string> {
  for (const element of elements) {
    if (ARGUMENT_TYPES.has(element.type) && typeof element.value === "string") into.add(element.value);
    for (const option of Object.values(element.options ?? {})) argumentNames(option.value, into);
    if (element.children) argumentNames(element.children, into);
  }
  return into;
}

/** Parse ICU; `ignoreTag` — teks seperti `<b>` tidak dianggap tag (React merender teks apa adanya). */
export function parseMessage(message: string, locale: string): Set<string> {
  const ast = new IntlMessageFormat(message, locale, undefined, { ignoreTag: true }).getAst() as AstElement[];
  return argumentNames(ast);
}

export function checkMessages(catalog: Readonly<Record<string, Readonly<Record<string, Tree>>>>): MessageIssue[] {
  const issues: MessageIssue[] = [];
  const locales = Object.keys(catalog);
  const namespaces = new Set(locales.flatMap((locale) => Object.keys(catalog[locale] ?? {})));
  for (const namespace of namespaces) {
    const flat = new Map(locales.map((locale) => [locale, flatten(catalog[locale]?.[namespace] ?? {})]));
    const keys = new Set([...flat.values()].flatMap((entries) => [...entries.keys()]));
    for (const key of keys) {
      const args = new Map<string, Set<string>>();
      for (const locale of locales) {
        const value = flat.get(locale)?.get(key);
        if (value === undefined) {
          issues.push({ kind: "missing", namespace, key, locale });
        } else if (typeof value !== "string") {
          issues.push({ kind: "not_string", namespace, key, locale });
        } else {
          try {
            args.set(locale, parseMessage(value, locale));
          } catch (error) {
            issues.push({ kind: "invalid_icu", namespace, key, locale, detail: (error as Error).message });
          }
        }
      }
      const [first, ...rest] = [...args.entries()];
      for (const [locale, names] of rest) {
        const expected = [...(first?.[1] ?? [])].sort().join(",");
        const actual = [...names].sort().join(",");
        if (first && expected !== actual) {
          issues.push({
            kind: "placeholder_mismatch",
            namespace,
            key,
            locale,
            detail: `${first[0]}: {${expected}} vs ${locale}: {${actual}}`,
          });
        }
      }
    }
  }
  return issues;
}

export function formatIssues(issues: readonly MessageIssue[]): string {
  return issues
    .map(
      (issue) =>
        `${issue.kind} ${issue.locale}/${issue.namespace}.json: ${issue.key}${issue.detail ? ` (${issue.detail})` : ""}`,
    )
    .join("\n");
}
