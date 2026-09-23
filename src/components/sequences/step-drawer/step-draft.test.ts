import { describe, expect, it } from "vitest";
import {
  applyPatch,
  draftFromStep,
  godModePatch,
  isBlankVariant,
  isDraftDirty,
  patchFromDraft,
  splitPatch,
  suggestionTarget,
  updateVariant,
  weightsOf,
} from "./step-draft";
import { mkStep, mkVariant } from "./test-fixtures";

describe("draftFromStep", () => {
  it("gives a blank step sensible defaults", () => {
    const draft = draftFromStep(mkStep());
    expect(draft).toMatchObject({
      delayDays: 0,
      delayUnit: "days",
      subject: "",
      body: "",
      linkedinAction: "connect",
      conditionWaitDays: 3,
      goalLabel: "",
      godMode: false,
      clauseOp: "and",
    });
    expect(draft.clauses).toEqual([{ type: "linkedin_invite_accepted", not: false }]);
    expect(draft.variants.A).toEqual({ subject: "", body: "", weight: 50 });
    expect(draft.variants.B).toEqual({ subject: "", body: "", weight: 50 });
    expect(draft.variants.C).toEqual({ subject: "", body: "", weight: 0 });
  });

  it("reads variants, falling back to the step's own subject/body for A", () => {
    const withVariants = draftFromStep(
      mkStep({ variants: [mkVariant("A", { subject: "S-A", bodyTemplate: "B-A" }), mkVariant("B", { subject: "S-B", weight: 30 })] })
    );
    expect(withVariants.variants.A).toEqual({ subject: "S-A", body: "B-A", weight: 50 });
    expect(withVariants.variants.B).toEqual({ subject: "S-B", body: "", weight: 30 });

    const legacy = draftFromStep(mkStep({ subject: "Old subject", bodyTemplate: "<p>Old</p>" }));
    expect(legacy.variants.A).toEqual({ subject: "Old subject", body: "<p>Old</p>", weight: 50 });
  });

  it("turns God Mode on when variant C is enabled", () => {
    const draft = draftFromStep(mkStep({ variants: [mkVariant("C", { enabled: true, weight: 25 })] }));
    expect(draft.godMode).toBe(true);
    expect(draft.variants.C.weight).toBe(25);
  });

  it("reads a compound expression, dropping nested groups", () => {
    const draft = draftFromStep(
      mkStep({
        stepType: "condition",
        conditionExpression: {
          op: "or",
          clauses: [
            { type: "email_opened", not: true },
            { type: "icp_score_gte", value: 65 },
            { op: "and", clauses: [{ type: "has_email" }] },
          ],
        },
      })
    );
    expect(draft.clauseOp).toBe("or");
    expect(draft.clauses).toEqual([
      { type: "email_opened", not: true },
      { type: "icp_score_gte", not: false, value: 65 },
    ]);
  });

  it("reads a leaf expression, then falls back to conditionType", () => {
    expect(
      draftFromStep(mkStep({ stepType: "condition", conditionExpression: { type: "icp_score_gte", value: 70 } })).clauses
    ).toEqual([{ type: "icp_score_gte", not: false, value: 70 }]);
    expect(draftFromStep(mkStep({ stepType: "condition", conditionType: "email_replied" })).clauses).toEqual([
      { type: "email_replied", not: false },
    ]);
  });
});

