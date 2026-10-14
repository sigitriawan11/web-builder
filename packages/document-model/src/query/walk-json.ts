// Penelusuran JSON dokumen untuk pencarian rujukan generik (asset, token, link, font). Path disimpan di satu stack
// yang dimutasi dan hanya disalin saat ditemukan — alokasi array per level membuat validasi 5.000 node melambat.

export type JsonPath = (string | number)[];

/**
 * Kunjungi setiap objek (bukan array) di `value`. `visit` menerima objek & fungsi penyalin path; kembalikan `true`
 * untuk tidak menelusuri isi objek itu (rujukan sudah ditemukan).
 */
export function walkJsonObjects(
  value: unknown,
  basePath: JsonPath,
  visit: (object: Record<string, unknown>, path: () => JsonPath) => unknown,
): void {
  const path: JsonPath = [...basePath];
  const copy = () => [...path];
  const step = (current: unknown): void => {
    if (current === null || typeof current !== "object") return;
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index++) {
        path.push(index);
        step(current[index]);
        path.pop();
      }
      return;
    }
    const object = current as Record<string, unknown>;
    if (visit(object, copy) === true) return;
    for (const key in object) {
      const child = object[key];
      if (child === null || typeof child !== "object") continue;
      path.push(key);
      step(child);
      path.pop();
    }
  };
  step(value);
}
