// Kait pengukuran untuk test & benchmark (ED-018, T0.7.3): dipanggil setiap kali NodeView render.
// `null` di aplikasi normal sehingga biayanya hanya satu pengecekan.
export const renderProbe: { onNodeRender: ((id: string) => void) | null } = { onNodeRender: null };
