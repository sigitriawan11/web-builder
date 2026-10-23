import { describe, expect, it } from "vitest";
import { estimateTokens, toOutline } from "./outline";

// T3.13.2 (AI-043/DM-077): outline ringkas + gate token.

const richText = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("toOutline (AI-043)", () => {
  it("outline berindentasi: section → komponen + teks pertama (potong 60 char)", () => {
    const doc = {
      nodes: {
        pg_home: { id: "pg_home", type: "page", name: "Home", children: ["n_sec"] },
        n_sec: { id: "n_sec", type: "frame", name: "Hero", parentId: "pg_home", children: ["n_txt", "n_inst"] },
        n_txt: {
          id: "n_txt",
          type: "text",
          name: "Headline",
          parentId: "n_sec",
          props: { content: richText("A".repeat(100)) },
        },
        n_inst: {
          id: "n_inst",
          type: "instance",
          name: "CTA",
          parentId: "n_sec",
          props: { componentId: "cmp_button01", version: 2 },
        },
      },
    };
    const out = toOutline(doc, "pg_home");
    expect(out).toContain('page "Home"');
    expect(out).toContain('  frame "Hero"');
    expect(out).toContain('    instance "CTA" [cmp_button01@2]');
    // Teks dipotong 60 char.
    const textLine = out.split("\n").find((l) => l.includes("Headline")) ?? "";
    expect(textLine).toContain("—");
    expect(textLine.split("— ")[1]?.length).toBe(60);
  });

  it("page hilang → string kosong", () => {
    expect(toOutline({ nodes: {} }, "pg_x")).toBe("");
  });

  it("DM-077: 1.500 node ≤ 25.000 token (teks hanya di node teks)", () => {
    type N = {
      id: string;
      type: string;
      name: string;
      parentId: string | null;
      children?: string[];
      props?: Record<string, unknown>;
    };
    const children: string[] = [];
    const page: N = { id: "pg_home", type: "page", name: "Home", parentId: null, children };
    const nodes: Record<string, N> = { pg_home: page };
    for (let i = 0; i < 1500; i++) {
      const id = `n_${i.toString().padStart(5, "0")}`;
      children.push(id);
      const isText = i % 3 === 0;
      nodes[id] = {
        id,
        type: isText ? "text" : "frame",
        name: `Node ${i}`,
        parentId: "pg_home",
        // Teks (dipotong 60 char) hanya di node teks — distribusi realistis.
        ...(isText
          ? { props: { content: richText("Teks contoh cukup panjang untuk menguji pemotongan per node.") } }
          : {}),
      };
    }
    const out = toOutline({ nodes }, "pg_home");
    expect(out.split("\n")).toHaveLength(1501);
    expect(estimateTokens(out)).toBeLessThanOrEqual(25000);
  });
});
