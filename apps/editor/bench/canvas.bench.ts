import { type Browser, expect, type Page, test } from "@playwright/test";

// T0.7.3 / ED-022: harness benchmark canvas yang mengisi tabel §M0.e ROADMAP sekaligus.
// Tiap skenario merekam jarak antar requestAnimationFrame + `performance.measure` (terlihat di trace Chrome).
// Variabel lingkungan:
//   BENCH_VARIANTS=shadow,prefix,class,iframe   kolom yang dijalankan (default semua)
//   BENCH_DURATION_MS=3000                      lama tiap pengukuran gerak
//   BENCH_RAW=1                                 cetak juga data mentah JSON (T0.7.4: `| tee bench/results/<nama>.md`)
//   BENCH_TRACE=1                               simpan trace Chrome per skenario ke bench/results/traces/
// Angka headless WSL2 tanpa GPU = indikatif; pengukuran resmi di laptop referensi (T0.7.4).

const VARIANTS = [
  { key: "shadow", label: "Shadow DOM", query: "isolation=shadow", interactive: true },
  { key: "prefix", label: "Prefix", query: "isolation=prefix", interactive: true },
  // Breakpoint frame (3 frame); interaksi mouse hanya di-bench pada kolom isolasi.
  { key: "class", label: "Non-iframe", query: "frames=all&bpMode=class", interactive: false },
  { key: "iframe", label: "Iframe", query: "frames=all&bpMode=iframe", interactive: false },
] as const;
type Variant = (typeof VARIANTS)[number];

const SCENARIOS = [
  { key: "panZoom200", label: "Pan/zoom 200 node", target: "60 fps" },
  { key: "drag200", label: "Drag move 200 node", target: "60 fps" },
  { key: "reorder200", label: "Reorder auto-layout 200 node", target: "≥ 50 fps" },
  { key: "resize100", label: "Resize frame 100 child", target: "≥ 45 fps" },
  { key: "clickSelect", label: "Klik → seleksi", target: "< 50 ms" },
  { key: "pan2000", label: "Pan 2.000 node (baseline)", target: "≥ 30 fps" },
] as const;
type ScenarioKey = (typeof SCENARIOS)[number]["key"];

const DURATION_MS = Number(process.env.BENCH_DURATION_MS ?? 3000);
const SELECTED = (process.env.BENCH_VARIANTS ?? "").split(",").filter(Boolean);
const ACTIVE = VARIANTS.filter((variant) => SELECTED.length === 0 || SELECTED.includes(variant.key));
// Relatif terhadap cwd Playwright (apps/editor).
const TRACE_DIR = "bench/results/traces";
const PAGE_ID = "pg_bench00001";

type FrameStats = { fps: number; p95Ms: number; longFrames: number; frames: number };
type LatencyStats = { p50Ms: number; p95Ms: number; maxMs: number; samples: number };
type Measurement = { kind: "frames"; motion: string; stats: FrameStats } | { kind: "latency"; stats: LatencyStats };

// Info mesin dari browser (tanpa API Node); diisi saat halaman pertama dibuka.
let machine: { userAgent: string; cores: number; memoryGb: number | null } | null = null;

const results = new Map<ScenarioKey, Map<Variant["key"], Measurement[]>>();
function record(scenario: ScenarioKey, variant: Variant, measurement: Measurement) {
  const byVariant = results.get(scenario) ?? new Map<Variant["key"], Measurement[]>();
  byVariant.set(variant.key, [...(byVariant.get(variant.key) ?? []), measurement]);
  results.set(scenario, byVariant);
}

const round = (value: number) => Math.round(value * 10) / 10;
const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

function frameStats(deltas: number[]): FrameStats {
  const sorted = [...deltas].sort((a, b) => a - b);
  const total = deltas.reduce((sum, delta) => sum + delta, 0);
  return {
    fps: round((deltas.length / total) * 1000),
    p95Ms: round(percentile(sorted, 0.95)),
    longFrames: deltas.filter((delta) => delta > 50).length,
    frames: deltas.length,
  };
}

function latencyStats(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50Ms: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted.at(-1) ?? 0),
    samples: samples.length,
  };
}

type BenchWindow = {
  __bench: { deltas: number[]; recording: boolean; label: string; probe: string | null; probeHits: number };
  __spike: {
    camera: {
      getState(): {
        x: number;
        y: number;
        zoom: number;
        setCamera(next: { x?: number; y?: number; zoom?: number }): void;
      };
    };
    selection: {
      getState(): { selectedIds: readonly string[]; select(ids: string[]): void };
      subscribe(listener: () => void): () => void;
    };
    run(op: unknown, input: unknown): { ok: true; value: string } | { ok: false; error: { message: string } };
    ops: { createNode: unknown };
    doc: {
      getMap(name: string): {
        get(id: string): { toJSON(): Record<string, unknown> } | undefined;
        entries(): IterableIterator<[string, { toJSON(): Record<string, unknown> }]>;
      };
    };
  };
};

