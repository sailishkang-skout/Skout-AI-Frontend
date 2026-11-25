# WB2-001: grid library spike — initial comparison

Status: **initial findings, day 1. No library is selected yet.** Both options have a working, tested proof of concept
on the same data. The numbers below are measured (raw data: [results.json](./results.json)); anything not measured is
listed under "Not tested". PRD reference: GRID-1 to GRID-4, §10 (grid targets), open question O1.

## What was built

| | Glide Data Grid | TanStack Table + Virtual |
|---|---|---|
| Version | `@glideapps/glide-data-grid` 6.0.3 (MIT) | `@tanstack/react-table` **9.3.1** + `@tanstack/react-virtual` 3.14.28 (MIT) |
| Renders | one `<canvas>` (cells are painted, no DOM per cell) | DOM; only the visible rows (+10 overscan) exist |
| Code written for the POC | 190 lines (`glide-grid.tsx`) | 322 lines (`tanstack-grid.tsx`) + 159 lines selection/clipboard logic (`selection.ts`) |

Shared by both: 100,000 rows × 30 columns (up to 50), generated on demand and identical for both
(`src/lib/workbook-grid-spike/dataset.ts`); a stand-in for the server rows API that returns pages of 200 rows with an
optional simulated delay and keeps at most 25 pages (`windowed-source.ts`). The TanStack grid also runs in a **full**
mode that hands the table all 100,000 rows, to measure what that costs.

Where it lives: `/workbook-grid-spike`, `/glide`, `/tanstack`, `/tanstack?mode=full`. Isolated from the product: outside
every authenticated route, and a **404 unless `WORKBOOK_GRID_SPIKE=1`** (checked: 404 with the flag off; the existing
Workbooks page is untouched and still protected). Options: `?cols=50`, `?latency=80`.

## How it was measured

Apple M3, 16 GB; Chrome 158 (headless); **production** `next build`; viewport 1500×900, grid 640 px tall; real wheel events
(Playwright) at 16 ms intervals. Fast scroll = 300 events × 400 px (120,000 px ≈ 3,500 rows). Frame times come from a
`requestAnimationFrame` recorder injected by the script, not from the app. Each number is **one run** unless stated.
Reproduce: `WORKBOOK_GRID_SPIKE=1 pnpm build && WORKBOOK_GRID_SPIKE=1 npx next start -p 3100`, then
`node scripts/wb-grid-spike/benchmark.mjs`.

## Results (30 columns, 100,000 rows)

| | Glide | TanStack (windowed) | TanStack (full) |
|---|---|---|---|
| Fast scroll: avg fps / p95 frame / frames over 25 ms | 59.9 / 16.8 ms / 1 | 59.9 / 16.7 ms / 1 | 59.8 / 16.8 ms / 2 |
| **CPU slowed 4×**: fps / p95 / frames over 25 ms | **59.9** / 16.8 ms / 1 | 51.0 / 33.4 ms / 82 | 52.3 / 33.3 ms / 69 |
| **CPU slowed 8×**: fps / p95 / frames over 25 ms | **59.8** / 16.7 ms / 1 | 30.0 / 66.6 ms / 237 | 30.8 / 50.1 ms / 217 |
| 50 columns, fast scroll (fps / p95) | 59.9 / 16.7 ms | 60.0 / 16.7 ms | 59.7 / 16.7 ms |
| Time to first real row (two runs) | 0.55–0.84 s | 0.54 s | 0.82–0.95 s |
| JS heap at rest → after scrolling | 4.6 → 10.0 MB | 4.7 → 10.0 MB | **125.8 → 127.1 MB** (198 MB at 50 columns) |
| Building all 100,000 rows in the browser | n/a | n/a | 151–165 ms |
| DOM nodes (30 / 50 columns) | 279 / 280 (canvas) | 1,023 / 2,183 | 1,023 / 2,183 |
| Rows fetched after the fast scroll | 4,800 (4.8%) | 5,000 (5%) | 100,000 (all, up front) |
| Rows held by the table object | n/a | ~30 | 100,000 |
| Jump to row 50,000 (0 ms / 80 ms server delay) | 15 / 98 ms | 17 / 91 ms | 17 / 18 ms |
| Select all + copy (100,000 × 30) | 3.0 s | 1.6 s | 1.5 s |
| JS+CSS transferred vs. the spike index page (299,251 B) | 398,958 B (**+99.7 KB**) | 328,039 B (**+28.8 KB**) | 328,038 B (+28.8 KB) |

Reading the table honestly: at full speed on this machine **every option hits the 60 fps cap**, so full-speed runs
cannot tell them apart. The throttled runs are the only ones that separate them, and they are single runs on a fast
machine with a simulated slowdown, not a measurement on slow hardware. Glide's canvas keeps 60 fps while the DOM grid
degrades as the CPU gets slower.

Windowing works for both: neither needs the whole dataset. Glide fetched 4,800 rows and the windowed TanStack 5,000
after a 3,500-row scroll. Giving TanStack Table all rows ("full") scrolls just as smoothly, but costs ~120 MB of heap
(and ~200 MB at 50 columns) and ~0.15 s to build, before any provider data or cell metadata is attached.

