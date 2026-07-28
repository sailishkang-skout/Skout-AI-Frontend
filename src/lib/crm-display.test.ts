import { describe, expect, it } from "vitest";
import { formatDueDate, formatMoney } from "./crm-display";

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
