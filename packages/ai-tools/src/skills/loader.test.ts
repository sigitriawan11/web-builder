import { describe, expect, it } from "vitest";
import { loadSkills, parseFrontmatter } from "./loader";

// T3.13.11 (AI-080): loader skill membaca frontmatter + body.

describe("parseFrontmatter (AI-080)", () => {
  it("parse key/value, array, komentar, snake→camel", () => {
    const { data, body } = parseFrontmatter(
      [
        "---",
        "name: x",
        "version: 1.0.0  # komentar",
        "languages: [id, en]",
        "tokens_estimate: 1800",
        "---",
        "",
        "# Judul",
        "isi",
      ].join("\n"),
    );
    expect(data.name).toBe("x");
    expect(data.version).toBe("1.0.0");
    expect(data.languages).toEqual(["id", "en"]);
    expect(data.tokensEstimate).toBe(1800);
    expect(body).toContain("# Judul");
  });

  it("tanpa frontmatter → error", () => {
    expect(() => parseFrontmatter("# cuma markdown")).toThrow(/frontmatter/);
  });
});

describe("loadSkills (admin, T3.13.11)", () => {
  const skills = loadSkills();

  it("memuat 2 skill admin dengan frontmatter valid", () => {
    const names = skills.map((s) => s.name);
    expect(names).toContain("admin-component-authoring");
    expect(names).toContain("admin-variation-generation");
    for (const skill of skills) {
      expect(skill.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(skill.audience).toBe("admin");
      expect(skill.body.length).toBeGreaterThan(50);
    }
  });

  it("variation-generation depends_on component-authoring", () => {
    const variation = skills.find((s) => s.name === "admin-variation-generation");
    expect(variation?.dependsOn).toContain("admin-component-authoring");
  });
});
