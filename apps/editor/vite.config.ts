import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Editor di-mount di `app.<domain>/editor/*` lewat rewrite Next.js (ARCHITECTURE §5.2).
export default defineConfig({
  base: "/editor/",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
