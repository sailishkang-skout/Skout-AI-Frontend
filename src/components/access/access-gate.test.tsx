import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessState } from "@/lib/access";
import { PRODUCT_FEATURES } from "@/lib/feature-nav";

const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.pathname,
}));

import { AccessGate } from "./access-gate";

const allOn = Object.fromEntries(PRODUCT_FEATURES.map((f) => [f, true])) as AccessState["features"];

function renderGate(state: AccessState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["access"], state);
  return render(
    <QueryClientProvider client={client}>
      <AccessGate>
        <p>workspace content</p>
      </AccessGate>
    </QueryClientProvider>
  );
}

describe("AccessGate", () => {
  beforeEach(() => {
    nav.pathname = "/dashboard";
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("sends a pending workspace to the early access page", async () => {
    renderGate({ status: "pending", features: allOn, request: null });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/early-access"));
    expect(screen.queryByText("workspace content")).toBeNull();
  });

  it("renders the app for an active workspace", async () => {
    renderGate({ status: "active", features: allOn, request: null });
    expect(await screen.findByText("workspace content")).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("shows the plan message on a switched-off area", async () => {
    nav.pathname = "/sequences/12";
    renderGate({ status: "active", features: { ...allOn, sequences: false }, request: null });
    expect(await screen.findByText("This isn't on your plan")).toBeTruthy();
    expect(screen.queryByText("workspace content")).toBeNull();
    expect(screen.getByRole("link", { name: "Contact us" }).getAttribute("href")).toMatch(/^mailto:/);
  });
});
