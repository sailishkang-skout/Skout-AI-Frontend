import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowBuilder } from "./flow-builder";
import { mkStep } from "./step-drawer/test-fixtures";

afterEach(cleanup);

function setup(steps: ReturnType<typeof mkStep>[]) {
  const onEditStep = vi.fn();
  render(<FlowBuilder steps={steps} onAddStep={vi.fn()} onEditStep={onEditStep} onDeleteStep={vi.fn()} />);
  return { onEditStep };
}

describe("FlowBuilder", () => {
  it("opens the drawer for a trunk step", () => {
    const { onEditStep } = setup([mkStep({ id: "e1", subject: "Hello" })]);
    fireEvent.click(screen.getByText("Hello"));
    expect(onEditStep).toHaveBeenCalledWith("e1");
  });

  it("opens the drawer for a step inside a branch", () => {
    const { onEditStep } = setup([
      mkStep({ id: "c1", stepType: "condition", stepOrder: 1 }),
      mkStep({ id: "y1", stepOrder: 2, subject: "Yes path", parentStepId: "c1", branch: "yes" }),
    ]);
    fireEvent.click(screen.getByText("Yes path"));
    expect(onEditStep).toHaveBeenCalledWith("y1");
  });

  it("no longer renders its own editor dialog", () => {
    const { onEditStep } = setup([mkStep({ id: "e1", subject: "Hello" })]);
    fireEvent.click(screen.getByText("Hello"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onEditStep).toHaveBeenCalledTimes(1);
  });
});