// Mulai/berhenti merekam jarak antar frame di halaman; label menjadi `performance.measure` di trace.
// `probe`: selector yang dihitung kemunculannya per frame (bukti interaksi benar-benar terjadi).
async function startFrames(page: Page, label: string, probe: string | null = null) {
  await page.evaluate(
    ({ name, probe }) => {
      const w = window as unknown as BenchWindow;
      w.__bench = { deltas: [], recording: true, label: name, probe, probeHits: 0 };
      performance.mark(`${name}:start`);
      let last = performance.now();
      const tick = (now: number) => {
        w.__bench.deltas.push(now - last);
        last = now;
        if (w.__bench.probe && document.querySelector(w.__bench.probe)) w.__bench.probeHits++;
        if (w.__bench.recording) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { name: label, probe },
  );
}

async function stopFrames(page: Page): Promise<FrameStats & { probeHits: number }> {
  const { deltas, probeHits } = await page.evaluate(() => {
    const w = window as unknown as BenchWindow;
    w.__bench.recording = false;
    performance.measure(w.__bench.label, `${w.__bench.label}:start`);
    // Delta pertama = jarak dari mulai rekam ke frame pertama, bukan durasi frame.
    return { deltas: w.__bench.deltas.slice(1), probeHits: w.__bench.probeHits };
  });
  return { ...frameStats(deltas), probeHits };
}

async function open(page: Page, variant: Variant, query: string) {
  await page.goto(`?${query}&${variant.query}`);
  // Mode iframe: node ada di dalam iframe frame breakpoint, jadi cukup tunggu frame-nya.
  const ready = variant.interactive ? `[data-node-id="${PAGE_ID}"], [data-node-id="n_wggrid0001"]` : ".bp-frame";
  await expect(page.locator(ready).first()).toBeAttached();
  // Font & layout awal selesai sebelum mengukur.
  await page.evaluate(() => document.fonts.ready);
  machine ??= await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    cores: navigator.hardwareConcurrency,
    // `deviceMemory` hanya ada di Chromium (dibulatkan browser).
    memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
  }));
  await page.waitForTimeout(500);
}

