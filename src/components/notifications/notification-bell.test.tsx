import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";

const mockToast = vi.fn();
vi.mock("sonner", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockUnreadCount = vi.fn();
const mockList = vi.fn();
vi.mock("@/lib/notifications", () => ({
  useNotificationsApi: () => ({
    unreadCount: mockUnreadCount,
    list: mockList,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
}));

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>
  );
  return { ...result, queryClient };
}

describe("NotificationBell — toast on new notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnreadCount.mockResolvedValue({ data: { count: 0 } });
  });

  afterEach(() => cleanup());

  it("does not toast for the notifications already present on first load", async () => {
    mockList.mockResolvedValue({
      data: [{ id: "n-1", title: "Existing notification", body: null, readAt: null, createdAt: "2026-01-01T00:00:00Z" }],
    });
    renderBell();

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("toasts when a genuinely new notification appears on a later poll", async () => {
    mockList.mockResolvedValueOnce({
      data: [{ id: "n-1", title: "Existing notification", body: null, readAt: null, createdAt: "2026-01-01T00:00:00Z" }],
    });
    const { queryClient } = renderBell();
    // Wait for the baseline render to actually commit (not just for the mock to have been
    // called) — otherwise React can coalesce it with the seeded update below and the component
    // never sees "n-1" as its own distinct render, breaking the baseline/new-arrival distinction.
    await waitFor(() =>
      expect(queryClient.getQueryData(["notifications", "feed"])).toEqual({
        data: [{ id: "n-1", title: "Existing notification", body: null, readAt: null, createdAt: "2026-01-01T00:00:00Z" }],
      })
    );

    // Seed the "next poll's" result directly into the cache — deterministic, unlike racing an
    // actual refetch against the mocked queryFn's resolution timing.
    await act(async () => {
      queryClient.setQueryData(["notifications", "feed"], {
        data: [
          {
            id: "n-2",
            title: "Hot signal detected",
            body: "Acme Corp just raised funding",
            readAt: null,
            createdAt: "2026-01-02T00:00:00Z",
          },
          { id: "n-1", title: "Existing notification", body: null, readAt: null, createdAt: "2026-01-01T00:00:00Z" },
        ],
      });
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Hot signal detected",
        expect.objectContaining({ description: "Acme Corp just raised funding" })
      )
    );
  });
});
