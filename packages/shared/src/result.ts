// Hasil fungsi murni tanpa exception (ARCHITECTURE §18): error yang diharapkan jadi nilai, bukan `throw`.
export type Result<T, E = unknown> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Ambil nilai atau lempar `error` (mis. AppError) — untuk boundary service yang memakai exception. */
export function unwrap<T, E>(result: Result<T, E>, toError: (error: E) => Error): T {
  if (result.ok) return result.value;
  throw toError(result.error);
}
