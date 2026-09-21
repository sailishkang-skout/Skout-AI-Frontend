import type { StepVariantInput, UpdateStepInput } from "@/lib/sequences";
import type {
  ConditionExpression,
  SequenceConditionType,
  SequenceDelayUnit,
  SequenceLinkedinAction,
  SequenceStep,
  SequenceVariantKey,
} from "@/types/api";
import { CONDITION_VALUE_DEFAULTS } from "./condition-relevance";
import { setSplit, splitPercentages, toggleGodMode, visibleKeys, type Weights } from "./variant-split";

export interface VariantDraft {
  subject: string;
  body: string;
  weight: number;
}

export interface ClauseDraft {
  type: SequenceConditionType;
  not: boolean;
  value?: number;
}

/** Everything the drawer edits for one step. Fields a step type doesn't use are carried through untouched. */
export interface StepDraft {
  delayDays: number;
  delayUnit: SequenceDelayUnit;
  /** Task title. Email/LinkedIn subjects live on `variants`. */
  subject: string;
  /** WhatsApp body. Email/LinkedIn bodies live on `variants`. */
  body: string;
  linkedinAction: SequenceLinkedinAction;
  clauses: ClauseDraft[];
  clauseOp: "and" | "or";
  conditionWaitDays: number;
  goalLabel: string;
  godMode: boolean;
  variants: Record<SequenceVariantKey, VariantDraft>;
}

/**
 * A change to the draft: fields to merge, or a function of the *latest* draft. Use the function
 * form inside callbacks that can be stale (e.g. the rich editor's onChange).
 */
export type DraftPatch = Partial<StepDraft> | ((current: StepDraft) => Partial<StepDraft>);

export function applyPatch(draft: StepDraft, patch: DraftPatch): StepDraft {
  return { ...draft, ...(typeof patch === "function" ? patch(draft) : patch) };
}

export function weightsOf(draft: StepDraft): Weights {
  return { A: draft.variants.A.weight, B: draft.variants.B.weight, C: draft.variants.C.weight };
}

export function withWeights(variants: StepDraft["variants"], w: Weights): StepDraft["variants"] {
  return {
    A: { ...variants.A, weight: w.A },
    B: { ...variants.B, weight: w.B },
    C: { ...variants.C, weight: w.C },
  };
}

/** Changes one variant. Pass a function to compute the change from that variant's latest value. */
export function updateVariant(
  key: SequenceVariantKey,
  patch: Partial<VariantDraft> | ((current: VariantDraft) => Partial<VariantDraft>)
): DraftPatch {
  return (d) => {
    const current = d.variants[key];
    const change = typeof patch === "function" ? patch(current) : patch;
    return { variants: { ...d.variants, [key]: { ...current, ...change } } };
  };
}

export function godModePatch(on: boolean): DraftPatch {
  return (d) => ({ godMode: on, variants: withWeights(d.variants, toggleGodMode(weightsOf(d), on)) });
}

export function splitPatch(key: SequenceVariantKey, pct: number): DraftPatch {
  return (d) => ({ variants: withWeights(d.variants, setSplit(weightsOf(d), d.godMode, key, pct)) });
}

type LeafExpression = Extract<ConditionExpression, { type: SequenceConditionType }>;

function toClause(leaf: LeafExpression): ClauseDraft {
  return { type: leaf.type, not: Boolean(leaf.not), value: leaf.value };
}

