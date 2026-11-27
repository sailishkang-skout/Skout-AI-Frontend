import { cleanup, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarPanel } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function renderSidebar(permissions: string[], features?: Record<string, boolean>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["me"], { role: "member", permissions });
  if (features) queryClient.setQueryData(["access"], { status: "active", features, request: null });
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
    // Anyone who can read LinkedIn Enrichment sees what is left to capture.
    expect(readOnly.getByText("Capture queue")).toBeTruthy();
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

describe("SidebarPanel — early access feature switches", () => {
  afterEach(() => cleanup());

  it("hides a switched-off area and keeps the rest", async () => {
    const { findByText, queryByText, getByText } = renderSidebar([], { sequences: false });
    await findByText("Skout AI");
    expect(queryByText("Sequences")).toBeNull();
    expect(getByText("Lists & Smart Lists")).toBeTruthy();
  });

  it("shows everything when no switches are loaded", async () => {
    const { findByText, getAllByText } = renderSidebar([]);
    await findByText("Skout AI");
    expect(getAllByText("Sequences").length).toBeGreaterThan(0);
  });
});

describe("SidebarPanel — WORKBOOKS_V2 entry point", () => {
  afterEach(() => cleanup());

  const open = async (features?: Record<string, boolean>) => {
    const view = renderSidebar(["enrichment:read"], features);
    await view.findByText("Skout AI");
    fireEvent.click(view.getByRole("button", { name: "Enrichment" }));
    return view;
  };

  it("workspace A (flag off): shows the existing Workbooks and no V2 entry", async () => {
    const { getByText, queryByText } = await open({ workbooks_v2: false });
    expect(getByText("Workbooks")).toBeTruthy();
    expect(queryByText("Workbooks V2 (beta)")).toBeNull();
  });

  it("workspace B (flag on): shows the V2 entry next to the existing Workbooks", async () => {
    const { getByText, getByRole } = await open({ workbooks_v2: true });
    expect(getByText("Workbooks")).toBeTruthy();
    expect(getByRole("link", { name: /Workbooks V2/ }).getAttribute("href")).toBe("/enrichment/workbooks-v2");
  });

  it("hides the V2 entry while the switches are loading or when the flag is missing", async () => {
    for (const features of [undefined, {}, { enrichment: true }] as Array<Record<string, boolean> | undefined>) {
      const { getByText, queryByText, unmount } = await open(features);
      expect(getByText("Workbooks")).toBeTruthy();
      expect(queryByText("Workbooks V2 (beta)")).toBeNull();
      unmount();
    }
  });

  it("still hides V2 from someone without enrichment access even when the flag is on", async () => {
    const view = renderSidebar([], { workbooks_v2: true });
    await view.findByText("Skout AI");
    expect(view.queryByText("Workbooks V2 (beta)")).toBeNull();
  });
});

