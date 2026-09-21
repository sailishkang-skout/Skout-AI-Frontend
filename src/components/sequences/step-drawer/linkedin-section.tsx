import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SequenceLinkedinAction, SequenceVariantKey } from "@/types/api";
import { StepSuggestions } from "../step-suggestions";
import { CopyEditor } from "./copy-editor";
import type { SectionProps } from "./section-types";
import { godModePatch, splitPatch, suggestionTarget, updateVariant, weightsOf } from "./step-draft";
import { TimingRow } from "./timing-row";
import { VariantTabs } from "./variant-tabs";

interface ActionOption {
  value: SequenceLinkedinAction;
  label: string;
  hint: string;
  /** False = the backend can't execute it yet (it would go out as a connection request). */
  available: boolean;
}

const ACTIONS: ActionOption[] = [
  { value: "connect", label: "Connection request", hint: "Send an invite, optionally with a short note.", available: true },
  { value: "message", label: "Direct message", hint: "Message someone you're already connected to.", available: true },
  { value: "voice", label: "Voice note (manual handoff)", hint: "Dexter drafts a script; a rep records and sends it.", available: true },
  { value: "inmail", label: "InMail", hint: "Message people you aren't connected to.", available: false },
  { value: "like", label: "Like recent posts", hint: "Warm up the prospect before reaching out.", available: false },
  { value: "follow", label: "Follow profile", hint: "Follow the prospect's profile.", available: false },
];

const COPY_ACTIONS: ReadonlySet<SequenceLinkedinAction> = new Set<SequenceLinkedinAction>(["connect", "message", "inmail"]);
const LIMITS: Partial<Record<SequenceLinkedinAction, number>> = { connect: 300, message: 700, inmail: 1200 };

function Info({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{children}</p>;
}

export function LinkedinSection({ step, draft, onChange }: SectionProps) {
  const [active, setActive] = useState<SequenceVariantKey>("A");
  const action = draft.linkedinAction;
  const target = suggestionTarget(draft, "linkedin");
  const unsupported = ACTIONS.find((a) => a.value === action && !a.available);

  return (
    <div className="space-y-4">
      <TimingRow draft={draft} onChange={onChange} />

      <div role="radiogroup" aria-label="LinkedIn action" className="space-y-1.5">
        {ACTIONS.map((a) => {
          const selected = a.value === action;
          const disabled = !a.available && !selected;
          return (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange({ linkedinAction: a.value })}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left",
                selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                disabled && "opacity-55 hover:bg-transparent"
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{a.label}</span>
                <span className="block text-xs text-muted-foreground">{a.hint}</span>
              </span>
              {disabled && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px]">Not available yet</span>
              )}
            </button>
          );
        })}
      </div>

      {unsupported && (
        <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
          {unsupported.label} isn&apos;t supported yet — this step currently sends as a connection request. Pick another action.
        </p>
      )}

      {COPY_ACTIONS.has(action) && (
        <>
          <VariantTabs
            godMode={draft.godMode}
            weights={weightsOf(draft)}
            active={active}
            onActive={setActive}
            onToggleGodMode={(on) => {
              onChange(godModePatch(on));
              if (!on && active === "C") setActive("A");
            }}
            onSplit={(key, pct) => onChange(splitPatch(key, pct))}
          />

          <StepSuggestions
            sequenceId={step.sequenceId}
            stepId={step.id}
            stepType="linkedin"
            linkedinAction={action}
            empty={target.allBlank}
            autoLoad
            applyLabel={target.replacing ? "Replace Variant A" : `Use in Variant ${target.key}`}
            onApply={(s) => {
              onChange(updateVariant(target.key, { body: s.body }));
              setActive(target.key);
            }}
          />

          <CopyEditor
            kind="plain"
            ariaLabel="Message body"
            placeholder={
              action === "connect"
                ? "Optional connection note — supports {{firstName}}, {{companyName}}, etc."
                : "Message body — supports {{firstName}}, {{companyName}}, etc."
            }
            maxLength={LIMITS[action]}
            value={draft.variants[active].body}
            onChange={(value) => onChange(updateVariant(active, { body: value }))}
          />
        </>
      )}

      {action === "voice" && (
        <Info>
          LinkedIn has no API to send a voice note automatically. Dexter drafts a script and creates a mobile
          handoff — the rep records and sends it themselves, then confirms to resume the sequence. The step waits (up
          to 7 days) until confirmed.
        </Info>
      )}
      {(action === "like" || action === "follow") && <Info>This action has no message.</Info>}

      <p className="text-[11px] text-muted-foreground">
        Sent via your connected LinkedIn account. Prospects need a LinkedIn profile URL. Connect under Deliverability →
        LinkedIn.
      </p>
    </div>
  );
}
