import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarPanel } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function groupLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("nav > div > p")).map((el) => el.textContent ?? "");
}

describe("SidebarPanel — nav-regroup default (ADI-14)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_NAV_REGROUP_ENABLED;

  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_NAV_REGROUP_ENABLED = originalEnv;
  });

  it("shows the 8-module regrouped nav by default, with no flags set", async () => {
    const { container, findByText } = render(<SidebarPanel />);
    await findByText("Skout AI");

    const labels = groupLabels(container);
    expect(labels).toContain("CRM Intelligence");
    expect(labels).toContain("Analytics");
    // Standalone top-level groups, not nested under Intelligence/Settings.
    expect(labels.filter((l) => l === "CRM Intelligence")).toHaveLength(1);
    expect(labels.filter((l) => l === "Analytics")).toHaveLength(1);
  });

  it("falls back to the old grouping when ?nav-regroup=false is set", async () => {
    window.history.pushState({}, "", "/?nav-regroup=false");
    const { container, findByText } = render(<SidebarPanel />);
    await findByText("Skout AI");

    const labels = groupLabels(container);
    expect(labels).not.toContain("CRM Intelligence");
    expect(labels).not.toContain("Analytics");
  });

  it("falls back to the old grouping when NEXT_PUBLIC_NAV_REGROUP_ENABLED is explicitly 'false' (deployment-wide kill switch)", async () => {
    process.env.NEXT_PUBLIC_NAV_REGROUP_ENABLED = "false";
    const { container, findByText } = render(<SidebarPanel />);
    await findByText("Skout AI");

    const labels = groupLabels(container);
    expect(labels).not.toContain("CRM Intelligence");
  });

  it("respects a prior opt-out stored in localStorage", async () => {
    localStorage.setItem("nav-regroup-enabled", "false");
    const { container, findByText } = render(<SidebarPanel />);
    await findByText("Skout AI");

    const labels = groupLabels(container);
    expect(labels).not.toContain("CRM Intelligence");
  });
});
