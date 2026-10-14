import { z } from "zod";
import { AssetIdSchema, JsonValueSchema } from "./values";

// Theme (DM-041) — kerangka top-level T1.8.1. Bentuk nilai token (`TokenValue`: literal | alias `$token` | responsif)
// dan `defaultTheme` dikencangkan di T1.8.12; sementara nilai token = JSON murni.

// Nama token dalam grup: `[a-zA-Z0-9-]+` (DM-041).
const TokenNameSchema = z.string().regex(/^[a-zA-Z0-9-]+$/);
const TokenGroupSchema = z.record(TokenNameSchema, JsonValueSchema);

export const ThemeTokensSchema = z.strictObject({
  color: TokenGroupSchema,
  typography: TokenGroupSchema,
  fontFamily: TokenGroupSchema,
  space: TokenGroupSchema,
  radius: TokenGroupSchema,
  shadow: TokenGroupSchema,
  size: TokenGroupSchema.optional(),
});

export const FontDefSchema = z.strictObject({
  family: z.string().min(1).max(100),
  source: z.enum(["google", "fontsource", "upload"]),
  weights: z.array(z.number().int().min(100).max(900).multipleOf(100)).min(1),
  italic: z.boolean().optional(),
  assetId: AssetIdSchema.optional(),
  fallback: z.enum(["sans-serif", "serif", "monospace"]),
});

export const ThemeSchema = z.strictObject({
  tokens: ThemeTokensSchema,
  fonts: z.array(FontDefSchema),
  // P2 (❓ OPEN-DM-6 dark mode pengunjung).
  modes: z
    .strictObject({ default: z.literal("light"), available: z.array(z.enum(["light", "dark"])).min(1) })
    .optional(),
});

export const TOKEN_GROUPS = ["color", "typography", "fontFamily", "space", "radius", "shadow", "size"] as const;

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type FontDef = z.infer<typeof FontDefSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
