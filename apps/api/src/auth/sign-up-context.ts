import { AsyncLocalStorage } from "node:async_hooks";
import type { Locale } from "@platform/i18n";

// Data registrasi yang tidak ikut ke Better Auth (consent, IP, locale) dibawa dari middleware Express ke hook
// Better Auth lewat AsyncLocalStorage — tanpa field tambahan di body BA dan tanpa bergantung pada `ctx.path`.

export interface SignUpContext {
  locale: Locale;
  timezone?: string;
  marketingOptIn: boolean;
  rememberMe?: boolean;
  ip?: string;
  userAgent?: string;
  // Diisi hook `user.create.after` (setelah commit) → hook after endpoint membuat sesi (auto-login ACC-001).
  createdUserId?: string;
}

const storage = new AsyncLocalStorage<SignUpContext>();

export function runWithSignUpContext<T>(context: SignUpContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Konteks registrasi email aktif; `undefined` untuk alur lain (OAuth, seed, admin). */
export function currentSignUp(): SignUpContext | undefined {
  return storage.getStore();
}
