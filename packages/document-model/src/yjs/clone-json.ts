// Yjs menyimpan nilai JSON per referensi; tanpa salinan, mengubah objek di luar diam-diam mengubah isi Y.Doc.
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
