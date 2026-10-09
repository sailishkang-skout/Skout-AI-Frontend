import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditViewer } from "./AuditViewer";

describe("AuditViewer field errors", () => {
  afterEach(() => cleanup());

  it("shows each 422 field message next to its filter", () => {
    render(
      <AuditViewer
        rows={[]}
        onQuery={vi.fn()}
        fieldErrors={{ from: "must be an ISO date", search: "too long" }}
      />
    );
    expect(screen.getByText("From date: must be an ISO date")).toBeTruthy();
    expect(screen.getByText("Search: too long")).toBeTruthy();
  });

  it("renders no field alerts when there are no field errors", () => {
    render(<AuditViewer rows={[]} onQuery={vi.fn()} />);
    expect(screen.queryByText(/From date:/)).toBeNull();
  });

  it("submits the selected date filter as an ISO query value", () => {
    const onQuery = vi.fn();
    render(<AuditViewer rows={[]} onQuery={onQuery} />);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-06" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    const query = new URLSearchParams(onQuery.mock.calls[0][0]);
    expect(query.get("from")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
