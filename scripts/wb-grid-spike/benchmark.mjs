/**
 * WB2-001 grid spike: drives both grids in a real Chrome and records what happens, so the comparison is
 * measured, not assumed. Run against a production build:
 *
 *   WORKBOOK_GRID_SPIKE=1 pnpm build && WORKBOOK_GRID_SPIKE=1 pnpm start -p 3100
 *   node scripts/wb-grid-spike/benchmark.mjs            # writes docs/wb-grid-spike/results.json
 *
 * Env: BASE (default http://127.0.0.1:3100/app/workbook-grid-spike), CHROME_CHANNEL (default chrome),
 *      ONLY (comma list of config ids), SKIP_STRESS=1 (skip the select-all copy).
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BASE = process.env.BASE ?? "http://127.0.0.1:3100/app/workbook-grid-spike";
const CONFIGS = [
  { id: "glide", path: "/glide", kind: "glide" },
  { id: "tanstack-windowed", path: "/tanstack", kind: "tanstack" },
  { id: "tanstack-full", path: "/tanstack?mode=full", kind: "tanstack" },
].filter((config) => !process.env.ONLY || process.env.ONLY.split(",").includes(config.id));

const MOD = "ControlOrMeta";
const results = { startedAt: new Date().toISOString(), env: {}, baselineBytes: null, configs: {} };

const withQuery = (path, query) => `${BASE}${path}${path.includes("?") ? "&" : "?"}${query}`;
const pct = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);

async function open(browser, config, query = "") {
  const context = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const transfers = [];
  page.on("requestfinished", async (request) => {
    if (!["script", "stylesheet"].includes(request.resourceType())) return;
    try {
      const sizes = await request.sizes();
      transfers.push({ url: request.url(), bytes: sizes.responseBodySize });
    } catch {}
  });
  // A frame recorder that is independent of the app code.
  await page.addInitScript(() => {
    window.__frames = [];
    window.__rec = (on) => {
      if (on) {
        window.__frames = [];
        window.__recOn = true;
        let last = performance.now();
        const tick = (now) => {
          if (!window.__recOn) return;
          window.__frames.push(now - last);
          last = now;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return null;
      }
      window.__recOn = false;
      return window.__frames;
    };
  });
  const started = Date.now();
  await page.goto(withQuery(config.path, query), { waitUntil: "load" });
  await page.waitForFunction(() => window.__gridSpike && window.__gridSpike.firstLoadedVisibleRow() >= 0, null, { timeout: 120000 });
  const firstRowMs = Date.now() - started;
  await page.waitForTimeout(300);
  return { context, page, firstRowMs, transfers };
}

async function heapMb(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("Performance.enable");
  const { metrics } = await cdp.send("Performance.getMetrics");
  const used = metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
  await cdp.detach();
  return Math.round((used / 1048576) * 10) / 10;
}

function frameStats(times, durationMs) {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    frames: times.length,
    durationMs: Math.round(durationMs),
    avgFps: Math.round((times.length / (durationMs / 1000)) * 10) / 10,
    p50: Math.round(pct(sorted, 0.5) * 10) / 10,
    p95: Math.round(pct(sorted, 0.95) * 10) / 10,
    p99: Math.round(pct(sorted, 0.99) * 10) / 10,
    max: Math.round((sorted.at(-1) ?? 0) * 10) / 10,
    over25ms: times.filter((time) => time > 25).length,
    over50ms: times.filter((time) => time > 50).length,
  };
}

/** Real wheel scrolling over the grid, with frame timing and a sample of how many visible rows had data. */
async function scrollRun(page, selector, { events, deltaY, gapMs }) {
  const box = await page.locator(selector).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => window.__rec(true));
  const samples = [];
  const started = Date.now();
  for (let i = 0; i < events; i++) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(gapMs);
    if (i % 6 === 0) samples.push(await page.evaluate(() => window.__gridSpike.visibleRows()));
  }
  const durationMs = Date.now() - started;
  const frames = await page.evaluate(() => window.__rec(false));
  const placeholderSamples = samples.filter((sample) => sample.loaded < sample.last - sample.first + 1).length;
  return { ...frameStats(frames, durationMs), scrolledPx: events * deltaY, lastVisible: samples.at(-1), placeholderSamples, samples: samples.length };
}

