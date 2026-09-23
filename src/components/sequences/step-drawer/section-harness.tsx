import { useEffect, useState } from "react";
import type { SequenceStep } from "@/types/api";
import type { SectionProps } from "./section-types";
import { applyPatch, draftFromStep, type StepDraft } from "./step-draft";

/** Test helper: holds a draft for a section and reports each new draft. */
export function SectionHarness({
  Section,
  step,
  steps,
  onDraft,
}: {
  Section: React.ComponentType<SectionProps>;
  step: SequenceStep;
  steps?: SequenceStep[];
  onDraft?: (draft: StepDraft) => void;
}) {
  const [draft, setDraft] = useState(() => draftFromStep(step));
  useEffect(() => {
    onDraft?.(draft);
  }, [draft, onDraft]);
  return (
    <Section
      step={step}
      steps={steps ?? [step]}
      draft={draft}
      onChange={(patch) => setDraft((current) => applyPatch(current, patch))}
    />
  );
}
