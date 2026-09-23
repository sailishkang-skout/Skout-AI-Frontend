import type { SequenceStep, SequenceStepVariant, SequenceVariantKey } from "@/types/api";

export function mkStep(over: Partial<SequenceStep> = {}): SequenceStep {
  return {
    id: "step-1",
    sequenceId: "seq-1",
    stepOrder: 1,
    stepType: "email",
    delayDays: 0,
    delayUnit: "days",
    subject: null,
    bodyTemplate: null,
    variants: [],
    createdAt: "2026-09-21T00:00:00Z",
    ...over,
  };
}

export function mkVariant(key: SequenceVariantKey, over: Partial<SequenceStepVariant> = {}): SequenceStepVariant {
  return {
    id: `variant-${key}`,
    stepId: "step-1",
    variantKey: key,
    subject: null,
    bodyTemplate: null,
    weight: 50,
    enabled: true,
    createdAt: "2026-09-21T00:00:00Z",
    ...over,
  };
}
