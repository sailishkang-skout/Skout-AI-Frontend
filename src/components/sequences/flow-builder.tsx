"use client";

import { useState } from "react";
import {
  Clock,
  GitBranch,
  Linkedin,
  ListChecks,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AddStepInput, StepVariantInput, UpdateStepInput } from "@/lib/sequences";
import type {
  ConditionExpression,
  SequenceConditionType,
  SequenceDelayUnit,
  SequenceLinkedinAction,
  SequenceStep,
  SequenceStepType,
  SequenceStepVariant,
  SequenceVariantKey,
} from "@/types/api";

const PALETTE: { type: SequenceStepType; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { type: "email", label: "Email", icon: Mail, tone: "text-blue-600" },
  { type: "linkedin", label: "LinkedIn", icon: Linkedin, tone: "text-sky-700" },
  { type: "call", label: "Call", icon: Phone, tone: "text-green-600" },
  { type: "whatsapp", label: "WhatsApp", icon: MessageCircle, tone: "text-emerald-600" },
  { type: "condition", label: "Condition", icon: GitBranch, tone: "text-rose-600" },
  { type: "wait", label: "Delay", icon: Clock, tone: "text-amber-600" },
  { type: "task", label: "Task", icon: ListChecks, tone: "text-teal-600" },
  { type: "goal", label: "Goal", icon: Target, tone: "text-purple-600" },
];

const CONDITION_LABELS: Record<SequenceConditionType, string> = {
  linkedin_invite_accepted: "LinkedIn invite accepted",
  linkedin_connected: "LinkedIn connected",
  linkedin_invite_declined: "LinkedIn invite declined",
  email_opened: "Email opened",
  email_clicked: "Email clicked",
  email_opened_count_gte: "Email opened at least N times",
  email_clicked_count_gte: "Email clicked at least N times",
  email_replied: "Email replied",
  call_connected: "Call connected",
  icp_score_gte: "ICP score ≥",
  has_email: "Has email",
  has_linkedin: "Has LinkedIn URL",
  account_has_positive_reply: "Another contact at this account replied positively",
};

const CONDITION_VALUE_DEFAULTS: Partial<Record<SequenceConditionType, number>> = {
  icp_score_gte: 80,
  email_opened_count_gte: 3,
  email_clicked_count_gte: 3,
};

function iconFor(type: SequenceStepType) {
  return PALETTE.find((p) => p.type === type)?.icon ?? Mail;
}

function toneFor(type: SequenceStepType) {
  switch (type) {
    case "email": return "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30";
    case "linkedin": return "border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/30";
    case "condition": return "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30";
    case "goal": return "border-purple-200 bg-purple-50/60 dark:border-purple-900 dark:bg-purple-950/30";
    case "wait": return "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30";
    default: return "border-border bg-card";
  }
}

function stepTitle(step: SequenceStep) {
  if (step.stepType === "condition") {
    const expr = step.conditionExpression;
    if (expr && "op" in expr) {
      return `${expr.op.toUpperCase()} · ${expr.clauses.length} clauses`;
    }
    return step.conditionType ? CONDITION_LABELS[step.conditionType] ?? step.conditionType : "Set a condition";
  }
  if (step.stepType === "goal") return step.goalLabel || "Goal";
  if (step.stepType === "linkedin") return step.linkedinAction ? `LinkedIn · ${step.linkedinAction}` : "LinkedIn";
  if (step.subject) return step.subject;
  return PALETTE.find((p) => p.type === step.stepType)?.label ?? step.stepType;
}

