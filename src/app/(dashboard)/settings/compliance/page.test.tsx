import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ComplianceCenterPage from "./page";

/** Completing an erasure request removes data (WB2-027), so the page confirms it first and says what went. */
const api = vi.hoisted(() => ({
  listSuppressions: vi.fn(),
  addSuppression: vi.fn(),
  removeSuppression: vi.fn(),
  listConsents: vi.fn(),
  revokeConsent: vi.fn(),
  listDsar: vi.fn(),
  createDsar: vi.fn(),
  updateDsar: vi.fn(),
}));
vi.mock("@/lib/compliance", () => ({ useComplianceApi: () => api }));
vi.mock("@/lib/api-client", async (original) => ({ ...(await original<typeof import("@/lib/api-client")>()), useAuthReady: () => true }));
vi.mock("@/lib/workspace-role", () => ({ useWorkspaceRole: () => ({ canDelete: true }) }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ toast }));

const request = (requestType: string, status = "in_progress") => ({ id: "r1", workspaceId: "w", requestType, subjectEmail: "gone@example.com", status, fulfillmentMode: "manual", notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
const erasure = { rowsRemoved: 1_200, cellsCleared: 1, workbooks: 3, reportsCleaned: 0, previewsCancelled: 0 };

function show(requestType: string) {
  api.listDsar.mockResolvedValue({ data: [request(requestType)], total: 1 });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ComplianceCenterPage />
    </QueryClientProvider>
  );
}
const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("completing a data subject request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listSuppressions.mockResolvedValue({ data: [], total: 0 });
    api.listConsents.mockResolvedValue({ data: [], total: 0 });
    api.updateDsar.mockResolvedValue({ data: request("erasure", "completed"), erasure });
  });
  afterEach(() => cleanup());

  it("asks before completing an erasure, saying what is removed for good", async () => {
    show("erasure");
    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("permanently removes gone@example.com from every Workbooks V2 workbook");
    expect(dialog.textContent).toContain("can’t be restored");
    expect(api.updateDsar).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.updateDsar).not.toHaveBeenCalled();
  });

  it("completes it once confirmed, says what went and reads the suppression list again", async () => {
    show("erasure");
    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    const before = api.listSuppressions.mock.calls.length;
    press("Remove and complete");
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(api.updateDsar.mock.calls).toEqual([["r1", "completed"]]);
    expect(toast.success).toHaveBeenCalledWith("Removed 1,200 workbook rows and cleared 1 other cell. The address is on the suppression list.", "Erasure completed");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(api.listSuppressions.mock.calls.length).toBeGreaterThan(before));
  });

  it("says when it could not be done, leaving the request to try again", async () => {
    api.updateDsar.mockRejectedValue(new Error("no"));
    show("erasure");
    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    press("Remove and complete");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Complete" })).toBeTruthy();
  });

  it("completes other requests, and rejects or starts an erasure, without asking", async () => {
    api.updateDsar.mockResolvedValue({ data: request("access", "completed") });
    show("access");
    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(api.updateDsar).toHaveBeenCalledWith("r1", "completed"));
    expect(toast.success).not.toHaveBeenCalled();
    cleanup();

    api.updateDsar.mockClear();
    show("erasure");
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(api.updateDsar).toHaveBeenCalledWith("r1", "rejected"));
  });
});
