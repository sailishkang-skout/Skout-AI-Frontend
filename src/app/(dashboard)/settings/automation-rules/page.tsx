"use client";

/** R13.4 — auto-activation rules settings page. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useActivationRulesApi } from "@/lib/automation-rules";
import type { ActivationRule, ActivationTargetAction } from "@/types/api";

const MAX_ACTIVE_RULES = 5;

const ACTION_LABEL: Record<ActivationTargetAction, string> = {
  activate: "Activate prospect",
  add_to_list: "Add to list",
  enroll_sequence: "Enroll in sequence",
};

export default function AutomationRulesPage() {
  const authReady = useAuthReady();
  const rulesApi = useActivationRulesApi();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [runsForRule, setRunsForRule] = useState<ActivationRule | null>(null);

  const rules = useQuery({
    queryKey: ["activation-rules"],
    queryFn: rulesApi.list,
    enabled: authReady,
  });

  const activeCount = (rules.data?.data ?? []).filter((r) => r.enabled).length;

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => rulesApi.setEnabled(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activation-rules"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => rulesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activation-rules"] }),
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Auto-activation rules"
        description="When a prospect crosses a score threshold (and, optionally, matches a signal), automatically activate, list, or enroll them — capped at 5 active rules so automation stays reviewable."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={activeCount >= MAX_ACTIVE_RULES && !rules.isLoading}>
            <Plus className="h-4 w-4" />
            New rule
          </Button>
        }
      />

      {activeCount >= MAX_ACTIVE_RULES && (
        <Alert variant="warning">
          You have {MAX_ACTIVE_RULES} active rules — the limit. Disable one before adding another.
        </Alert>
      )}

      {rules.isError && (
        <Alert variant="error">{formatQueryError(rules.error, "Could not load rules.")}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (rules.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rules yet. Create one to automate what happens when a prospect scores high.
            </p>
          ) : (
            <div className="divide-y">
              {rules.data!.data.map((rule) => (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      <Badge tone={rule.enabled ? "success" : "muted"}>
                        {rule.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      score ≥ {rule.scoreThreshold}
                      {rule.signalType ? ` + signal "${rule.signalType}"` : ""} →{" "}
                      {ACTION_LABEL[rule.targetAction]}
                      {rule.targetId ? ` (${rule.targetId})` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRunsForRule(rule)}>
                      View runs
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggleEnabled.isPending}
                      onClick={() => toggleEnabled.mutate({ id: rule.id, enabled: !rule.enabled })}
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </Button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete rule"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRuleDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {runsForRule && <RuleRunsDialog rule={runsForRule} onClose={() => setRunsForRule(null)} />}
    </PageShell>
  );
}

function CreateRuleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rulesApi = useActivationRulesApi();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [scoreThreshold, setScoreThreshold] = useState("80");
  const [signalType, setSignalType] = useState("");
  const [targetAction, setTargetAction] = useState<ActivationTargetAction>("activate");
  const [targetId, setTargetId] = useState("");

  const create = useMutation({
    mutationFn: () =>
      rulesApi.create({
        name: name.trim(),
        scoreThreshold: Number(scoreThreshold),
        signalType: signalType.trim() || undefined,
        targetAction,
        targetId: targetId.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activation-rules"] });
      setName("");
      setScoreThreshold("80");
      setSignalType("");
      setTargetAction("activate");
      setTargetId("");
      onClose();
    },
  });

  const needsTarget = targetAction !== "activate";

  return (
    <Dialog open={open} onClose={onClose} title="New auto-activation rule">
      <div className="space-y-4">
        {create.isError && (
          <Alert variant="error">{formatQueryError(create.error, "Could not create rule.")}</Alert>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Rule name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hot leads → outbound" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Score threshold (0-100)</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={scoreThreshold}
              onChange={(e) => setScoreThreshold(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Signal type (optional)</span>
            <Input
              value={signalType}
              onChange={(e) => setSignalType(e.target.value)}
              placeholder="e.g. hiring"
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Action</span>
          <Select value={targetAction} onChange={(e) => setTargetAction(e.target.value as ActivationTargetAction)}>
            <option value="activate">Activate prospect</option>
            <option value="add_to_list">Add to list</option>
            <option value="enroll_sequence">Enroll in sequence</option>
          </Select>
        </label>
        {needsTarget && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              {targetAction === "add_to_list" ? "List ID" : "Sequence ID"}
            </span>
            <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="uuid" />
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || (needsTarget && !targetId.trim()) || create.isPending}
          >
            Create rule
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function RuleRunsDialog({ rule, onClose }: { rule: ActivationRule; onClose: () => void }) {
  const rulesApi = useActivationRulesApi();
  const queryClient = useQueryClient();

  const runs = useQuery({
    queryKey: ["activation-rules", rule.id, "runs"],
    queryFn: () => rulesApi.listRuns(rule.id),
  });

  const reverse = useMutation({
    mutationFn: (runId: string) => rulesApi.reverseRun(runId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activation-rules", rule.id, "runs"] }),
  });

  return (
    <Dialog open onClose={onClose} title={`Runs — ${rule.name}`}>
      <div className="space-y-3">
        {runs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (runs.data?.data.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">This rule hasn't fired yet.</p>
        ) : (
          <div className="divide-y">
            {runs.data!.data.map((run) => (
              <div key={run.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{run.actionTaken}</p>
                  <p className="text-xs text-muted-foreground">
                    prospect {run.prospectId} · {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                {run.reversedAt ? (
                  <Badge tone="muted">Reversed</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reverse.isPending}
                    onClick={() => reverse.mutate(run.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reverse
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