async function jump(page, row) {
  const started = Date.now();
  await page.evaluate((target) => window.__gridSpike.scrollToRow(target), row);
  await page
    .waitForFunction(
    (target) => {
      const v = window.__gridSpike.visibleRows();
      // At the very end the window cannot start at the target: the last row on screen is the end.
      return (v.first >= target - 3 || v.last >= 99999) && v.loaded >= v.last - v.first + 1;
    },
    row,
    { timeout: 60000 }
    )
    .catch(async (error) => {
      throw new Error(`jump to ${row} did not settle: ${JSON.stringify(await page.evaluate(() => window.__gridSpike.visibleRows()))} (${error.message.split("\n")[0]})`);
    });
  return Date.now() - started;
}

// ---- cell geometry ------------------------------------------------------------------------------
async function geometry(page, config) {
  if (config.kind === "tanstack") {
    return async (row, col) => {
      const box = await page.locator(`[data-row="${row}"][data-col="${col}"]`).first().boundingBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
    };
  }
  const canvas = await page.locator('canvas[data-testid="data-grid-canvas"]').first().boundingBox();
  const widths = await page.evaluate(() => Array.from({ length: 30 }, (_, col) => window.__gridSpike.columnWidth(col)));
  const MARKER = 48;
  const HEADER = 36;
  const ROW = 34;
  return async (row, col) => {
    const x = canvas.x + MARKER + widths.slice(0, col).reduce((a, b) => a + b, 0) + widths[col] / 2;
    const y = canvas.y + HEADER + ROW * row + ROW / 2;
    return { x, y };
  };
}

const sel = (page) => page.evaluate(() => window.__gridSpike.selectedCells());
const active = (page) => page.evaluate(() => window.__gridSpike.activeCell());

