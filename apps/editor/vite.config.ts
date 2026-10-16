import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Editor di-mount di `app.<domain>/editor/*` lewat rewrite Next.js (ARCHITECTURE §5.2).
const port = Number(process.env.EDITOR_PORT ?? 5173);

export default defineConfig({
  base: "/editor/",
  plugins: [react(), tailwindcss()],
  server: {
    port,
    strictPort: true,
    // Rewrite Next.js dev tidak meneruskan upgrade WebSocket → klien HMR tersambung langsung ke port Vite, bukan ke
    // port halaman (app.localhost:3000).
    hmr: { clientPort: port },
  },
});
