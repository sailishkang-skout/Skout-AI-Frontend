import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { draftFromStep } from "./step-draft";
import { formatDuration, TimingRow } from "./timing-row";
import { mkStep } from "./test-fixtures";

afterEach(cleanup);

describe("formatDuration", () => {
  it("singularises one unit", () => {
    expect(formatDuration(1, "days")).toBe("1 day");
    expect(formatDuration(2, "weeks")).toBe("2 weeks");
    expect(formatDuration(0, "hours")).toBe("0 hours");
  });
});

describe("TimingRow", () => {
  it("reports amount and unit changes, never below zero", () => {
    const onChange = vi.fn();
    render(<TimingRow draft={draftFromStep(mkStep({ delayDays: 2 }))} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Delay amount"), { target: { value: "5" } });
    expect(onChange).toHaveBeenLastCalledWith({ delayDays: 5 });

    fireEvent.change(screen.getByLabelText("Delay amount"), { target: { value: "-3" } });
    expect(onChange).toHaveBeenLastCalledWith({ delayDays: 0 });

    fireEvent.change(screen.getByLabelText("Delay unit"), { target: { value: "weeks" } });
    expect(onChange).toHaveBeenLastCalledWith({ delayUnit: "weeks" });
  });
});
