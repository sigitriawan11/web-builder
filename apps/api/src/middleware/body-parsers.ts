import express, { type Router } from "express";

// Middleware 5 (ARCHITECTURE §5.3). Urutan penting: parser raw dipasang lebih dulu; body-parser melewati request
// yang body-nya sudah diproses, jadi `express.json` tidak menimpa raw body webhook.
export const JSON_LIMIT = "1mb";
// Update/state Yjs biner: batas state dokumen 16 MB (DM-076).
export const BINARY_LIMIT = "16mb";

export function bodyParsers(): Router {
  const router = express.Router();
  // Webhook: verifikasi signature butuh byte asli, apa pun content-type-nya.
  router.use("/webhooks", express.raw({ type: () => true, limit: JSON_LIMIT }));
  router.use(express.raw({ type: "application/octet-stream", limit: BINARY_LIMIT }));
  router.use(express.json({ limit: JSON_LIMIT }));
  return router;
}
