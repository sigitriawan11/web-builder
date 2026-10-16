import { type DestinationStream, type Logger, pino } from "pino";

// Logger JSON semua app Node (ARCHITECTURE §13). Field wajib: `service`, `env` (base), lalu `requestId`,
// `userId?`, `workspaceId?`, `siteId?`, `jobId?` lewat child logger / mixin konteks request (T1.2.5).

export const REDACTED = "[REDACTED]";

// Nama key sensitif di kedalaman berapa pun (ARCHITECTURE §13: password, token, authorization, cookie,
// credentials*, serverKey) + varian umum. Dicocokkan tanpa membedakan huruf besar/kecil.
const SENSITIVE_KEY =
  /^(?:password|passwd|secret|token|authorization|cookie|set-cookie|serverkey|apikey|api_key|privatekey)$|^credentials|token$|secret$|password$/i;

const MAX_DEPTH = 8;

// Child bindings (`logger.child({...})`) tidak melewati `formatters.log`; pino `redact` (path persis) menutupnya.
// Daftar eksplisit nama key sensitif yang umum, sampai kedalaman 3. Child bindings sebaiknya hanya berisi ID konteks.
const SENSITIVE_BINDING_KEYS = [
  "password",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "sessionToken",
  "streamToken",
  "authorization",
  "cookie",
  '["set-cookie"]',
  "apiKey",
  "serverKey",
  "privateKey",
  "credentials",
  "credentialsDekEncrypted",
];
const REDACT_PATHS = SENSITIVE_BINDING_KEYS.flatMap((key) => {
  const segment = key.startsWith("[") ? key : `.${key}`;
  return [key, `*${segment}`, `*.*${segment}`];
});

/** Salinan objek dengan nilai key sensitif diganti `[REDACTED]`; Error & tipe non-plain dibiarkan. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(inner, depth + 1);
  }
  return result;
}

export interface LoggerOptions {
  service: string;
  env: string;
  level?: string;
  // Lokal: tampilan mudah dibaca lewat pino-pretty. Production: JSON ke stdout.
  pretty?: boolean;
  // Field tambahan per baris log (mis. requestId dari AsyncLocalStorage, T1.2.5).
  mixin?: () => Record<string, unknown>;
  // Untuk test: tujuan selain stdout.
  destination?: DestinationStream;
  // T1.16.3: setiap log level ≥ error yang membawa `err` dilaporkan (Sentry) dengan tag ID konteks (tanpa isi log).
  onError?: (error: unknown, tags: Record<string, string>) => void;
}

// Field konteks yang aman dijadikan tag error (ID, bukan konten) → nama tag snake_case.
const TAG_FIELDS: Readonly<Record<string, string>> = {
  requestId: "request_id",
  workspaceId: "workspace_id",
  siteId: "site_id",
  docId: "doc_id",
  queue: "queue",
  jobId: "job_id",
  alert: "alert",
};

function errorTags(...sources: ReadonlyArray<Record<string, unknown> | undefined>): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const source of sources) {
    for (const [field, tag] of Object.entries(TAG_FIELDS)) {
      const value = source?.[field];
      if (typeof value === "string" || typeof value === "number") tags[tag] = String(value);
    }
  }
  return tags;
}

export function createLogger(options: LoggerOptions): Logger {
  const { service, env, level = "info", pretty = false, mixin, destination, onError } = options;
  const config = {
    level,
    base: { service, env },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: REDACTED },
    formatters: {
      // Redaksi pola di setiap objek log (termasuk hasil mixin); child bindings lewat `redact` di atas.
      log: (object: Record<string, unknown>) => redactSensitive(object) as Record<string, unknown>,
    },
    ...(mixin ? { mixin } : {}),
    ...(onError
      ? {
          hooks: {
            logMethod(
              this: Logger,
              args: Parameters<Logger["error"]>,
              method: (...rest: unknown[]) => void,
              level: number,
            ) {
              const [first] = args as unknown[];
              // pino: level 50 = error, 60 = fatal.
              if (level >= 50 && first !== null && typeof first === "object") {
                const fields = first as Record<string, unknown>;
                const error = first instanceof Error ? first : fields.err;
                // Log akses HTTP (pino-http: `responseTime`) membawa error sintetis "failed with status code 5xx";
                // error aslinya sudah dilaporkan oleh error handler → jangan dilaporkan dua kali.
                const accessLog = !(first instanceof Error) && "responseTime" in fields;
                if (error !== undefined && !accessLog) {
                  try {
                    onError(error, errorTags(this.bindings(), mixin?.(), first instanceof Error ? undefined : fields));
                  } catch {
                    // Pelaporan tidak boleh menggagalkan logging.
                  }
                }
              }
              method.apply(this, args as unknown[]);
            },
          },
        }
      : {}),
  };
  if (destination) return pino(config, destination);
  if (pretty) return pino({ ...config, transport: { target: "pino-pretty", options: { colorize: true } } });
  return pino(config);
}

export type { Logger };
