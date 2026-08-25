import { describe, expect, it } from "vitest";
import { formatDueDate, formatMoney, summarizeAuditDiff } from "./crm-display";

describe("formatMoney", () => {
  it("formats a positive amount with currency", () => {
    expect(formatMoney(24000.75, "USD")).toBe("$24,000.75");
  });

  it("returns an em dash for null", () => {
    expect(formatMoney(null)).toBe("—");
  });

  it("returns an em dash for undefined", () => {
    expect(formatMoney(undefined)).toBe("—");
  });

  it("defaults to USD when currency omitted", () => {
    expect(formatMoney(100)).toBe("$100.00");
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });
});

describe("formatDueDate", () => {
  it("returns null for a null/undefined date", () => {
    expect(formatDueDate(null)).toBeNull();
    expect(formatDueDate(undefined)).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(formatDueDate("not-a-date")).toBeNull();
  });

  it("labels today", () => {
    const today = new Date().toISOString();
    expect(formatDueDate(today)).toEqual({ label: "Due today", overdue: false });
  });

  it("labels tomorrow", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(formatDueDate(tomorrow)).toEqual({ label: "Due tomorrow", overdue: false });
  });

  it("labels a future date in N days", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatDueDate(future)).toEqual({ label: "Due in 3 days", overdue: false });
  });

  it("labels yesterday as 1 day overdue", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatDueDate(yesterday)).toEqual({ label: "1 day overdue", overdue: true });
  });

  it("labels a past date as N days overdue", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatDueDate(past)).toEqual({ label: "3 days overdue", overdue: true });
  });
});

describe("summarizeAuditDiff", () => {
  it("renders create rows as a flat list of all new field values, with humanized labels", () => {
    expect(summarizeAuditDiff(null, { name: "Acme", amount: 100 }, "create")).toEqual([
      "Name: Acme",
      "Amount: $100.00",
    ]);
  });

  it("renders update rows only for changed keys and preserves arrows", () => {
    expect(summarizeAuditDiff({ name: "Acme", amount: 100 }, { name: "Acme", amount: 150 }, "update")).toEqual([
      "Amount: $100.00 → $150.00",
    ]);
  });

  it("renders delete rows using the final pre-delete state and a deleted-with prefix", () => {
    expect(summarizeAuditDiff({ name: "Acme", status: "open" }, null, "delete")).toEqual([
      "Deleted with: Name: Acme",
      "Deleted with: Status: open",
    ]);
  });

  it("hides internal bookkeeping fields entirely (id, workspaceId, fieldSources, timestamps, etc.)", () => {
    const after = {
      id: "c-1",
      workspaceId: "ws-1",
      name: "Acme",
      deletedAt: null,
      fieldSources: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      sourceProspectId: "p-1",
    };
    expect(summarizeAuditDiff(null, after, "create")).toEqual(["Name: Acme"]);
  });

  it("skips update lines where neither side has a real value (e.g. — → —)", () => {
    const before = { name: "Acme", email: null };
    const after = { name: "Acme 2", email: undefined };
    expect(summarizeAuditDiff(before, after, "update")).toEqual(["Name: Acme → Acme 2"]);
  });

  it("returns an empty array when both states are null", () => {
    expect(summarizeAuditDiff(null, null, "update")).toEqual([]);
  });

  it("formats boolean, date, and null values in a diff", () => {
    const before = { isActive: false, dueDate: null, ownerId: "u-1" };
    const after = { isActive: true, dueDate: new Date(Date.now()).toISOString(), ownerId: "u-2" };
    const lines = summarizeAuditDiff(before, after, "update");

    expect(lines[0]).toBe("Is active: false → true");
    expect(lines[1]).toContain(" → Due today");
    expect(lines[2]).toBe("Owner: u-1 → u-2");
  });

  it("renders null/undefined values as an em dash", () => {
    expect(summarizeAuditDiff({ amount: null }, { amount: 100 }, "update")).toEqual([
      "Amount: — → $100.00",
    ]);
  });

  it("renders a delete row as an empty diff when beforeState is null", () => {
    expect(summarizeAuditDiff(null, null, "delete")).toEqual([]);
  });
});
