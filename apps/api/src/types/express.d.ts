import type { SiteTenant, WorkspaceTenant } from "@platform/db";
import type { AuthUser } from "../middleware/auth-session";

// Konteks per request yang dibangun middleware chain (ARCHITECTURE §5.3).
declare global {
  namespace Express {
    interface Request {
      // `tenant` diisi middleware tenantResolver setelah memverifikasi akses (ARCHITECTURE §6.2).
      ctx: {
        requestId: string;
        // Diisi authSession (middleware 6): `null` = tidak login; `undefined` = app tanpa auth (test).
        user?: AuthUser | null;
        tenant?: WorkspaceTenant | SiteTenant;
      };
      // Hasil `validate()` (middleware 10); bertipe lewat `validated()`.
      valid?: unknown;
    }
  }
}
