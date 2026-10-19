import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  componentKindEnum,
  components,
  componentVersions,
  libraryCategories,
  libraryOwnerTypeEnum,
  libraryStatusEnum,
  siteComponentUsage,
  themeModeEnum,
  themes,
  usageDocStateEnum,
  versionBumpEnum,
} from "./library";

// Schema-shape test (tanpa DB); trigger immutable & relasi diuji di integration (apps/api, CMP-152).
describe("schema library (CMP-150/151/152)", () => {
  it("enum sesuai spec", () => {
    expect(componentKindEnum.enumValues).toEqual(["element", "block", "section", "page", "layout"]);
    expect(libraryOwnerTypeEnum.enumValues).toEqual(["platform", "user", "vendor"]);
    expect(libraryStatusEnum.enumValues).toEqual(["draft", "in_review", "published", "deprecated", "archived"]);
    expect(versionBumpEnum.enumValues).toEqual(["major", "minor", "patch"]);
  });

  it("library_categories: slug unik, scope/type/name wajib, parent self-FK", () => {
    const cols = getTableColumns(libraryCategories);
    expect(cols.slug.isUnique).toBe(true);
    expect(cols.scope.notNull).toBe(true);
    expect(cols.type.notNull).toBe(true);
    expect(cols.name.notNull).toBe(true);
    expect(cols.sortOrder.hasDefault).toBe(true);
  });

  it("components: owner/kind/category wajib; min_plan nullable (O-1 gating disiapkan); pointer versi non-FK", () => {
    const cols = getTableColumns(components);
    expect(cols.ownerType.notNull).toBe(true);
    expect(cols.kind.notNull).toBe(true);
    expect(cols.categoryId.notNull).toBe(true);
    // Kolom gating & kepemilikan disiapkan sejak M3 (CMP-004/P-7).
    expect(cols.minPlan.notNull).toBe(false);
    expect(cols.ownerId.notNull).toBe(false);
    expect(cols.status.hasDefault).toBe(true);
    expect(cols.usageSiteCount.hasDefault).toBe(true);
  });

  it("component_versions: definition wajib; version/version_seq nullable (draft); yanked default false", () => {
    const cols = getTableColumns(componentVersions);
    expect(cols.componentId.notNull).toBe(true);
    expect(cols.definition.notNull).toBe(true);
    expect(cols.version.notNull).toBe(false);
    expect(cols.versionSeq.notNull).toBe(false);
    expect(cols.yanked.hasDefault).toBe(true);
    expect(cols.status.hasDefault).toBe(true);
  });

  it("themes (CMP-155): tokens/displayName wajib, mode light|dark, version default 1", () => {
    expect(themeModeEnum.enumValues).toEqual(["light", "dark"]);
    const cols = getTableColumns(themes);
    expect(cols.tokens.notNull).toBe(true);
    expect(cols.displayName.notNull).toBe(true);
    expect(cols.version.hasDefault).toBe(true);
  });

  it("site_component_usage (CMP-156): doc_state draft|published, version/docState wajib", () => {
    expect(usageDocStateEnum.enumValues).toEqual(["draft", "published"]);
    const cols = getTableColumns(siteComponentUsage);
    expect(cols.siteId.notNull).toBe(true);
    expect(cols.componentId.notNull).toBe(true);
    expect(cols.version.notNull).toBe(true);
    expect(cols.docState.notNull).toBe(true);
    expect(cols.instanceCount.hasDefault).toBe(true);
  });
});
