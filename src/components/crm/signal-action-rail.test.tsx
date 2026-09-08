import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignalActionRail } from "./signal-action-rail";
import type { Signal } from "@/types/api";

vi.mock("@/lib/sequences", () => ({
  useSequencesApi: () => ({
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    enroll: vi.fn(),
  }),
}));

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "sig-1",
    entityType: "account",
    entityId: "acct-1",
    signalType: "hiring_surge",
    value: { reason: "Hiring 5 SDRs" },
    confidence: 0.85,
    observedAt: "2026-09-01T00:00:00.000Z",
    detectedAt: "2026-09-01T00:00:00.000Z",
    source: "linkedin",
    provenance: {},
    createdAt: "2026-09-01T00:00:00.000Z",
    expiresAt: null,
    activationPaths: ["enroll_sequence"],
    ...overrides,
  };
}

function renderRail(signals: Signal[], enrollProspectId: string | null = "prospect-1") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SignalActionRail signals={signals} enrollProspectId={enrollProspectId} />
    </QueryClientProvider>
  );
}

describe("SignalActionRail", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("renders nothing when there are no qualifying signals", () => {
    const { container } = renderRail([]);
    expect(container.firstChild).toBeNull();
  });

  it("excludes low-confidence, expired, and purely-informational signals", () => {
    const { container } = renderRail([
      makeSignal({ id: "low-confidence", confidence: 0.4 }),
      makeSignal({ id: "expired", expiresAt: "2020-01-01T00:00:00.000Z" }),
      makeSignal({ id: "informational-only", activationPaths: [] }),
    ]);
    expect(container.firstChild).toBeNull();
  });

  it("shows a qualifying signal with an Enroll in sequence action", async () => {
    renderRail([makeSignal()]);
    await screen.findByText("Active signals — next actions");
    expect(screen.getByRole("button", { name: /enroll in sequence/i })).toBeTruthy();
  });

  it("caps the rail at 3 items, highest confidence first", () => {
    renderRail([
      makeSignal({ id: "a", confidence: 0.7 }),
      makeSignal({ id: "b", confidence: 0.95 }),
      makeSignal({ id: "c", confidence: 0.8 }),
      makeSignal({ id: "d", confidence: 0.9 }),
    ]);
    expect(screen.getAllByRole("button", { name: /enroll in sequence/i })).toHaveLength(3);
  });

  it("hides the Enroll action when there's no resolvable prospect to enroll", async () => {
    renderRail([makeSignal()], null);
    await screen.findByText("Active signals — next actions");
    expect(screen.queryByRole("button", { name: /enroll in sequence/i })).toBeNull();
  });

  it("opens the enroll panel when the action is clicked", async () => {
    renderRail([makeSignal()]);
    fireEvent.click(await screen.findByRole("button", { name: /enroll in sequence/i }));
    await screen.findByText("Enroll in a sequence");
  });
});
