import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreBreakdownCard } from "./score-breakdown-card";
import type { ScoreBreakdown } from "@/lib/ai-chat";

const breakdown: ScoreBreakdown = {
  prospectId: "p-1",
  icp: {
    score: 72,
    band: "medium",
    version: "3",
    source: "heuristic",
    dimensions: {
      industry: { score: 80, matched: true, explanation: "SaaS is in target industries" },
      seniority: { score: 20, matched: false, explanation: "Individual contributor, not a decision-maker" },
    },
    reasoning: "Strong industry fit, weak seniority match.",
  },
  signalStack: {
    score: 41,
    band: "warm",
    distinctSignalTypes: 2,
    reachableDecisionMaker: true,
    contributingSignals: [
      { id: "sig-1", signalType: "recent_funding", confidence: 0.8, detectedAt: "2026-01-01T00:00:00Z", weight: 1.2 },
      { id: "sig-2", signalType: "job_change", confidence: 0.5, detectedAt: "2026-01-02T00:00:00Z", weight: 0.7 },
    ],
    weights: { defaultConfidence: 0.6 },
  },
};

describe("ScoreBreakdownCard — §8.13 SP-13", () => {
  afterEach(() => cleanup());

  it("renders the ICP score, band, and every dimension as a structured breakdown, not raw text", () => {
    render(<ScoreBreakdownCard breakdown={breakdown} />);

    expect(screen.getByText("ICP fit")).toBeTruthy();
    expect(screen.getByText("72/100")).toBeTruthy();
    expect(screen.getByText("medium")).toBeTruthy();
    expect(screen.getByText("Industry")).toBeTruthy();
    expect(screen.getByText("SaaS is in target industries")).toBeTruthy();
    expect(screen.getByText("Seniority")).toBeTruthy();
    expect(screen.getByText("Individual contributor, not a decision-maker")).toBeTruthy();
  });

  it("renders the signal stack score, band, and per-signal confidence/weight", () => {
    render(<ScoreBreakdownCard breakdown={breakdown} />);

    expect(screen.getByText("Signal stack")).toBeTruthy();
    expect(screen.getByText("41/100")).toBeTruthy();
    expect(screen.getByText("warm")).toBeTruthy();
    expect(screen.getByText("recent funding")).toBeTruthy();
    expect(screen.getByText(/confidence 80% · weight 1\.20/)).toBeTruthy();
    expect(screen.getByText("job change")).toBeTruthy();
    expect(screen.getByText(/confidence 50% · weight 0\.70/)).toBeTruthy();
    expect(screen.getByText(/2 distinct signal types · reachable decision-maker · ICP v3/)).toBeTruthy();
  });

  it("shows a fallback line instead of an empty list when there are no contributing signals", () => {
    render(
      <ScoreBreakdownCard
        breakdown={{
          ...breakdown,
          signalStack: { ...breakdown.signalStack, contributingSignals: [], distinctSignalTypes: 0, reachableDecisionMaker: false },
        }}
      />
    );

    expect(screen.getByText("No timing signals contributing right now.")).toBeTruthy();
  });
});
