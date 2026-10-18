import { useCallback, useEffect, useRef } from "react";

// ED-021 Level 1: breakpoint frame yang sepenuhnya di luar viewport (+ ~1 layar margin) mendapat
// `content-visibility: hidden` + `contain-intrinsic-size` dari ukuran terakhir → browser melewati render/layout-nya
// (hemat saat beberapa breakpoint frame berdampingan, AC "3 breakpoint frame"). IntersectionObserver independen dari
// render React, jadi culling mengikuti pan/zoom (transform kamera) tanpa re-render. Frame aktif (diukur geometry)
// umumnya terlihat → tidak ter-cull; frame non-aktif tak punya geometry sehingga aman di-skip.
export function useFrameCulling(): (element: HTMLElement | null) => void {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const viewport = document.getElementById("editor-viewport");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            el.style.contentVisibility = "";
            el.style.containIntrinsicSize = "";
          } else {
            // Baca ukuran layout SEBELUM menyembunyikan (setelah hidden → ukuran jadi intrinsik).
            el.style.containIntrinsicSize = `${el.offsetWidth}px ${el.offsetHeight}px`;
            el.style.contentVisibility = "hidden";
          }
        }
      },
      // root = viewport canvas; margin 1 layar agar frame dirender sedikit sebelum masuk.
      { root: viewport, rootMargin: "100%" },
    );
    observerRef.current = observer;
    return () => observer.disconnect();
  }, []);

  return useCallback((element: HTMLElement | null) => {
    if (element) observerRef.current?.observe(element);
  }, []);
}
