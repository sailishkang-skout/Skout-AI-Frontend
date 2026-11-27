import { describe, expect, it, vi } from "vitest";
import { EditQueue, type Change, type QueueHandlers } from "./workbooks-v2-edit-queue";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
/** A promise answered by hand, to hold a save open. */
function held<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

function queueWith(over: Partial<QueueHandlers> = {}) {
  const handlers: QueueHandlers = { add: vi.fn(async () => ({ id: 7 })), edit: vi.fn(async () => {}), refused: vi.fn(), retryable: () => true, ...over };
  const queue = new EditQueue();
  queue.handlers = handlers;
  return { queue, handlers };
}
const add = (temp: string, value = "x"): Change => ({ kind: "add", key: `key-${temp}`, temp, cells: { a: value } });
const edit = (row: number | { temp: string }, cells: Record<string, string | null>): Change => ({ kind: "edit", key: "e", row, cells });

describe("EditQueue", () => {
  it("creates a typed row once, then sends later values for it to that row", async () => {
    const creating = held<{ id: number }>();
    const { queue, handlers } = queueWith({ add: vi.fn(() => creating.promise) });
    queue.push(add("t1", "first"));
    queue.push(edit({ temp: "t1" }, { b: "second" }));
    expect(queue.snapshot().pendingRows).toEqual([{ temp: "t1", cells: { a: "first", b: "second" } }]);
    expect(handlers.edit).not.toHaveBeenCalled();
    creating.resolve({ id: 42 });
    await settle();
    expect(handlers.add).toHaveBeenCalledTimes(1);
    // The request that creates the row keeps what it was made with.
    expect(vi.mocked(handlers.add).mock.calls[0]![0].cells).toEqual({ a: "first" });
    expect(handlers.edit).toHaveBeenCalledWith(42, { b: "second" });
    expect(queue.snapshot()).toMatchObject({ waiting: [], pendingRows: [], failure: null });
    expect(queue.idOf("t1")).toBe(42);
  });

  it("saves in order, one at a time", async () => {
    const order: string[] = [];
    const { queue } = queueWith({ edit: vi.fn(async (id) => void order.push(`edit ${id}`)) });
    queue.push({ kind: "task", key: "k", label: "Pasting", run: async () => void (await settle(), order.push("paste")) });
    queue.push(edit(1, { a: "1" }));
    queue.push(edit(2, { a: "2" }));
    await settle();
    await settle();
    expect(order).toEqual(["paste", "edit 1", "edit 2"]);
  });

  it("stops on a failure that may pass, and retries the same change", async () => {
    const add1 = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ id: 1 });
    const { queue, handlers } = queueWith({ add: add1 });
    queue.push(add("t1"));
    queue.push(edit(5, { a: "b" }));
    await settle();
    expect(queue.snapshot().failure?.change).toMatchObject({ key: "key-t1" });
    expect(queue.snapshot().pendingRows).toHaveLength(1);
    expect(handlers.edit).not.toHaveBeenCalled();
    queue.retry();
    await settle();
    expect(add1.mock.calls[1]![0]).toBe(add1.mock.calls[0]![0]);
    expect(handlers.edit).toHaveBeenCalledTimes(1);
    expect(queue.snapshot()).toMatchObject({ waiting: [], pendingRows: [], failure: null });
  });

  it("discards a failed row with the values waiting on it, and carries on", async () => {
    const { queue, handlers } = queueWith({ add: vi.fn(async () => Promise.reject(new Error("offline"))) });
    queue.push(add("t1"));
    queue.push(edit({ temp: "t1" }, { b: "1" }));
    queue.push(edit(5, { a: "kept" }));
    await settle();
    queue.discard();
    await settle();
    expect(handlers.edit).toHaveBeenCalledTimes(1);
    expect(handlers.edit).toHaveBeenCalledWith(5, { a: "kept" });
    expect(queue.snapshot()).toMatchObject({ waiting: [], pendingRows: [], failure: null });
  });

  it("drops a change the API refuses, reports it, and carries on", async () => {
    const refusal = new Error("row limit");
    const { queue, handlers } = queueWith({ add: vi.fn(async () => Promise.reject(refusal)), retryable: () => false });
    queue.push(add("t1"));
    queue.push(edit({ temp: "t1" }, { b: "1" }));
    queue.push(edit(5, { a: "kept" }));
    await settle();
    expect(handlers.refused).toHaveBeenCalledTimes(1);
    expect(handlers.refused).toHaveBeenCalledWith(expect.objectContaining({ kind: "add" }), refusal);
    expect(handlers.edit).toHaveBeenCalledTimes(1);
    expect(queue.snapshot()).toMatchObject({ waiting: [], pendingRows: [], failure: null });
  });

  it("tells subscribers, and stops telling those who leave", async () => {
    const { queue } = queueWith();
    const heard = vi.fn();
    const stop = queue.subscribe(heard);
    queue.push(edit(1, { a: "1" }));
    await settle();
    expect(heard).toHaveBeenCalled();
    const calls = heard.mock.calls.length;
    stop();
    queue.push(edit(1, { a: "2" }));
    await settle();
    expect(heard).toHaveBeenCalledTimes(calls);
  });
});