async function features(browser, config) {
  const out = {};
  // Each test gets a fresh page, so one test's selection, scroll or edits cannot affect the next.
  const record = async (name, fn) => {
    const { context, page } = await open(browser, config);
    try {
      const cell = await geometry(page, config);
      const click = async (row, col, modifiers = []) => {
        const { x, y } = await cell(row, col);
        for (const key of modifiers) await page.keyboard.down(key);
        await page.mouse.click(x, y);
        for (const key of modifiers) await page.keyboard.up(key);
      };
      out[name] = { ok: true, ...(await fn({ page, cell, click })) };
    } catch (error) {
      out[name] = { ok: false, error: String(error?.message ?? error).split("\n")[0].slice(0, 220) };
    } finally {
      await context.close();
    }
  };
  const drag = async (page, cell, from, to) => {
    const a = await cell(...from);
    const b = await cell(...to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
  };

  await record("click selects one cell", async ({ page, click }) => {
    await click(3, 2);
    const a = await active(page);
    const n = await sel(page);
    if (n !== 1 || a?.row !== 3 || a?.col !== 2) throw new Error(`expected 1 cell at (3,2); got ${n} at ${JSON.stringify(a)}`);
    return { cells: n };
  });

  await record("drag selects a 4x3 block", async ({ page, cell }) => {
    await drag(page, cell, [2, 2], [5, 4]);
    const n = await sel(page);
    if (n !== 12) throw new Error(`expected 12 cells; got ${n}`);
    return { cells: n };
  });

  await record("shift-click extends a range", async ({ page, click }) => {
    await click(1, 1);
    await click(3, 3, ["Shift"]);
    const n = await sel(page);
    if (n !== 9) throw new Error(`expected 9 cells; got ${n}`);
    return { cells: n };
  });

  await record("ctrl/cmd-click adds a second area", async ({ page, click }) => {
    await click(1, 1);
    await click(3, 3, ["Shift"]);
    await click(10, 0, ["ControlOrMeta"]);
    const n = await sel(page);
    if (n !== 10) throw new Error(`expected 10 cells (9 + 1); got ${n}`);
    return { cells: n };
  });

  await record("keyboard: arrows move, shift+arrows extend", async ({ page, click }) => {
    await click(0, 1);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("Shift+ArrowRight");
    const n = await sel(page);
    if (n !== 3) throw new Error(`expected 3 cells; got ${n}`);
    return { cells: n };
  });

  await record("copy puts the selected block on the clipboard as TSV that matches the data", async ({ page, cell }) => {
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await drag(page, cell, [1, 0], [3, 2]);
    await page.keyboard.press(`${MOD}+c`);
    await page.waitForFunction(async () => (await navigator.clipboard.readText()).length > 0, null, { timeout: 8000 });
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const expected = await page.evaluate(() => window.__gridOracle(1, 3, 0, 2, 30));
    if (text.replace(/\r\n/g, "\n") !== expected) throw new Error(`clipboard differs: ${JSON.stringify(text.slice(0, 80))} vs ${JSON.stringify(expected.slice(0, 80))}`);
    return { chars: text.length };
  });

  await record("paste writes text cells and skips result (number) columns", async ({ page, click }) => {
    await page.evaluate(() => navigator.clipboard.writeText("Ada\tAcme\tx\t77\nBo\tGlobex\ty\t88"));
    await click(0, 0);
    await page.keyboard.press(`${MOD}+v`);
    await page.waitForFunction(() => window.__gridSpike.editedValue(0, 0) !== undefined, null, { timeout: 8000 });
    const values = await page.evaluate(() => ({ a: window.__gridSpike.editedValue(0, 0), b: window.__gridSpike.editedValue(1, 1), numberCol: window.__gridSpike.editedValue(0, 3) }));
    if (values.a !== "Ada" || values.b !== "Globex") throw new Error(`unexpected edits ${JSON.stringify(values)}`);
    if (values.numberCol !== undefined) throw new Error(`a read-only number column was written: ${values.numberCol}`);
    return values;
  });

  await record("column resize by dragging the header edge", async ({ page }) => {
    const before = await page.evaluate(() => window.__gridSpike.columnWidth(1));
    let edgeX;
    let edgeY;
    if (config.kind === "tanstack") {
      const box = await page.locator('[data-testid="resize-c1"]').boundingBox();
      edgeX = box.x + box.width / 2;
      edgeY = box.y + box.height / 2;
    } else {
      const canvas = await page.locator('canvas[data-testid="data-grid-canvas"]').first().boundingBox();
      const widths = await page.evaluate(() => [0, 1].map((col) => window.__gridSpike.columnWidth(col)));
      edgeX = canvas.x + 48 + widths[0] + widths[1];
      edgeY = canvas.y + 18;
    }
    await page.mouse.move(edgeX, edgeY);
    await page.mouse.down();
    await page.mouse.move(edgeX + 30, edgeY, { steps: 3 });
    await page.mouse.move(edgeX + 60, edgeY, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => window.__gridSpike.columnWidth(1));
    if (!(after > before + 30)) throw new Error(`width ${before} -> ${after}`);
    return { before, after };
  });

  await record("frozen column stays put while scrolling sideways", async ({ page }) => {
    const region = async () => {
      const box = config.kind === "glide" ? await page.locator('canvas[data-testid="data-grid-canvas"]').first().boundingBox() : await page.locator('[data-testid="tanstack-scroller"]').boundingBox();
      return page.screenshot({ clip: { x: box.x + 48, y: box.y + 40, width: 170, height: 200 } });
    };
    const before = await region();
    const box = await page.locator(config.kind === "glide" ? ".dvn-scroller" : '[data-testid="tanstack-scroller"]').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(900, 0);
    await page.waitForTimeout(400);
    const after = await region();
    const frozen = await page.evaluate(() => window.__gridSpike.frozenColumns());
    if (frozen < 1) throw new Error("no frozen column reported");
    if (!before.equals(after)) throw new Error("the first column moved with the scroll");
    return { frozenColumns: frozen, method: "pixel-compare of column 0 before/after a 900px sideways scroll" };
  });

  // Not built in the TanStack proof of concept (a headless table has no editor): recorded as such, not as a failure.
  if (config.kind === "tanstack") out["inline cell editing (double-click, type, Enter)"] = { ok: null, note: "not implemented in the POC (custom editor needed)" };
  else await record("inline cell editing (double-click, type, Enter)", async ({ page, cell }) => {
    const { x, y } = await cell(6, 0);
    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(250);
    await page.keyboard.type("Edited");
    // Enter in the same instant as the last key loses the value in Glide's editor; a short pause (as a person has) commits it.
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    const edited = await page.evaluate(() => window.__gridSpike.editedValue(6, 0));
    if (!edited || !edited.includes("Edited")) throw new Error(`edit not recorded (${edited})`);
    return { edited };
  });

  return out;
}

async function stressCopyAll(browser, config) {
  const { context, page } = await open(browser, config);
  try {
    await page.evaluate(() => navigator.clipboard.writeText(""));
    const cell = await geometry(page, config);
    const { x, y } = await cell(2, 2);
    await page.mouse.click(x, y);
    const started = Date.now();
    await page.keyboard.press(`${MOD}+a`);
    const selected = await sel(page);
    await page.keyboard.press(`${MOD}+c`);
    await page.waitForFunction(async () => (await navigator.clipboard.readText()).length > 1000, null, { timeout: 90000 });
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const lines = text.split("\n").length;
    const stats = await page.evaluate(() => window.__gridSpike.stats());
    return { ok: true, selectedCells: selected, ms: Date.now() - started, lines, chars: text.length, rowsResidentAfter: stats.rowsResident };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).split("\n")[0], ms: null };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? "chrome", headless: true });