describe("patchFromDraft", () => {
  it("email: persists all three variants, with A mirrored onto the step", () => {
    const step = mkStep({
      subject: "Hi",
      bodyTemplate: "<p>Body</p>",
      variants: [mkVariant("A", { subject: "Hi", bodyTemplate: "<p>Body</p>" }), mkVariant("B")],
    });
    const patch = patchFromDraft(step, draftFromStep(step));
    expect(patch).toMatchObject({ delayDays: 0, delayUnit: "days", subject: "Hi", bodyTemplate: "<p>Body</p>" });
    expect(patch.variants).toEqual([
      { variantKey: "A", subject: "Hi", bodyTemplate: "<p>Body</p>", weight: 50, enabled: true },
      { variantKey: "B", subject: null, bodyTemplate: null, weight: 50, enabled: true },
      { variantKey: "C", subject: null, bodyTemplate: null, weight: 0, enabled: false },
    ]);
  });

  it("God Mode persists real percentages and enables C", () => {
    const step = mkStep({
      variants: [mkVariant("A"), mkVariant("B"), mkVariant("C", { enabled: true, weight: 25 })],
    });
    const patch = patchFromDraft(step, draftFromStep(step));
    expect(patch.variants?.map((v) => [v.variantKey, v.weight, v.enabled])).toEqual([
      ["A", 40, true],
      ["B", 40, true],
      ["C", 20, true],
    ]);
  });

  it("clearing A's subject clears it instead of resurrecting the old one", () => {
    const step = mkStep({ subject: "Old", variants: [mkVariant("A", { subject: "Old" })] });
    const draft = applyPatch(draftFromStep(step), updateVariant("A", { subject: "" }));
    expect(patchFromDraft(step, draft).subject).toBeNull();
  });

  it("linkedin: includes the action and variants", () => {
    const step = mkStep({ stepType: "linkedin", linkedinAction: "message" });
    const patch = patchFromDraft(step, draftFromStep(step));
    expect(patch.linkedinAction).toBe("message");
    expect(patch.variants).toHaveLength(3);
  });

  it("whatsapp and task: subject and body come from the plain fields", () => {
    const whatsapp = mkStep({ stepType: "whatsapp", bodyTemplate: "Hi there" });
    expect(patchFromDraft(whatsapp, draftFromStep(whatsapp))).toMatchObject({ subject: null, bodyTemplate: "Hi there" });
    const task = mkStep({ stepType: "task", subject: "Call {{firstName}}" });
    expect(patchFromDraft(task, draftFromStep(task))).toMatchObject({ subject: "Call {{firstName}}", bodyTemplate: null });
  });

  it("wait and call send only timing", () => {
    for (const stepType of ["wait", "call"] as const) {
      const step = mkStep({ stepType, delayDays: 2, delayUnit: "weeks" });
      expect(patchFromDraft(step, draftFromStep(step))).toEqual({ delayDays: 2, delayUnit: "weeks" });
    }
  });

  it("goal: label, or null when blank", () => {
    const step = mkStep({ stepType: "goal", goalLabel: "Meeting booked" });
    expect(patchFromDraft(step, draftFromStep(step)).goalLabel).toBe("Meeting booked");
    expect(patchFromDraft(step, applyPatch(draftFromStep(step), { goalLabel: "" })).goalLabel).toBeNull();
  });

  describe("condition", () => {
    const condition = (over = {}) => mkStep({ stepType: "condition", conditionType: "email_opened", conditionWaitDays: 3, ...over });

    it("a plain single rule keeps the legacy shape (type only, no expression)", () => {
      const step = condition();
      expect(patchFromDraft(step, draftFromStep(step))).toEqual({
        delayDays: 0,
        delayUnit: "days",
        conditionWaitDays: 3,
        conditionType: "email_opened",
        conditionExpression: null,
      });
    });

    it("a single rule with a value is saved as a leaf so the threshold sticks", () => {
      const step = condition({ conditionType: "icp_score_gte" });
      const patch = patchFromDraft(step, draftFromStep(step));
      expect(patch.conditionExpression).toEqual({ type: "icp_score_gte", value: 80 });

      const edited = applyPatch(draftFromStep(step), { clauses: [{ type: "icp_score_gte", not: false, value: 65 }] });
      expect(patchFromDraft(step, edited).conditionExpression).toEqual({ type: "icp_score_gte", value: 65 });
    });

    it("a single NOT rule is saved as a leaf with not: true", () => {
      const step = condition();
      const draft = applyPatch(draftFromStep(step), { clauses: [{ type: "email_opened", not: true }] });
      expect(patchFromDraft(step, draft).conditionExpression).toEqual({ type: "email_opened", not: true });
    });

    it("several rules are saved as a compound expression, first rule as conditionType", () => {
      const step = condition();
      const draft = applyPatch(draftFromStep(step), {
        clauseOp: "or",
        clauses: [
          { type: "email_opened", not: false },
          { type: "icp_score_gte", not: false },
        ],
      });
      const patch = patchFromDraft(step, draft);
      expect(patch.conditionType).toBe("email_opened");
      expect(patch.conditionExpression).toEqual({
        op: "or",
        clauses: [{ type: "email_opened" }, { type: "icp_score_gte", value: 80 }],
      });
    });
  });
});

