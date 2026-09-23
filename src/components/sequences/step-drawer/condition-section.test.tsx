import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SequenceStep } from "@/types/api";
import { ConditionSection } from "./condition-section";
import { SectionHarness } from "./section-harness";
import type { StepDraft } from "./step-draft";
import { mkStep } from "./test-fixtures";

afterEach(cleanup);

const condition = (over: Partial<SequenceStep> = {}) =>
  mkStep({ id: "cond", stepType: "condition", stepOrder: 2, conditionType: "email_opened", ...over });
const email = mkStep({ id: "e1", stepOrder: 1, stepType: "email" });

function renderCondition(step: SequenceStep, steps: SequenceStep[]) {
  const onDraft = vi.fn();
  render(<SectionHarness Section={ConditionSection} step={step} steps={steps} onDraft={onDraft} />);
  return { latest: () => onDraft.mock.calls[onDraft.mock.calls.length - 1]![0] as StepDraft };
}

describe("ConditionSection — relevance", () => {
  it("lists rules that can fire first and the rest under 'Won't trigger here'", () => {
    const step = condition();
    renderCondition(step, [email, step]);
    const groupOf = (name: string) =>
      screen.getByRole("option", { name }).parentElement?.getAttribute("label");
    expect(groupOf("Email opened")).toBe("Relevant to this sequence");
    expect(groupOf("Meeting booked")).toBe("Relevant to this sequence");
    expect(groupOf("LinkedIn invite accepted")).toBe("Won't trigger here");
  });

  it("warns, without blocking, when the chosen rule can never be met", () => {
    const step = condition();
    renderCondition(step, [step]); // no earlier email step
    expect(screen.getByRole("alert").textContent).toMatch(/No earlier email step\. This rule can never be met/);
  });

  it("shows no warning when an earlier step satisfies the rule", () => {
    const step = condition();
    renderCondition(step, [email, step]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ConditionSection — rules", () => {
  it("adds rules, then offers Match ALL / ANY", () => {
    const step = condition();
    const { latest } = renderCondition(step, [email, step]);
    expect(screen.queryByRole("button", { name: "Match ANY" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(latest().clauses).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Match ALL" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Match ANY" }));
    expect(latest().clauseOp).toBe("or");
  });

  it("cannot remove the last rule, but can remove one of several", () => {
    const step = condition();
    const { latest } = renderCondition(step, [email, step]);
    expect((screen.getByRole("button", { name: "Remove rule 1" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove rule 2" }));
    expect(latest().clauses).toHaveLength(1);
  });

  it("toggles NOT on a rule", () => {
    const step = condition();
    const { latest } = renderCondition(step, [email, step]);
    fireEvent.click(screen.getByLabelText("Rule 1 NOT"));
    expect(latest().clauses[0]!.not).toBe(true);
  });

  it("ICP rule shows an editable threshold defaulting to 80", () => {
    const step = condition();
    const { latest } = renderCondition(step, [email, step]);
    expect(screen.queryByLabelText("Rule 1 value")).toBeNull();

    fireEvent.change(screen.getByLabelText("Rule 1 type"), { target: { value: "icp_score_gte" } });
    expect((screen.getByLabelText("Rule 1 value") as HTMLInputElement).value).toBe("80");

    fireEvent.change(screen.getByLabelText("Rule 1 value"), { target: { value: "65" } });
    expect(latest().clauses[0]).toMatchObject({ type: "icp_score_gte", value: 65 });
  });

  it("changing a rule's type clears its old value", () => {
    const step = condition({ conditionType: "icp_score_gte", conditionExpression: { type: "icp_score_gte", value: 65 } });
    const { latest } = renderCondition(step, [step]);
    fireEvent.change(screen.getByLabelText("Rule 1 type"), { target: { value: "email_opened_count_gte" } });
    expect(latest().clauses[0]!.value).toBeUndefined();
    expect((screen.getByLabelText("Rule 1 value") as HTMLInputElement).value).toBe("3");
  });
});

describe("ConditionSection — wait and outcome", () => {
  it("clamps max wait to 1-30 days and explains the branches", () => {
    const step = condition();
    const { latest } = renderCondition(step, [email, step]);
    fireEvent.change(screen.getByLabelText("Max wait days"), { target: { value: "99" } });
    expect(latest().conditionWaitDays).toBe(30);
    fireEvent.change(screen.getByLabelText("Max wait days"), { target: { value: "0" } });
    expect(latest().conditionWaitDays).toBe(1);
    screen.getByText(/continue on the Yes branch/);
    screen.getByText(/waiting up to 1 day\./);
  });
});
