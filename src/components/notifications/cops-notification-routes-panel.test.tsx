import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listCopsRoutes, setCopsRoute, resetCopsRoute } = vi.hoisted(() => ({
  listCopsRoutes: vi.fn(),
  setCopsRoute: vi.fn(),
  resetCopsRoute: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  useAuthReady: () => true,
  formatQueryError: (_error: unknown, fallback: string) => fallback,
}));

vi.mock("@/lib/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notifications")>();
  return {
    ...actual,
    useNotificationsApi: () => ({ listCopsRoutes, setCopsRoute, resetCopsRoute }),
  };
});

import { CopsNotificationRoutesPanel } from "./cops-notification-routes-panel";

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CopsNotificationRoutesPanel />
    </QueryClientProvider>
  );
}

describe("CopsNotificationRoutesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCopsRoutes.mockResolvedValue({ data: [] });
    setCopsRoute.mockResolvedValue({ data: {}, request_id: "request-1" });
    resetCopsRoute.mockResolvedValue({ data: { reset: true }, request_id: "request-1" });
  });

  afterEach(() => cleanup());

  it("shows configured defaults and only saves route changes with an auditable reason", async () => {
    renderPanel();

    await screen.findByText("Opportunity qualified");
    fireEvent.click(screen.getByText("Opportunity qualified"));

    const saveButton = screen.getAllByRole("button", { name: "Save route" })[0];
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason for route changes"), {
      target: { value: "Route payment ownership to Finance" },
    });
    fireEvent.click(screen.getByLabelText("Route OpportunityQualified to Finance"));
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(setCopsRoute).toHaveBeenCalledWith(
        "OpportunityQualified",
        ["sales", "sales_manager", "finance"],
        "Route payment ownership to Finance"
      )
    );
  });

  it("preserves an explicit empty override instead of reverting to defaults", async () => {
    listCopsRoutes.mockResolvedValue({
      data: [{ eventType: "PaymentRequested", roleKeys: [], updatedAt: "2026-10-06T00:00:00.000Z" }],
    });
    renderPanel();

    expect(await screen.findByText(/Workspace override: No recipients/)).toBeTruthy();
    fireEvent.click(screen.getByText("Payment requested"));
    expect((screen.getByLabelText("Route PaymentRequested to Finance") as HTMLInputElement).checked).toBe(false);
  });

  it("lets admins reset an override back to system defaults with an audit reason", async () => {
    listCopsRoutes.mockResolvedValue({
      data: [{ eventType: "PaymentRequested", roleKeys: ["cs"], updatedAt: "2026-10-06T00:00:00.000Z" }],
    });
    renderPanel();
    await screen.findByText("Payment requested");
    fireEvent.click(screen.getByText("Payment requested"));
    fireEvent.change(screen.getByLabelText("Reason for route changes"), {
      target: { value: "Restore the standard finance recipients" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    await waitFor(() =>
      expect(resetCopsRoute).toHaveBeenCalledWith(
        "PaymentRequested",
        "Restore the standard finance recipients"
      )
    );
  });
});
