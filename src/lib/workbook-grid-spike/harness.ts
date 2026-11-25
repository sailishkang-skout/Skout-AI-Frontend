/**
 * WB2-001 grid spike: measurement helpers shared by both grids. A grid registers a small object on
 * `window.__gridSpike`, and the benchmark script (scripts/wb-grid-spike/benchmark.mjs) drives and reads it
 * from a real browser. Nothing here runs unless a spike page mounts.
 */

export interface FrameReport {
  frames: number;
  durationMs: number;
  /** Frames per second over the whole run. */
  avgFps: number;
  /** Frame-to-frame time, ms. */
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Frames that took over 25 ms (a visible hitch at 60 fps). */
  longFrames: number;
}

/** Samples frame-to-frame time with requestAnimationFrame while a scroll runs. */
export class FrameSampler {
  private times: number[] = [];
  private handle = 0;
  private startedAt = 0;
  private last = 0;
  private running = false;

  start() {
    this.times = [];
    this.running = true;
    this.startedAt = performance.now();
    this.last = this.startedAt;
    const tick = (now: number) => {
      if (!this.running) return;
      this.times.push(now - this.last);
      this.last = now;
      this.handle = requestAnimationFrame(tick);
    };
    this.handle = requestAnimationFrame(tick);
  }

  stop(): FrameReport {
    this.running = false;
    cancelAnimationFrame(this.handle);
    const durationMs = performance.now() - this.startedAt;
    return summarizeFrames(this.times, durationMs);
  }
}

export function summarizeFrames(times: number[], durationMs: number): FrameReport {
  const sorted = [...times].sort((a, b) => a - b);
  const at = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! : 0);
  return {
    frames: times.length,
    durationMs: Math.round(durationMs),
    avgFps: durationMs > 0 ? Math.round((times.length / durationMs) * 1000 * 10) / 10 : 0,
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    p99: round(at(0.99)),
    max: round(sorted.length ? sorted[sorted.length - 1]! : 0),
    longFrames: times.filter((time) => time > 25).length,
  };
}

const round = (value: number) => Math.round(value * 10) / 10;

export interface GridHarness {
  kind: "glide" | "tanstack";
  /** Which data mode the grid is in (TanStack: windowed or full). */
  mode: string;
  /** The element that scrolls (for the benchmark to wheel over). */
  scrollerSelector: string;
  /** Jump to a row, as a scroll to a far position (fast scrollbar drag). */
  scrollToRow: (row: number) => void;
  /** First row currently painted with real data (not a loading placeholder), or -1. */
  firstLoadedVisibleRow: () => number;
  /** How many rows are visible on screen and whether each has real data. */
  visibleRows: () => { first: number; last: number; loaded: number };
  /** The windowed source's counters. */
  stats: () => Record<string, number>;
  /** DOM node count under the grid container. */
  domNodes: () => number;
  /** Number of selected cells. */
  selectedCells: () => number;
  /** Frozen column count. */
  frozenColumns: () => number;
  /** Width of column 0..n as the grid currently has it. */
  columnWidth: (col: number) => number;
  /** The value typed or pasted into a cell, or undefined if it was never edited. */
  editedValue: (row: number, col: number) => string | undefined;
  /** The cell the selection is anchored on, if any. */
  activeCell: () => { row: number; col: number } | null;
}

/**
 * What a copy of this rectangle must put on the clipboard, computed straight from the dataset (not from what
 * the grid shows), so a copy test compares the grid against the data and not against itself.
 */
export function oracleTsv(rowStart: number, rowEnd: number, colStart: number, colEnd: number, columnCount: number): string {
  const columns = buildColumns(columnCount);
  const rows = generateWindow(rowStart, rowEnd - rowStart + 1, columns).map((line) => line.slice(colStart, colEnd + 1));
  return toTsv(rows);
}

import { buildColumns, generateWindow } from "./dataset";
import { toTsv } from "./selection";

declare global {
  interface Window {
    __gridSpike?: GridHarness;
  }
}

export function registerHarness(harness: GridHarness | undefined) {
  if (typeof window !== "undefined") {
    window.__gridSpike = harness;
    (window as unknown as { __gridOracle?: typeof oracleTsv }).__gridOracle = oracleTsv;
  }
}
