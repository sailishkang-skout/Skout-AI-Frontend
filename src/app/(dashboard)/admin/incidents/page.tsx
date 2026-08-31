"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useIncidentsApi } from "@/lib/incidents";
import { useWorkspaceRole } from "@/lib/workspace-role";

/** §11.3 / §17.18 — Incident management UI. */
export default function IncidentsPage() {
  const authReady = useAuthReady();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const api = useIncidentsApi();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("manual");

  const incidents = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.list(),
    enabled: authReady,
  });

  const create = useMutation({
    mutationFn: () => api.create({ title: title.trim(), source, severity: "medium" }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["enterprise-control-plane"] });
    },
  });

  const ack = useMutation({
    mutationFn: (id: string) => api.acknowledge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => api.resolve(id, "Resolved from control plane UI"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });

  return (
    <PageShell width="wide">
      <PageHeader title="Incidents" description="Log, triage, and resolve operational incidents for this workspace." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Report incident
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-md" />
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="manual">Manual</option>
            <option value="integration">Integration</option>
            <option value="provider">Provider</option>
          </Select>
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </CardContent>
      </Card>

      {incidents.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-3">
          {(incidents.data?.data ?? []).map((inc) => (
            <Card key={inc.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={inc.status === "resolved" ? "success" : "warning"}>{inc.status}</Badge>
                    <Badge tone="muted">{inc.severity}</Badge>
                    <span className="font-medium">{inc.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{inc.source} · {inc.detectedAt}</p>
                </div>
                <div className="flex gap-2">
                  {inc.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => ack.mutate(inc.id)}>
                      Acknowledge
                    </Button>
                  )}
                  {isAdmin && inc.status !== "resolved" && (
                    <Button size="sm" onClick={() => resolve.mutate(inc.id)}>
                      Resolve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(incidents.data?.data.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No incidents recorded.</p>
          )}
        </div>
      )}
      {create.isError && <Alert variant="error">{formatQueryError(create.error)}</Alert>}
    </PageShell>
  );
}
