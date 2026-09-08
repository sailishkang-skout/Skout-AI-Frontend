import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TamDetailPage from "./page";

const mockGet = vi.fn();
const mockRecompute = vi.fn();
const mockDrillIn = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "tam-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/tam", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tam")>();
  return {
    ...actual,
    useTamApi: () => ({ get: mockGet, recompute: mockRecompute, drillIn: mockDrillIn }),
  };
});

vi.mock("@/components/tam/market-intelligence-suggestions", () => ({
  MarketIntelligenceSuggestions: () => null,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TamDetailPage />
    </QueryClientProvider>
  );
}

describe("TamDetailPage — coverage funnel chart and weighted segment rows", () => {
  afterEach(() => cleanup());

  it("shows each coverage stage's real value/percentage and the largest segment gets the widest bar", async () => {
    mockGet.mockResolvedValue({
      data: {
        id: "tam-1",
        name: "Mid-market SaaS",
        totalCount: 500,
        lastComputedAt: new Date().toISOString(),
        coverage: { total: 500, activated: 200, enriched: 120, contacted: 80, replied: 20, deal: 5 },
        segmentBreakdown: [
          { dimension: "industry", value: "SaaS", count: 300 },
          { dimension: "industry", value: "Fintech", count: 100 },
        ],
      },
    });

    renderPage();

    await screen.findByText("Mid-market SaaS");
    screen.getByText("Coverage funnel");

    const saasRow = screen.getByText("SaaS").closest("[class*='justify-between']") as HTMLElement;
    const fintechRow = screen.getByText("Fintech").closest("[class*='justify-between']") as HTMLElement;
    const saasBar = saasRow.querySelector("[aria-hidden]") as HTMLElement;
    const fintechBar = fintechRow.querySelector("[aria-hidden]") as HTMLElement;
    expect(saasBar.style.width).toBe("100%");
    expect(fintechBar.style.width).toBe(`${(100 / 300) * 100}%`);
  });
});
