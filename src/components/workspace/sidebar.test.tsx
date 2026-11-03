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
    expect(readOnly.getByText("People")).toBeTruthy();
    expect(readOnly.getByText("Companies")).toBeTruthy();
    expect(readOnly.queryByText("Capture")).toBeNull();
    readOnly.unmount();

    const canCapture = renderSidebar(["enrichment:read", "enrichment:capture"]);
    await canCapture.findByText("Skout AI");
    fireEvent.click(canCapture.getByRole("button", { name: "Enrichment" }));
    expect(canCapture.getByText("Capture")).toBeTruthy();
  });
});
