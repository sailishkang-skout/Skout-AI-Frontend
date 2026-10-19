"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmApi } from "@/lib/crm";
import type { CrmSyncOptInSettings } from "@/types/api";

const POLL_INTERVALS = [15, 30, 60, 240, 1440];

/**
 * COPS-09 / ADR 0014: CRM sync is off until an admin turns it on. Webhooks, the scheduled poll,
 * "Sync now", the initial import and Skout-to-HubSpot writes all respect this switch.
 */
export function CrmSyncSettings({ provider = "hubspot" }: { provider?: string }) {
  const crmApi = useCrmApi();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CrmSyncOptInSettings | null>(null);

  const optIn = useQuery({
    queryKey: ["crm", provider, "opt-in"],
    queryFn: () => crmApi.getOptIn(provider),
  });

  useEffect(() => {
    if (optIn.data?.data) setDraft(optIn.data.data);
  }, [optIn.data]);

  const save = useMutation({
    mutationFn: (body: Partial<CrmSyncOptInSettings>) => crmApi.updateOptIn(provider, body),
    onSuccess: (res) => {
      setDraft(res.data);
      queryClient.invalidateQueries({ queryKey: ["crm", provider] });
    },
  });

  const enabled = draft?.syncEnabled ?? false;
  const scopedAccounts = draft?.accountScope && !draft.accountScope.includes("*") ? draft.accountScope.length : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Power className="h-4 w-4 text-primary" />
              Sync settings
              <Badge tone={enabled ? "success" : "muted"}>{enabled ? "On" : "Off"}</Badge>
            </CardTitle>
            <CardDescription>
              Two-way sync with HubSpot is off until you turn it on. Nothing is pulled or pushed while it is off.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant={enabled ? "outline" : "default"}
            disabled={!draft || save.isPending}
            onClick={() => save.mutate({ syncEnabled: !enabled })}
          >
            {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {enabled ? "Turn sync off" : "Turn sync on"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {optIn.isLoading && <p className="text-muted-foreground">Loading sync settings…</p>}
        {optIn.isError && (
          <Alert variant="error">{optIn.error instanceof Error ? optIn.error.message : "Could not load sync settings"}</Alert>
        )}
        {save.isError && (
          <Alert variant="error">{save.error instanceof Error ? save.error.message : "The settings were not saved"}</Alert>
        )}

        {draft && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.objectScope?.contacts !== false}
                disabled={save.isPending}
                onChange={(e) => save.mutate({ objectScope: { ...draft.objectScope, contacts: e.target.checked } })}
              />
              Contacts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.objectScope?.deals !== false}
                disabled={save.isPending}
                onChange={(e) => save.mutate({ objectScope: { ...draft.objectScope, deals: e.target.checked } })}
              />
              Deals
            </label>
            <label className="flex items-center gap-2">
              Check HubSpot every
              <select
                aria-label="Poll interval"
                value={draft.pollIntervalMinutes ?? 30}
                disabled={save.isPending}
                onChange={(e) => save.mutate({ pollIntervalMinutes: Number(e.target.value) })}
                className="h-8 rounded border border-border bg-background px-2 text-xs"
              >
                {POLL_INTERVALS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} minutes` : m === 60 ? "hour" : m === 1440 ? "day" : `${m / 60} hours`}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-muted-foreground">
              {scopedAccounts > 0 ? `Limited to ${scopedAccounts} accounts` : "All accounts"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
