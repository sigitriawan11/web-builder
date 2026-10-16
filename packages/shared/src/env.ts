import { z } from "zod";

// Loader env tervalidasi Zod (ARCHITECTURE §15.4). Isomorfik: menerima sumber apa pun (`process.env` di Node,
// `import.meta.env` di Vite) sehingga tiap app mendefinisikan schema subset-nya sendiri dan gagal start
// dengan daftar variabel yang salah. Nilai env TIDAK pernah ditulis ke pesan error (bisa berisi secret).

export type EnvSource = Readonly<Record<string, string | boolean | undefined>>;

export interface EnvIssue {
  key: string;
  message: string;
}

export class EnvError extends Error {
  constructor(
    readonly app: string,
    readonly issues: readonly EnvIssue[],
  ) {
    super(
      [
        `Konfigurasi env "${app}" tidak valid (${issues.length} variabel). Periksa .env (lihat .env.example):`,
        ...issues.map((issue) => `  - ${issue.key}: ${issue.message}`),
      ].join("\n"),
    );
    this.name = "EnvError";
  }
}

// Helper field umum; semua menerima string dari file .env.
export const envField = {
  string: () => z.string().min(1),
  url: () => z.url(),
  port: () => z.coerce.number({ error: "harus nomor port" }).int().min(1, "port 1–65535").max(65_535, "port 1–65535"),
  int: () => z.coerce.number({ error: "harus bilangan bulat" }).int("harus bilangan bulat"),
  // `.env` hanya punya string: "true"/"false" eksplisit, tidak menebak "1"/"yes".
  boolean: () => z.enum(["true", "false"]).transform((value) => value === "true"),
  // Secret minimal panjang tertentu; pesan error tidak memuat nilainya.
  secret: (minLength = 16) => z.string().min(minLength, `minimal ${minLength} karakter`),
  list: () =>
    z.string().transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  json: <T extends z.ZodType>(schema: T) =>
    z
      .string()
      .transform((value, ctx): unknown => {
        try {
          return JSON.parse(value);
        } catch {
          ctx.addIssue({ code: "custom", message: "bukan JSON valid" });
          return z.NEVER;
        }
      })
      .pipe(schema),
};

/**
 * Validasi env untuk satu app. String kosong (`KEY=` di .env) dianggap tidak diisi, sehingga
 * `.optional()`/`.default()` berlaku. Key di luar schema diabaikan.
 */
export function parseEnv<S extends z.ZodRawShape>(app: string, shape: S, source: EnvSource): z.infer<z.ZodObject<S>> {
  const input: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    const value = source[key];
    input[key] = value === "" ? undefined : value;
  }
  const result = z.object(shape).safeParse(input);
  if (result.success) return result.data;
  throw new EnvError(
    app,
    result.error.issues.map((issue) => ({
      key: issue.path.map(String).join(".") || "(root)",
      message: input[String(issue.path[0])] === undefined ? "wajib diisi" : issue.message,
    })),
  );
}

/** Env Sentry app server (ARCHITECTURE §13, T1.16.3); kosong = pelaporan nonaktif. `SENTRY_RELEASE` = git SHA dari CI. */
export const telemetryEnvSchema = {
  SENTRY_DSN: envField.url().optional(),
  SENTRY_ENVIRONMENT: envField.string().optional(),
  SENTRY_RELEASE: envField.string().optional(),
};