export function draftFromStep(step: SequenceStep): StepDraft {
  const variantOf = (key: SequenceVariantKey) => step.variants?.find((v) => v.variantKey === key);

  const expr = step.conditionExpression;
  let clauses: ClauseDraft[] = [];
  let clauseOp: "and" | "or" = "and";
  if (expr && "op" in expr) {
    clauseOp = expr.op;
    // Nested groups aren't editable in the drawer; only leaf rules are kept (same as the old modal).
    clauses = expr.clauses.filter((c): c is LeafExpression => "type" in c).map(toClause);
  } else if (expr && "type" in expr) {
    clauses = [toClause(expr)];
  }
  if (clauses.length === 0) {
    clauses = [{ type: step.conditionType ?? "linkedin_invite_accepted", not: false }];
  }

  return {
    delayDays: step.delayDays,
    delayUnit: step.delayUnit ?? "days",
    subject: step.subject ?? "",
    body: step.bodyTemplate ?? "",
    linkedinAction: step.linkedinAction ?? "connect",
    clauses,
    clauseOp,
    conditionWaitDays: step.conditionWaitDays ?? 3,
    goalLabel: step.goalLabel ?? "",
    godMode: Boolean(variantOf("C")?.enabled),
    variants: {
      A: {
        subject: variantOf("A")?.subject ?? step.subject ?? "",
        body: variantOf("A")?.bodyTemplate ?? step.bodyTemplate ?? "",
        weight: variantOf("A")?.weight ?? 50,
      },
      B: {
        subject: variantOf("B")?.subject ?? "",
        body: variantOf("B")?.bodyTemplate ?? "",
        weight: variantOf("B")?.weight ?? 50,
      },
      C: {
        subject: variantOf("C")?.subject ?? "",
        body: variantOf("C")?.bodyTemplate ?? "",
        weight: variantOf("C")?.weight ?? 0,
      },
    },
  };
}

export function patchFromDraft(step: SequenceStep, d: StepDraft): UpdateStepInput {
  const patch: UpdateStepInput = { delayDays: d.delayDays, delayUnit: d.delayUnit };
  const type = step.stepType;

  if (type === "whatsapp" || type === "task") {
    patch.subject = d.subject || null;
    patch.bodyTemplate = d.body || null;
  }

  if (type === "email" || type === "linkedin") {
    const pct = splitPercentages(weightsOf(d), d.godMode);
    const variants: StepVariantInput[] = (["A", "B", "C"] as const).map((key) => ({
      variantKey: key,
      subject: d.variants[key].subject || null,
      bodyTemplate: d.variants[key].body || null,
      weight: pct[key],
      enabled: key === "C" ? d.godMode : true,
    }));
    patch.variants = variants;
    patch.subject = d.variants.A.subject || null;
    patch.bodyTemplate = d.variants.A.body || null;
    if (type === "linkedin") patch.linkedinAction = d.linkedinAction;
  }

  if (type === "condition") {
    patch.conditionWaitDays = d.conditionWaitDays;
    const first = d.clauses[0]!;
    const needsExpression = d.clauses.length > 1 || first.not || first.type in CONDITION_VALUE_DEFAULTS;
    patch.conditionType = first.type;
    if (!needsExpression) {
      patch.conditionExpression = null;
    } else {
      const leaves: ConditionExpression[] = d.clauses.map((c) => ({
        type: c.type,
        not: c.not || undefined,
        value: c.type in CONDITION_VALUE_DEFAULTS ? (c.value ?? CONDITION_VALUE_DEFAULTS[c.type]) : undefined,
      }));
      patch.conditionExpression = leaves.length === 1 ? leaves[0]! : { op: d.clauseOp, clauses: leaves };
    }
  }

  if (type === "goal") patch.goalLabel = d.goalLabel || null;

  return patch;
}

export function isDraftDirty(initial: StepDraft, current: StepDraft): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, "").trim();

/** Blank = nothing written yet. LinkedIn has no subject, so a stale one doesn't count. */
export function isBlankVariant(v: VariantDraft, channel: "email" | "linkedin"): boolean {
  return !stripTags(v.body) && (channel === "linkedin" || !v.subject.trim());
}

/** Where an AI suggestion goes: the first blank visible variant, else A (replacing it). */
export function suggestionTarget(
  draft: StepDraft,
  channel: "email" | "linkedin"
): { key: SequenceVariantKey; replacing: boolean; allBlank: boolean } {
  const keys = visibleKeys(draft.godMode);
  const blank = keys.find((k) => isBlankVariant(draft.variants[k], channel));
  return {
    key: blank ?? "A",
    replacing: blank === undefined,
    allBlank: keys.every((k) => isBlankVariant(draft.variants[k], channel)),
  };
}
