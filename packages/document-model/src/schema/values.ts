import { z } from "zod";
import type { IdPrefix } from "../ids";

// DM-007: `prefix_` + 6–24 karakter [0-9a-z]; schema per jenis entitas agar node tidak bisa merujuk asset, dst.
function idSchema(...prefixes: IdPrefix[]) {
  return z.string().regex(new RegExp(`^(${prefixes.join("|")})_[0-9a-z]{6,24}$`));
}

export const NodeIdSchema = idSchema("pg", "n");
export const ComponentIdSchema = idSchema("cmp");
export const TemplateIdSchema = idSchema("tpl");
export const CollectionIdSchema = idSchema("col");
export const InteractionIdSchema = idSchema("ix");
export const PageIdSchema = idSchema("pg");
export const AssetIdSchema = idSchema("ast");

// DM-002: JSON murni — tanpa undefined bermakna, angka finite (bukan NaN/Infinity).
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

// DM-025: referensi token = objek satu key `$token`. Path `<group>.<name>` dengan nested
// maksimal 1 level (DM-041), mis. `color.primary` atau `color.brand.600`.
export const TOKEN_PATH_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9-]+){1,2}$/;
export const TokenRefSchema = z.strictObject({ $token: z.string().regex(TOKEN_PATH_PATTERN) });

// DM-025: referensi prop component — sah HANYA di dalam ComponentDefinition (M3). Dokumen site tidak pernah
// menerimanya karena nilai style/props site memakai `tv()` (literal | token), bukan `cv()`.
export const PropRefSchema = z.strictObject({
  // Key prop camelCase (DM-046).
  $prop: z.string().regex(/^[a-z][a-zA-Z0-9]{0,63}$/),
  fallback: JsonValueSchema.optional(),
  // Prop enum → boolean: `{ $prop: "variant", eq: "outline" }` (dipakai untuk visible di definisi component).
  eq: z.string().optional(),
});

/** V<T>: nilai literal atau referensi token (style, alias theme, mark textStyle). */
export const tv = <T extends z.ZodType>(literal: T) => z.union([literal, TokenRefSchema]);

/** CV<T>: seperti `tv()` ditambah `$prop` — hanya untuk schema ComponentDefinition. */
export const cv = <T extends z.ZodType>(literal: T) => z.union([literal, TokenRefSchema, PropRefSchema]);

export const UnitSchema = z.enum(["px", "%", "vw", "vh", "rem", "em", "fr"]);

// Angka tanpa unit tidak diizinkan untuk panjang (DM-025).
export const LengthSchema = tv(z.strictObject({ value: z.number().finite(), unit: UnitSchema }));

// Warna literal hanya hex agar diff & output AI konsisten (DM-025); `{ $token, alpha }` = token dengan opasitas override.
export const HexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

export const ColorSchema = z.union([
  HexColorSchema,
  TokenRefSchema,
  z.strictObject({ $token: TokenRefSchema.shape.$token, alpha: z.number().min(0).max(1) }),
]);

/** Type guard referensi; berlaku juga untuk `{ $token, alpha }`. */
export function isTokenRef(value: unknown): value is { $token: string } {
  return typeof value === "object" && value !== null && "$token" in value && typeof value.$token === "string";
}

export function isPropRef(value: unknown): value is PropRef {
  return typeof value === "object" && value !== null && "$prop" in value && typeof value.$prop === "string";
}

export type NodeId = z.infer<typeof NodeIdSchema>;
export type ComponentId = z.infer<typeof ComponentIdSchema>;
export type InteractionId = z.infer<typeof InteractionIdSchema>;
export type PageId = z.infer<typeof PageIdSchema>;
export type AssetId = z.infer<typeof AssetIdSchema>;
export type TokenRef = z.infer<typeof TokenRefSchema>;
export type PropRef = z.infer<typeof PropRefSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type LengthValue = z.infer<typeof LengthSchema>;
export type ColorValue = z.infer<typeof ColorSchema>;
