import { type RefObject, useLayoutEffect, useState } from "react";

// Shadow root di elemen host; dipakai ulang jika sudah ada (StrictMode menjalankan effect dua kali,
// dan attachShadow kedua kali melempar error).
export function useShadowRoot(hostRef: RefObject<HTMLElement | null>, enabled: boolean): ShadowRoot | null {
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!enabled || !host) return;
    setShadowRoot(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
  }, [hostRef, enabled]);
  return shadowRoot;
}
