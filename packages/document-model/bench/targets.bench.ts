import { test } from "vitest";
import * as Y from "yjs";
import {
  createStyleResolver,
  jsonToYDoc,
  loadDocument,
  resolveStyle,
  runCommand,
  type SiteDocument,
  SiteDocumentSchema,
  updateStyle,
  userOrigin,
  validateDocument,
  yDocToJson,
  yNodeToJson,
} from "../src";
import { generateLandingDocument } from "../test/fixtures";

// T1.9.12 / DM-077: target performa M1. Tabel "target vs median" dicetak di awal (WSL2 = indikatif; angka resmi di
// laptop referensi T0.7.4), lalu Vitest bench untuk latensi detail. Jalankan: `pnpm --filter @platform/document-model bench`.

const NODE_COUNT = 5000;
const doc: SiteDocument = generateLandingDocument({ nodeCount: NODE_COUNT });
const origin = userOrigin("bench");

function median(run: () => void, rounds = 15): number {
  for (let i = 0; i < 3; i++) run();
  const times: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] ?? Number.NaN;
}

// Node frame di tengah dokumen (bukan page) untuk aksi "drag slider" (DM-077: resolveStyle + render ulang < 16 ms).
const targetId =
  Object.values(doc.nodes).filter((node) => node.type === "frame" && node.parentId !== null)[100]?.id ?? "";
const state = Y.encodeStateAsUpdate(jsonToYDoc(doc));

function updateAndResolve(ydoc: Y.Doc, gap: number): void {
  const result = runCommand({ doc: ydoc, origin }, updateStyle, {
    ids: [targetId],
    patch: { layout: { gap: { value: gap, unit: "px" } } },
  });
  if (!result.ok) throw new Error(result.error.message.id);
  const yNode = ydoc.getMap<Y.Map<unknown>>("nodes").get(targetId);
  const node = yNode ? (yNodeToJson(yNode) as SiteDocument["nodes"][string]) : undefined;
  if (node) for (const bp of ["base", "tablet", "mobile"] as const) resolveStyle(node.style, bp);
}

type Row = { "target ms": number; "median ms": number; status: string };
function row(target: number, measured: number): Row {
  return {
    "target ms": target,
    "median ms": Math.round(measured * 10) / 10,
    status: measured <= target ? "OK" : "LEBIH",
  };
}

const sliderDoc = jsonToYDoc(doc);
let gap = 0;
const nextGap = () => {
  gap = (gap + 1) % 64;
  return gap;
};
console.log(`\nTarget DM-077 / DM-068 / DM-061 (dokumen landing ${NODE_COUNT} node):`);
console.table({
  "updateStyle + resolveStyle 1 node (drag slider)": row(
    16,
    median(() => updateAndResolve(sliderDoc, nextGap()), 60),
  ),
  "validateDocument publish": row(
    100,
    median(() => validateDocument(doc, { mode: "publish" })),
  ),
  "loadDocument (snapshot state)": row(
    500,
    median(() => loadDocument(state, []).destroy(), 7),
  ),
  "round-trip Yjs (jsonToYDoc → yDocToJson)": row(
    500,
    median(() => yDocToJson(jsonToYDoc(doc)), 7),
  ),
});
console.log("Belum diukur (fiturnya belum ada): resolve 200 instance (M3), compile site 10 page (renderer T1.10).\n");

test(`${NODE_COUNT} node — target DM-077`, async ({ bench }) => {
  const resolver = createStyleResolver();
  const node = doc.nodes[targetId];
  let revision = 0;
  const ydoc = jsonToYDoc(doc);
  await bench.compare(
    bench("validateDocument edit", () => {
      validateDocument(doc, { mode: "edit" });
    }),
    bench("validateDocument publish", () => {
      validateDocument(doc, { mode: "publish" });
    }),
    bench("SiteDocumentSchema.parse", () => {
      SiteDocumentSchema.parse(doc);
    }),
    bench("round-trip Yjs", () => {
      yDocToJson(jsonToYDoc(doc));
    }),
    bench("loadDocument", () => {
      loadDocument(state, []).destroy();
    }),
    bench("updateStyle + resolveStyle (1 node)", () => {
      updateAndResolve(ydoc, nextGap());
    }),
    bench("resolveStyle tanpa memo (3 breakpoint)", () => {
      if (node) for (const bp of ["base", "tablet", "mobile"] as const) resolveStyle(node.style, bp);
    }),
    bench("createStyleResolver memo hit", () => {
      if (node) resolver(targetId, node.style, "mobile", revision);
    }),
    bench("createStyleResolver memo miss", () => {
      revision++;
      if (node) resolver(targetId, node.style, "mobile", revision);
    }),
  );
  // 9 bench × ~1 s pada dokumen 5.000 node.
}, 180_000);

test.todo("resolve 200 instance (DM-077) — menunggu instance/component (M3)");
test.todo("compile site 10 page (DM-077) — menunggu renderer compileSite (T1.10)");
