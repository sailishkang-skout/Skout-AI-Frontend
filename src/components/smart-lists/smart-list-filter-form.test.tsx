// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { SmartListFacets, SmartListFilters } from "@/types/api";

const facets = vi.fn();
const count = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/lib/api-client");
  return { ...actual, useAuthReady: () => true };
});
vi.mock("@/lib/smart-lists", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/lib/smart-lists");
  return { ...actual, useSmartListApi: () => ({ facets, count }) };
});

import { SmartListFilterForm } from "./smart-list-filter-form";

const FACETS: SmartListFacets = {
  total: 6807,
  industry: [
    { value: "FinTech", label: "FinTech", count: 533 },
    { value: "Financial Services", label: "Financial Services", count: 21 },
  ],
  country: [
    { value: "IN", label: "India", count: 532 },
    { value: "India", label: "India", count: 369 },
    { value: "US", label: "United States", count: 539 },
  ],
  seniority: [
    { value: "vp", label: "VP", count: 764 },
    { value: "director", label: "Director", count: 760 },
  ],
};

let latest: SmartListFilters = {};
function Harness() {
  const [filters, setFilters] = useState<SmartListFilters>({});
  latest = filters;
  return <SmartListFilterForm filters={filters} onChange={setFilters} />;
}

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Harness />
    </QueryClientProvider>
  );
}

describe("SmartListFilterForm", () => {
  beforeEach(() => {
    latest = {};
    facets.mockResolvedValue({ data: FACETS });
    count.mockResolvedValue({ total: 97, demo: false });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("offers industries from the stored values, with counts, and selects several", async () => {
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /Industry/ }));
    expect(await screen.findByText("533")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/^FinTech/));
    fireEvent.click(screen.getByLabelText(/^Financial Services/));
    expect(latest.industries).toEqual(["FinTech", "Financial Services"]);
  });

  it("shows one country entry per country, selecting every stored spelling of it", async () => {
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /Country/ }));
    const india = await screen.findAllByLabelText(/^India/);
    expect(india).toHaveLength(1);
    expect(screen.getByText("901")).toBeTruthy(); // 532 stored as "IN" + 369 as "India"
    fireEvent.click(india[0]!);
    expect(latest.countries).toEqual(["IN", "India"]);
  });

  it("filters the options by what you type", async () => {
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /Industry/ }));
    await screen.findByLabelText(/^FinTech/);
    fireEvent.change(screen.getByPlaceholderText(/Search industries/), { target: { value: "finan" } });
    expect(screen.queryByLabelText(/^FinTech/)).toBeNull();
    expect(screen.getByLabelText(/^Financial Services/)).toBeTruthy();
  });

  it("selects seniorities by their stored value", async () => {
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /Seniority/ }));
    fireEvent.click(await screen.findByLabelText(/^VP/));
    expect(latest.seniorities).toEqual(["vp"]);
  });

  it("shows a live match count for the current filters", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Head of Sales" } });
    await waitFor(() => expect(count).toHaveBeenCalledWith({ jobTitle: "Head of Sales" }), { timeout: 2000 });
    await waitFor(() => expect(document.querySelector("[aria-live]")?.textContent).toContain("97 matching prospects"));
  });

  it("asks you to add a filter instead of counting the whole corpus", async () => {
    renderForm();
    expect(await screen.findByText(/Add a filter to see how many prospects match/)).toBeTruthy();
    expect(count).not.toHaveBeenCalled();
  });
});
