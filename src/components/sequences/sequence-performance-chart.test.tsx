import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SequencePerformanceChart } from "./sequence-performance-chart";

describe("SequencePerformanceChart", () => {
  afterEach(() => cleanup());

  it("shows a loading state", () => {
    render(<SequencePerformanceChart isLoading />);
    screen.getByText(/loading/i);
  });

  it("shows an honest empty state instead of a fake random walk when no emails were sent", () => {
    const data = Array.from({ length: 14 }, (_, i) => ({
      date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      sent: 0,
      opens: 0,
      replies: 0,
      openRate: 0,
      replyRate: 0,
    }));
    render(<SequencePerformanceChart data={data} />);
    screen.getByText(/no emails sent/i);
  });

  it("does not show the empty state once real sends have arrived", () => {
    render(
      <SequencePerformanceChart
        data={[{ date: "2026-09-01", sent: 10, opens: 5, replies: 1, openRate: 50, replyRate: 10 }]}
      />
    );
    expect(screen.queryByText(/no emails sent/i)).toBeNull();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });
});
