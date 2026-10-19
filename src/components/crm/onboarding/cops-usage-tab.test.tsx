import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CopsRequestError } from "@/lib/cops-fetch";

const onboardingApi = vi.hoisted(() => ({ onboarding: vi.fn() }));
const provApi = vi.hoisted(() => ({ wallet: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  useAuthReady: () => true,
}));
vi.mock("@/lib/cops-onboarding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cops-onboarding")>()),
  useCopsOnboardingApi: () => onboardingApi,
}));
vi.mock("@/lib/cops-provisioning", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cops-provisioning")>()),
  useCopsProvisioningApi: () => provApi,
}));

import { CopsUsageTab } from "./cops-usage-tab";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const today = new Date().toISOString().slice(0, 10);

describe("CopsUsageTab", () => {
  beforeEach(() => {
    onboardingApi.onboarding.mockReset();
    provApi.wallet.mockReset();
  });
  afterEach(() => cleanup());

  it("shows first login, milestones with their evidence, credits used and the balance", async () => {
    onboardingApi.onboarding.mockResolvedValue({
      data: {
        activation: {
          instance_id: "i1",
          template_key: "default_trial",
          template_version: 1,
          activation_pct: 50,
          activated_at: null,
          first_login_at: "2026-10-10T09:00:00Z",
          milestones: [
            { key: "first_search", label: "First search", weight: 50, required: true, source: "event", completed_at: "2026-10-11T09:00:00Z", evidence: { source_type: "analytics_event" } },
            { key: "first_export", label: "First export", weight: 50, required: true, source: "event", completed_at: null, evidence: null },
          ],
        },
      },
    });
    provApi.wallet.mockResolvedValue({ data: { balance: 420, usage: [{ day: today, consumed: 80 }], ledger: [], next_cursor: null } });

    wrap(<CopsUsageTab accountId="a1" />);

    expect((await screen.findByTestId("usage-milestones")).textContent).toContain("1 / 2");
    expect(screen.getByTestId("usage-credits-30d").textContent).toContain("80");
    expect(screen.getByTestId("usage-balance").textContent).toContain("420");
    expect(screen.getByText("waiting for the product event")).toBeTruthy();
  });

  it("says there is no usage before the workspace is provisioned", async () => {
    const notProvisioned = new CopsRequestError("not provisioned", { code: "NOT_PROVISIONED", message: "x", request_id: "r", retryable: false }, null);
    onboardingApi.onboarding.mockRejectedValue(notProvisioned);
    provApi.wallet.mockRejectedValue(notProvisioned);

    wrap(<CopsUsageTab accountId="a1" />);

    expect(await screen.findByTestId("usage-empty")).toBeTruthy();
  });
});
