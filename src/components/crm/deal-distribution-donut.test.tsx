import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DealDistributionDonut } from "./deal-distribution-donut";
import type { DashboardOverview } from "@/types/crm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const STAGES: DashboardOverview["stages"] = [
  { stageId: "s1", name: "Discovery", count: 2, valueByCurrency: [{ currency: "USD", value: 140000 }] },
  { stageId: "s2", name: "Negotiation", count: 1, valueByCurrency: [{ currency: "USD", value: 60000 }] },
];

describe("DealDistributionDonut", () => {
  afterEach(() => cleanup());

  it("shows a loading state", () => {
    render(<DealDistributionDonut isLoading />);
    screen.getByText(/loading/i);
  });

  it("shows an empty state when there are no open deals", () => {
    render(<DealDistributionDonut stages={[]} />);
    screen.getByText(/no open deals yet/i);
  });

  it("renders the real total value across stages, in the stages' own currency", () => {
    render(<DealDistributionDonut stages={STAGES} />);
    screen.getByText("USD 200k");
  });
});