// Gerak kamera terprogram tiap animation frame: mengukur biaya render/compositing, bukan input.
async function cameraMotion(page: Page, motion: "pan" | "zoom", label: string): Promise<FrameStats> {
  await startFrames(page, label);
  await page.evaluate(
    ({ motion, durationMs }) =>
      new Promise<void>((resolve) => {
        const camera = (window as unknown as BenchWindow).__spike.camera.getState();
        let start = 0;
        const step = (now: number) => {
          if (start === 0) start = now;
          const t = (now - start) / durationMs;
          if (motion === "pan") camera.setCamera({ x: 20 - t * 1600, y: 20 - t * 1200 });
          else camera.setCamera({ x: 20, y: 20, zoom: 0.25 + 0.35 * Math.abs(Math.sin(t * Math.PI * 3)) });
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    { motion, durationMs: DURATION_MS },
  );
  return stopFrames(page);
}

// Gerak mouse sungguhan selama DURATION_MS mengikuti `path(t)`; tombol ditekan di `from`.
async function mouseDrag(
  page: Page,
  label: string,
  from: { x: number; y: number },
  path: (t: number) => { x: number; y: number },
  probe: string | null = null,
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await startFrames(page, label, probe);
  const began = Date.now();
  let moves = 0;
  while (Date.now() - began < DURATION_MS) {
    const point = path((Date.now() - began) / DURATION_MS);
    await page.mouse.move(point.x, point.y);
    moves++;
  }
  const { probeHits, ...stats } = await stopFrames(page);
  return { stats, moves, probeHits };
}

async function boxOf(page: Page, id: string) {
  const box = await page.locator(`[data-node-id="${id}"]`).boundingBox();
  if (!box) throw new Error(`node ${id} tidak terlihat`);
  return box;
}

const center = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

// Geser kamera agar node berada di sekitar y layar 300 (fixture landing lebih tinggi dari viewport).
async function scrollIntoView(page: Page, id: string) {
  const box = await boxOf(page, id);
  await page.evaluate((dy) => {
    const camera = (window as unknown as BenchWindow).__spike.camera.getState();
    camera.setCamera({ y: camera.y - dy });
  }, box.y - 300);
  await page.waitForTimeout(100);
}

const RUNNERS: Record<ScenarioKey, (page: Page, variant: Variant) => Promise<void>> = {
  async panZoom200(page, variant) {
    await open(page, variant, "fixture=landing200&zoom=0.4&x=20&y=20");
    record("panZoom200", variant, { kind: "frames", motion: "pan", stats: await cameraMotion(page, "pan", "pan200") });
    record("panZoom200", variant, {
      kind: "frames",
      motion: "zoom",
      stats: await cameraMotion(page, "zoom", "zoom200"),
    });
  },

  // Landing 200 node + satu frame absolute di atasnya: drag menggeser preview di atas halaman penuh.
  async drag200(page, variant) {
    await open(page, variant, "fixture=landing200&zoom=0.5&x=20&y=20");
    const id = await page.evaluate((pageId) => {
      const spike = (window as unknown as BenchWindow).__spike;
      const result = spike.run(spike.ops.createNode, {
        parentId: pageId,
        type: "frame",
        name: "Bench drag",
        style: {
          base: {
            position: { type: "absolute", x: 200, y: 200 },
            size: {
              width: { mode: "fixed", value: 240, unit: "px" },
              height: { mode: "fixed", value: 160, unit: "px" },
            },
            fills: [{ type: "solid", color: "#3366FF" }],
          },
        },
      });
      if (!result.ok) throw new Error(`createNode gagal: ${result.error.message}`);
      spike.selection.getState().select([result.value]);
      return result.value;
    }, PAGE_ID);
    const from = center(await boxOf(page, id));
    const { stats, moves } = await mouseDrag(page, "drag200", from, (t) => ({
      x: from.x + 300 * Math.sin(t * Math.PI * 2),
      y: from.y + 150 * Math.sin(t * Math.PI * 4),
    }));
    // Bukti preview benar-benar bergerak selama drag (bukan halaman diam).
    const moved = await page.evaluate((nodeId) => {
      const element =
        document.querySelector(`[data-node-id="${nodeId}"]`) ??
        document.getElementById("world")?.shadowRoot?.querySelector(`[data-node-id="${nodeId}"]`);
      return element instanceof HTMLElement && element.style.translate !== "";
    }, id);
    await page.mouse.up();
    expect(moves).toBeGreaterThan(30);
    expect(moved).toBe(true);
    record("drag200", variant, { kind: "frames", motion: "drag", stats });
  },

  // Kartu di grid fitur pertama digeser bolak-balik melewati saudaranya (penanda sisip berpindah-pindah).
  async reorder200(page, variant) {
    await open(page, variant, "fixture=landing200&zoom=0.6&x=20&y=20");
    const card = await page.evaluate(() => {
      for (const [id, node] of (window as unknown as BenchWindow).__spike.doc.getMap("nodes").entries()) {
        const json = node.toJSON();
        if ((json.props as { role?: string } | undefined)?.role === "card") return id;
      }
      return null;
    });
    if (!card) throw new Error("fixture tidak punya kartu");
    await scrollIntoView(page, card);
    await page.evaluate((id) => (window as unknown as BenchWindow).__spike.selection.getState().select([id]), card);
    const box = await boxOf(page, card);
    const from = center(box);
    const { stats, moves, probeHits } = await mouseDrag(
      page,
      "reorder200",
      from,
      (t) => ({ x: from.x + box.width * 2.5 * Math.sin(t * Math.PI * 2), y: from.y + 4 }),
      ".overlay-insertion-marker",
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(moves).toBeGreaterThan(30);
    // Penanda sisip tampil di sebagian besar frame: reorder benar-benar aktif selama pengukuran.
    expect(probeHits).toBeGreaterThan(stats.frames / 2);
    record("reorder200", variant, { kind: "frames", motion: "reorder", stats });
  },

  // Sama dengan T0.6.6: handle kanan grid wrap 100 anak, lebar berayun 1200 → 500 → 1200 px.
  async resize100(page, variant) {
    await open(page, variant, "fixture=wrap100&zoom=1&x=0&y=0");
    await page.evaluate(() => (window as unknown as BenchWindow).__spike.selection.getState().select(["n_wggrid0001"]));
    const handle = page.locator('.overlay-handle[data-handle="e"]');
    await expect(handle).toBeVisible();
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("handle tidak terlihat");
    const from = center(handleBox);
    const { stats, moves } = await mouseDrag(page, "resize100", from, (t) => ({
      x: from.x - 700 * Math.abs(Math.sin(t * Math.PI * 2)),
      y: from.y,
    }));
    const width = (await boxOf(page, "n_wggrid0001")).width;
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(moves).toBeGreaterThan(30);
    expect(width).toBeLessThan(1200);
    record("resize100", variant, { kind: "frames", motion: "resize", stats });
  },

  // Latensi pointerup → frame berikutnya selesai dirender dengan seleksi baru; dua section diklik bergantian.
  async clickSelect(page, variant) {
    await open(page, variant, "fixture=landing200&zoom=0.3&x=20&y=20");
    const sections = await page.evaluate((pageId) => {
      const children = (window as unknown as BenchWindow).__spike.doc.getMap("nodes").get(pageId)?.toJSON().children;
      return Array.isArray(children) ? (children.slice(1, 3) as string[]) : [];
    }, PAGE_ID);
    expect(sections).toHaveLength(2);
    const points = await Promise.all(sections.map(async (id) => center(await boxOf(page, id))));
    await page.evaluate(() => {
      const w = window as unknown as BenchWindow & { __latencies: number[] };
      w.__latencies = [];
      let releasedAt = 0;
      window.addEventListener("pointerup", (event) => (releasedAt = event.timeStamp), { capture: true });
      w.__spike.selection.subscribe(() => {
        const start = releasedAt;
        if (start === 0) return;
        releasedAt = 0;
        // rAF lalu task berikutnya ≈ setelah frame berisi seleksi baru dipaint.
        requestAnimationFrame(() => setTimeout(() => w.__latencies.push(performance.now() - start)));
      });
      performance.mark("clickSelect:start");
    });
    const clicks = 30;
    for (let i = 0; i < clicks; i++) {
      const point = points[i % 2];
      if (!point) throw new Error("titik klik hilang");
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(120);
    }
    const latencies = await page.evaluate(() => {
      performance.measure("clickSelect", "clickSelect:start");
      return (window as unknown as { __latencies: number[] }).__latencies;
    });
    expect(latencies.length).toBe(clicks);
    record("clickSelect", variant, { kind: "latency", stats: latencyStats(latencies) });
  },

  async pan2000(page, variant) {
    await open(page, variant, "fixture=landing2000&zoom=0.25&x=20&y=20");
    record("pan2000", variant, { kind: "frames", motion: "pan", stats: await cameraMotion(page, "pan", "pan2000") });
  },
};

const INTERACTIVE_ONLY: ReadonlySet<ScenarioKey> = new Set(["drag200", "reorder200", "resize100", "clickSelect"]);

function cell(measurements: Measurement[] | undefined): string {
  if (!measurements) return "—";
  return measurements
    .map((m) =>
      m.kind === "latency"
        ? `p50 ${m.stats.p50Ms} / p95 ${m.stats.p95Ms} ms`
        : `${measurements.length > 1 ? `${m.motion} ` : ""}${m.stats.fps} fps (p95 ${m.stats.p95Ms} ms, ${m.stats.longFrames}× >50 ms)`,
    )
    .join("<br>");
}

async function withTrace(browser: Browser, page: Page, name: string, run: () => Promise<void>) {
  if (process.env.BENCH_TRACE !== "1") return run();
  await browser.startTracing(page, { path: `${TRACE_DIR}/${name}.json`, screenshots: false });
  try {
    await run();
  } finally {
    await browser.stopTracing();
  }
}

for (const variant of ACTIVE) {
  for (const scenario of SCENARIOS) {
    if (INTERACTIVE_ONLY.has(scenario.key) && !variant.interactive) continue;
    test(`${scenario.label} · ${variant.label}`, async ({ page, browser }) => {
      await withTrace(browser, page, `${scenario.key}-${variant.key}`, () => RUNNERS[scenario.key](page, variant));
    });
  }
}

test.afterAll(async ({ browser }) => {
  const header = ["Skenario", "Target M0", ...ACTIVE.map((variant) => variant.label)];
  const rows = SCENARIOS.map((scenario) => [
    scenario.label,
    scenario.target,
    ...ACTIVE.map((variant) => cell(results.get(scenario.key)?.get(variant.key))),
  ]);
  const table = [header, header.map(() => "---"), ...rows].map((row) => `| ${row.join(" | ")} |`).join("\n");
  console.log(
    `\nBenchmark canvas (${DURATION_MS} ms/gerak, ${browser.browserType().name()} ${browser.version()})\n\n${table}\n`,
  );

  if (process.env.BENCH_RAW === "1") {
    const raw = Object.fromEntries(
      [...results].map(([scenario, byVariant]) => [scenario, Object.fromEntries(byVariant)]),
    );
    console.log(
      `\n\`\`\`json\n${JSON.stringify({ date: new Date().toISOString(), durationMs: DURATION_MS, machine, results: raw }, null, 2)}\n\`\`\``,
    );
  }
});
