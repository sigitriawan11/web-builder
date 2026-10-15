// 404 global — sengaja STATIS: not-found dinamis membuat semua route (termasuk marketing SSG/ISR, ARCHITECTURE §5.1)
// ikut dinamis. Konsekuensi: di host `app.` (CSP nonce, PUB-211) 404 tampil tanpa hidrasi → halaman ini harus
// berfungsi tanpa JS. Tampilan & string i18n di T1.14.9.
export default function NotFound() {
  return <main />;
}
