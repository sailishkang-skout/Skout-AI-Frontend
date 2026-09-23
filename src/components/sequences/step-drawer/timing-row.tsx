import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SequenceDelayUnit } from "@/types/api";
import type { DraftPatch, StepDraft } from "./step-draft";

export const DELAY_UNITS: SequenceDelayUnit[] = ["minutes", "hours", "days", "weeks"];

export function formatDuration(amount: number, unit: SequenceDelayUnit): string {
  return `${amount} ${amount === 1 ? unit.replace(/s$/, "") : unit}`;
}

export function DelayFields({
  draft,
  onChange,
  large,
}: {
  draft: StepDraft;
  onChange: (patch: DraftPatch) => void;
  large?: boolean;
}) {
  return (
    <>
      <Input
        type="number"
        min={0}
        aria-label="Delay amount"
        className={large ? "h-10 w-24 text-lg" : "h-8 w-16"}
        value={draft.delayDays}
        onChange={(e) => onChange({ delayDays: Math.max(0, Number(e.target.value) || 0) })}
      />
      <Select
        aria-label="Delay unit"
        className={large ? "h-10 w-32" : "h-8 w-28"}
        value={draft.delayUnit}
        onChange={(e) => onChange({ delayUnit: e.target.value as SequenceDelayUnit })}
      >
        {DELAY_UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </Select>
    </>
  );
}

export function TimingRow({ draft, onChange }: { draft: StepDraft; onChange: (patch: DraftPatch) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Wait</span>
      <DelayFields draft={draft} onChange={onChange} />
    </div>
  );
}
