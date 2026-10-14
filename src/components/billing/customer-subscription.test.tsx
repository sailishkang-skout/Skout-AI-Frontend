// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CustomerSubscription } from "@/lib/billing";

const api = { subscription: vi.fn(), payInvoice: vi.fn() };
vi.mock("@/lib/api-client", () => ({ useAuthReady: () => true, useApiFetch: () => vi.fn(), authQueryOptions: {}, formatQueryError: (_e: unknown, f: string) => f }));
vi.mock("@/lib/billing", async (original) => ({ ...(await original<typeof import("@/lib/billing")>()), useBillingApi: () => api }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { CustomerSubscriptionCard, SubscriptionStatusBanner } from "./customer-subscription";

const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);
const bill = (over: Partial<CustomerSubscription["invoices"][number]> = {}) => ({
  id: "b1",
  period_start: "2026-10-01T00:00:00Z",
  period_end: "2026-11-01T00:00:00Z",
  due_at: "2026-10-01T00:00:00Z",
  amount_minor: 94_800,
  currency: "USD",
  status: "open",
  paid_at: null,
  ...over,
});
const sub = (over: Partial<CustomerSubscription> = {}): CustomerSubscription => ({
  status: "suspended",
  billing: "payment_link",
  currency: "USD",
  cadence: "monthly",
  seats: 10,
  renews_at: "2027-10-01T00:00:00Z",
  invoices: [bill(), bill({ id: "b0", period_start: "2026-09-01T00:00:00Z", status: "paid", paid_at: "2026-09-02T00:00:00Z" })],
  dunning: { overdue_invoice_id: "b1", due_at: "2026-10-01T00:00:00Z", day: 16, next_status: "closed", next_status_at: "2026-11-15T00:00:00Z" },
  ...over,
});

beforeEach(() => {
  api.subscription.mockReset();
  api.payInvoice.mockReset();
});
afterEach(cleanup);

describe("customer subscription", () => {
  it("a suspended workspace sees why on every page, with the way to the bill", async () => {
    api.subscription.mockResolvedValue({ data: sub() });
    wrap(<SubscriptionStatusBanner />);
    const banner = await screen.findByTestId("subscription-status-banner");
    expect(banner.textContent).toContain("suspended for an unpaid bill");
    expect(banner.querySelector("a")?.getAttribute("href")).toBe("/settings/workspace#subscription");
  });

  it("no banner while the subscription is in good standing, or for a workspace Skout does not bill", async () => {
    api.subscription.mockResolvedValueOnce({ data: sub({ status: "active", dunning: null }) });
    const { unmount } = wrap(<SubscriptionStatusBanner />);
    await waitFor(() => expect(api.subscription).toHaveBeenCalled());
    expect(screen.queryByTestId("subscription-status-banner")).toBeNull();
    unmount();
    api.subscription.mockResolvedValueOnce({ data: null });
    wrap(<CustomerSubscriptionCard />);
    await waitFor(() => expect(api.subscription).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("customer-subscription")).toBeNull();
  });

  it("shows the bills read-only and opens the payment page for an open one", async () => {
    api.subscription.mockResolvedValue({ data: sub() });
    api.payInvoice.mockResolvedValue({ data: { checkout_url: "https://rzp.io/i/abc", status: "requested" } });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    wrap(<CustomerSubscriptionCard />);
    expect((await screen.findByTestId("customer-subscription-status")).textContent).toBe("Suspended");
    expect(screen.getByTestId("customer-subscription").textContent).toContain("16 days overdue");
    // One Pay now: the paid bill has none.
    const pay = screen.getAllByRole("button", { name: /Pay now/ });
    expect(pay).toHaveLength(1);
    fireEvent.click(pay[0]!);
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://rzp.io/i/abc", "_blank", "noopener,noreferrer"));
    expect(api.payInvoice).toHaveBeenCalledWith("b1");
  });

  it("an invoiced bill is paid as the invoice says, not from a button", async () => {
    api.subscription.mockResolvedValue({ data: sub({ billing: "invoiced" }) });
    wrap(<CustomerSubscriptionCard />);
    expect(await screen.findByText("Pay as the invoice says")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Pay now/ })).toBeNull();
  });
});
