import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// AI-080: skill = Markdown `skills/<name>/SKILL.md` + frontmatter YAML (subset). Loader membaca frontmatter + body,
// validasi Zod. Dipakai worker untuk menyusun skills index (prompt) + `read_skill`.

const SKILLS_DIR = fileURLToPath(new URL("../../skills/", import.meta.url));

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "name kebab-case"),
  description: z.string().min(1).max(500),
  whenToUse: z.string().min(1).max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver"),
  audience: z.enum(["user", "admin"]),
  entitlement: z.array(z.string()).optional(),
  languages: z.array(z.string()).min(1),
  dependsOn: z.array(z.string()).optional(),
  tokensEstimate: z.number().int().positive().optional(),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface Skill extends SkillFrontmatter {
  body: string;
}

// snake_case frontmatter → camelCase field schema.
const KEY_MAP: Record<string, string> = {
  when_to_use: "whenToUse",
  depends_on: "dependsOn",
  tokens_estimate: "tokensEstimate",
};

/** Parser frontmatter minimal (bukan YAML penuh): `key: value`, array `[a, b]`, komentar `# …`. */
export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("SKILL.md tanpa frontmatter");
  const data: Record<string, unknown> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const rawKey = line.slice(0, idx).trim();
    const key = KEY_MAP[rawKey] ?? rawKey;
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/\s+#.*$/, "");
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    } else if (/^\d+$/.test(value)) {
      data[key] = Number(value);
    } else {
      data[key] = value;
    }
  }
  return { data, body: (match[2] ?? "").trim() };
}

/** Muat satu skill (SKILL.md) dari folder. */
export function loadSkill(dir: string): Skill {
  const raw = readFileSync(join(dir, "SKILL.md"), "utf8");
  const { data, body } = parseFrontmatter(raw);
  const frontmatter = SkillFrontmatterSchema.parse(data);
  return { ...frontmatter, body };
}

/** Muat semua skill di `skills/` (deterministik, urut nama). */
export function loadSkills(dir = SKILLS_DIR): Skill[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadSkill(join(dir, entry.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
