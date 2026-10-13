// Aturan dependensi monorepo (ARCHITECTURE §4.3), dijalankan `pnpm lint:deps` (lokal & CI).
// Path yang dicocokkan = path file hasil resolusi (symlink workspace pnpm diikuti ke `packages/<nama>/…`,
// paket npm ke `node_modules/.pnpm/<paket>@<versi>/node_modules/<paket>/…`). Jangan melonggarkan aturan
// agar lolos — ubah ARCHITECTURE §4.3 dulu bila memang perlu.

// Paket npm berdasarkan nama. Path virtual store pnpm (`node_modules/.pnpm/<p>@<v>/node_modules/<p>/`)
// juga memuat `node_modules/<p>/`, jadi satu pola cukup (regex sengaja tanpa pengulangan bersarang).
const npm = (...names) => `node_modules/(?:${names.join("|")})/`;

// Paket internal yang boleh diimport tiap paket (diagram §4.3). `config` selalu boleh (devDependency).
const ALLOWED_INTERNAL = {
  "document-model": [],
  shared: [],
  i18n: [],
  renderer: ["document-model", "shared"],
  "workflow-blocks": ["shared"],
  "ai-tools": ["document-model", "shared"],
  "library-seed": ["document-model"],
  db: ["shared", "document-model"], // document-model hanya type-only (aturan db-document-model-type-only)
  sdk: ["shared"],
  ui: ["i18n"],
};

const allowedInternalRules = Object.entries(ALLOWED_INTERNAL).map(([pkg, allowed]) => ({
  name: `internal-deps-${pkg}`,
  comment: `${pkg} hanya boleh mengimport paket internal: ${allowed.length ? allowed.join(", ") : "(tidak ada)"} (ARCHITECTURE §4.3).`,
  severity: "error",
  from: { path: `^packages/${pkg}/` },
  to: { path: "^packages/", pathNot: `^packages/(?:${[pkg, "config", ...allowed].join("|")})/` },
}));
// db boleh import type-only dari document-model (untuk `$type<>` kolom JSON), bukan import runtime.
allowedInternalRules.push({
  name: "db-document-model-type-only",
  comment: "db hanya boleh import type-only dari document-model (ARCHITECTURE §4.3).",
  severity: "error",
  from: { path: "^packages/db/" },
  to: { path: "^packages/document-model/", dependencyTypesNot: ["type-only"] },
});

const NETWORK_MODULES = [
  "http",
  "https",
  "http2",
  "net",
  "tls",
  "dns",
  "dgram",
  "node:http",
  "node:https",
  "node:http2",
  "node:net",
  "node:tls",
  "node:dns",
  "node:dgram",
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-package-to-app",
      comment: "packages/* tidak boleh mengimport apps/* (boundary deploy).",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "no-app-to-app",
      comment: "App tidak boleh mengimport app lain (boundary deploy).",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "document-model-pure",
      comment: "document-model hanya boleh bergantung pada zod, yjs, nanoid (dipakai browser, Node, edge).",
      severity: "error",
      // Kode produksi saja: test boleh memakai vitest & helper di test/.
      from: { path: "^packages/document-model/src/", pathNot: "\\.test\\.ts$" },
      to: { pathNot: [`^packages/document-model/src/`, npm("zod", "yjs", "nanoid")] },
    },
    {
      name: "renderer-deterministic",
      comment: "renderer tidak boleh import db, ui, ai-tools (output publish deterministik & jalan di Node).",
      severity: "error",
      from: { path: "^packages/renderer/" },
      to: { path: "^packages/(?:db|ui|ai-tools)/" },
    },
    {
      name: "browser-edge-no-server-code",
      comment: "editor, web, site-host tidak boleh import db atau @platform/shared/node (kode server/secret).",
      severity: "error",
      from: { path: "^apps/(?:editor|web|site-host)/" },
      to: { path: ["^packages/db/", "^packages/shared/src/node/"] },
    },
    {
      name: "site-host-shared-only",
      comment: "site-host hanya boleh paket internal shared (edge-safe, batas ukuran Workers).",
      severity: "error",
      from: { path: "^apps/site-host/" },
      to: { path: "^packages/", pathNot: "^packages/(?:shared|config)/" },
    },
    {
      name: "ports-only-no-db",
      comment: "workflow-blocks & ai-tools tidak mengakses DB langsung; efek samping lewat ports.",
      severity: "error",
      from: { path: "^packages/(?:workflow-blocks|ai-tools)/" },
      to: { path: ["^packages/db/", npm("pg", "postgres", "drizzle-orm", "ioredis", "redis", "bullmq")] },
    },
    {
      name: "ports-only-no-network",
      comment: "workflow-blocks & ai-tools tidak melakukan HTTP/network langsung (global fetch dicegah Biome).",
      severity: "error",
      from: { path: "^packages/(?:workflow-blocks|ai-tools)/" },
      to: {
        path: [
          `^(?:${NETWORK_MODULES.join("|")})$`,
          npm("undici", "node-fetch", "axios", "ky", "got", "ws", "@anthropic-ai/sdk"),
        ],
      },
    },
    ...allowedInternalRules,
    {
      name: "not-to-unresolvable",
      comment: "Import yang tidak bisa di-resolve (salah path / dependency belum dipasang).",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(?:^|/)(?:dist|coverage|test-results|playwright-report|\\.turbo)/" },
    parser: "swc",
    // SWC (bukan tsc — dependency-cruiser 18 belum mendukung TypeScript 7) sudah menandai `import type`
    // sebagai `type-only`; tsPreCompilationDeps hanya berlaku untuk parser tsc.
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".d.ts", ".js", ".mjs", ".cjs", ".json"],
      mainFields: ["module", "main", "types"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
