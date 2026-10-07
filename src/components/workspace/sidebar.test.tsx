import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarPanel } from "./sidebar";

const { mockHasPermission } = vi.hoisted(() => ({
  mockHasPermission: vi.fn<(permission: string) => boolean>(),
}));

vi.mock("@/lib/workspace-role", () => ({
  useWorkspaceRole: () => ({ hasPermission: mockHasPermission }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function groupLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("nav > div > p")).map((el) => el.textContent ?? "");
}

describe("SidebarPanel — Pipeline/Prospects/Engage/Workflows grouping", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    mockHasPermission.mockReturnValue(false);
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

  it("shows enrichment routes only when the matching workspace permission is granted", async () => {
    mockHasPermission.mockImplementation((permission) => permission === "enrichment:read");
    const readOnly = render(<SidebarPanel />);
    await readOnly.findByText("Skout AI");
    fireEvent.click(readOnly.getByRole("button", { name: "Enrichment" }));
    expect(readOnly.getByText("People")).toBeTruthy();
    expect(readOnly.getByText("Companies")).toBeTruthy();
    expect(readOnly.queryByText("Capture")).toBeNull();
    readOnly.unmount();

    mockHasPermission.mockImplementation((permission) =>
      permission === "enrichment:read" || permission === "enrichment:capture"
    );
    const canCapture = render(<SidebarPanel />);
    await canCapture.findByText("Skout AI");
    fireEvent.click(canCapture.getByRole("button", { name: "Enrichment" }));
    expect(canCapture.getByText("Capture")).toBeTruthy();
  });
});
