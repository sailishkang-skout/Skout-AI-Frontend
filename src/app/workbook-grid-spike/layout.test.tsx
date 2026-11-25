import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import GridSpikeLayout from "./layout";

afterEach(() => vi.unstubAllEnvs());

describe("the grid spike is an experiment, not a product page", () => {
  it("is a 404 unless WORKBOOK_GRID_SPIKE=1, so it cannot reach users", () => {
    vi.stubEnv("WORKBOOK_GRID_SPIKE", "");
    expect(() => GridSpikeLayout({ children: null })).toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("WORKBOOK_GRID_SPIKE", "true");
    expect(() => GridSpikeLayout({ children: null })).toThrow("NEXT_NOT_FOUND");
  });

  it("renders when the flag is exactly 1", () => {
    vi.stubEnv("WORKBOOK_GRID_SPIKE", "1");
    expect(() => GridSpikeLayout({ children: null })).not.toThrow();
  });
});
