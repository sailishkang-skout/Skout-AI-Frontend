import type { SequenceStep } from "@/types/api";
import type { DraftPatch, StepDraft } from "./step-draft";

export interface SectionProps {
  step: SequenceStep;
  /** Every step in the sequence, for context such as "which steps come before this one". */
  steps: SequenceStep[];
  draft: StepDraft;
  onChange: (patch: DraftPatch) => void;
}
