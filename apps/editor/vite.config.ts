import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Editor di-mount di `app.<domain>/editor/*` lewat rewrite Next.js (ARCHITECTURE §5.2).
const port = Number(process.env.EDITOR_PORT ?? 5173);

// Proxy rewrite Next dev memakai ulang koneksi keep-alive ke Vite; dengan `keepAliveTimeout` bawaan Node (5 s) Vite
// kadang menutup soket tepat saat proxy memakainya → `ECONNRESET` & modul editor gagal dimuat (flaky e2e/dev).
// Timeout dibuat lebih panjang dari koneksi idle proxy.
const longKeepAlive = (): Plugin => ({
  name: "platform:long-keep-alive",
  configureServer(server) {
    const http = server.httpServer;
    // Dev memakai http/1.1 (tanpa https) → `node:http` Server; http2 tidak punya opsi ini.
    if (!http || !("keepAliveTimeout" in http)) return;
    http.keepAliveTimeout = 65_000;
    http.headersTimeout = 66_000;
  },
});

export default defineConfig({
  base: "/editor/",
  plugins: [react(), tailwindcss(), longKeepAlive()],
  server: {
    port,
    strictPort: true,
    // Rewrite Next.js dev tidak meneruskan upgrade WebSocket → klien HMR tersambung langsung ke port Vite, bukan ke
    // port halaman (app.localhost:3000).
    hmr: { clientPort: port },
  },
});
