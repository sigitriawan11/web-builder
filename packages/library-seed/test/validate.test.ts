import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { formatSeedIssues, SEED_DATA_DIR, SEED_JSON_SCHEMAS, seedJsonSchema, validateSeedLibrary } from "../src";

// T1.11.3 / CMP-143: validasi Zod seluruh seed — seed invalid gagal, error menyertakan path file + JSON path.
const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const BUTTON = JSON.parse(
  readFileSync(join(SEED_DATA_DIR, "components/elements/button-primary.component.json"), "utf8"),
) as Record<string, unknown> & { meta: Record<string, unknown>; versions: Record<string, unknown>[] };

/** Salinan `data/` di direktori sementara dengan file component tambahan. */
function libraryWith(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "library-seed-"));
  temps.push(dir);
  cpSync(SEED_DATA_DIR, dir, { recursive: true });
  for (const [path, json] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), JSON.stringify(json));
  }
  return dir;
}

const seed = (overrides: Record<string, unknown>) => ({ ...structuredClone(BUTTON), ...overrides });
const issuesOf = (files: Record<string, unknown>) =>
  validateSeedLibrary(libraryWith(files)).issues.map((issue) => `${issue.file}: ${issue.path} — ${issue.message}`);

describe("library seed di repo", () => {
  it("semua file valid (gerbang CI, AC CMP-140)", () => {
    const report = validateSeedLibrary();
    expect(report.issues, formatSeedIssues(report.issues)).toEqual([]);
    expect(report.components.length).toBeGreaterThanOrEqual(1);
  });

  it.each(Object.entries(SEED_JSON_SCHEMAS))("JSON Schema %s sinkron dengan Zod", async (name, schema) => {
    await expect(seedJsonSchema(schema)).toMatchFileSnapshot(`../schema/${name}`);
  });
});

describe("seed invalid gagal dengan path file + JSON path (AC CMP-143)", () => {
  const file = "components/elements/button-x.component.json";
  const base = { id: "cmp_buttonxxxx", slug: "button-x", meta: { ...BUTTON.meta, name: "ButtonX" } };

  it("error skema: JSON path ber-indeks", () => {
    const issues = issuesOf({
      [file]: seed({ ...base, meta: { ...base.meta, tags: ["button"], keywords: { id: [] } } }),
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^components\/elements\/button-x\.component\.json: meta\.tags — /),
        expect.stringMatching(/meta\.keywords\.en — /),
      ]),
    );
  });

  it("kategori/industri tidak ada, nama file ≠ slug", () => {
    const issues = issuesOf({
      "components/elements/salah-nama.component.json": seed({
        ...base,
        categorySlug: "tidak-ada",
        meta: { ...base.meta, industries: ["kuliner", "antah-berantah"] },
      }),
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/: categorySlug — kategori component "tidak-ada"/),
        expect.stringMatching(/: meta\.industries\[1\] — industri "antah-berantah"/),
        expect.stringMatching(/: slug — nama file harus "button-x\.component\.json"/),
      ]),
    );
    expect(issues.join("\n")).not.toMatch(/industries\[0\]/);
  });

  it("versi tidak naik/unik & draft bukan terakhir", () => {
    const [v1] = BUTTON.versions;
    const issues = issuesOf({
      [file]: seed({
        ...base,
        versions: [
          { ...v1, status: "draft" },
          { ...v1, version: "1.0.0" },
          { ...v1, version: "0.9.0" },
        ],
      }),
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/versions\[1\]\.version — versi 1\.0\.0 harus lebih besar/),
        expect.stringMatching(/versions\[2\]\.version — versi 0\.9\.0/),
        expect.stringMatching(/versions\[0\]\.status — draft hanya boleh versi terakhir/),
      ]),
    );
  });

  it("subtree tidak valid (dry-run insertSubtree), root section tidak fill, asset tanpa manifest", () => {
    const [v1] = structuredClone(BUTTON.versions) as {
      definition: { subtree: { nodes: Record<string, Record<string, unknown>> } };
    }[];
    if (!v1) throw new Error("fixture berubah");
    v1.definition.subtree.nodes.tmp_label = { ...v1.definition.subtree.nodes.tmp_label, tag: "div" };
    const invalidNode = issuesOf({ [file]: seed({ ...base, versions: [v1] }) });
    expect(invalidNode).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/versions\[0\]\.definition\.subtree\.nodes\.tmp_label.* — Node "tmp_label" tidak valid/),
      ]),
    );

    const [section] = structuredClone(BUTTON.versions) as (typeof v1)[];
    if (!section) throw new Error("fixture berubah");
    section.definition.subtree.nodes.tmp_image = {
      type: "image",
      name: "Foto",
      parentId: "tmp_button",
      visible: true,
      locked: false,
      style: { base: { size: { width: { mode: "fill" }, height: { mode: "fixed", value: 200, unit: "px" } } } },
      props: { image: { assetId: "ast_tidakada001" }, fit: "cover" },
    };
    (section.definition.subtree.nodes.tmp_button as { children: string[] }).children.push("tmp_image");
    const issues = issuesOf({ [file]: seed({ ...base, kind: "section", versions: [section] }) });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/nodes\.tmp_button\.style\.base\.size\.width — root section wajib width fill/),
        expect.stringMatching(
          /nodes\.tmp_image\.props\.image\.assetId — asset "ast_tidakada001" tidak ada di assets\.manifest\.json/,
        ),
      ]),
    );
  });

  it("id/slug/name duplikat antar file; semua error dilaporkan sekaligus", () => {
    const issues = issuesOf({
      "components/elements/button-primary-copy.component.json": seed({ slug: "button-primary-copy" }),
      [file]: seed({ ...base, categorySlug: "tidak-ada", meta: { ...base.meta, tags: [] } }),
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        // File diproses urut path: salah satu dari pasangan dilaporkan sebagai duplikat yang lain.
        expect.stringMatching(
          /button-primary(-copy)?\.component\.json: id — id "cmp_buttonprimary" sudah dipakai .*button-primary/,
        ),
        expect.stringMatching(
          /button-primary(-copy)?\.component\.json: meta\.name — name "ButtonPrimary" sudah dipakai/,
        ),
        expect.stringMatching(/button-x\.component\.json: meta\.tags — /),
      ]),
    );
  });
});
