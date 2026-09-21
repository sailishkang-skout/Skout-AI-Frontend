import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SequenceConditionType } from "@/types/api";
import {
  CONDITION_VALUE_DEFAULTS,
  classifyConditions,
  earlierStepsOf,
  unmetPrerequisite,
} from "./condition-relevance";
import type { SectionProps } from "./section-types";
import type { ClauseDraft } from "./step-draft";
import { TimingRow } from "./timing-row";

export function ConditionSection({ step, steps, draft, onChange }: SectionProps) {
  const earlier = useMemo(() => earlierStepsOf(step, steps), [step, steps]);
  const { relevant, unavailable } = useMemo(() => classifyConditions(earlier), [earlier]);

  const setClause = (idx: number, patch: Partial<ClauseDraft>) =>
    onChange((d) => ({ clauses: d.clauses.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));

  return (
    <div className="space-y-5">
      <TimingRow draft={draft} onChange={onChange} />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Rules</p>

        {draft.clauses.length > 1 && (
          <div role="group" aria-label="Match" className="inline-flex overflow-hidden rounded-md border border-border text-xs">
            {(["and", "or"] as const).map((op) => (
              <button
                key={op}
                type="button"
                aria-pressed={draft.clauseOp === op}
                onClick={() => onChange({ clauseOp: op })}
                className={cn("px-3 py-1", draft.clauseOp === op ? "bg-primary text-primary-foreground" : "bg-muted/40 hover:bg-accent")}
              >
                {op === "and" ? "Match ALL" : "Match ANY"}
              </button>
            ))}
          </div>
        )}

        {draft.clauses.map((clause, idx) => {
          const problem = unmetPrerequisite(clause.type, earlier);
          const hasValue = clause.type in CONDITION_VALUE_DEFAULTS;
          const defaultValue = CONDITION_VALUE_DEFAULTS[clause.type];
          return (
            <div key={idx} className="space-y-1.5 rounded-md border border-border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={`Rule ${idx + 1} type`}
                  className="h-8 min-w-[12rem] flex-1"
                  value={clause.type}
                  onChange={(e) => setClause(idx, { type: e.target.value as SequenceConditionType, value: undefined })}
                >
                  <optgroup label="Relevant to this sequence">
                    {relevant.map((o) => (
                      <option key={o.type} value={o.type}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                  {unavailable.length > 0 && (
                    <optgroup label="Won't trigger here">
                      {unavailable.map((o) => (
                        <option key={o.type} value={o.type}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>

                {hasValue && (
                  <Input
                    type="number"
                    aria-label={`Rule ${idx + 1} value`}
                    className="h-8 w-20"
                    value={clause.value ?? defaultValue}
                    onChange={(e) => setClause(idx, { value: Number(e.target.value) || defaultValue })}
                  />
                )}

                <label className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    aria-label={`Rule ${idx + 1} NOT`}
                    checked={clause.not}
                    onChange={(e) => setClause(idx, { not: e.target.checked })}
                  />
                  NOT
                </label>

                <button
                  type="button"
                  aria-label={`Remove rule ${idx + 1}`}
                  disabled={draft.clauses.length === 1}
                  onClick={() => onChange((d) => ({ clauses: d.clauses.filter((_, i) => i !== idx) }))}
                  className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  ×
                </button>
              </div>

              {problem && (
                <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
                  {problem} This rule can never be met, so it won&apos;t trigger.
                </p>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange((d) => ({ clauses: [...d.clauses, { type: relevant[0]?.type ?? "has_email", not: false }] }))
          }
        >
          Add rule
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Max wait</span>
        <Input
          type="number"
          min={1}
          max={30}
          aria-label="Max wait days"
          className="h-8 w-16"
          value={draft.conditionWaitDays}
          onChange={(e) => onChange({ conditionWaitDays: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
        />
        <span className="text-muted-foreground">days</span>
      </div>

      <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Yes</span> — prospects who meet the{" "}
          {draft.clauses.length > 1 ? "rules" : "rule"} continue on the Yes branch.
        </p>
        <p>
          <span className="font-semibold text-foreground">No</span> — everyone else moves to the No branch, after
          waiting up to {draft.conditionWaitDays} {draft.conditionWaitDays === 1 ? "day" : "days"}.
        </p>
      </div>
    </div>
  );
}