Bundle: Glide's main chunk is 287 KB raw / 91 KB gzip (+11 KB / 4.5 KB); its peer dependencies `lodash`, `marked` and
`react-responsive-carousel` come with it. The TanStack route adds ~29 KB gzip (route chunk 15.5 KB raw / 6.1 KB gzip plus
the shared table and virtual code). Glide is loaded lazily with `next/dynamic`, so it does not weigh on first load of
any page that does not use it.

## Features (each tested in a real browser unless marked)

| Requirement | Glide | TanStack |
|---|---|---|
| Click, drag and shift-click selection; ctrl/cmd-click second area; arrows and shift+arrows | **Built in**, all pass | **Custom** (159 lines, `selection.ts`), all pass |
| Select all (3,000,000 cells) | passes | passes |
| Copy as TSV (matched against the data, not against the grid) | **Built in** via `getCellsForSelection` (async, loads missing windows) | **Custom**, passes |
| Paste into input columns only (result columns skipped) | **Built in** via `onPaste`; read-only cells are skipped | **Custom** (`pasteTargets`), passes |
| Column resize | **Built in** | `columnResizingFeature` + a hand-made handle; passes |
| Frozen columns (pixel-compared after a 900 px sideways scroll) | `freezeColumns` (built in); passes | `columnPinningFeature` + CSS `sticky` offsets; passes |
| Inline editing | Built in; passes (see quirk below) | **Not built** in the POC (a headless table has no editor) |
| Row numbers, number/boolean cell types | Built in | Hand-rendered |
| Keyboard navigation | Built in | Custom (arrows, shift+arrows, ctrl+A, ctrl+C, paste event) |

TanStack Table v9's **built-in cell selection does not fit windowed rows** (tested in `tanstack-grid.test.tsx`): ranges
are stored as row ids and resolved against the rows *in the table*. With a window in the table, selecting from row 10 to
row 50,000 selects **0 cells**; the selection also resets whenever the data changes. It has no clipboard support (it
returns the values; the app writes the text). The POC therefore uses its own index-based selection. Using the built-in
feature would mean the "full" mode above (all rows in the table).

Integration notes found while testing:
- Glide needs a `<div id="portal">` in the page for its cell editor; without it, inline editing silently never opens.
- In Glide's editor, pressing Enter in the same instant as the last keystroke loses the typed value; a 200 ms pause (as a
  person has) commits it. Probably a synthetic-input artefact, but unconfirmed with real typing.
- Glide draws to a canvas, so cells are not in the DOM: tests need coordinate maths (it was done here), and there are no
  per-cell DOM nodes for CSS, browser find, or screen readers.
- TanStack Table 9.x is a new major version; most public examples are for v8. The package ships its own usage notes
  (`skills/`), which the POC followed.

## Not tested (do not read these as passing)

Server-windowed loading against a **real** API (the rows API, WB2-012, does not exist yet: windows are simulated in
memory, so network failure, stale-request cancellation and the 300 ms p95 are untested); server-side sort and filter;
live cell updates while scrolling (GRID-6); undo (GRID-3); column reorder and hide; saved views; screen readers and
keyboard-only use; touch; dark mode and the design system's look; custom cells for the workbook's cell states (found /
not found / running / error badges); real GPUs, slow or low-memory machines, other browsers; repeat runs and variance.

## Risks and blockers

- The throttled runs favour Glide, but they were produced by software throttling on an M3. Real low-end hardware has not
  been tried.
- A DOM grid's cost grows with visible cells (1,023 nodes at 30 columns, 2,183 at 50). Column virtualization was not
  built; it is the obvious mitigation to test.
- Glide's accessibility and DOM-based testing story is the main product risk to check (PRD has no explicit accessibility
  requirement, but the app's e2e tests are DOM-based).
- The TanStack option needs roughly 480 lines of custom grid code before editing, undo and custom cells.
- Copying all 100,000 × 30 produced a 29 MB clipboard payload in 1.5–3 s in both; only line count and size were checked
  for that case (content was verified on a 3 × 3 block).
- The 2M-cell storage target (WB2-003) is unrelated to this spike and not assessed here.

## Remaining work to finish WB2-001

1. Repeat the scroll and throttle runs several times (variance) and on a low-end Windows laptop and headed Chrome with
   a real GPU; add Safari and Firefox.
2. Re-run against the real rows API once WB2-012 exists, with stale-request cancellation, 200-row windows and sort/filter.
3. Build workbook-style cells in both (state badge, value + confidence, credits) and measure again.
4. Add live updates (one batch per second while scrolling) and measure frame time.
5. Test undo (20 steps), column reorder/hide, and a column-virtualized TanStack variant at 50 columns.
6. Check accessibility basics (keyboard-only, screen reader) and DOM-based test automation for both.
7. Verify the full content of a 100,000 × 30 copy, then write the one-page decision and select a library.
