import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WarmupMailboxesPage from "./page";

const mockReplace = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/warmup/mailboxes",
  useSearchParams: () => mockSearchParams(),
}));

vi.mock("@/lib/api-client", () => ({
  useAuthReady: () => true,
  formatQueryError: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("@/lib/warmup-tool", () => ({
  useWarmupToolApi: () => ({ listMailboxes: vi.fn().mockResolvedValue([]) }),
  mailboxLabel: (m: { emailAddress?: string }) => m.emailAddress ?? "",
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <WarmupMailboxesPage />
    </QueryClientProvider>
  );
}

describe("WarmupMailboxesPage OAuth return notice", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });
  afterEach(() => cleanup());

  it("shows nothing extra without oauth params", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams());
    renderPage();
    expect(screen.queryByText(/mailbox connected/i)).toBeNull();
    expect(screen.queryByText(/could not connect/i)).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("confirms a successful Google connect and clears the query string", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("oauth=connected&provider=google"));
    renderPage();
    expect(screen.getByText(/google mailbox connected/i)).toBeTruthy();
    expect(mockReplace).toHaveBeenCalledWith("/warmup/mailboxes", { scroll: false });
  });

  it("explains a failed connect with the reason code", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("oauth=error&provider=microsoft&reason=OAUTH_STATE_INVALID"));
    renderPage();
    expect(screen.getByText(/could not connect microsoft/i)).toBeTruthy();
    expect(screen.getByText(/OAUTH_STATE_INVALID/)).toBeTruthy();
  });
});
