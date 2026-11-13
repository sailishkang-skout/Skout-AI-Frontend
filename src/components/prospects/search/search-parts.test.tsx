import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFilterSections } from "@/components/prospects/prospect-filter-sidebar";
import { EMPTY_FILTER_DRAFT } from "@/lib/search-constants";
import { AllFiltersDialog } from "./all-filters-dialog";
import { FilterDock } from "./filter-dock";
import { SelectionDock } from "./selection-dock";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

describe("AllFiltersDialog", () => {
  it("lists every filter group in Person, Company and Signals columns and opens one in place", () => {
    const sections = buildFilterSections({ ...EMPTY_FILTER_DRAFT, jobTitle: "CTO" }, () => {});
    const onShowResults = vi.fn();
    render(
      <AllFiltersDialog
        open
        onClose={() => {}}
        sections={sections}
        draft={{ ...EMPTY_FILTER_DRAFT, jobTitle: "CTO" }}
        onClearAll={() => {}}
        onShowResults={onShowResults}
      />
    );
    expect(screen.getByText("Person")).toBeTruthy();
    expect(screen.getByText("Company", { selector: "span.uppercase" })).toBeTruthy();
    expect(screen.getByText("Signals & controls")).toBeTruthy();
    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(sections.length);
    for (const s of sections) expect(screen.getAllByText(s.title).length).toBeGreaterThan(0);

    // The applied value shows under the closed row; opening the row shows its editor.
    expect(screen.getByText("CTO")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Job Title/ }));
    expect(screen.getByPlaceholderText("e.g. VP Sales")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show results" }));
    expect(onShowResults).toHaveBeenCalledTimes(1);
  });
});

describe("FilterDock", () => {
  it("shows the quick filters with their current value and a count of the rest", () => {
    const draft = { ...EMPTY_FILTER_DRAFT, companySizes: ["11-50"] };
    render(<FilterDock sections={buildFilterSections(draft, () => {})} draft={draft} onApply={() => {}} onOpenAll={() => {}} />);
    expect(screen.getByRole("button", { name: /Headcount\s*11–50/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /All filters\s*17 more/ })).toBeTruthy();
  });

  it("opens a filter in a small panel and applies the search", () => {
    const onApply = vi.fn();
    render(<FilterDock sections={buildFilterSections(EMPTY_FILTER_DRAFT, () => {})} draft={EMPTY_FILTER_DRAFT} onApply={onApply} onOpenAll={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Job title/ }));
    expect(screen.getByRole("dialog", { name: "Job Title" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Job Title" })).toBeNull();
  });
});

describe("SelectionDock", () => {
  const lists = [
    { id: "l1", name: "Europe CTOs", prospectCount: 24 },
    { id: "l2", name: "Q4 outbound", prospectCount: 112 },
  ];

  it("is hidden with nothing selected", () => {
    render(<SelectionDock count={0} lists={lists} onAdd={() => {}} onEnrich={() => {}} onClear={() => {}} addPending={false} enrichPending={false} />);
    expect(screen.queryByTestId("selection-dock")).toBeNull();
  });

  it("adds the selection to the list picked, and Enrich uses the same picker", () => {
    const onAdd = vi.fn();
    const onEnrich = vi.fn();
    render(<SelectionDock count={3} lists={lists} onAdd={onAdd} onEnrich={onEnrich} onClear={() => {}} addPending={false} enrichPending={false} />);
    expect(screen.getByText("3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Q4 outbound/ }));
    expect(onAdd).toHaveBeenCalledWith("l2");

    fireEvent.click(screen.getByRole("button", { name: /Enrich/ }));
    expect(screen.getByText("Enrich into a list")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Europe CTOs/ }));
    expect(onEnrich).toHaveBeenCalledWith("l1");
  });
});
