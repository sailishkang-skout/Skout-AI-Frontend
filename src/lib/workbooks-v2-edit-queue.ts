/**
 * Changes made in the grid, saved one at a time in the order they were made (WB2-022).
 *
 * Saving in order is what lets someone type across a new row: the first value creates it, and the next one waits for
 * the row's id. A change that may succeed if sent again (the network or the server failed) stops the queue until the
 * person retries or discards it; a change the API refuses is dropped and reported. Nothing is sent twice under a new
 * identity: a retry repeats the same request with the same key.
 */
export type Cells = Record<string, string | null>;

export type Change =
  /** A row typed into the empty row. `temp` names it until the API gives it an id. */
  | { kind: "add"; key: string; temp: string; cells: Record<string, string> }
  | { kind: "edit"; key: string; row: number | { temp: string }; cells: Cells }
  /** Anything else that must keep its place in the order, such as a paste. */
  | { kind: "task"; key: string; label: string; run: () => Promise<void>; refused?: (error: unknown) => void };

export interface PendingRow {
  temp: string;
  cells: Cells;
}

export interface QueueState {
  /** Changes not saved yet, the one being saved first. */
  waiting: Change[];
  /** Rows typed but not created yet, in the order they will be added. */
  pendingRows: PendingRow[];
  failure: { change: Change; error: unknown } | null;
}

export interface QueueHandlers {
  add: (change: Extract<Change, { kind: "add" }>) => Promise<{ id: number }>;
  edit: (rowId: number, cells: Cells) => Promise<void>;
  /** A change the API refused: it will not be tried again. */
  refused: (change: Change, error: unknown) => void;
  /** Whether sending the same request again could work. */
  retryable: (error: unknown) => boolean;
}

export class EditQueue {
  private state: QueueState = { waiting: [], pendingRows: [], failure: null };
  private running = false;
  /** Ids the API gave to rows typed here. */
  private ids = new Map<string, number>();
  private listeners = new Set<() => void>();
  /** Replaced on every render, so a change is always sent with the current session. */
  handlers!: QueueHandlers;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };
  snapshot = () => this.state;

  private set(next: Partial<QueueState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  push(change: Change) {
    let pendingRows = this.state.pendingRows;
    if (change.kind === "add") pendingRows = [...pendingRows, { temp: change.temp, cells: { ...change.cells } }];
    if (change.kind === "edit" && typeof change.row === "object") {
      const { temp } = change.row;
      pendingRows = pendingRows.map((r) => (r.temp === temp ? { ...r, cells: { ...r.cells, ...change.cells } } : r));
    }
    this.set({ waiting: [...this.state.waiting, change], pendingRows });
    void this.run();
  }

  /** The id of a typed row, once it has one. */
  idOf = (temp: string) => this.ids.get(temp);

  retry() {
    this.set({ failure: null });
    void this.run();
  }

  /** Gives up on the change that failed, and on whatever depended on the row it was going to create. */
  discard() {
    const failed = this.state.failure?.change;
    if (!failed) return;
    this.drop(failed);
    this.set({ failure: null });
    void this.run();
  }

  private drop(change: Change) {
    const gone = change.kind === "add" ? change.temp : null;
    const depends = (c: Change) => c.kind === "edit" && typeof c.row === "object" && c.row.temp === gone;
    this.set({
      waiting: this.state.waiting.filter((c) => c !== change && !(gone && depends(c))),
      pendingRows: gone ? this.state.pendingRows.filter((r) => r.temp !== gone) : this.state.pendingRows,
    });
  }

  private async send(change: Change) {
    if (change.kind === "task") return change.run();
    if (change.kind === "add") {
      const { id } = await this.handlers.add(change);
      this.ids.set(change.temp, id);
      return;
    }
    const rowId = typeof change.row === "number" ? change.row : this.ids.get(change.row.temp);
    // The row it belonged to was never created.
    if (rowId === undefined) return;
    await this.handlers.edit(rowId, change.cells);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.state.waiting.length && !this.state.failure) {
        const change = this.state.waiting[0]!;
        try {
          await this.send(change);
          this.set({
            waiting: this.state.waiting.filter((c) => c !== change),
            pendingRows: change.kind === "add" ? this.state.pendingRows.filter((r) => r.temp !== change.temp) : this.state.pendingRows,
          });
        } catch (error) {
          if (this.handlers.retryable(error)) this.set({ failure: { change, error } });
          else {
            this.drop(change);
            this.handlers.refused(change, error);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
