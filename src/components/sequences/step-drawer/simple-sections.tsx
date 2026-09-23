import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { insertIntoField } from "@/lib/insert-at-cursor";
import type { SequenceDelayUnit } from "@/types/api";
import type { SectionProps } from "./section-types";
import { DelayFields, formatDuration, TimingRow } from "./timing-row";
import { VariableMenu } from "./variable-menu";

function Info({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{children}</p>;
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
    >
      {children}
    </button>
  );
}

const DELAY_PRESETS: { label: string; amount: number; unit: SequenceDelayUnit }[] = [
  { label: "1 day", amount: 1, unit: "days" },
  { label: "2 days", amount: 2, unit: "days" },
  { label: "3 days", amount: 3, unit: "days" },
  { label: "1 week", amount: 1, unit: "weeks" },
];

const GOAL_PRESETS = ["Meeting booked", "Reply received", "Demo attended", "Event confirmed"];

export function DelaySection({ draft, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Wait for</p>
        <div className="flex items-center gap-2">
          <DelayFields draft={draft} onChange={onChange} large />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {DELAY_PRESETS.map((p) => (
          <Chip key={p.label} onClick={() => onChange({ delayDays: p.amount, delayUnit: p.unit })}>
            {p.label}
          </Chip>
        ))}
      </div>
      <Info>{`Prospects wait ${formatDuration(draft.delayDays, draft.delayUnit)} here before moving on.`}</Info>
    </div>
  );
}

export function GoalSection({ draft, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Goal label</p>
        <Input
          aria-label="Goal label"
          placeholder="e.g. Meeting booked"
          value={draft.goalLabel}
          onChange={(e) => onChange({ goalLabel: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {GOAL_PRESETS.map((label) => (
          <Chip key={label} onClick={() => onChange({ goalLabel: label })}>
            {label}
          </Chip>
        ))}
      </div>
      <Info>When a prospect reaches this step they&apos;re marked completed and the sequence ends for them.</Info>
    </div>
  );
}

export function TaskSection({ draft, onChange }: SectionProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <TimingRow draft={draft} onChange={onChange} />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Task title</p>
          <VariableMenu
            onPick={(text) => insertIntoField(titleRef.current, text, (value) => onChange({ subject: value }))}
          />
        </div>
        <Input
          ref={titleRef}
          aria-label="Task title"
          placeholder="e.g. Call {{firstName}} about their trial"
          value={draft.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
        />
      </div>
      <Info>A task is created on your CRM Tasks page when this step comes up, linked to the prospect.</Info>
    </div>
  );
}

export function CallSection({ draft, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <TimingRow draft={draft} onChange={onChange} />
      <Info>Creates a CRM task and pauses the sequence until a rep logs the call outcome.</Info>
    </div>
  );
}
