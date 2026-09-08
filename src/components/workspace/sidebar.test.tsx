import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarPanel } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function groupLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("nav > div > p")).map((el) => el.textContent ?? "");
}

describe("SidebarPanel — Pipeline/Prospects/Engage/Workflows grouping", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => cleanup());

  it("renders the Command Center's own grouping, with every route folded in exactly once", async () => {
    const { container, findByText } = render(<SidebarPanel />);
    await findByText("Skout AI");

    const labels = groupLabels(container);
    expect(labels).toEqual([
      "Home",
      "Pipeline",
      "Prospects",
      "Engage",
      "Workflows",
      "Intelligence",
      "Settings & Help",
    ]);
  });
});
