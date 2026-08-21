"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Loader2, Plus, SkipForward, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskFormSheet } from "@/components/crm/task-form-sheet";
import { CallButton } from "@/components/crm/call-button";
import { useTasksApi } from "@/lib/crm/tasks";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useWorkspaceRole, isForbiddenError } from "@/lib/workspace-role";
import { formatDueDate, taskStatusTone, TASK_TYPE_LABEL } from "@/lib/crm-display";
import type { CrmEntityType, TaskDisposition, TaskStatus } from "@/types/crm";

type AssigneeFilter = "me" | "all";
type DueFilter = "all" | "overdue" | "today" | "week";

const ENTITY_FILTER_OPTIONS: { value: CrmEntityType | "all"; label: string }[] = [
  { value: "all", label: "All linked entities" },
  { value: "contact", label: "Contacts" },
  { value: "company", label: "Companies" },
  { value: "deal", label: "Deals" },
];

const DISPOSITION_OPTIONS: { value: TaskDisposition; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "bad_number", label: "Bad number" },
];

function dueFilterRange(filter: DueFilter): { dueBefore?: string; dueAfter?: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "overdue") return { dueBefore: startOfToday.toISOString() };
  if (filter === "today") {
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    return { dueAfter: startOfToday.toISOString(), dueBefore: startOfTomorrow.toISOString() };
  }
  if (filter === "week") {
    const in7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { dueBefore: in7Days.toISOString() };
  }
  return {};
}

export default function TasksPage() {
  const queryClient = useQueryClient();
  const tasksApi = useTasksApi();
  const authReady = useAuthReady();
  const { canDelete, userId } = useWorkspaceRole();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("open");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("me");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [entityFilter, setEntityFilter] = useState<CrmEntityType | "all">("all");
  const [actionError, setActionError] = useState<string | null>(null);

  const dueRange = useMemo(() => dueFilterRange(dueFilter), [dueFilter]);

  const tasks = useQuery({
    queryKey: ["crm", "tasks", { status: statusFilter, assigneeFilter, dueFilter, entityFilter, userId }],
    queryFn: () =>
      tasksApi.list({
        limit: 100,
        status: statusFilter === "all" ? undefined : statusFilter,
        assignedTo: assigneeFilter === "me" ? userId : undefined,
        relatedEntityType: entityFilter === "all" ? undefined : entityFilter,
        ...dueRange,
      }),
    enabled: authReady && (assigneeFilter !== "me" || Boolean(userId)),
  });

  const complete = useMutation({
    mutationFn: (id: string) => tasksApi.complete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "tasks"] }),
  });

  const skip = useMutation({
    mutationFn: (id: string) => tasksApi.skip(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "tasks"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["crm", "tasks"] });
    },
    onError: (err) => {
      setActionError(
        isForbiddenError(err)
          ? "You don't have permission to delete this — ask a workspace admin or owner."
          : formatQueryError(err, "Could not delete this task.")
      );
    },
  });

  // R20.4 — SDR sets a disposition after placing a sequence "call" step's call; this is what
  // unblocks the cadence worker (see resolveCallDisposition() in sequence-enrollment.worker.ts).
  const setDisposition = useMutation({
    mutationFn: ({ id, disposition }: { id: string; disposition: TaskDisposition }) =>
      tasksApi.update(id, { disposition }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "tasks"] }),
  });

  const rows = tasks.data?.data ?? [];

  return (
    <PageShell data-testid="page-crm-tasks">
      <PageHeader
        title={assigneeFilter === "me" ? "My Tasks" : "Tasks"}
        description="Follow-ups and to-dos across your companies, contacts, and deals."
        actions={
          <Button data-testid="create-task-button" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
          className="w-36"
        >
          <option value="me">My tasks</option>
          <option value="all">All tasks</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "all")}
          className="w-36"
        >
          <option value="open">Open</option>
          <option value="done">Done</option>
          <option value="skipped">Skipped</option>
          <option value="all">All statuses</option>
        </Select>
        <Select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as DueFilter)} className="w-40">
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
        </Select>
        <Select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value as CrmEntityType | "all")}
          className="w-48"
        >
          {ENTITY_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {tasks.isError && (
        <Alert variant="error" onRetry={() => tasks.refetch()}>
          {formatQueryError(tasks.error, "Could not load tasks.")}
        </Alert>
      )}
      {actionError && <Alert variant="warning" dismissible>{actionError}</Alert>}

      {tasks.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <CheckSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No tasks</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((task) => {
            const due = formatDueDate(task.dueDate);
            return (
              <Card key={task.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => complete.mutate(task.id)}
                    disabled={task.status !== "open" || (complete.isPending && complete.variables === task.id)}
                    className="shrink-0 rounded-full border border-border p-1 hover:bg-accent disabled:opacity-50"
                    aria-label={task.status === "done" ? "Completed" : "Mark complete"}
                  >
                    {complete.isPending && complete.variables === task.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckSquare className={`h-4 w-4 ${task.status === "done" ? "text-green-600" : "text-muted-foreground"}`} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${task.status !== "open" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {due && task.status === "open" && (
                        <span className={due.overdue ? "text-red-600 dark:text-red-400" : ""}>{due.label}</span>
                      )}
                      <Badge tone={taskStatusTone(task.status)}>{task.status}</Badge>
                      <Badge tone="muted">{TASK_TYPE_LABEL[task.type]}</Badge>
                      <Badge tone="muted">{task.priority}</Badge>
                      {task.relatedEntityType && <Badge tone="info">{task.relatedEntityType}</Badge>}
                      {task.disposition && <Badge tone="muted">{task.disposition.replace("_", " ")}</Badge>}
                    </div>
                    {/* R20.4 — sequence "call" step tasks carry a prospectId; give the SDR a
                        one-click dial + a disposition to set once they're done. */}
                    {task.prospectId && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CallButton prospectId={task.prospectId} taskId={task.id} />
                        <Select
                          value={task.disposition ?? ""}
                          onChange={(e) =>
                            e.target.value &&
                            setDisposition.mutate({ id: task.id, disposition: e.target.value as TaskDisposition })
                          }
                          className="h-8 w-40 text-xs"
                        >
                          <option value="" disabled>
                            Set disposition…
                          </option>
                          {DISPOSITION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </div>
                  {task.status === "open" && (
                    <button
                      type="button"
                      onClick={() => skip.mutate(task.id)}
                      disabled={skip.isPending && skip.variables === task.id}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
                      aria-label={`Skip ${task.title}`}
                      title="Skip"
                    >
                      {skip.isPending && skip.variables === task.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <SkipForward className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(task.id)}
                      disabled={remove.isPending && remove.variables === task.id}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      aria-label={`Delete ${task.title}`}
                    >
                      {remove.isPending && remove.variables === task.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TaskFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </PageShell>
  );
}
