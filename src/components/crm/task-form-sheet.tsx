"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTasksApi } from "@/lib/crm/tasks";
import { useTeamApi } from "@/lib/team";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { Field } from "./form-field";
import { TASK_TYPE_LABEL } from "@/lib/crm-display";
import type { CrmEntityType, Task, TaskPriority, TaskType } from "@/types/crm";

const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high"];
const TYPE_OPTIONS: TaskType[] = ["custom", "call", "email", "follow-up"];

export function TaskFormSheet({
  open,
  onClose,
  task,
  /** Preselect the related entity when creating a task from a detail page's mini-panel. */
  defaultRelatedEntity,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  defaultRelatedEntity?: { type: CrmEntityType; id: string };
  onSaved?: (task: Task) => void;
}) {
  const queryClient = useQueryClient();
  const tasksApi = useTasksApi();
  const teamApi = useTeamApi();
  const authReady = useAuthReady();
  const isEdit = Boolean(task);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [type, setType] = useState<TaskType>("custom");
  const [assignedTo, setAssignedTo] = useState("");

  const members = useQuery({
    queryKey: ["team", "members"],
    queryFn: () => teamApi.listMembers(),
    enabled: authReady && open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDueDate(task?.dueDate ? task.dueDate.slice(0, 16) : "");
    setPriority(task?.priority ?? "medium");
    setType(task?.type ?? "custom");
    setAssignedTo(task?.assignedTo ?? "");
  }, [open, task]);

  const save = useMutation({
    mutationFn: () => {
      const dueDateIso = dueDate ? new Date(dueDate).toISOString() : undefined;
      if (isEdit) {
        return tasksApi.update(task!.id, {
          title: title.trim(),
          dueDate: dueDateIso,
          priority,
          type,
          assignedTo: assignedTo || undefined,
        });
      }
      return tasksApi.create({
        title: title.trim(),
        dueDate: dueDateIso,
        priority,
        type,
        assignedTo: assignedTo || undefined,
        relatedEntityType: task?.relatedEntityType ?? defaultRelatedEntity?.type,
        relatedEntityId: task?.relatedEntityId ?? defaultRelatedEntity?.id,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "tasks"] });
      onSaved?.(saved);
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit task" : "New task"}>
      <div className="space-y-4">
        {save.isError && (
          <Alert variant="error">{formatQueryError(save.error, "Could not save this task.")}</Alert>
        )}

        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Send updated proposal" />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assign to">
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} disabled={members.isLoading}>
            <option value="">Unassigned</option>
            {(members.data?.data ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName || m.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!title.trim() || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
