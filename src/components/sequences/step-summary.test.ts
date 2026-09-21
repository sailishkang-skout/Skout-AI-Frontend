import { describe, expect, it } from "vitest";
import { summarizeStep } from "./step-summary";
import { mkStep } from "./step-drawer/test-fixtures";

describe("summarizeStep", () => {
  it("email: subject as title, tag-stripped body as detail", () => {
    expect(summarizeStep(mkStep({ subject: "Quick idea", bodyTemplate: "<p>Hello <b>there</b></p>" }))).toEqual({
      title: "Quick idea",
      detail: "Hello there",
      empty: false,
    });
  });

  it("email: flags an unwritten step, and truncates a long body", () => {
    expect(summarizeStep(mkStep())).toEqual({ title: "No subject yet", detail: null, empty: true });
    const long = summarizeStep(mkStep({ subject: "S", bodyTemplate: `<p>${"x".repeat(300)}</p>` }));
    expect(long.detail!.length).toBeLessThanOrEqual(140);
    expect(long.detail!.endsWith("…")).toBe(true);
  });

  it("linkedin: action label; only message-like actions need copy", () => {
    expect(summarizeStep(mkStep({ stepType: "linkedin", linkedinAction: "connect" }))).toEqual({
      title: "Connection request",
      detail: null,
      empty: false,
    });
    expect(summarizeStep(mkStep({ stepType: "linkedin", linkedinAction: "message" })).empty).toBe(true);
    expect(summarizeStep(mkStep({ stepType: "linkedin", linkedinAction: null })).title).toBe("Connection request");
    expect(summarizeStep(mkStep({ stepType: "linkedin", linkedinAction: "message", bodyTemplate: "Hi" }))).toMatchObject({
      detail: "Hi",
      empty: false,
    });
  });

  it("whatsapp and task", () => {
    expect(summarizeStep(mkStep({ stepType: "whatsapp" }))).toEqual({ title: "WhatsApp message", detail: null, empty: true });
    expect(summarizeStep(mkStep({ stepType: "task", subject: "Call them" }))).toEqual({
      title: "Call them",
      detail: null,
      empty: false,
    });
    expect(summarizeStep(mkStep({ stepType: "task" })).empty).toBe(true);
  });

  it("call, wait and goal", () => {
    expect(summarizeStep(mkStep({ stepType: "call" })).title).toBe("Call task");
    expect(summarizeStep(mkStep({ stepType: "wait", delayDays: 1, delayUnit: "weeks" })).title).toBe("Wait 1 week");
    expect(summarizeStep(mkStep({ stepType: "goal", goalLabel: "Meeting booked" })).title).toBe("Meeting booked");
    expect(summarizeStep(mkStep({ stepType: "goal" })).title).toBe("Goal");
  });

  it("condition: single rule label, compound count, or a prompt to set one", () => {
    expect(summarizeStep(mkStep({ stepType: "condition", conditionType: "email_opened" })).title).toBe("Email opened");
    expect(
      summarizeStep(mkStep({ stepType: "condition", conditionExpression: { type: "icp_score_gte", value: 70 } })).title
    ).toBe("ICP score ≥");
    expect(
      summarizeStep(
        mkStep({
          stepType: "condition",
          conditionExpression: { op: "or", clauses: [{ type: "email_opened" }, { type: "has_email" }] },
        })
      ).title
    ).toBe("Any of 2 rules");
    expect(summarizeStep(mkStep({ stepType: "condition" }))).toMatchObject({ title: "Set a condition", empty: true });
  });
});
