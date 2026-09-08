import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PipelineVelocityChart } from "./pipeline-velocity-chart";

describe("PipelineVelocityChart", () => {
  afterEach(() => cleanup());

  it("shows a loading state", () => {
    render(<PipelineVelocityChart isLoading />);
    screen.getByText(/loading/i);
  });

  it("shows an honest empty state instead of a fake trend when no deals were created", () => {
    const series = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      value: 0,
    }));
    render(<PipelineVelocityChart series={series} />);
    screen.getByText(/no new deals created/i);
  });

  it("labels the metric as new pipeline created, not a historical snapshot", () => {
    render(<PipelineVelocityChart series={[{ date: "2026-09-01", value: 5000 }]} />);
    screen.getByText(/new pipeline created per day/i);
  });
});
