import { describe, expect, it } from "vitest";
import {
  CONDITION_LABELS,
  CONDITION_VALUE_DEFAULTS,
  classifyConditions,
  earlierStepsOf,
  unmetPrerequisite,
} from "./condition-relevance";
import { mkStep } from "./test-fixtures";

describe("earlierStepsOf", () => {
  it("returns only steps ordered before the given step, never the step itself", () => {
    const a = mkStep({ id: "a", stepOrder: 1 });
    const b = mkStep({ id: "b", stepOrder: 2 });
    const c = mkStep({ id: "c", stepOrder: 3 });
    expect(earlierStepsOf(b, [c, b, a]).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("unmetPrerequisite", () => {
  const linkedinTypes = ["linkedin_invite_accepted", "linkedin_connected", "linkedin_invite_declined"] as const;

  it("needs an earlier LinkedIn connection request for invite conditions", () => {
    for (const type of linkedinTypes) {
      expect(unmetPrerequisite(type, [])).toMatch(/LinkedIn connection request/);
      expect(unmetPrerequisite(type, [mkStep({ stepType: "linkedin", linkedinAction: "connect" })])).toBeNull();
    }
  });

  it("treats a LinkedIn step with no action as a connection request (the editor default)", () => {
    expect(unmetPrerequisite("linkedin_connected", [mkStep({ stepType: "linkedin", linkedinAction: null })])).toBeNull();
  });

  it("does not count a LinkedIn message step as a connection request", () => {
    expect(
      unmetPrerequisite("linkedin_invite_accepted", [mkStep({ stepType: "linkedin", linkedinAction: "message" })])
    ).toMatch(/LinkedIn connection request/);
  });

  it("needs an earlier email step for email engagement conditions", () => {
    for (const type of ["email_opened", "email_clicked", "email_opened_count_gte", "email_clicked_count_gte", "email_replied"] as const) {
      expect(unmetPrerequisite(type, [])).toMatch(/earlier email step/);
      expect(unmetPrerequisite(type, [mkStep({ stepType: "email" })])).toBeNull();
    }
  });

  it("needs an earlier call step for call_connected", () => {
    expect(unmetPrerequisite("call_connected", [])).toMatch(/earlier call step/);
    expect(unmetPrerequisite("call_connected", [mkStep({ stepType: "call" })])).toBeNull();
  });

  it("never blocks data conditions", () => {
    for (const type of ["icp_score_gte", "has_email", "has_linkedin", "meeting_booked", "account_has_positive_reply"] as const) {
      expect(unmetPrerequisite(type, [])).toBeNull();
    }
  });
});

describe("classifyConditions", () => {
  it("splits every known condition into relevant and unavailable", () => {
    const { relevant, unavailable } = classifyConditions([mkStep({ stepType: "email" })]);
    const all = [...relevant, ...unavailable].map((o) => o.type).sort();
    expect(all).toEqual(Object.keys(CONDITION_LABELS).sort());
    expect(relevant.map((o) => o.type)).toContain("email_opened");
    expect(unavailable.map((o) => o.type)).toContain("linkedin_invite_accepted");
    expect(unavailable.find((o) => o.type === "call_connected")?.reason).toMatch(/call step/);
    expect(relevant.every((o) => o.reason === null)).toBe(true);
  });

  it("includes the meeting_booked rule", () => {
    expect(classifyConditions([]).relevant.map((o) => o.type)).toContain("meeting_booked");
    expect(CONDITION_LABELS.meeting_booked).toBe("Meeting booked");
  });
});

describe("CONDITION_VALUE_DEFAULTS", () => {
  it("defaults the ICP threshold to 80 and the count rules to 3", () => {
    expect(CONDITION_VALUE_DEFAULTS).toEqual({
      icp_score_gte: 80,
      email_opened_count_gte: 3,
      email_clicked_count_gte: 3,
    });
  });
});