export function FlowBuilder({
  steps,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  adding,
  updatingStepId,
  deletingStepId,
}: {
  steps: SequenceStep[];
  onAddStep: (input: AddStepInput) => void;
  onUpdateStep: (stepId: string, patch: UpdateStepInput) => void;
  onDeleteStep: (stepId: string) => void;
  adding?: boolean;
  updatingStepId?: string | null;
  deletingStepId?: string | null;
}) {
  const [editing, setEditing] = useState<SequenceStep | null>(null);
  const [addAfter, setAddAfter] = useState<{ parentStepId?: string | null; branch?: "yes" | "no" | null } | null>(
    null,
  );

  const trunk = steps
    .filter((s) => !s.branch && !s.parentStepId)
    .sort((a, b) => a.stepOrder - b.stepOrder);

  function children(conditionId: string, branch: "yes" | "no") {
    return steps
      .filter((s) => s.parentStepId === conditionId && s.branch === branch)
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_12rem]">
      <div className="overflow-x-auto rounded-xl border border-dashed border-border bg-muted/20 p-6">
        <div className="mx-auto flex min-w-[28rem] max-w-3xl flex-col items-center">
          <div className="rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Start
          </div>
          <Arrow />

          {trunk.length === 0 && (
            <EmptyAdd onPick={(type) => onAddStep(defaultStep(type))} adding={adding} />
          )}

          {trunk.map((step, idx) => (
            <div key={step.id} className="flex w-full flex-col items-center">
              {idx > 0 && <DelayChip step={step} />}
              <FlowNode
                step={step}
                busy={updatingStepId === step.id || deletingStepId === step.id}
                onEdit={() => setEditing(step)}
                onDelete={() => onDeleteStep(step.id)}
              />
              {step.stepType === "condition" ? (
                <div className="mt-4 grid w-full grid-cols-2 gap-6">
                  <BranchColumn
                    label="No"
                    tone="text-rose-600"
                    steps={children(step.id, "no")}
                    updatingStepId={updatingStepId}
                    deletingStepId={deletingStepId}
                    onEdit={setEditing}
                    onDelete={onDeleteStep}
                    onAdd={() => setAddAfter({ parentStepId: step.id, branch: "no" })}
                  />
                  <BranchColumn
                    label="Yes"
                    tone="text-emerald-600"
                    steps={children(step.id, "yes")}
                    updatingStepId={updatingStepId}
                    deletingStepId={deletingStepId}
                    onEdit={setEditing}
                    onDelete={onDeleteStep}
                    onAdd={() => setAddAfter({ parentStepId: step.id, branch: "yes" })}
                  />
                </div>
              ) : (
                <AddPlus onClick={() => setAddAfter({ parentStepId: null, branch: null })} />
              )}
            </div>
          ))}
        </div>
      </div>

      <aside className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add step</p>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          {PALETTE.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.type}
                type="button"
                disabled={adding}
                onClick={() => onAddStep(defaultStep(p.type))}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
              >
                <Icon className={cn("h-4 w-4", p.tone)} />
                {p.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          A/B variants are on by default for Email and LinkedIn. Enable <strong>C</strong> for God Mode extra testing.
        </p>
      </aside>

      {addAfter && (
        <Dialog open onClose={() => setAddAfter(null)} title="Add step" className="max-w-sm">
          <div className="grid grid-cols-2 gap-2">
            {PALETTE.map((p) => {
              const Icon = p.icon;
              return (
                <Button
                  key={p.type}
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => {
                    onAddStep({
                      ...defaultStep(p.type),
                      parentStepId: addAfter.parentStepId ?? null,
                      branch: addAfter.branch ?? null,
                    });
                    setAddAfter(null);
                  }}
                >
                  <Icon className={cn("h-4 w-4", p.tone)} />
                  {p.label}
                </Button>
              );
            })}
          </div>
        </Dialog>
      )}

      {editing && (
        <StepEditorDialog
          step={steps.find((s) => s.id === editing.id) ?? editing}
          saving={updatingStepId === editing.id}
          onClose={() => setEditing(null)}
          onSave={(patch) => onUpdateStep(editing.id, patch)}
        />
      )}
    </div>
  );
}

function defaultStep(type: SequenceStepType): AddStepInput {
  if (type === "condition") {
    return {
      stepType: "condition",
      delayDays: 0,
      conditionType: "linkedin_invite_accepted",
      conditionWaitDays: 3,
    };
  }
  if (type === "linkedin") {
    return { stepType: "linkedin", delayDays: 1, linkedinAction: "connect" };
  }
  if (type === "goal") {
    return { stepType: "goal", delayDays: 0, goalLabel: "Meeting booked" };
  }
  if (type === "wait") {
    return { stepType: "wait", delayDays: 2, delayUnit: "days" };
  }
  if (type === "email") {
    return { stepType: "email", delayDays: 0, subject: "", bodyTemplate: "" };
  }
  return { stepType: type, delayDays: 1 };
}

