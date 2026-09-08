import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SignalDensityChart } from "./signal-density-chart";

describe("SignalDensityChart", () => {
  afterEach(() => cleanup());

  it("shows a loading state", () => {
    render(<SignalDensityChart isLoading />);
    screen.getByText(/loading/i);
  });

  it("shows an honest empty state instead of fake mock data when no signals were detected", () => {
    render(<SignalDensityChart data={[]} />);
    screen.getByText(/no signals detected/i);
  });

  it("does not show the empty state once real signal data has arrived", () => {
    render(<SignalDensityChart data={[{ signalType: "recent_funding", count: 3 }]} />);
    expect(screen.queryByText(/no signals detected/i)).toBeNull();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });
});
