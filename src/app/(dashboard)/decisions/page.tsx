"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";

/** §1.2 / D14 — decision-oriented views (not vanity dashboards). */
export default function DecisionsPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const qc = useQueryClient();
  const [entityId, setEntityId] = useState("");

  const list = useQuery({
    queryKey: ["decision-views"],
    queryFn: () => api.listDecisions(),
    enabled: authReady,
  });

  const create = useMutation({
    mutationFn: () => api.createDecisionFromNba("contact", entityId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decision-views"] }),
  });

  const decide = useMutation({
    mutationFn: ({ id, choice }: { id: string; choice: "decided" | "dismissed" }) => api.decide(id, choice),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decision-views"] }),
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Decision views"
        description="Actionable recommendations with options and evidence — grounded in next-best-action and Policy Gateway."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create from NBA</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Contact UUID"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="max-w-md"
          />
          <Button onClick={() => create.mutate()} disabled={!entityId || create.isPending}>
            Create decision
          </Button>
        </CardContent>
      </Card>

      {list.isError && <Alert variant="error">{formatQueryError(list.error, "Could not load decisions.")}</Alert>}
      {create.isError && <Alert variant="error">{formatQueryError(create.error, "Create failed.")}</Alert>}

      <div className="space-y-3">
        {(list.data?.data ?? []).map((d) => {
          const id = String(d.id ?? "");
          return (
            <Card key={id}>
              <CardHeader>
                <CardTitle className="text-base">{String(d.title ?? "Decision")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{String(d.recommendation ?? "")}</p>
                <p className="text-muted-foreground">
                  Status: {String(d.status)} · kind: {String(d.kind)}
                </p>
                {String(d.status) === "open" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide.mutate({ id, choice: "decided" })}>
                      Decide
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => decide.mutate({ id, choice: "dismissed" })}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!list.isLoading && !(list.data?.data ?? []).length && (
          <p className="text-sm text-muted-foreground">No open decisions yet.</p>
        )}
      </div>
    </PageShell>
  );
}
