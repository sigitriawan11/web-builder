"use client";

import { useEffect, useRef } from "react";

// Widget Cloudflare Turnstile (ACC-004: muncul setelah 3 login gagal). Script dimuat sekali saat dibutuhkan; dengan
// CSP `'strict-dynamic'` script yang disisipkan kode tepercaya diizinkan, iframe-nya lewat `frame-src` (PUB-211).
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => string;
  remove: (widgetId: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile tidak termuat")));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile tidak termuat"));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token) => callback.current(token),
        });
      })
      .catch(() => {
        // Gagal memuat (jaringan/blokir): form tetap menampilkan pesan captcha dari server.
      });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);
  return <div ref={container} data-testid="turnstile" />;
}
