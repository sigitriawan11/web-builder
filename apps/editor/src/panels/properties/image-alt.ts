// ED-210: gambar yang bukan dekoratif WAJIB punya alt text (teks alternatif). Dipakai badge peringatan inspector &
// (nanti) checklist pra-publish. Murni agar bisa diuji.
export function needsAltWarning(alt: string | undefined, decorative: boolean | undefined): boolean {
  if (decorative) return false;
  return (alt ?? "").trim().length === 0;
}
