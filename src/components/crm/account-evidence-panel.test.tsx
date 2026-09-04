import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountEvidencePanel } from "@/components/crm/account-evidence-panel";
import type { AccountEvidenceGroup } from "@/types/api";

const mockGetAccountEvidence = vi.fn();

vi.mock("@/lib/dexter-platform", () => ({
  useDexterPlatformApi: () => ({
    getAccountEvidence: mockGetAccountEvidence,
  }),
}));

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountEvidencePanel companyId="company-1" />
    </QueryClientProvider>
  );
}

const industryGroup: AccountEvidenceGroup = {
  attribute: "industry",
  entries: [
    {
      id: "ev-2",
      attribute: "industry",
      value: "Software",
      source: "manual",
      observedAt: new Date().toISOString(),
      confidence: 0.4,
      confidenceTier: "low",
      freshnessExpiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      freshnessStatus: "expiring_soon",
      method: null,
      authority: null,
      corroborationCount: 1,
    },
    {
      id: "ev-1",
      attribute: "industry",
      value: "SaaS",
      source: "clearbit",
      observedAt: new Date(Date.now() - 86_400_000).toISOString(),
      confidence: 0.95,
      confidenceTier: "high",
      freshnessExpiresAt: null,
      freshnessStatus: "no_expiry",
      method: null,
      authority: null,
      corroborationCount: 2,
    },
  ],
};

describe("AccountEvidencePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an empty state when no evidence is recorded", async () => {
    mockGetAccountEvidence.mockResolvedValue({ data: { companyId: "company-1", evidence: [] } });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/No evidence recorded yet/)).toBeTruthy();
    });
  });

  it("collapses each attribute by default, showing only the current value and its confidence/freshness tier", async () => {
    mockGetAccountEvidence.mockResolvedValue({ data: { companyId: "company-1", evidence: [industryGroup] } });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText("industry")).toBeTruthy();
    });
    // Historical entry not shown until expanded.
    expect(screen.queryByText("SaaS")).toBeNull();
    expect(screen.getByText("low")).toBeTruthy();
    expect(screen.getByText("expiring soon")).toBeTruthy();
  });

  it("expands an attribute on click to reveal the full evidence trail with source and confidence", async () => {
    mockGetAccountEvidence.mockResolvedValue({ data: { companyId: "company-1", evidence: [industryGroup] } });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText("industry")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /industry/i }));

    await waitFor(() => {
      expect(screen.getByText("SaaS")).toBeTruthy();
    });
    expect(screen.getByText("clearbit")).toBeTruthy();
    expect(screen.getByText("manual")).toBeTruthy();
    expect(screen.getByText("95% · High confidence")).toBeTruthy();
    expect(screen.getByText("40% · Low confidence")).toBeTruthy();
  });
});
