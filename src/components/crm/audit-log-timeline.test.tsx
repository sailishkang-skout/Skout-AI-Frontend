import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { AuditLogTimeline } from "@/components/crm/audit-log-timeline";

const mockList = vi.fn();
const mockMembers = [
  { userId: "u-1", email: "owner@acme.com", fullName: "Owner One", role: "owner", joinedAt: "2024-01-01T00:00:00.000Z" },
  { userId: "u-2", email: "admin@acme.com", fullName: "Admin Two", role: "admin", joinedAt: "2024-01-01T00:00:00.000Z" },
];

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("@/lib/crm/audit", () => ({
  useAuditLogApi: () => ({
    list: mockList,
  }),
}));

vi.mock("@/lib/team", () => ({
  useWorkspaceMembers: () => ({
    data: { data: mockMembers },
  }),
}));

const mockCompaniesList = vi.fn().mockResolvedValue({
  data: [{ id: "company-1", name: "Acme Corp" }],
  total: 1,
  workspaceId: "ws-1",
});
vi.mock("@/lib/crm/companies", () => ({
  useCompaniesApi: () => ({
    list: mockCompaniesList,
  }),
}));

const mockPipelinesList = vi.fn().mockResolvedValue({
  data: [
    {
      id: "pipeline-1",
      name: "Sales Pipeline",
      isDefault: true,
      stages: [{ id: "stage-1", name: "Qualified", orderIndex: 0, probability: 25, isClosedWon: false, isClosedLost: false }],
    },
  ],
  total: 1,
  workspaceId: "ws-1",
});
vi.mock("@/lib/crm/pipelines", () => ({
  usePipelinesApi: () => ({
    list: mockPipelinesList,
  }),
}));

function renderTimeline() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuditLogTimeline entityType="contact" entityId="contact-1" />
    </QueryClientProvider>
  );
}

describe("AuditLogTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton rows while the audit query is pending", async () => {
    mockList.mockImplementation(() => new Promise(() => {}));

    const { container } = renderTimeline();
    await waitFor(() => {
      expect(container.querySelectorAll(".animate-pulse").length).toBe(3);
    });
  });

  it("renders an error alert and retry reissues the query", async () => {
    mockList
      .mockRejectedValueOnce(new ApiError("Audit service failed", 500))
      .mockResolvedValueOnce({ data: [], total: 0, workspaceId: "ws-1" });

    renderTimeline();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(2);
    });
  });

  it("renders an empty state when no audit rows are returned", async () => {
    mockList.mockResolvedValue({ data: [], total: 0, workspaceId: "ws-1" });

    renderTimeline();

    await waitFor(() => {
      expect(screen.getByText("No audit history yet.")).toBeTruthy();
    });
  });

  it("renders rows sorted newest-first and only shows the truncation footer when total exceeds the response length", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: "oldest",
          workspaceId: "ws-1",
          actorId: "u-1",
          action: "update",
          entityType: "contact",
          entityId: "contact-1",
          beforeState: { name: "Old" },
          afterState: { name: "Older" },
          createdAt: new Date(Date.now() - 120_000).toISOString(),
        },
        {
          id: "newest",
          workspaceId: "ws-1",
          actorId: "u-2",
          action: "create",
          entityType: "contact",
          entityId: "contact-1",
          beforeState: null,
          afterState: { name: "Newest contact" },
          createdAt: new Date(Date.now() - 30_000).toISOString(),
        },
      ],
      total: 150,
      workspaceId: "ws-1",
    });

    const { container } = renderTimeline();

    await waitFor(() => {
      expect(screen.getByText("Showing the most recent 100 of 150 changes.")).toBeTruthy();
    });

    const items = Array.from(container.querySelectorAll("li"));
    expect(items[0]?.textContent).toContain("Newest contact");
    expect(items[1]?.textContent).toContain("Older");
  });

  it("renders a delete action badge and resolves the actor name", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: "deleted",
          workspaceId: "ws-1",
          actorId: "u-1",
          action: "delete",
          entityType: "contact",
          entityId: "contact-1",
          beforeState: { name: "Gone", status: "customer" },
          afterState: null,
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
      total: 1,
      workspaceId: "ws-1",
    });

    renderTimeline();

    await waitFor(() => {
      expect(screen.getByText("Deleted")).toBeTruthy();
    });
    expect(screen.getAllByText("Owner One").length).toBeGreaterThan(0);
  });

  it("resolves companyId/stageId to real names instead of showing raw UUIDs, and hides plumbing fields", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          id: "created",
          workspaceId: "ws-1",
          actorId: "u-1",
          action: "create",
          entityType: "contact",
          entityId: "contact-1",
          beforeState: {},
          afterState: {
            id: "contact-1",
            workspaceId: "ws-1",
            firstName: "Katie",
            companyId: "company-1",
            stageId: "stage-1",
            fieldSources: {},
            deletedAt: null,
          },
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      workspaceId: "ws-1",
    });

    const { container } = renderTimeline();

    await waitFor(() => {
      expect(container.textContent).toContain("Acme Corp");
    });
    expect(container.textContent).toContain("Qualified");
    expect(container.textContent).not.toContain("company-1");
    expect(container.textContent).not.toContain("stage-1");
    expect(container.textContent).not.toContain("workspaceId");
    expect(container.textContent).not.toContain("fieldSources");
  });

  it("renders nothing and fails closed when the request is forbidden (403)", async () => {
    mockList.mockRejectedValue(new ApiError("Forbidden", 403));

    const { container } = renderTimeline();

    await waitFor(() => {
      expect(container.textContent).toBe("");
    });
  });
});
