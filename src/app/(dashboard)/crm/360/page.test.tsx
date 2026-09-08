import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Account360Page from "./page";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams("mode=person&id=prospect-1"));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams(),
}));

const mockGetPerson360 = vi.fn();
const mockGetAccount360 = vi.fn();
vi.mock("@/lib/dexter-platform", () => ({
  useDexterPlatformApi: () => ({
    getAccount360: mockGetAccount360,
    getPerson360: mockGetPerson360,
  }),
}));

const mockCreateList = vi.fn();
const mockAddToList = vi.fn();
vi.mock("@/lib/enrichment", () => ({
  useEnrichmentApi: () => ({
    createList: mockCreateList,
    addToList: mockAddToList,
  }),
}));

vi.mock("@/components/crm/crm-360-record-picker", () => ({
  Crm360RecordPicker: () => null,
}));

vi.mock("@/components/crm/next-best-action-card", () => ({
  NextBestActionCard: () => null,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Account360Page />
    </QueryClientProvider>
  );
}

describe("Account360Page — person mode contextual actions (GTM revamp fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams("mode=person&id=prospect-1"));
    mockGetPerson360.mockResolvedValue({
      data: {
        professionalFacts: { fullName: "Ada Lovelace", title: "VP Sales", email: "ada@acme.com" },
        signals: [],
        timeline: [],
      },
    });
  });

  afterEach(() => cleanup());

  it("Add to Sequence creates a single-prospect list and lands on its detail page", async () => {
    mockCreateList.mockResolvedValue({ id: "list-1", workspaceId: "ws-1", name: "Ada Lovelace — Results", prospectCount: 0, createdAt: "" });
    mockAddToList.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /add to sequence/i }));

    await waitFor(() => expect(mockCreateList).toHaveBeenCalled());
    await waitFor(() => expect(mockAddToList).toHaveBeenCalledWith("list-1", ["prospect-1"]));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/lists/list-1"));
  });

  it("Enrich Person creates a list and lands on Workbooks, not the list page", async () => {
    mockCreateList.mockResolvedValue({ id: "list-2", workspaceId: "ws-1", name: "Ada Lovelace — Results", prospectCount: 0, createdAt: "" });
    mockAddToList.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /enrich person/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/enrichment/workbooks"));
  });
});

describe("Account360Page — account mode contextual actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams("mode=account&id=company-1"));
    mockGetAccount360.mockResolvedValue({
      data: {
        company: { name: "Acme", domain: "acme.com" },
        buyingCommittee: [{ id: "contact-1", fullName: "Grace Hopper", title: "CTO", role: "Decision Maker" }],
        signals: [],
        deals: [],
        timeline: [],
      },
    });
  });

  afterEach(() => cleanup());

  it("Find Contacts navigates to Discover with the account's real domain, not a nonexistent companyId filter", async () => {
    renderPage();

    const findButton = await screen.findByRole("button", { name: /find contacts/i });
    expect(findButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(findButton);

    expect(mockPush).toHaveBeenCalledWith("/prospects/search?companyDomain=acme.com");
  });

  it("Find Contacts is disabled when the account has no known domain", async () => {
    mockGetAccount360.mockResolvedValue({
      data: { company: { name: "Acme" }, buyingCommittee: [], signals: [], deals: [], timeline: [] },
    });
    renderPage();

    const findButton = await screen.findByRole("button", { name: /find contacts/i });
    expect(findButton.hasAttribute("disabled")).toBe(true);
  });

  it("Enrich Account resolves the first buying-committee contact as the enrich target", async () => {
    mockCreateList.mockResolvedValue({ id: "list-3", workspaceId: "ws-1", name: "Acme — Results", prospectCount: 0, createdAt: "" });
    mockAddToList.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /enrich account/i }));

    await waitFor(() => expect(mockAddToList).toHaveBeenCalledWith("list-3", ["contact-1"]));
  });
});