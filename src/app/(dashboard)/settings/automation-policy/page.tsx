"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { type AutomationMode, useDexterPlatformApi } from "@/lib/dexter-platform";

const MODES: AutomationMode[] = ["ask", "auto", "draft", "approve"];

/** D7 Policy Gateway — workspace automation modes. */
export default function AutomationPolicyPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const qc = useQueryClient();

  const policies = useQuery({
    queryKey: ["automation-policy"],
    queryFn: api.listPolicies,
    enabled: authReady,
  });

  const setMode = useMutation({
    mutationFn: ({ actionKey, mode }: { actionKey: string; mode: AutomationMode }) =>
      api.setPolicy(actionKey, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-policy"] }),
  });

  const rows = [
    ...(policies.data?.data.policies ?? []).map((p) => ({ ...p, editable: true })),
    ...(policies.data?.data.defaults ?? []).map((p) => ({ ...p, editable: true })),
  ];

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Automation policy"
        description="Four explicit modes for automatable actions: ask, auto, draft, approve. Distinct from sequence Mode A/B/C."
      />

      {policies.isError && (
        <Alert variant="error">{formatQueryError(policies.error, "Could not load policies.")}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Action modes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.actionKey} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
              <div>
                <div className="font-medium">{row.actionKey}</div>
                <div className="text-muted-foreground">{row.source}</div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={row.mode as AutomationMode}
                  onChange={(e) =>
                    setMode.mutate({ actionKey: row.actionKey, mode: e.target.value as AutomationMode })
                  }
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={setMode.isPending}
                  onClick={() => setMode.mutate({ actionKey: row.actionKey, mode: row.mode as AutomationMode })}
                >
                  Save
                </Button>
              </div>
            </div>
          ))}
          {!policies.isLoading && rows.length === 0 && (
            <p className="text-muted-foreground">No policies returned.</p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
