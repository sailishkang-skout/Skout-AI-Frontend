import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnrollInSequencePanel } from "./enroll-in-sequence-panel";
import type { Sequence } from "@/types/api";

const mockList = vi.fn();
const mockEnroll = vi.fn();
vi.mock("@/lib/sequences", () => ({
  useSequencesApi: () => ({
    list: mockList,
    enroll: mockEnroll,
  }),
}));

const ACTIVE_SEQUENCE: Sequence = {
  id: "seq-1",
  workspaceId: "ws-1",
  name: "Outbound A",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderPanel(props: Partial<React.ComponentProps<typeof EnrollInSequencePanel>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onCancel = vi.fn();
  const onEnrolled = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <EnrollInSequencePanel onCancel={onCancel} onEnrolled={onEnrolled} {...props} />
    </QueryClientProvider>
  );
  return { onCancel, onEnrolled };
}

describe("EnrollInSequencePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ data: [ACTIVE_SEQUENCE], total: 1 });
    mockEnroll.mockResolvedValue({ enrolled: 1 });
  });

  afterEach(() => cleanup());

  it("enrolls a whole list when given a listId", async () => {
    const { onEnrolled } = renderPanel({ listId: "list-1" });
    await screen.findByText("Enroll this list in a sequence");

    fireEvent.change(await screen.findByRole("combobox"), { target: { value: "seq-1" } });
    fireEvent.click(screen.getByRole("button", { name: /^enroll$/i }));

    await waitFor(() => expect(mockEnroll).toHaveBeenCalledWith("seq-1", { listId: "list-1" }));
    await waitFor(() => expect(onEnrolled).toHaveBeenCalled());
  });

  it("enrolls a single prospect when given prospectIds", async () => {
    renderPanel({ prospectIds: ["p1"] });
    await screen.findByText("Enroll in a sequence");

    fireEvent.change(await screen.findByRole("combobox"), { target: { value: "seq-1" } });
    fireEvent.click(screen.getByRole("button", { name: /^enroll$/i }));

    await waitFor(() => expect(mockEnroll).toHaveBeenCalledWith("seq-1", { prospectIds: ["p1"] }));
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const { onCancel } = renderPanel({ listId: "list-1" });
    await screen.findByText("Enroll this list in a sequence");

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
