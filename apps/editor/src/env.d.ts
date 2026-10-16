// Variabel build editor (Vite, prefiks VITE_ — terlihat di bundle publik; jangan isi rahasia).
interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  // Git SHA (CI) — release Sentry & source map.
  readonly VITE_RELEASE?: string;
  // "true" = tampilkan tombol dev sementara (T1.15.18) di build non-dev, mis. staging.
  readonly VITE_EDITOR_DEV_TOOLS?: string;
}