function Arrow() {
  return <div className="my-1 h-6 w-px bg-border" />;
}

function DelayChip({ step }: { step: SequenceStep }) {
  const unit = step.delayUnit ?? "days";
  if (!step.delayDays) return <Arrow />;
  return (
    <div className="my-1 flex flex-col items-center">
      <div className="h-3 w-px bg-border" />
      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
        Wait {step.delayDays} {unit}
      </span>
      <div className="h-3 w-px bg-border" />
    </div>
  );
}

function AddPlus({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
      aria-label="Add step"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}

function EmptyAdd({ onPick, adding }: { onPick: (type: SequenceStepType) => void; adding?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-8 py-10 text-center">
      <p className="text-sm font-medium">Start with an action</p>
      <div className="flex flex-wrap justify-center gap-2">
        {PALETTE.slice(0, 4).map((p) => {
          const Icon = p.icon;
          return (
            <Button key={p.type} size="sm" variant="outline" disabled={adding} onClick={() => onPick(p.type)}>
              <Icon className={cn("h-3.5 w-3.5", p.tone)} />
              {p.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function FlowNode({
  step,
  busy,
  onEdit,
  onDelete,
}: {
  step: SequenceStep;
  busy?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = iconFor(step.stepType);
  const variants = step.variants ?? [];
  const enabledVariants = variants.filter((v) => v.enabled);
  return (
    <div className={cn("relative w-full max-w-sm rounded-xl border p-3 shadow-sm", toneFor(step.stepType), busy && "opacity-60")}>
      <button type="button" className="w-full text-left" onClick={onEdit}>
        <div className="mb-1 flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {PALETTE.find((p) => p.type === step.stepType)?.label}
          </span>
          {step.stepType === "condition" && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              Wait up to {step.conditionWaitDays ?? 2} days
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-medium">{stepTitle(step)}</p>
        {enabledVariants.length > 0 && (step.stepType === "email" || step.stepType === "linkedin") && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            A/B{enabledVariants.some((v) => v.variantKey === "C") ? "/C" : ""} testing
          </p>
        )}
      </button>
      <button
        type="button"
        aria-label="Delete step"
        onClick={onDelete}
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function BranchColumn({
  label,
  tone,
  steps,
  updatingStepId,
  deletingStepId,
  onEdit,
  onDelete,
  onAdd,
}: {
  label: string;
  tone: string;
  steps: SequenceStep[];
  updatingStepId?: string | null;
  deletingStepId?: string | null;
  onEdit: (step: SequenceStep) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("mb-2 text-xs font-bold uppercase", tone)}>{label}</span>
      {steps.map((s) => (
        <div key={s.id} className="mb-2 w-full">
          <DelayChip step={s} />
          <FlowNode
            step={s}
            busy={updatingStepId === s.id || deletingStepId === s.id}
            onEdit={() => onEdit(s)}
            onDelete={() => onDelete(s.id)}
          />
        </div>
      ))}
      <AddPlus onClick={onAdd} />
    </div>
  );
}

function StepEditorDialog({
  step,
  saving,
  onClose,
  onSave,
}: {
  step: SequenceStep;
  saving?: boolean;
  onClose: () => void;
  onSave: (patch: UpdateStepInput) => void;
}) {
  const [delayDays, setDelayDays] = useState(step.delayDays);
  const [delayUnit, setDelayUnit] = useState<SequenceDelayUnit>(step.delayUnit ?? "days");
  const [subject, setSubject] = useState(step.subject ?? "");
  const [body, setBody] = useState(step.bodyTemplate ?? "");
  const [linkedinAction, setLinkedinAction] = useState<SequenceLinkedinAction>(step.linkedinAction ?? "connect");
  const [conditionType, setConditionType] = useState<SequenceConditionType>(
    step.conditionType ?? "linkedin_invite_accepted",
  );
  const initialExpr = step.conditionExpression;
  const [compound, setCompound] = useState(Boolean(initialExpr && "op" in initialExpr));
  const [compoundOp, setCompoundOp] = useState<"and" | "or">(
    initialExpr && "op" in initialExpr ? initialExpr.op : "and",
  );
  const [clauses, setClauses] = useState<{ type: SequenceConditionType; not: boolean; value?: number }[]>(() => {
    if (initialExpr && "op" in initialExpr) {
      return initialExpr.clauses
        .filter((c): c is Extract<ConditionExpression, { type: SequenceConditionType }> => "type" in c)
        .map((c) => ({ type: c.type, not: Boolean(c.not), value: c.value }));
    }
    if (initialExpr && "type" in initialExpr) {
      return [{ type: initialExpr.type, not: Boolean(initialExpr.not), value: initialExpr.value }];
    }
    return [{ type: step.conditionType ?? "linkedin_invite_accepted", not: false }];
  });
  const [conditionWaitDays, setConditionWaitDays] = useState(step.conditionWaitDays ?? 3);
  const [goalLabel, setGoalLabel] = useState(step.goalLabel ?? "");
  const [godMode, setGodMode] = useState(Boolean(step.variants?.find((v) => v.variantKey === "C" && v.enabled)));
  const [variants, setVariants] = useState<Record<SequenceVariantKey, { subject: string; body: string; weight: number }>>(
    () => {
      const from = (key: SequenceVariantKey): SequenceStepVariant | undefined =>
        step.variants?.find((v) => v.variantKey === key);
      return {
        A: { subject: from("A")?.subject ?? step.subject ?? "", body: from("A")?.bodyTemplate ?? step.bodyTemplate ?? "", weight: from("A")?.weight ?? 50 },
        B: { subject: from("B")?.subject ?? "", body: from("B")?.bodyTemplate ?? "", weight: from("B")?.weight ?? 50 },
        C: { subject: from("C")?.subject ?? "", body: from("C")?.bodyTemplate ?? "", weight: from("C")?.weight ?? 0 },
      };
    },
  );

  const showVariants = step.stepType === "email" || step.stepType === "linkedin";

  function save() {
    const patch: UpdateStepInput = { delayDays, delayUnit };
    if (step.stepType === "email" || step.stepType === "linkedin" || step.stepType === "whatsapp" || step.stepType === "task") {
      patch.subject = subject || null;
      patch.bodyTemplate = body || null;
    }
    if (step.stepType === "linkedin") patch.linkedinAction = linkedinAction;
    if (step.stepType === "condition") {
      patch.conditionWaitDays = conditionWaitDays;
      if (compound && clauses.length > 0) {
        patch.conditionType = clauses[0]!.type;
        patch.conditionExpression = {
          op: compoundOp,
          clauses: clauses.map((c) => ({
            type: c.type,
            not: c.not || undefined,
            value: c.type in CONDITION_VALUE_DEFAULTS ? c.value ?? CONDITION_VALUE_DEFAULTS[c.type] : undefined,
          })),
        };
      } else {
        patch.conditionType = conditionType;
        patch.conditionExpression = null;
      }
    }
    if (step.stepType === "goal") patch.goalLabel = goalLabel || null;
    if (showVariants) {
      const list: StepVariantInput[] = [
        { variantKey: "A", subject: variants.A.subject || null, bodyTemplate: variants.A.body || null, weight: variants.A.weight, enabled: true },
        { variantKey: "B", subject: variants.B.subject || null, bodyTemplate: variants.B.body || null, weight: variants.B.weight, enabled: true },
        { variantKey: "C", subject: variants.C.subject || null, bodyTemplate: variants.C.body || null, weight: godMode ? variants.C.weight || 25 : 0, enabled: godMode },
      ];
      patch.variants = list;
      patch.subject = variants.A.subject || subject || null;
      patch.bodyTemplate = variants.A.body || body || null;
    }
    onSave(patch);
    onClose();
  }

  return (
    <Dialog open onClose={onClose} title={`Edit ${PALETTE.find((p) => p.type === step.stepType)?.label ?? "step"}`} className="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Wait</span>
          <Input type="number" min={0} className="h-8 w-16" value={delayDays} onChange={(e) => setDelayDays(Number(e.target.value) || 0)} />
          <Select value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as SequenceDelayUnit)} className="h-8 w-28">
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
            <option value="weeks">weeks</option>
          </Select>
        </div>

        {step.stepType === "linkedin" && (
          <Select value={linkedinAction} onChange={(e) => setLinkedinAction(e.target.value as SequenceLinkedinAction)}>
            <option value="connect">Connection request</option>
            <option value="message">Direct message</option>
            <option value="inmail">InMail</option>
            <option value="like">Like recent posts</option>
            <option value="follow">Follow profile</option>
          </Select>
        )}

        {step.stepType === "condition" && (
          <>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={compound} onChange={(e) => setCompound(e.target.checked)} />
              Compound AND / OR / NOT
            </label>
            {!compound ? (
              <Select value={conditionType} onChange={(e) => setConditionType(e.target.value as SequenceConditionType)}>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            ) : (
              <div className="space-y-2 rounded-md border border-border p-2">
                <Select value={compoundOp} onChange={(e) => setCompoundOp(e.target.value as "and" | "or")} className="h-8">
                  <option value="and">Match ALL (AND)</option>
                  <option value="or">Match ANY (OR)</option>
                </Select>
                {clauses.map((clause, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-1.5">
                    <label className="flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={clause.not}
                        onChange={(e) => setClauses((rows) => rows.map((r, i) => i === idx ? { ...r, not: e.target.checked } : r))}
                      />
                      NOT
                    </label>
                    <Select
                      value={clause.type}
                      className="h-8 flex-1"
                      onChange={(e) => setClauses((rows) => rows.map((r, i) => i === idx ? { ...r, type: e.target.value as SequenceConditionType } : r))}
                    >
                      {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                    {clause.type in CONDITION_VALUE_DEFAULTS && (
                      <Input
                        type="number"
                        className="h-8 w-16"
                        value={clause.value ?? CONDITION_VALUE_DEFAULTS[clause.type]}
                        onChange={(e) => {
                          const fallback = CONDITION_VALUE_DEFAULTS[clause.type]!;
                          setClauses((rows) => rows.map((r, i) => i === idx ? { ...r, value: Number(e.target.value) || fallback } : r));
                        }}
                      />
                    )}
                    <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setClauses((rows) => rows.filter((_, i) => i !== idx))}>
                      ×
                    </button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => setClauses((rows) => [...rows, { type: "email_opened", not: false }])}>
                  Add clause
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Max wait</span>
              <Input type="number" min={1} max={30} className="h-8 w-16" value={conditionWaitDays} onChange={(e) => setConditionWaitDays(Number(e.target.value) || 1)} />
              <span className="text-muted-foreground">days, then fallback (No)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Accepted → Yes branch. Declined or still pending after the wait → No / email fallback.
            </p>
          </>
        )}

        {step.stepType === "goal" && (
          <Input placeholder="Goal label — e.g. Event participation confirmation" value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} />
        )}

        {showVariants && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">A/B/C testing</p>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={godMode} onChange={(e) => setGodMode(e.target.checked)} />
                Enable C — God Mode
              </label>
            </div>
            {(["A", "B", ...(godMode ? (["C"] as const) : [])] as SequenceVariantKey[]).map((key) => (
              <div key={key} className="space-y-1.5 rounded-md border border-border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Variant {key}{key === "C" ? " · God Mode" : ""}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-7 w-16 text-xs"
                    value={variants[key].weight}
                    onChange={(e) =>
                      setVariants((v) => ({ ...v, [key]: { ...v[key], weight: Number(e.target.value) || 0 } }))
                    }
                    aria-label={`${key} weight`}
                  />
                </div>
                {step.stepType === "email" && (
                  <Input
                    placeholder="Subject"
                    value={variants[key].subject}
                    onChange={(e) => setVariants((v) => ({ ...v, [key]: { ...v[key], subject: e.target.value } }))}
                  />
                )}
                <textarea
                  rows={3}
                  placeholder="Message body"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={variants[key].body}
                  onChange={(e) => setVariants((v) => ({ ...v, [key]: { ...v[key], body: e.target.value } }))}
                />
              </div>
            ))}
          </div>
        )}

        {!showVariants && (step.stepType === "whatsapp" || step.stepType === "task") && (
          <>
            {step.stepType === "task" && (
              <Input placeholder="Task title" value={subject} onChange={(e) => setSubject(e.target.value)} />
            )}
            <textarea
              rows={4}
              placeholder="Body"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
