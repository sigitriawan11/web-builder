import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { defaultTheme } from "../defaults/theme";
import type { Theme } from "../schema";
import { validateDocument } from "../validate/validate-document";
import { runCommand } from "./command";
import { applyThemePreset } from "./theme";

// Preset = theme default dengan beberapa token diganti/dihapus.
function preset(mutate: (theme: Theme) => void): Theme {
  const theme = structuredClone(defaultTheme());
  mutate(theme);
  return theme;
}
const colorOf = (theme: Theme, name: string) => (theme.tokens.color as Record<string, unknown>)[name];

describe("applyThemePreset (DM-044)", () => {
  it("mengganti token preset; tanpa TOKEN_REF; node tak disentuh", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const before = structuredClone(read().nodes);
    const p = preset((theme) => {
      (theme.tokens.color as Record<string, unknown>).primary = "#FF0000";
    });
    expect(runCommand(ctx, applyThemePreset, { preset: p }).ok).toBe(true);
    const doc = read();
    expect(colorOf(doc.theme, "primary")).toBe("#FF0000");
    expect(doc.nodes).toEqual(before); // node tidak disentuh
    expect(validateDocument(doc, { mode: "publish" }).errors.map((i) => i.code)).not.toContain("TOKEN_REF");
  });

  it("token yang hilang di preset diisi dari tema lama (tanpa rujukan patah)", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const kept = colorOf(defaultTheme(), "accent");
    const p = preset((theme) => {
      delete (theme.tokens.color as Record<string, unknown>).accent;
    });
    expect(runCommand(ctx, applyThemePreset, { preset: p }).ok).toBe(true);
    expect(colorOf(read().theme, "accent")).toEqual(kept);
    expect(validateDocument(read(), { mode: "publish" }).errors.map((i) => i.code)).not.toContain("TOKEN_REF");
  });

  it("keep: grup color dipertahankan dari tema lama (preset diabaikan untuk grup itu)", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const original = colorOf(read().theme, "primary");
    const p = preset((theme) => {
      (theme.tokens.color as Record<string, unknown>).primary = "#00FF00";
      (theme.tokens.space as Record<string, unknown>)["6"] = { value: 99, unit: "px" };
    });
    expect(runCommand(ctx, applyThemePreset, { preset: p, keep: ["color"] }).ok).toBe(true);
    const doc = read();
    expect(colorOf(doc.theme, "primary")).toEqual(original); // color dipertahankan
    expect((doc.theme.tokens.space as Record<string, unknown>)["6"]).toEqual({ value: 99, unit: "px" }); // space diganti
  });
});