results.env = { browser: browser.version(), node: process.version, platform: process.platform, cpu: process.env.CPU ?? "Apple M3", viewport: "1500x900", build: "next build (production)" };

// Baseline: the index page, so each grid's own transfer cost is what it adds.
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const bytes = [];
  page.on("requestfinished", async (request) => {
    if (["script", "stylesheet"].includes(request.resourceType())) bytes.push((await request.sizes()).responseBodySize);
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  results.baselineBytes = bytes.reduce((a, b) => a + b, 0);
  await context.close();
}

for (const config of CONFIGS) {
  const entry = { path: config.path };
  console.log(`\n== ${config.id}`);
  for (const [label, latency] of [["latency0", 0], ["latency80", 80]]) {
    const { context, page, firstRowMs, transfers } = await open(browser, config, `latency=${latency}`);
    const run = { firstRowMs };
    run.transferBytes = transfers.reduce((a, b) => a + b.bytes, 0);
    run.scriptRequests = transfers.length;
    run.heapMbAtRest = await heapMb(page);
    run.domNodesAtRest = await page.evaluate(() => window.__gridSpike.domNodes());
    run.canvasCount = await page.locator("canvas").count();
    const selector = await page.evaluate(() => window.__gridSpike.scrollerSelector);
    run.fastScroll = await scrollRun(page, selector, { events: 300, deltaY: 400, gapMs: 16 });
    run.slowScroll = await scrollRun(page, selector, { events: 180, deltaY: 100, gapMs: 16 });
    run.jumpTo50000Ms = await jump(page, 50000);
    run.jumpToEndMs = await jump(page, 99990);
    run.jumpToTopMs = await jump(page, 0);
    run.heapMbAfterScroll = await heapMb(page);
    run.domNodesAfterScroll = await page.evaluate(() => window.__gridSpike.domNodes());
    run.sourceStats = await page.evaluate(() => window.__gridSpike.stats());
    entry[label] = run;
    console.log(label, JSON.stringify({ firstRowMs, fast: entry[label].fastScroll.avgFps, p95: entry[label].fastScroll.p95, jump: run.jumpTo50000Ms, heap: run.heapMbAfterScroll }));
    await context.close();
  }
  entry.features = await features(browser, config);
  for (const [name, value] of Object.entries(entry.features)) console.log(value.ok === null ? "  N/A " : value.ok ? "  PASS" : "  FAIL", name, value.ok ? "" : value.error ?? value.note);
  if (!process.env.SKIP_STRESS) {
    entry.copyAll = await stressCopyAll(browser, config);
    console.log("  copy all:", JSON.stringify(entry.copyAll));
  }
  results.configs[config.id] = entry;
}

// 50 columns (the PRD's ceiling): scroll smoothness only.
results.wide = {};
for (const config of CONFIGS) {
  const { context, page, firstRowMs } = await open(browser, config, "cols=50");
  const selector = await page.evaluate(() => window.__gridSpike.scrollerSelector);
  results.wide[config.id] = { firstRowMs, fastScroll: await scrollRun(page, selector, { events: 200, deltaY: 400, gapMs: 16 }), domNodes: await page.evaluate(() => window.__gridSpike.domNodes()), heapMb: await heapMb(page) };
  console.log("50 cols", config.id, results.wide[config.id].fastScroll.avgFps, "fps", results.wide[config.id].fastScroll.p95, "ms p95");
  await context.close();
}

// Headroom: the same scroll with the CPU slowed, because at full speed every option is held at the 60 fps cap.
results.throttled = {};
for (const config of CONFIGS) {
  results.throttled[config.id] = {};
  for (const rate of [4, 8]) {
    const { context, page } = await open(browser, config);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const selector = await page.evaluate(() => window.__gridSpike.scrollerSelector);
    const run = await scrollRun(page, selector, { events: 200, deltaY: 400, gapMs: 16 });
    results.throttled[config.id][`cpu${rate}x`] = { avgFps: run.avgFps, p50: run.p50, p95: run.p95, p99: run.p99, max: run.max, over25ms: run.over25ms, over50ms: run.over50ms, frames: run.frames };
    console.log(`cpu ${rate}x`, config.id, run.avgFps, "fps", run.p95, "ms p95", run.over25ms, "frames >25ms");
    await context.close();
  }
}

await browser.close();
mkdirSync("docs/wb-grid-spike", { recursive: true });
writeFileSync("docs/wb-grid-spike/results.json", JSON.stringify(results, null, 2));
console.log("\nwrote docs/wb-grid-spike/results.json");
void gzipSync;
