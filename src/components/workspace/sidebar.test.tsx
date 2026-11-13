import { cleanup, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarPanel } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function renderSidebar(permissions: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["me"], { role: "member", permissions });
  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarPanel />
    </QueryClientProvider>
  );
}

function groupLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("nav > div > p")).map((el) => el.textContent ?? "");
}

describe("SidebarPanel — Pipeline/Prospects/Engage/Workflows grouping", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => cleanup());

  it("renders the Command Center's own grouping, with every route folded in exactly once", async () => {
    const { container, findByText } = renderSidebar([]);
    await findByText("Skout AI");

    const labels = groupLabels(container);
    expect(labels).toEqual([
      "Home",
      "Prospects",
      "Pipeline",
      "Engage",
      "Workflows",
      "Intelligence",
      "Settings & Help",
    ]);
  });

  it("shows enrichment routes only when the matching workspace permission is granted", async () => {
    const readOnly = renderSidebar(["enrichment:read"]);
    await readOnly.findByText("Skout AI");
    fireEvent.click(readOnly.getByRole("button", { name: "Enrichment" }));
    // Enrichment holds only provider enrichment; LinkedIn Enrichment is its own Prospects item.
    expect(readOnly.getByText("Workbooks")).toBeTruthy();
    expect(readOnly.queryByText("People")).toBeNull();
    fireEvent.click(readOnly.getByRole("button", { name: "Enrichment" }));
    fireEvent.click(readOnly.getByRole("button", { name: "LinkedIn Enrichment" }));
    expect(readOnly.getByText("People")).toBeTruthy();
    expect(readOnly.getByText("Companies")).toBeTruthy();
    expect(readOnly.getByText("Job changes")).toBeTruthy();
    expect(readOnly.queryByText("Capture")).toBeNull();
    expect(readOnly.queryByText("Providers")).toBeNull();
    readOnly.unmount();

    const canCapture = renderSidebar(["enrichment:read", "enrichment:capture"]);
    await canCapture.findByText("Skout AI");
    fireEvent.click(canCapture.getByRole("button", { name: "LinkedIn Enrichment" }));
    expect(canCapture.getByText("Capture")).toBeTruthy();
    canCapture.unmount();

    // Without any enrichment permission, neither section is shown.
    const none = renderSidebar([]);
    await none.findByText("Skout AI");
    expect(none.queryByRole("button", { name: "Enrichment" })).toBeNull();
    expect(none.queryByRole("button", { name: "LinkedIn Enrichment" })).toBeNull();
  });
});
