import { jsonToYDoc } from "@platform/document-model";
import { heroDocument, landing200 } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { NodeStore } from "./node-store";
import { countPageNodes } from "./use-page-node-count";

describe("countPageNodes", () => {
  it("menghitung seluruh subtree page termasuk page", () => {
    const fixture = landing200();
    const store = new NodeStore(jsonToYDoc(fixture));
    expect(countPageNodes(store, fixture.pageOrder[0] ?? "")).toBe(200);
  });

  it("hanya page yang diminta (node page lain tidak dihitung)", () => {
    const fixture = heroDocument();
    const store = new NodeStore(jsonToYDoc(fixture));
    const [home, ...others] = fixture.pageOrder;
    const total = Object.keys(fixture.nodes).length;
    const homeCount = countPageNodes(store, home ?? "");
    expect(homeCount).toBeLessThanOrEqual(total);
    expect(homeCount + others.reduce((sum, id) => sum + countPageNodes(store, id), 0)).toBe(total);
  });
});
