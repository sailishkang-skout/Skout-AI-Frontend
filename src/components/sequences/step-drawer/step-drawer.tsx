"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { UpdateStepInput } from "@/lib/sequences";
import type { SequenceStep, SequenceStepType } from "@/types/api";
import { ConditionSection } from "./condition-section";
import { EmailSection } from "./email-section";
import { LinkedinSection } from "./linkedin-section";
import type { SectionProps } from "./section-types";
import { CallSection, DelaySection, GoalSection, TaskSection } from "./simple-sections";
import { applyPatch, draftFromStep, isDraftDirty, patchFromDraft, type DraftPatch } from "./step-draft";
import { WhatsappSection } from "./whatsapp-section";

const STEP_LABELS: Record<SequenceStepType, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  call: "Call",
  wait: "Delay",
  task: "Task",
  condition: "Condition",
  goal: "Goal",
};

function SectionFor(props: SectionProps) {
  switch (props.step.stepType) {
    case "email":
      return <EmailSection {...props} />;
    case "linkedin":
      return <LinkedinSection {...props} />;
    case "whatsapp":
      return <WhatsappSection {...props} />;
    case "condition":
      return <ConditionSection {...props} />;
    case "wait":
      return <DelaySection {...props} />;
    case "goal":
      return <GoalSection {...props} />;
    case "task":
      return <TaskSection {...props} />;
    case "call":
      return <CallSection {...props} />;
  }
}

export interface StepDrawerProps {
  /** The step being edited; null keeps the drawer closed. */
  step: SequenceStep | null;
  /** Every step in the sequence, for context such as which steps come before this one. */
  steps: SequenceStep[];
  onClose: () => void;
  /** Persist the patch. Reject to keep the drawer open and show the error inline. */
  onSave: (stepId: string, patch: UpdateStepInput) => Promise<unknown>;
  onDelete: (stepId: string) => Promise<unknown>;
}

export function StepDrawer({ step, ...rest }: StepDrawerProps) {
  if (!step) return null;
  // Keyed by step id so opening a different step starts from a fresh draft.
  return <DrawerBody key={step.id} step={step} {...rest} />;
}

function DrawerBody({ step, steps, onClose, onSave, onDelete }: Omit<StepDrawerProps, "step"> & { step: SequenceStep }) {
  const [initial] = useState(() => draftFromStep(step));
  const [draft, setDraft] = useState(initial);
  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = isDraftDirty(initial, draft);
  const change = (patch: DraftPatch) => setDraft((current) => applyPatch(current, patch));

  function requestClose() {
    if (busy) return;
    if (dirty) setConfirm("discard");
    else onClose();
  }

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fallback);
      setBusy(false);
      setConfirm(null);
    }
  }

  const footer =
    confirm === "delete" ? (
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Delete this step?</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Keep step
          </Button>
          <Button variant="destructive" onClick={() => run(() => onDelete(step.id), "Couldn't delete this step.")}>
            Delete step
          </Button>
        </div>
      </div>
    ) : confirm === "discard" ? (
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Discard your changes?</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={onClose}>
            Discard
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" className="text-destructive" disabled={busy} onClick={() => setConfirm("delete")}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={requestClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => run(() => onSave(step.id, patchFromDraft(step, draft)), "Couldn't save this step.")}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    );

  return (
    <Sheet
      open
      onClose={requestClose}
      title={`Edit ${STEP_LABELS[step.stepType]}`}
      description={`Step ${step.stepOrder}`}
      className="max-w-2xl"
      footer={footer}
    >
      {error && (
        <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <SectionFor step={step} steps={steps} draft={draft} onChange={change} />
    </Sheet>
  );
}
