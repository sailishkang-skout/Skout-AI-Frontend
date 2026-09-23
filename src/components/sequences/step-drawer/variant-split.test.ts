import { describe, expect, it } from "vitest";
import { distribute, setSplit, splitPercentages, toggleGodMode, visibleKeys } from "./variant-split";

const sum = (w: { A: number; B: number; C: number }) => w.A + w.B + w.C;

describe("distribute", () => {
  it("splits proportionally and sums to the total", () => {
    expect(distribute([50, 50, 25])).toEqual([40, 40, 20]);
    expect(distribute([1, 1, 1])).toEqual([34, 33, 33]);
    expect(distribute([40, 20], 40)).toEqual([27, 13]);
  });

  it("splits evenly when every weight is zero, and ignores bad values", () => {
    expect(distribute([0, 0])).toEqual([50, 50]);
    expect(distribute([0, 0, 0])).toEqual([34, 33, 33]);
    expect(distribute([Number.NaN, -5, 10])).toEqual([0, 0, 100]);
    expect(distribute([])).toEqual([]);
  });
});

describe("visibleKeys", () => {
  it("shows C only in God Mode", () => {
    expect(visibleKeys(false)).toEqual(["A", "B"]);
    expect(visibleKeys(true)).toEqual(["A", "B", "C"]);
  });
});

describe("splitPercentages", () => {
  it("shows the real split of relative weights (the old default 50/50/25 is 40/40/20)", () => {
    expect(splitPercentages({ A: 50, B: 50, C: 25 }, true)).toEqual({ A: 40, B: 40, C: 20 });
  });

  it("ignores C when God Mode is off", () => {
    expect(splitPercentages({ A: 50, B: 50, C: 25 }, false)).toEqual({ A: 50, B: 50, C: 0 });
  });
});

describe("setSplit", () => {
  it("sets one variant and rescales the others to fill 100", () => {
    const out = setSplit({ A: 40, B: 40, C: 20 }, true, "A", 60);
    expect(out).toEqual({ A: 60, B: 27, C: 13 });
    expect(sum(out)).toBe(100);
  });

  it("clamps to 0-100 and handles other variants being zero", () => {
    expect(setSplit({ A: 50, B: 50, C: 0 }, false, "A", 150)).toEqual({ A: 100, B: 0, C: 0 });
    expect(setSplit({ A: 100, B: 0, C: 0 }, false, "A", 40)).toEqual({ A: 40, B: 60, C: 0 });
    expect(setSplit({ A: 50, B: 50, C: 0 }, false, "A", Number.NaN)).toEqual({ A: 0, B: 100, C: 0 });
  });

  it("leaves a hidden variant untouched", () => {
    expect(setSplit({ A: 50, B: 50, C: 25 }, false, "C", 70)).toEqual({ A: 50, B: 50, C: 0 });
  });
});

describe("toggleGodMode", () => {
  it("turning on gives C a 20% starting share", () => {
    expect(toggleGodMode({ A: 50, B: 50, C: 0 }, true)).toEqual({ A: 40, B: 40, C: 20 });
  });

  it("turning off folds traffic back to A and B", () => {
    expect(toggleGodMode({ A: 40, B: 40, C: 20 }, false)).toEqual({ A: 50, B: 50, C: 0 });
  });
});
