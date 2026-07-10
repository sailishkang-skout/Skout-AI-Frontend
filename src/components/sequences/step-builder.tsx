"use client";

import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  GripVertical,
  Linkedin,
  ListChecks,
  Loader2,
  Mail,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EmailBodyEditor } from "@/components/sequences/email-body-editor";
import type { SequenceStep, SequenceStepType } from "@/types/api";

// ── Step type visual config ──────────────────────────────────
const STEP_CONFIG = {
  email: {
    label: "Email",
    icon: Mail,
    dot: "bg-blue-500",
    border: "border-l-blue-500",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    ring: "ring-blue-200 dark:ring-blue-800",
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    dot: "bg-violet-500",
    border: "border-l-violet-500",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    ring: "ring-violet-200 dark:ring-violet-800",
  },
  wait: {
    label: "Wait",
    icon: Clock,
    dot: "bg-amber-500",
    border: "border-l-amber-500",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    ring: "ring-amber-200 dark:ring-amber-800",
  },
  task: {
    label: "Manual task",
    icon: ListChecks,
    dot: "bg-emerald-500",
    border: "border-l-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    ring: "ring-emerald-200 dark:ring-emerald-800",
  },
} satisfies Record<SequenceStepType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dot: string;
  border: string;
  badge: string;
  ring: string;
}>;

const STEP_TYPE_OPTIONS = (Object.entries(STEP_CONFIG) as [SequenceStepType, typeof STEP_CONFIG[SequenceStepType]][]).map(
  ([value, cfg]) => ({ value, label: cfg.label }),
);

// ── Connector between steps ──────────────────────────────────
function StepConnector({ delayDays }: { delayDays: number }) {
  return (
    <div className="flex items-center gap-3 py-0.5 pl-[22px]">
      <div className="flex flex-col items-center">
        <div className="h-6 w-0.5 bg-border" />
      </div>
      <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {delayDays === 0 ? "immediately" : `+${delayDays} day${delayDays === 1 ? "" : "s"}`}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ── Individual step card ─────────────────────────────────────
function StepCard({
  step,
  onUpdate,
  onDelete,
  updating,
  deleting,
}: {
  step: SequenceStep;
  onUpdate: (patch: {
    stepType?: SequenceStepType;
    delayDays?: number;
    subject?: string | null;
    bodyTemplate?: string | null;
  }) => void;
  onDelete: () => void;
  updating: boolean;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  const cfg = STEP_CONFIG[step.stepType];
  const Icon = cfg.icon;

  const [subjectDraft, setSubjectDraft] = useState(step.subject ?? "");
  const [bodyDraft, setBodyDraft] = useState(step.bodyTemplate ?? "");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-60")}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border border-l-4 bg-card shadow-sm transition-opacity",
          cfg.border,
          (updating || deleting) && "opacity-60",
        )}
      >
        {/* ── Card header ─────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Drag handle */}
          <button
            type="button"
            aria-label="Drag to reorder"
            className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Step number */}
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2",
              cfg.badge,
              cfg.ring,
            )}
          >
            {step.stepOrder}
          </span>

          {/* Type icon + badge */}
          <span className={cn("flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", cfg.badge)}>
            <Icon className="h-3.5 w-3.5" />
            {cfg.label}
          </span>

          {/* Type selector */}
          <Select
            value={step.stepType}
            onChange={(e) => onUpdate({ stepType: e.target.value as SequenceStepType })}
            disabled={updating}
            className="h-8 w-36 shrink-0 text-xs"
          >
            {STEP_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>

          {/* Delay control */}
          <div className="flex shrink-0 items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Wait</span>
            <Input
              type="number"
              min={0}
              value={step.delayDays}
              onChange={(e) => onUpdate({ delayDays: Math.max(0, Number(e.target.value) || 0) })}
              disabled={updating}
              className="h-8 w-14 text-center text-xs"
              aria-label="Delay in days"
            />
            <span className="text-muted-foreground">days</span>
          </div>

          {/* Saving indicator */}
          {updating && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          )}

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Delete step"
            className="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>

        {/* ── Email fields ────────────────────────────── */}
        {step.stepType === "email" && (
          <div className="space-y-2 border-t border-border bg-muted/20 px-4 py-3">
            <Input
              placeholder="Subject line — supports {{firstName}}, {{companyName}}, etc."
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              onBlur={() => {
                if (subjectDraft !== (step.subject ?? ""))
                  onUpdate({ subject: subjectDraft || null });
              }}
              disabled={updating}
              className="h-9 bg-background text-sm"
            />
            <EmailBodyEditor
              value={bodyDraft}
              onChange={(html) => {
                setBodyDraft(html);
                onUpdate({ bodyTemplate: html || null });
              }}
              disabled={updating}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── StepBuilder ──────────────────────────────────────────────
export function StepBuilder({
  steps,
  onReorder,
  onUpdateStep,
  onDeleteStep,
  onAddStep,
  reordering,
  updatingStepId,
  deletingStepId,
  adding,
}: {
  steps: SequenceStep[];
  onReorder: (orderedStepIds: string[]) => void;
  onUpdateStep: (
    stepId: string,
    patch: { stepType?: SequenceStepType; delayDays?: number; subject?: string | null; bodyTemplate?: string | null },
  ) => void;
  onDeleteStep: (stepId: string) => void;
  onAddStep: (input: { stepType: SequenceStepType; delayDays: number }) => void;
  reordering: boolean;
  updatingStepId: string | null;
  deletingStepId: string | null;
  adding: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [newStepType, setNewStepType] = useState<SequenceStepType>("email");

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = steps.findIndex((s) => s.id === active.id);
    const newIdx = steps.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved!);
    onReorder(reordered.map((s) => s.id));
  }

  return (
    <div className={cn("space-y-0", reordering && "pointer-events-none opacity-60")}>
      {/* ── Empty state ──────────────────────────────── */}
      {steps.length === 0 && (
        <div className="mb-4 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-14 text-center">
          <div className="rounded-full bg-muted p-3">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">No steps yet</p>
            <p className="text-sm text-muted-foreground">Add your first step below to build this sequence.</p>
          </div>
        </div>
      )}

      {/* ── Step list ────────────────────────────────── */}
      {steps.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {steps.map((step, idx) => (
                <div key={step.id}>
                  {idx > 0 && <StepConnector delayDays={step.delayDays} />}
                  <StepCard
                    step={step}
                    onUpdate={(patch) => onUpdateStep(step.id, patch)}
                    onDelete={() => onDeleteStep(step.id)}
                    updating={updatingStepId === step.id}
                    deleting={deletingStepId === step.id}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ── Add step bar ─────────────────────────────── */}
      <div className="mt-4">
        {steps.length > 0 && (
          <div className="mb-3 flex items-center gap-3 pl-[22px]">
            <div className="h-6 w-0.5 bg-border" />
          </div>
        )}
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center">
          <Select
            value={newStepType}
            onChange={(e) => setNewStepType(e.target.value as SequenceStepType)}
            className="h-9 w-full sm:w-44"
          >
            {STEP_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Button
            onClick={() => onAddStep({ stepType: newStepType, delayDays: 1 })}
            disabled={adding}
            className="gap-2"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add step
          </Button>
          <p className="text-xs text-muted-foreground">
            Steps run in order — drag to reorder
          </p>
        </div>
      </div>
    </div>
  );
}
