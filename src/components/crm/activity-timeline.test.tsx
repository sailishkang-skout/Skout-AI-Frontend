import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityTimeline } from "@/components/crm/activity-timeline";

const mockList = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/crm/activities", () => ({
  useActivitiesApi: () => ({
    list: mockList,
    create: mockCreate,
  }),
}));

function renderTimeline() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ActivityTimeline entityType="contact" entityId="contact-1" />
    </QueryClientProvider>
  );
}

afterEach(cleanup);

describe("ActivityTimeline", () => {
  it("renders a known activity type with its icon and label", async () => {
    mockList.mockResolvedValue({
      data: [{ id: "a-1", activityType: "note", subject: "Called about pricing", occurredAt: "2026-01-01T00:00:00.000Z" }],
    });
    renderTimeline();
    expect(await screen.findByText("Called about pricing")).toBeTruthy();
  });

  it("falls back instead of crashing when activityType isn't in the CRM's known set", async () => {
    // activities.activity_type has no DB-level enum/check constraint — an automation's CRM
    // writeback node (or any other writer) can insert a value outside ActivityType's closed
    // union. This is exactly what happened in production: an untouched writeback node defaulted
    // to "workflow_action", which isn't a recognized ActivityType, and crashed the whole timeline.
    mockList.mockResolvedValue({
      data: [{ id: "a-1", activityType: "workflow_action", subject: "", occurredAt: "2026-01-01T00:00:00.000Z" }],
    });
    renderTimeline();
    expect(await screen.findByText("workflow_action")).toBeTruthy();
  });
});
