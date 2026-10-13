// Verifikasi Cloudflare Turnstile (ACC-004: wajib setelah 3× login gagal). URL tujuan tetap (bukan dari input
// user), jadi tidak lewat SSRF guard. Gagal menghubungi Cloudflare = tidak lolos (fail closed).

export type CaptchaVerifier = (token: string, remoteIp?: string) => Promise<boolean>;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileVerifier(secret: string, onError?: (error: unknown) => void): CaptchaVerifier {
  return async (token, remoteIp) => {
    try {
      const body = new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) });
      const response = await fetch(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5_000) });
      if (!response.ok) return false;
      const result = (await response.json()) as { success?: unknown };
      return result.success === true;
    } catch (error) {
      onError?.(error);
      return false;
    }
  };
}
