import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PendingVoiceHandoffsQueue } from "./pending-voice-handoffs";

const mockList = vi.fn();

vi.mock("@/lib/dexter-platform", () => ({
  useDexterPlatformApi: () => ({
    listLinkedinVoiceHandoffs: mockList,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("PendingVoiceHandoffsQueue (LVH-01)", () => {
  it("renders nothing when there are no pending handoffs", async () => {
    mockList.mockResolvedValue({ data: [] });
    const { container } = renderWithClient(<PendingVoiceHandoffsQueue />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("lists only handed_off handoffs, not confirmed/expired ones", async () => {
    mockList.mockResolvedValue({
      data: [
        { id: "h-1", status: "handed_off", prospectName: "Ada Lovelace", mobileUrl: "https://x/h/tok1", expiresAt: null },
        { id: "h-2", status: "confirmed", prospectName: "Grace Hopper", mobileUrl: "https://x/h/tok2", expiresAt: null },
        { id: "h-3", status: "expired", prospectName: "Alan Turing", mobileUrl: "https://x/h/tok3", expiresAt: null },
      ],
    });

    renderWithClient(<PendingVoiceHandoffsQueue />);

    await waitFor(() => screen.getByText("Ada Lovelace"));
    expect(screen.queryByText("Grace Hopper")).toBeNull();
    expect(screen.queryByText("Alan Turing")).toBeNull();
    expect(screen.getByText("Needs your action — voice notes awaiting send")).toBeTruthy();
  });
});
