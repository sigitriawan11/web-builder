import { customAlphabet } from "nanoid";

// DM-007: alfabet lowercase alfanumerik agar ID aman sebagai atribut HTML, selector CSS, dan path override.
const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 10;

export const ID_PREFIXES = ["pg", "n", "cmp", "ast", "ix", "tpl", "col"] as const;

export type IdPrefix = (typeof ID_PREFIXES)[number];

// Panjang 6–24 (bukan tepat 10) agar ID seed manusiawi seperti `cmp_navbar0001` tetap valid.
export const ID_PATTERN = /^(pg|n|cmp|ast|ix|tpl|col)_[0-9a-z]{6,24}$/;

const randomPart = customAlphabet(ID_ALPHABET, ID_LENGTH);

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${randomPart()}`;
}
