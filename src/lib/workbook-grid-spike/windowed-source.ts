/**
 * WB2-001 grid spike: a stand-in for the server-windowed rows API (PRD GRID-1, WB2-012). Rows are fetched
 * in fixed pages of 200 (the PRD's target window), kept in a bounded cache, and fetched with a simulated
 * network delay, so the spike measures what a real windowed API would cost. It also records what was
 * fetched, so "only the visible rows are loaded" can be shown with numbers, not assumed.
 */
import { ROW_COUNT, buildColumns, generateWindow, type CellValue, type SpikeColumn } from "./dataset";

export const PAGE_SIZE = 200;

export interface WindowedSourceOptions {
  columns?: SpikeColumn[];
  rowCount?: number;
  /** Simulated round trip for one page, in ms. 0 resolves on the next microtask. */
  latencyMs?: number;
  /** Pages kept; the oldest is dropped beyond this. 200-row pages × 25 = 5,000 rows resident at most. */
  maxPages?: number;
  /** Called when a page lands, so a grid can repaint. */
  onPage?: (page: number) => void;
}

export interface WindowedStats {
  requests: number;
  rowsFetched: number;
  pagesResident: number;
  rowsResident: number;
  evictions: number;
  rowCount: number;
}

export class WindowedSource {
  readonly columns: SpikeColumn[];
  readonly rowCount: number;
  private readonly latencyMs: number;
  private readonly maxPages: number;
  private readonly pages = new Map<number, CellValue[][]>();
  private readonly pending = new Set<number>();
  private onPage?: (page: number) => void;
  private readonly waiters = new Map<number, Array<() => void>>();
  private requests = 0;
  private rowsFetched = 0;
  private evictions = 0;

  constructor(options: WindowedSourceOptions = {}) {
    this.columns = options.columns ?? buildColumns();
    this.rowCount = options.rowCount ?? ROW_COUNT;
    this.latencyMs = options.latencyMs ?? 0;
    this.maxPages = options.maxPages ?? 25;
    this.onPage = options.onPage;
  }

  setOnPage(callback: ((page: number) => void) | undefined) {
    this.onPage = callback;
  }

  static pageOf(row: number): number {
    return Math.floor(row / PAGE_SIZE);
  }

  /** The cell if its page is loaded, else undefined (and its page is requested). Never blocks. */
  cell(row: number, col: number): CellValue | undefined {
    if (row < 0 || row >= this.rowCount) return undefined;
    const page = WindowedSource.pageOf(row);
    const data = this.pages.get(page);
    if (!data) {
      this.request(page);
      return undefined;
    }
    // Recently used pages are the last to be dropped.
    this.pages.delete(page);
    this.pages.set(page, data);
    return data[row - page * PAGE_SIZE]?.[col];
  }

  isLoaded(row: number): boolean {
    return this.pages.has(WindowedSource.pageOf(row));
  }

  /** Ask for the pages covering rows [start, end]; used for what is on screen. */
  ensure(start: number, end: number) {
    const last = Math.min(this.rowCount - 1, end);
    for (let page = WindowedSource.pageOf(Math.max(0, start)); page <= WindowedSource.pageOf(last); page++) if (!this.pages.has(page)) this.request(page);
  }

  private request(page: number) {
    if (this.pending.has(page) || this.pages.has(page)) return;
    this.pending.add(page);
    this.requests++;
    const finish = () => {
      const rows = generateWindow(page * PAGE_SIZE, PAGE_SIZE, this.columns);
      this.rowsFetched += rows.length;
      this.pending.delete(page);
      this.pages.set(page, rows);
      while (this.pages.size > this.maxPages) {
        this.pages.delete(this.pages.keys().next().value as number);
        this.evictions++;
      }
      this.onPage?.(page);
      for (const resolve of this.waiters.get(page) ?? []) resolve();
      this.waiters.delete(page);
    };
    if (this.latencyMs > 0) setTimeout(finish, this.latencyMs);
    else queueMicrotask(finish);
  }

  /**
   * Every value of a rectangular range, loading what is missing page by page. Each page is copied out as soon
   * as it is there, so a range wider than the cache (select all, then copy) still returns every row.
   */
  async range(rowStart: number, rowEnd: number, colStart: number, colEnd: number): Promise<CellValue[][]> {
    const first = Math.max(0, rowStart);
    const last = Math.min(this.rowCount - 1, rowEnd);
    const out: CellValue[][] = [];
    for (let page = WindowedSource.pageOf(first); page <= WindowedSource.pageOf(last); page++) {
      if (!this.pages.has(page)) await this.load(page);
      const data = this.pages.get(page);
      if (!data) continue;
      const from = Math.max(first, page * PAGE_SIZE);
      const to = Math.min(last, page * PAGE_SIZE + PAGE_SIZE - 1);
      for (let row = from; row <= to; row++) out.push(data[row - page * PAGE_SIZE]!.slice(colStart, colEnd + 1));
    }
    return out;
  }

  /** Resolves when `page` has landed. */
  private load(page: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waiters.set(page, [...(this.waiters.get(page) ?? []), resolve]);
      this.request(page);
    });
  }

  stats(): WindowedStats {
    return {
      requests: this.requests,
      rowsFetched: this.rowsFetched,
      pagesResident: this.pages.size,
      rowsResident: this.pages.size * PAGE_SIZE,
      evictions: this.evictions,
      rowCount: this.rowCount,
    };
  }
}
