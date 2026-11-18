import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./command-palette";

// jsdom doesn't implement scrollIntoView; cmdk calls it internally when its selected item changes.
Element.prototype.scrollIntoView = vi.fn();

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockListCompanies = vi.fn();
vi.mock("@/lib/crm/companies", () => ({
  useCompaniesApi: () => ({ list: mockListCompanies }),
}));

const mockListContacts = vi.fn();
vi.mock("@/lib/crm/contacts", () => ({
  useContactsApi: () => ({ list: mockListContacts }),
}));

const mockListDeals = vi.fn();
vi.mock("@/lib/crm/deals", () => ({
  useDealsApi: () => ({ list: mockListDeals }),
}));

function renderPalette() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandPalette />
    </QueryClientProvider>
  );
}

function openPalette() {
  fireEvent.keyDown(document, { key: "k", metaKey: true });
}

describe("CommandPalette — real CRM search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCompanies.mockResolvedValue({ data: [], total: 0 });
    mockListContacts.mockResolvedValue({ data: [], total: 0 });
    mockListDeals.mockResolvedValue({ data: [], total: 0 });
  });

  afterEach(() => cleanup());

  it("does not search until at least 2 characters are typed", async () => {
    renderPalette();
    openPalette();

    const input = screen.getByPlaceholderText(/search companies, contacts, deals/i);
    fireEvent.change(input, { target: { value: "a" } });

    await new Promise((r) => setTimeout(r, 350));
    expect(mockListCompanies).not.toHaveBeenCalled();
  });

  it("searches companies/contacts/deals in parallel and shows real results", async () => {
    mockListCompanies.mockResolvedValue({
      data: [{ id: "c-1", name: "Quicksilver Robotics", domain: "quicksilver.com" }],
      total: 1,
    });
    renderPalette();
    openPalette();

    const input = screen.getByPlaceholderText(/search companies, contacts, deals/i);
    fireEvent.change(input, { target: { value: "quick" } });

    await screen.findByText("Quicksilver Robotics", {}, { timeout: 2000 });
    expect(mockListCompanies).toHaveBeenCalledWith(expect.objectContaining({ search: "quick" }));
    expect(mockListContacts).toHaveBeenCalledWith(expect.objectContaining({ search: "quick" }));
    expect(mockListDeals).toHaveBeenCalledWith(expect.objectContaining({ search: "quick" }));
  });

  it("navigates to the company's detail page when selected", async () => {
    mockListCompanies.mockResolvedValue({
      data: [{ id: "c-1", name: "Quicksilver Robotics", domain: "quicksilver.com" }],
      total: 1,
    });
    renderPalette();
    openPalette();

    const input = screen.getByPlaceholderText(/search companies, contacts, deals/i);
    fireEvent.change(input, { target: { value: "quick" } });

    const item = await screen.findByText("Quicksilver Robotics", {}, { timeout: 2000 });
    fireEvent.click(item);

    expect(mockPush).toHaveBeenCalledWith("/crm/companies/c-1");
  });
});
