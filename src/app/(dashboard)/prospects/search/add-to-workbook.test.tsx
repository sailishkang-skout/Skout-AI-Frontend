import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import ProspectsSearchPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/credits/insufficient-credits-modal", () => ({
  useCreditsModal: () => ({ showInsufficientCredits: vi.fn(), closeCreditsModal: vi.fn() }),
  useCreditGuard: () => vi.fn(() => true),
  isInsufficientCreditsError: () => false,
  parseCreditsDetails: () => ({}),
  handleCreditsError: () => false,
}));
const featureOn = vi.fn();
vi.mock("@/lib/access", () => ({ useFeatureOn: () => featureOn() }));

const api = vi.fn();
vi.mock("@/lib/api-client", async (original) => ({ ...(await original<typeof import("@/lib/api-client")>()), useApiFetch: () => api, useAuthReady: () => true }));

const person = (i: number) => ({ prospectId: `p-${i}`, companyId: `c-${i}`, fullName: `Person ${i}`, title: "CTO", seniority: "vp", country: "GB", industry: "SaaS", companyDomain: `co${i}.com` });
let permissions: string[];
let addition: () => Promise<unknown>;

function item(counts: Partial<Record<"total" | "processed" | "imported" | "duplicates" | "skipped" | "failed", number>>, status = "completed") {
  return { data: { id: "imp-1", workbookId: "w1", sourceType: "search", sourceName: null, truncated: null, status, error: null, counts: { total: 2, processed: 2, imported: 2, duplicates: 0, skipped: 0, failed: 0, ...counts } } };
}

const sent = () => api.mock.calls.filter(([path]) => String(path).includes("prospect-imports"));

async function show() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProspectsSearchPage />
    </QueryClientProvider>
  );
  await screen.findByLabelText("Select Person 1");
}
const pick = (...people: number[]) => people.forEach((i) => fireEvent.click(screen.getByLabelText(`Select Person ${i}`)));
async function addTo(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: /Add to workbook/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

describe("Search — Add to workbook", () => {
  beforeEach(() => {
    featureOn.mockReturnValue(true);
    permissions = ["enrichment:read", "enrichment:capture"];
    addition = async () => item({});
    api.mockReset();
    api.mockImplementation(async (path: string) => {
      if (path === "/api/v1/me") return { permissions };
      if (path === "/api/v1/search/prospects") return { results: [person(1), person(2), person(3)], total: 3, page: 1, pageSize: 25 };
      if (path.startsWith("/api/v1/workbooks-v2?")) return { data: [{ id: "w1", name: "Leads", rowCount: 4, rowLimit: 100000 }], total: 1 };
      if (path.includes("prospect-imports")) return addition();
      if (path.startsWith("/api/v1/lists")) return { data: [], total: 0 };
      return { scores: {} };
    });
  });
  afterEach(() => cleanup());

  it("sends the selected prospect ids to the chosen workbook and says how many were added", async () => {
    await show();
    pick(1, 3);
    await waitFor(() => expect(screen.getByRole("button", { name: /Add to workbook/ })).toBeTruthy());
    await addTo(/Leads/);
    expect(await screen.findByText("Added 2 of 2 selected to “Leads”.")).toBeTruthy();
    expect(sent()).toHaveLength(1);
    expect(sent()[0]![0]).toBe("/api/v1/workbooks-v2/w1/prospect-imports");
    expect(JSON.parse(sent()[0]![1].body)).toEqual({ source: { type: "search" }, selection: { prospectIds: ["p-1", "p-3"] } });
    expect(screen.getByRole("link", { name: "Open Workbooks V2" }).getAttribute("href")).toBe("/enrichment/workbooks-v2");
    // The selection is spent, so the dock goes.
    expect(screen.queryByTestId("selection-dock")).toBeNull();
  });

  it("reports a partial result with the reasons", async () => {
    addition = async () => item({ total: 3, imported: 1, duplicates: 1, failed: 1 });
    await show();
    pick(1, 2, 3);
    await addTo(/Leads/);
    expect(await screen.findByText("Added 1 of 3 selected to “Leads”. Not added: 1 already there, 1 over the row limit.")).toBeTruthy();
  });

  it("shows the server's row-limit message and keeps the selection", async () => {
    addition = async () => {
      throw new ApiError("This workbook already holds its limit of 100,000 rows.", 422, { code: "ROW_LIMIT_EXCEEDED", error: "ROW_LIMIT_EXCEEDED", message: "This workbook already holds its limit of 100,000 rows." });
    };
    await show();
    pick(2);
    await addTo(/Leads/);
    expect(await screen.findByText("This workbook already holds its limit of 100,000 rows.")).toBeTruthy();
    expect(screen.getByTestId("selection-dock")).toBeTruthy();
    expect((screen.getByLabelText("Select Person 2") as HTMLInputElement).checked).toBe(true);
  });

  it("keeps the selection when the addition ends as failed", async () => {
    addition = async () => ({ data: { ...item({ imported: 0 }, "failed").data, error: { code: "IMPORT_FAILED", message: "Something went wrong on our side." } } });
    await show();
    pick(2);
    await addTo(/Leads/);
    expect(await screen.findByText("Added 0 of 1 selected to “Leads”. Something went wrong on our side.")).toBeTruthy();
    expect(screen.getByTestId("selection-dock")).toBeTruthy();
  });

  it.each([
    ["the workspace does not have Workbooks V2", () => featureOn.mockReturnValue(false)],
    ["the person cannot edit workbooks", () => (permissions = ["enrichment:read"])],
  ])("is not offered when %s", async (_name, arrange) => {
    arrange();
    await show();
    pick(1);
    await waitFor(() => expect(api.mock.calls.some(([path]) => path === "/api/v1/me")).toBe(true));
    expect(screen.getByRole("button", { name: /Add to list/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add to workbook/ })).toBeNull();
    expect(api.mock.calls.some(([path]) => String(path).startsWith("/api/v1/workbooks-v2"))).toBe(false);
  });
});
