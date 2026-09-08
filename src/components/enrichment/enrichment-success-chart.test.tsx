import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EnrichmentSuccessChart } from "./enrichment-success-chart";

describe("EnrichmentSuccessChart", () => {
  afterEach(() => cleanup());

  it("shows a loading state", () => {
    render(<EnrichmentSuccessChart isLoading />);
    screen.getByText(/loading/i);
  });

  it("shows an honest empty state instead of fake random data when there's no activity", () => {
    const data = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      spent: 0,
      found: 0,
    }));
    render(<EnrichmentSuccessChart data={data} />);
    screen.getByText(/no enrichment activity/i);
  });

  it("does not show the empty state once real activity has arrived", () => {
    render(<EnrichmentSuccessChart data={[{ date: "2026-09-01", spent: 40, found: 12 }]} />);
    expect(screen.queryByText(/no enrichment activity/i)).toBeNull();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });
});
