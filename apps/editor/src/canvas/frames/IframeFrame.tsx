import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadSiteFont, SITE_FONT_WEIGHTS } from "../fonts/site-fonts";
import { TEXT_EDITOR_CSS } from "../isolation";
import type { FrameSpec } from "./frame-layout";

const IFRAME_BASE_CSS = `html, body { margin: 0; } ${TEXT_EDITOR_CSS}`;

/**
 * Opsi (b) ED-034: satu iframe per breakpoint frame; isi dirender ke dokumen iframe lewat portal.
 * Dokumen iframe sudah terisolasi sendiri, jadi mode shadow/prefix tidak berlaku di dalamnya.
 * `pointer-events: none`: event pointer di dalam iframe tidak sampai ke viewport (pan/zoom/klik),
 * sehingga hit-test harus menerjemahkan koordinat sendiri (lihat hit-test/spike-hit-test.ts).
 */
interface IframeFrameProps {
  frame: FrameSpec;
  siteFont: string | null;
  children: ReactNode;
}

export function IframeFrame({ frame, siteFont, children }: IframeFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(900);

  useEffect(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const iframeWindow = iframe?.contentWindow;
    if (!iframe || !doc || !iframeWindow) return;
    const style = doc.createElement("style");
    style.textContent = IFRAME_BASE_CSS;
    doc.head.append(style);
    setBody(doc.body);
    // Tiap dokumen iframe punya FontFaceSet sendiri; font situs harus dimuat ulang per frame.
    const iframeGlobals = iframeWindow as Window & typeof globalThis;
    if (siteFont) void loadSiteFont(doc.fonts, siteFont, SITE_FONT_WEIGHTS, iframeGlobals.FontFace);

    // Tinggi frame = tinggi konten (hug), ED-034. Ditunda ke frame berikutnya: mengubah ukuran iframe
    // langsung di callback memicu "ResizeObserver loop completed with undelivered notifications".
    // ResizeObserver dibuat dari window iframe: observer dari window induk yang mengamati elemen dokumen
    // lain memicu error "loop" tiap frame (realm berbeda, temuan T0.4.6).
    let frame = 0;
    const IframeResizeObserver = iframeGlobals.ResizeObserver;
    const observer = new IframeResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHeight(Math.max(doc.body.scrollHeight, 1)));
    });
    observer.observe(doc.body);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      style.remove();
    };
  }, [siteFont]);

  return (
    <>
      <iframe
        ref={iframeRef}
        title={frame.label}
        className={`bp-frame bp-iframe bp-${frame.breakpoint}`}
        style={{
          position: "absolute",
          left: frame.x,
          top: 0,
          width: frame.width,
          height,
          border: 0,
          pointerEvents: "none",
        }}
      />
      {body && createPortal(children, body)}
    </>
  );
}
