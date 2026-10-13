// Konteks per request yang dibangun middleware chain (ARCHITECTURE §5.3); field auth/tenant menyusul (T1.5).
declare global {
  namespace Express {
    interface Request {
      ctx: { requestId: string };
      // Hasil `validate()` (middleware 10); bertipe lewat `validated()`.
      valid?: unknown;
    }
  }
}

export {};
