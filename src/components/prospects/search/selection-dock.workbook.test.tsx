import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectionDock, type WorkbookTargets } from "./selection-dock";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const lists = [{ id: "l1", name: "Europe CTOs", prospectCount: 24 }];
const targets = (over: Partial<WorkbookTargets> = {}): WorkbookTargets => ({
  items: [
    { id: "w1", name: "Leads", rowCount: 1200 },
    { id: "w2", name: "Accounts", rowCount: 0 },
  ],
  failed: false,
  onAdd: vi.fn(),
  pending: false,
  ...over,
});
const dock = (workbooks?: WorkbookTargets, handlers: { onAdd?: () => void; onEnrich?: () => void; onClear?: () => void } = {}) =>
  render(
    <SelectionDock
      count={3}
      lists={lists}
      onAdd={handlers.onAdd ?? (() => {})}
      onEnrich={handlers.onEnrich ?? (() => {})}
      onClear={handlers.onClear ?? (() => {})}
      addPending={false}
      enrichPending={false}
      workbooks={workbooks}
    />
  );

describe("SelectionDock — Add to workbook", () => {
  afterEach(() => cleanup());

  it("is not offered unless the page provides workbooks", () => {
    dock();
    expect(screen.queryByRole("button", { name: /Add to workbook/ })).toBeNull();
  });

  it("lets the person choose which workbook the selection goes into", () => {
    const workbooks = targets();
    dock(workbooks);
    fireEvent.click(screen.getByRole("button", { name: /Add to workbook/ }));
    expect(screen.getByText("Add 3 to a workbook")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Accounts/ }));
    expect(workbooks.onAdd).toHaveBeenCalledWith({ id: "w2", name: "Accounts", rowCount: 0 });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps the list actions and Clear working beside it", () => {
    const handlers = { onAdd: vi.fn(), onEnrich: vi.fn(), onClear: vi.fn() };
    const workbooks = targets();
    dock(workbooks, handlers);
    fireEvent.click(screen.getByRole("button", { name: /Add to workbook/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
    // One menu at a time, and the list menu holds lists only.
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.queryByRole("menuitem", { name: /Accounts/ })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: /Europe CTOs/ }));
    expect(handlers.onAdd).toHaveBeenCalledWith("l1");
    fireEvent.click(screen.getByRole("button", { name: /Enrich/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Europe CTOs/ }));
    expect(handlers.onEnrich).toHaveBeenCalledWith("l1");
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(handlers.onClear).toHaveBeenCalled();
    expect(workbooks.onAdd).not.toHaveBeenCalled();
  });

  it("says when there are no workbooks, while loading, and when loading fails", () => {
    for (const [over, text] of [
      [{ items: [] }, "You have no workbooks yet."],
      [{ items: undefined }, "Loading workbooks…"],
      [{ items: undefined, failed: true }, "Your workbooks could not be loaded."],
    ] as const) {
      dock(targets(over as Partial<WorkbookTargets>));
      fireEvent.click(screen.getByRole("button", { name: /Add to workbook/ }));
      expect(screen.getByText(text)).toBeTruthy();
      cleanup();
    }
  });

  it("cannot be pressed again while an addition is on its way", () => {
    dock(targets({ pending: true }));
    expect((screen.getByRole("button", { name: /Add to workbook/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
