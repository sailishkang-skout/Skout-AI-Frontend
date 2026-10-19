import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Crm360RecordPicker } from "./crm-360-record-picker";

const mockListCompanies = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  useAuthReady: () => true,
}));
vi.mock("@/lib/crm/companies", () => ({ useCompaniesApi: () => ({ list: mockListCompanies }) }));
vi.mock("@/lib/crm/contacts", () => ({ useContactsApi: () => ({ list: vi.fn() }) }));

function renderPicker() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Crm360RecordPicker mode="account" onSelect={() => {}} />
    </QueryClientProvider>
  );
}

describe("Crm360RecordPicker", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows an error with retry when the list fails, not an empty CRM", async () => {
    mockListCompanies.mockRejectedValue(new Error("boom"));
    renderPicker();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("No records in CRM yet.")).toBeNull();
  });

  it("shows the empty state when the CRM has no records", async () => {
    mockListCompanies.mockResolvedValue({ data: [] });
    renderPicker();
    expect(await screen.findByText("No records in CRM yet.")).toBeTruthy();
  });
});
