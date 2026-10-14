import { z } from "zod";

// `SiteSettings` (DM-005) — kerangka top-level T1.8.1; field P0 (bahasa, SEO default, favicon, breakpoints,
// manualResponsive, autoResponsive) ditambah di T1.8.2.
export const SiteSettingsSchema = z.strictObject({});

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;
