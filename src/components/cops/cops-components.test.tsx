// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AuditViewer, type CopsAuditRow } from "./AuditViewer";

afterEach(cleanup);

const row: CopsAuditRow = {
  id: "a1",
  occurredAt: "2026-10-06T10:00:00.000Z",
  actorType: "user",
  actorId: "u_1",
  actorName: "Alex Morgan",
  actorEmail: "alex@example.com",
  entityType: "account",
  entityId: "acc_1",
  action: "account.updated",
  reason: "Customer requested an update",
  beforeState: null,
  afterState: null,
  correlationId: "c1",
  sourceChannel: "web",
};

describe("AuditViewer", () => {
  it("shows an empty state when there are no rows", () => {
    render(<AuditViewer rows={[]} onQuery={() => {}} />);
    expect(screen.getByText(/No audit events match/)).toBeTruthy();
  });

  it("renders a row with actor, action and entity", () => {
    render(<AuditViewer rows={[row]} onQuery={() => {}} />);
    expect(screen.getByText("Account Updated")).toBeTruthy();
    expect(screen.getByText("Alex Morgan")).toBeTruthy();
    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getByText("Customer requested an update")).toBeTruthy();
    expect(screen.queryByText("u_1")).toBeNull();
  });

  it("sends the built query string on submit", () => {
    const onQuery = vi.fn();
    render(<AuditViewer rows={[]} onQuery={onQuery} />);
    fireEvent.change(screen.getByLabelText("Search audit log"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onQuery).toHaveBeenCalledWith("search=Alex&limit=25");
  });

  it("shows lifecycle state changes in expandable record details", () => {
    render(
      <AuditViewer
        rows={[{ ...row, entityType: "cops_opportunity", beforeState: { state: "qualified" }, afterState: { state: "demo" } }]}
        onQuery={() => {}}
      />
    );
    fireEvent.click(screen.getByText("Record details"));
    expect(screen.getByText("State: Qualified → Demo")).toBeTruthy();
    expect(screen.getByText("Reference: acc_1")).toBeTruthy();
  });

  it("shows an error alert", () => {
    render(<AuditViewer rows={[]} error="Forbidden" onQuery={() => {}} />);
    expect(screen.getByRole("alert").textContent).toBe("Forbidden");
  });
});