describe("draft helpers", () => {
  it("applyPatch merges an object or a function of the latest draft", () => {
    const draft = draftFromStep(mkStep());
    expect(applyPatch(draft, { delayDays: 4 }).delayDays).toBe(4);
    expect(applyPatch(draft, (d) => ({ delayDays: d.delayDays + 2 })).delayDays).toBe(2);
  });

  it("updateVariant changes one variant against the latest draft", () => {
    const draft = draftFromStep(mkStep());
    const next = applyPatch(draft, updateVariant("B", { subject: "B subject" }));
    expect(next.variants.B.subject).toBe("B subject");
    expect(next.variants.A).toEqual(draft.variants.A);
  });

  it("updateVariant can compute the change from the variant's latest value", () => {
    const draft = applyPatch(draftFromStep(mkStep()), updateVariant("A", { subject: "Keep me" }));
    const next = applyPatch(draft, updateVariant("A", (v) => ({ subject: v.subject || "fallback", body: "<p>New</p>" })));
    expect(next.variants.A).toEqual({ subject: "Keep me", body: "<p>New</p>", weight: 50 });
  });

  it("godModePatch turns C on with a 20% share and off again", () => {
    const on = applyPatch(draftFromStep(mkStep()), godModePatch(true));
    expect(on.godMode).toBe(true);
    expect(weightsOf(on)).toEqual({ A: 40, B: 40, C: 20 });
    const off = applyPatch(on, godModePatch(false));
    expect(off.godMode).toBe(false);
    expect(weightsOf(off)).toEqual({ A: 50, B: 50, C: 0 });
  });

  it("splitPatch rebalances the other variants", () => {
    const on = applyPatch(draftFromStep(mkStep()), godModePatch(true));
    expect(weightsOf(applyPatch(on, splitPatch("A", 60)))).toEqual({ A: 60, B: 27, C: 13 });
  });

  it("isDraftDirty compares content", () => {
    const initial = draftFromStep(mkStep());
    expect(isDraftDirty(initial, draftFromStep(mkStep()))).toBe(false);
    expect(isDraftDirty(initial, applyPatch(initial, { delayDays: 1 }))).toBe(true);
  });
});

describe("suggestion target", () => {
  it("email: a variant is blank only when subject and body are both empty (tags ignored)", () => {
    expect(isBlankVariant({ subject: "", body: "<p></p>", weight: 50 }, "email")).toBe(true);
    expect(isBlankVariant({ subject: "Hi", body: "", weight: 50 }, "email")).toBe(false);
  });

  it("linkedin ignores the subject", () => {
    expect(isBlankVariant({ subject: "stale", body: "", weight: 50 }, "linkedin")).toBe(true);
  });

  it("picks the first blank visible variant, or says it is replacing A", () => {
    const blank = draftFromStep(mkStep());
    expect(suggestionTarget(blank, "email")).toEqual({ key: "A", replacing: false, allBlank: true });

    const aFilled = applyPatch(blank, updateVariant("A", { body: "<p>x</p>" }));
    expect(suggestionTarget(aFilled, "email")).toEqual({ key: "B", replacing: false, allBlank: false });

    const bothFilled = applyPatch(aFilled, updateVariant("B", { body: "<p>y</p>" }));
    expect(suggestionTarget(bothFilled, "email")).toEqual({ key: "A", replacing: true, allBlank: false });
  });

  it("a hidden C never counts as the blank slot", () => {
    const filled = applyPatch(
      applyPatch(draftFromStep(mkStep()), updateVariant("A", { body: "a" })),
      updateVariant("B", { body: "b" })
    );
    expect(suggestionTarget(filled, "email").key).toBe("A");
    const withC = applyPatch(filled, godModePatch(true));
    expect(suggestionTarget(withC, "email")).toMatchObject({ key: "C", replacing: false });
  });
});
