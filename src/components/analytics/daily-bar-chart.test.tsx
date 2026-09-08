import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DailyBarChart } from "./daily-bar-chart";

describe("DailyBarChart", () => {
  afterEach(() => cleanup());

  it("shows a loading skeleton instead of a chart while loading", () => {
    render(<DailyBarChart data={[]} isLoading emptyLabel="No data" valueLabel="credits" />);
    screen.getByText(/loading chart data/i);
  });

  it("shows the empty label instead of a chart when every value is zero", () => {
    render(
      <DailyBarChart
        data={[{ date: "2026-09-01", value: 0 }]}
        emptyLabel="No credit activity in this period"
        valueLabel="credits"
      />
    );
    screen.getByText("No credit activity in this period");
  });

  it("does not show the empty state once real data has arrived", () => {
    render(<DailyBarChart data={[{ date: "2026-09-01", value: 42 }]} emptyLabel="No data" valueLabel="jobs" />);
    expect(screen.queryByText("No data")).toBeNull();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });
});
