import { describe, expect, it } from "vitest";
import { instanceChildPath } from "./instance-child-hit";

// ED-058/T3.6.3: parsing path override dari id resolved.
describe("instanceChildPath", () => {
  it("instance satu tingkat → ID node definisi", () => {
    expect(instanceChildPath("n_inst0001:n_btnlabel", "n_inst0001")).toBe("n_btnlabel");
  });
  it("bukan milik instance ini → null", () => {
    expect(instanceChildPath("n_other0001:n_btnlabel", "n_inst0001")).toBeNull();
  });
  it("nested instance (mengandung `:`) → null (M4)", () => {
    expect(instanceChildPath("n_inst0001:n_card:n_label", "n_inst0001")).toBeNull();
  });
  it("item repeater (`:i<idx>`) → null (M4)", () => {
    expect(instanceChildPath("n_inst0001:n_item:i2", "n_inst0001")).toBeNull();
  });
  it("prefix tanpa path → null", () => {
    expect(instanceChildPath("n_inst0001:", "n_inst0001")).toBeNull();
  });
});
