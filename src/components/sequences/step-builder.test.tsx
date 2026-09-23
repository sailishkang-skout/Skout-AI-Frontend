import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StepBuilder } from "./step-builder";
import { mkStep } from "./step-drawer/test-fixtures";

afterEach(cleanup);

const steps = [
  mkStep({ id: "email-1", stepOrder: 1, subject: "Quick idea", bodyTemplate: "<p>Hello there</p>" }),
  mkStep({ id: "task-1", stepOrder: 2, stepType: "task", subject: "Call them" }),
];

function setup() {
  const onEditStep = vi.fn();
  render(
    <StepBuilder
      steps={steps}
      onReorder={vi.fn()}
      onUpdateStep={vi.fn()}
      onDeleteStep={vi.fn()}
      onAddStep={vi.fn()}
      onEditStep={onEditStep}
      reordering={false}
      updatingStepId={null}
      deletingStepId={null}
      adding={false}
    />
  );
  return { onEditStep };
}

describe("StepBuilder — summary rows", () => {
  it("shows a summary per step and opens the drawer for the one clicked", () => {
    const { onEditStep } = setup();
    screen.getByText("Quick idea");
    screen.getByText("Hello there");
    screen.getByText("Call them");

    const edits = screen.getAllByText("Edit");
    expect(edits).toHaveLength(2);
    fireEvent.click(edits[0]!);
    expect(onEditStep).toHaveBeenLastCalledWith("email-1");
    fireEvent.click(edits[1]!);
    expect(onEditStep).toHaveBeenLastCalledWith("task-1");
  });

  it("no longer edits copy inline", () => {
    setup();
    expect(screen.queryByPlaceholderText(/Subject line/)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps the structural controls: type, delay, delete and reorder", () => {
    setup();
    expect(screen.getAllByLabelText("Delay amount").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Delete step" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Drag to reorder" })).toHaveLength(2);
  });
});
