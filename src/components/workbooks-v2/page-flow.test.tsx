import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkbooksV2Page from "@/app/(dashboard)/enrichment/workbooks-v2/page";

/** The V2 page with its real parts: they all follow the one chosen workbook. */
let permissions = ["enrichment:read", "enrichment:capture"];
vi.mock("@/lib/workspace-role", () => ({ useWorkspaceRole: () => ({ permissions: new Set(permissions), hasPermission: (k: string) => permissions.includes(k), isLoading: false }) }));
const api = vi.fn();
vi.mock("@/lib/api-client", async (original) => ({ ...(await original<typeof import("@/lib/api-client")>()), useApiFetch: () => api, useApiFetchBlob: () => vi.fn(), useAuthReady: () => true }));

describe("Workbooks V2 page", () => {
  afterEach(() => cleanup());
  const show = () => {
    api.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/workbooks-v2?")) return { data: [{ id: "w1", name: "Leads", rowCount: 0 }, { id: "w2", name: "Accounts", rowCount: 0 }], total: 2 };
      if (path.includes("/rows?")) return { data: [], window: { total: 0, hasMore: false } };
      if (path.endsWith("/imports") || path === "/api/v1/lists") return { data: [] };
      return { data: { columns: [] } };
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <WorkbooksV2Page />
      </QueryClientProvider>
    );
  };

  it("shows the rows of, and adds rows to, whichever workbook is chosen", async () => {
    permissions = ["enrichment:read", "enrichment:capture"];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Add rows" }));
    expect(screen.getByRole("dialog").textContent).toContain("Add rows to “Leads”");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByLabelText("Workbook"), { target: { value: "w2" } });
    await waitFor(() => expect(api.mock.calls.some(([p]) => String(p).startsWith("/api/v1/workbooks-v2/w2/rows?"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Add rows" }));
    expect(screen.getByRole("dialog").textContent).toContain("Add rows to “Accounts”");
  });

  it("shows rows to a viewer and offers no way to add them", async () => {
    permissions = ["enrichment:read"];
    show();
    expect(await screen.findByText("This workbook has no rows yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add rows" })).toBeNull();
  });
});
