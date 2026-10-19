import { useEffect } from "react";
import { useStore } from "zustand";
import { brandIconsStore } from "./brand-icons";

// ED-163: render logo merek (Simple Icons) sebagai inline SVG, warna `currentColor` (ikut style.color node). Data
// dimuat lazy; sebelum siap → kosong (placeholder), lalu re-render saat termuat (store reaktif).
export function BrandIcon({ slug }: { slug: string }) {
  const entries = useStore(brandIconsStore, (state) => state.entries);
  useEffect(() => brandIconsStore.getState().load(), []);
  const icon = entries.get(slug);
  if (!icon) return null;
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" role="img" aria-label={icon.title}>
      <path d={icon.path} />
    </svg>
  );
}
