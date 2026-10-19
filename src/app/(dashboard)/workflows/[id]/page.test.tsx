import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = {
  get: vi.fn(),
  listVersions: vi.fn(),
  listRuns: vi.fn(),
  saveDraftVersion: vi.fn(),
  publishVersion: vi.fn(),
  run: vi.fn(),
  rollback: vi.fn(),
  update: vi.fn(),
  getRun: vi.fn(),
  retryRun: vi.fn(),
  cancelRun: vi.fn(),
  decideApproval: vi.fn(),
  replayRun: vi.fn(),
};

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "auto-1" }) }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  useAuthReady: () => true,
}));
vi.mock("@/lib/automations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/automations")>()),
  useAutomationsApi: () => api,
}));
// The canvas is reactflow; this page test only needs it to show and report edits.
vi.mock("@/components/automations/automation-canvas", () => ({
  AutomationCanvas: () => <div data-testid="canvas-stub" />,
}));

import AutomationDetailPage from "./page";

const GRAPH = { nodes: [{ id: "t", type: "trigger", config: {} }], edges: [] };
const run = (over: Record<string, unknown>) => ({
  id: "run-1",
  automationId: "auto-1",
  automationVersionId: "v-1",
  workspaceId: "ws-1",
  triggerType: "manual",
  status: "succeeded",
  isSimulation: false,
  correlationId: "c",
  createdAt: new Date().toISOString(),
  startedAt: null,
  finishedAt: null,
  version: 1,
  ...over,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AutomationDetailPage />
    </QueryClientProvider>
  );
}

describe("Workflow builder page (COPS-10)", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { id: "auto-1", workspaceId: "ws-1", name: "Flow", description: null, status: "active", currentVersion: 2, createdAt: "", updatedAt: "" } });
    api.listVersions.mockResolvedValue({
      data: [
        { id: "v-2", automationId: "auto-1", version: 2, graph: GRAPH, status: "published", publishedAt: new Date().toISOString() },
        { id: "v-1", automationId: "auto-1", version: 1, graph: GRAPH, status: "published", publishedAt: new Date().toISOString() },
      ],
    });
    api.listRuns.mockResolvedValue({ data: [], next_before: null });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("Publish waits for a successful simulation of the canvas as it is now", async () => {
    api.saveDraftVersion.mockResolvedValue({ data: {} });
    api.run.mockResolvedValue({ data: run({ id: "sim-1", isSimulation: true, status: "pending", version: 0 }) });
    renderPage();
    const publish = (await screen.findByTestId("publish-button")) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    expect((await screen.findByTestId("publish-hint")).textContent).toMatch(/Simulate the workflow/);

    api.listRuns.mockResolvedValue({ data: [run({ id: "sim-1", isSimulation: true, status: "succeeded", version: 0 })], next_before: null });
    fireEvent.click(screen.getByRole("button", { name: /Simulate/ }));
    await waitFor(() => expect((screen.getByTestId("publish-button") as HTMLButtonElement).disabled).toBe(false));
  });

  it("rolls back to an earlier version, and the live one has no rollback", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.rollback.mockResolvedValue({ data: { id: "v-3", version: 3, graph: GRAPH, status: "published", restoredFrom: 1 } });
    renderPage();
    fireEvent.click(await screen.findByTestId("rollback-v1"));
    await waitFor(() => expect(api.rollback).toHaveBeenCalledWith("auto-1", 1));
    expect(screen.queryByTestId("rollback-v2")).toBeNull();
  });

  it("a run waiting on approval offers approve, reject and cancel; a finished run offers replay", async () => {
    api.listRuns.mockResolvedValue({ data: [run({ id: "r-wait", status: "awaiting_approval" }), run({ id: "r-done", status: "failed" })], next_before: null });
    api.decideApproval.mockResolvedValue({ data: { runId: "r-wait", decision: "approve", nodeId: "ok" } });
    api.replayRun.mockResolvedValue({ data: run({ id: "r-new", status: "pending" }) });
    renderPage();
    fireEvent.click(await screen.findByTestId("run-approve"));
    await waitFor(() => expect(api.decideApproval).toHaveBeenCalledWith("r-wait", "approve", undefined));
    expect(screen.getByTestId("run-reject")).toBeTruthy();
    expect(screen.getByTestId("run-cancel")).toBeTruthy();
    fireEvent.click(screen.getByTestId("run-replay"));
    await waitFor(() => expect(api.replayRun).toHaveBeenCalledWith("r-done", "same"));
  });
});
