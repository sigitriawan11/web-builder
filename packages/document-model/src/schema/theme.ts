import { z } from "zod";
import { ShadowSchema, TypographyStyleSchema } from "./style";
import { AssetIdSchema, HexColorSchema, TokenRefSchema, UnitSchema } from "./values";

// Theme (DM-041). Nilai token = literal sesuai grup | alias `{ $token }` (DM-042) | token responsif
// `{ value, tablet?, mobile?, dark?, description? }`. Alias & siklus diperiksa di `checkThemeTokens` (SiteDocument).

// Nama token dalam grup: `[a-zA-Z0-9-]+` (DM-041).
const TokenNameSchema = z.string().regex(/^[a-zA-Z0-9-]+$/);

// Literal token panjang selalu `{ value, unit }` (tanpa token di dalamnya; alias dipakai di level token).
const LengthLiteralSchema = z.strictObject({ value: z.number().finite(), unit: UnitSchema });

function tokenValue<T extends z.ZodType>(literal: T) {
  const literalOrAlias = z.union([literal, TokenRefSchema]);
  return z.union([
    literalOrAlias,
    // Token responsif: dipakai rule scaleType/scaleSpacing & CSS variable yang di-override di media query.
    z.strictObject({
      value: literalOrAlias,
      tablet: literal.optional(),
      mobile: literal.optional(),
      dark: literalOrAlias.optional(),
      description: z.string().max(200).optional(),
    }),
  ]);
}

// Grup boleh bersarang satu tingkat (`color.brand.600`, DM-041).
function tokenGroup<T extends z.ZodType>(literal: T) {
  const value = tokenValue(literal);
  return z.record(TokenNameSchema, z.union([value, z.record(TokenNameSchema, value)]));
}

export const TOKEN_LITERAL_SCHEMAS = {
  color: HexColorSchema,
  typography: TypographyStyleSchema,
  fontFamily: z.string().min(1).max(100),
  space: LengthLiteralSchema,
  radius: LengthLiteralSchema,
  shadow: z.array(ShadowSchema).min(1).max(6),
  size: LengthLiteralSchema,
} as const;

export const ThemeTokensSchema = z.strictObject({
  color: tokenGroup(TOKEN_LITERAL_SCHEMAS.color),
  typography: tokenGroup(TOKEN_LITERAL_SCHEMAS.typography),
  fontFamily: tokenGroup(TOKEN_LITERAL_SCHEMAS.fontFamily),
  space: tokenGroup(TOKEN_LITERAL_SCHEMAS.space),
  radius: tokenGroup(TOKEN_LITERAL_SCHEMAS.radius),
  shadow: tokenGroup(TOKEN_LITERAL_SCHEMAS.shadow),
  size: tokenGroup(TOKEN_LITERAL_SCHEMAS.size).optional(),
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
export type TokenGroup = (typeof TOKEN_GROUPS)[number];

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type FontDef = z.infer<typeof FontDefSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
