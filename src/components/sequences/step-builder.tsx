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
import { GripVertical, Linkedin, Loader2, Mail, Plus, Trash2, Clock, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SequenceStep, SequenceStepType } from "@/types/api";

const STEP_TYPE_OPTIONS: { value: SequenceStepType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "email", label: "Email", icon: Mail },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "wait", label: "Wait", icon: Clock },
  { value: "task", label: "Manual task", icon: ListChecks },
];

function stepTypeIcon(type: SequenceStepType) {
  return STEP_TYPE_OPTIONS.find((o) => o.value === type)?.icon ?? Mail;
}

function StepCard({
  step,
  onUpdate,
  onDelete,
  updating,
  deleting,
}: {
  step: SequenceStep;
  onUpdate: (patch: { stepType?: SequenceStepType; delayDays?: number; subject?: string | null; bodyTemplate?: string | null }) => void;
  onDelete: () => void;
  updating: boolean;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const Icon = stepTypeIcon(step.stepType);
  const [subjectDraft, setSubjectDraft] = useState(step.subject ?? "");
  const [bodyDraft, setBodyDraft] = useState(step.bodyTemplate ?? "");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "opacity-60 shadow-lg", (updating || deleting) && "opacity-70")}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {step.stepOrder}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

          <Select
            value={step.stepType}
            onChange={(e) => onUpdate({ stepType: e.target.value as SequenceStepType })}
            disabled={updating}
            className="h-9 w-36 shrink-0"
          >
            {STEP_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          <div className="flex shrink-0 items-center gap-1.5">
            <Input
              type="number"
              min={0}
              value={step.delayDays}
              onChange={(e) => onUpdate({ delayDays: Math.max(0, Number(e.target.value) || 0) })}
              disabled={updating}
              className="h-9 w-16"
              aria-label="Delay in days"
            />
            <span className="text-xs text-muted-foreground">day(s) delay</span>
          </div>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            aria-label="Delete step"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>

        {step.stepType === "email" && (
          <div className="space-y-2 pl-10">
            <Input
              placeholder="Subject — supports {{firstName}}, {{companyName}}, etc."
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              onBlur={() => {
                if (subjectDraft !== (step.subject ?? "")) onUpdate({ subject: subjectDraft || null });
              }}
              disabled={updating}
              className="h-9"
            />
            <textarea
              placeholder="Body — supports merge tokens like {{firstName}}, {{unsubscribeUrl}}"
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              onBlur={() => {
                if (bodyDraft !== (step.bodyTemplate ?? "")) onUpdate({ bodyTemplate: bodyDraft || null });
              }}
              disabled={updating}
              rows={3}
              className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  onUpdateStep: (stepId: string, patch: { stepType?: SequenceStepType; delayDays?: number; subject?: string | null; bodyTemplate?: string | null }) => void;
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
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);
    onReorder(reordered.map((s) => s.id));
  }

  return (
    <div className="space-y-3">
      {steps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No steps yet — add the first step below.
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className={cn("space-y-3", reordering && "opacity-70")}>
              {steps.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  onUpdate={(patch) => onUpdateStep(step.id, patch)}
                  onDelete={() => onDeleteStep(step.id)}
                  updating={updatingStepId === step.id}
                  deleting={deletingStepId === step.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Select
            value={newStepType}
            onChange={(e) => setNewStepType(e.target.value as SequenceStepType)}
            className="h-10 w-full sm:w-44"
          >
            {STEP_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            disabled={adding}
            onClick={() => onAddStep({ stepType: newStepType, delayDays: 1 })}
            className="w-full sm:w-auto"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add step
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
