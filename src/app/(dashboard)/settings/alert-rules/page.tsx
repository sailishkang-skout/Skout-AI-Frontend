"use client";

/** R17.3 — signal-triggered SDR alerts. A rule watches a signal type (with an optional minimum
 * confidence); when a matching signal lands on an owned account, the owning SDR is notified.
 * Real-time vs. daily-digest delivery is a per-user choice on the Notifications settings page. */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Trash2 } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
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
import { ALERTABLE_SIGNAL_TYPES, useAlertRulesApi } from "@/lib/alert-rules";
import { signalLabel } from "@/lib/signals";

export default function AlertRulesPage() {
  const authReady = useAuthReady();
  const rulesApi = useAlertRulesApi();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const rules = useQuery({
    queryKey: ["alert-rules"],
    queryFn: rulesApi.list,
    enabled: authReady,
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => rulesApi.update(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => rulesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  return (
    <PageShell width="narrow" data-testid="page-alert-rules">
      <PageHeader
        title="Signal alerts"
        description="Get notified the moment an important signal lands on an account you own — funding, hiring, tech changes, or risk signals like engagement decay."
        actions={
          <>
            <GuideLink slug="alert-notifications" label="Alerts guide" compact />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New alert
            </Button>
          </>
        }
      />

      <Alert variant="default">
        Choose real-time or daily-digest delivery per signal type on the{" "}
        <Link href="/settings/notifications" className="font-medium underline">
          Notifications settings
        </Link>{" "}
        page.
      </Alert>

      {rules.isError && (
        <Alert variant="error">{formatQueryError(rules.error, "Could not load alert rules.")}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (rules.data?.data.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Bell className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No alert rules yet. Create one to be notified when a signal fires.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {rules.data!.data.map((rule) => (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{signalLabel(rule.signalType)}</p>
                      <Badge tone={rule.enabled ? "success" : "muted"}>
                        {rule.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {rule.minConfidence != null
                        ? `Fires at ≥ ${Math.round(rule.minConfidence * 100)}% confidence`
                        : "Fires on any matching signal"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: rule.id, enabled: !rule.enabled })}
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </Button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete alert rule"
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

      <CreateAlertRuleDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageShell>
  );
}

function CreateAlertRuleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rulesApi = useAlertRulesApi();
  const queryClient = useQueryClient();

  const [signalType, setSignalType] = useState(ALERTABLE_SIGNAL_TYPES[0]!.value);
  const [minConfidence, setMinConfidence] = useState("");

  const create = useMutation({
    mutationFn: () =>
      rulesApi.create({
        signalType,
        minConfidence: minConfidence.trim() ? Number(minConfidence) / 100 : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setSignalType(ALERTABLE_SIGNAL_TYPES[0]!.value);
      setMinConfidence("");
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="New signal alert">
      <div className="space-y-4">
        {create.isError && (
          <Alert variant="error">{formatQueryError(create.error, "Could not create alert.")}</Alert>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Signal type</span>
          <Select value={signalType} onChange={(e) => setSignalType(e.target.value)}>
            {ALERTABLE_SIGNAL_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Minimum confidence (optional, 0–100)</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
            placeholder="Any confidence"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Create alert
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
