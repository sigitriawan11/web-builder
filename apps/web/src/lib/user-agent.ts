// Ringkasan perangkat dari user agent untuk daftar sesi (ACC-007): cukup "Browser · OS", bukan deteksi lengkap.
const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];
const SYSTEMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

const first = (ua: string, table: ReadonlyArray<readonly [RegExp, string]>) =>
  table.find(([pattern]) => pattern.test(ua))?.[1] ?? null;

/** "Chrome · Windows"; bagian tak dikenal dilewati; `null` bila tidak ada yang dikenali. */
export function summarizeUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const parts = [first(userAgent, BROWSERS), first(userAgent, SYSTEMS)].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
