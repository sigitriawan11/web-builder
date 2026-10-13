import type { SiteTenant, WorkspaceTenant } from "@platform/db";

// Konteks per request yang dibangun middleware chain (ARCHITECTURE §5.3); field auth menyusul (T1.5).
declare global {
  namespace Express {
    interface Request {
      // `tenant` diisi middleware tenantResolver setelah memverifikasi akses (ARCHITECTURE §6.2).
      ctx: { requestId: string; tenant?: WorkspaceTenant | SiteTenant };
      // Hasil `validate()` (middleware 10); bertipe lewat `validated()`.
      valid?: unknown;
    }
  }
}
