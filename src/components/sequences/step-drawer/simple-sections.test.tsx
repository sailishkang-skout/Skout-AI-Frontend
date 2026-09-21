import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SectionProps } from "./section-types";
import { SectionHarness } from "./section-harness";
import { CallSection, DelaySection, GoalSection, TaskSection } from "./simple-sections";
import type { StepDraft } from "./step-draft";
import { mkStep } from "./test-fixtures";
import type { SequenceStep } from "@/types/api";

afterEach(cleanup);

function renderSection(Section: React.ComponentType<SectionProps>, step: SequenceStep) {
  const onDraft = vi.fn();
  render(<SectionHarness Section={Section} step={step} onDraft={onDraft} />);
  return { latest: () => onDraft.mock.calls[onDraft.mock.calls.length - 1]![0] as StepDraft };
}

describe("DelaySection", () => {
  const step = mkStep({ stepType: "wait", delayDays: 2, delayUnit: "days" });

  it("shows the wait and explains it", () => {
    renderSection(DelaySection, step);
    screen.getByText("Prospects wait 2 days here before moving on.");
  });

  it("quick-picks set amount and unit", () => {
    const { latest } = renderSection(DelaySection, step);
    fireEvent.click(screen.getByRole("button", { name: "1 week" }));
    expect(latest()).toMatchObject({ delayDays: 1, delayUnit: "weeks" });
    screen.getByText("Prospects wait 1 week here before moving on.");
  });

  it("edits the amount directly", () => {
    const { latest } = renderSection(DelaySection, step);
    fireEvent.change(screen.getByLabelText("Delay amount"), { target: { value: "3" } });
    expect(latest().delayDays).toBe(3);
  });
});

describe("GoalSection", () => {
  it("edits the label and offers presets", () => {
    const { latest } = renderSection(GoalSection, mkStep({ stepType: "goal", goalLabel: "" }));
    fireEvent.change(screen.getByLabelText("Goal label"), { target: { value: "Trial started" } });
    expect(latest().goalLabel).toBe("Trial started");
    fireEvent.click(screen.getByRole("button", { name: "Reply received" }));
    expect(latest().goalLabel).toBe("Reply received");
  });

  it("says what reaching the goal does", () => {
    renderSection(GoalSection, mkStep({ stepType: "goal" }));
    screen.getByText(/marked completed and the sequence ends for them/);
  });
});

describe("TaskSection", () => {
  it("edits the task title and keeps the timing row", () => {
    const { latest } = renderSection(TaskSection, mkStep({ stepType: "task", subject: "" }));
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Call {{firstName}}" } });
    expect(latest().subject).toBe("Call {{firstName}}");
    screen.getByLabelText("Delay amount");
    screen.getByText(/CRM Tasks page/);
  });
});

describe("CallSection", () => {
  it("has timing and explains the call task, with no copy fields", () => {
    renderSection(CallSection, mkStep({ stepType: "call" }));
    screen.getByLabelText("Delay amount");
    screen.getByText(/pauses the sequence until a rep logs the call outcome/);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
