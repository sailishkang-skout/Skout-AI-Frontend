import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listDecisions = vi.fn(async () => ({ data: [] }));
const listAccounts = vi.fn(async () => ({ data: [] }));
vi.mock("@/lib/dexter-platform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dexter-platform")>()),
  useDexterPlatformApi: () => ({ listDecisions }),
}));
vi.mock("@/lib/signals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/signals")>()),
  useSignalsApi: () => ({ listAccounts }),
}));

import { DashboardCommandCenter } from "./dashboard-command-center";

function renderCenter(features?: Record<string, boolean>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (features) client.setQueryData(["access"], { status: "active", features, request: null });
  return render(
    <QueryClientProvider client={client}>
      <DashboardCommandCenter />
    </QueryClientProvider>
  );
}

describe("DashboardCommandCenter — AI switch", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("loads decisions when AI is on", async () => {
    renderCenter({ ai: true });
    await waitFor(() => expect(listDecisions).toHaveBeenCalled());
  });

  it("with AI off, never loads decisions and blurs that card, but still loads signals", async () => {
    renderCenter({ ai: false });
    await waitFor(() => expect(listAccounts).toHaveBeenCalled());
    expect(listDecisions).not.toHaveBeenCalled();
    expect(screen.getByTestId("feature-locked-ai").textContent).toContain("Priority decisions");
  });
});
