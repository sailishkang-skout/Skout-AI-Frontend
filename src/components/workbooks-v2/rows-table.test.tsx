import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FROM_SKOUT, RowsTable, sourceLabel } from "./rows-table";

const rows = { window: vi.fn() };
const columns = vi.fn();
vi.mock("@/lib/workbooks-v2-rows", () => ({ useWorkbookRowsApi: () => rows }));
vi.mock("@/lib/workbooks-v2-import", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-import")>()), useWorkbookImportApi: () => ({ columns }) }));

const cell = (value: unknown, over: Record<string, unknown> = {}) => ({ value, state: "found", foundVia: null, verification: null, ...over });
const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RowsTable workbookId="wb-1" />
    </QueryClientProvider>
  );

describe("Workbook rows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    columns.mockResolvedValue([
      { id: "n", name: "Name", type: "input", config: {} },
      { id: "e", name: "Email", type: "input", config: {} },
      { id: "h", name: "Secret", type: "input", config: {}, hidden: true },
    ]);
    rows.window.mockImplementation(async (_wb: string, offset: number) => ({
      data: [
        { id: offset + 1, prospectId: "p", source: { type: "list", listName: "Q4 leads" }, cells: { n: cell("Ann"), e: cell("ann@acme.com", { foundVia: "cache", verification: "valid" }), h: cell("no") } },
        { id: offset + 2, prospectId: null, source: { type: "csv", fileName: "a.csv" }, cells: { n: cell("Bo"), e: cell("typed@acme.com") } },
      ],
      window: { total: 60, hasMore: offset === 0 },
    }));
  });
  afterEach(() => cleanup());

  it("marks reused values From your Skout data, with how they were verified, and nothing else", async () => {
    show();
    const reused = (await screen.findByText("ann@acme.com")).closest("td")!;
    expect(within(reused).getByText(FROM_SKOUT)).toBeTruthy();
    expect(FROM_SKOUT).toBe("From your Skout data");
    expect(within(reused).getByText("Verified")).toBeTruthy();
    expect(screen.getAllByText(FROM_SKOUT)).toHaveLength(1);
    expect(screen.getByText("List: Q4 leads")).toBeTruthy();
    expect(screen.getByText("CSV: a.csv")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Secret" })).toBeNull();
  });

  it("pages through the rows", async () => {
    show();
    expect(await screen.findByText("Rows 1–2 of 60")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Rows 26–27 of 60")).toBeTruthy();
    expect(rows.window).toHaveBeenLastCalledWith("wb-1", 25, 25);
  });

  it("says when there are no rows", async () => {
    rows.window.mockResolvedValue({ data: [], window: { total: 0, hasMore: false } });
    show();
    expect(await screen.findByText("This workbook has no rows yet.")).toBeTruthy();
  });

  it("names every kind of source", () => {
    expect([
      sourceLabel({ type: "smart_list", smartListName: "ICP" }),
      sourceLabel({ type: "search" }),
      sourceLabel({ type: "manual" }),
      sourceLabel({ type: "hubspot" }),
    ]).toEqual(["Smart list: ICP", "Search", "Added by hand", "hubspot"]);
  });
});
