"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useComplianceApi, type DsarRow } from "@/lib/compliance";
import { useWorkspaceRole } from "@/lib/workspace-role";

/** §16 — Consent + suppression center. */
export default function ComplianceCenterPage() {
  const authReady = useAuthReady();
  const api = useComplianceApi();
  const qc = useQueryClient();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");

  const suppressions = useQuery({
    queryKey: ["suppressions", search],
    queryFn: () => api.listSuppressions({ email: search || undefined, limit: 50 }),
    enabled: authReady,
  });

  const consents = useQuery({
    queryKey: ["compliance-consents"],
    queryFn: () => api.listConsents({ limit: 50 }),
    enabled: authReady,
  });

  const add = useMutation({
    mutationFn: () => api.addSuppression(email.trim()),
    onSuccess: () => {
      setEmail("");
      qc.invalidateQueries({ queryKey: ["suppressions"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.removeSuppression(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppressions"] }),
  });

  return (
    <PageShell width="wide">
      <PageHeader
        title="Compliance center"
        description="Unified consent audit trail and email suppression (DNC) list across outreach channels."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Suppression list
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && (
              <div className="flex gap-2">
                <Input
                  placeholder="email@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button disabled={!email.trim() || add.isPending} onClick={() => add.mutate()}>
                  Add DNC
                </Button>
              </div>
            )}
            <Input placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {add.isError && <Alert variant="error">{formatQueryError(add.error)}</Alert>}
            {suppressions.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">Email</th>
                      <th className="p-2">Reason</th>
                      {isAdmin && <th className="p-2 w-12" />}
                    </tr>
                  </thead>
                  <tbody>
                    {(suppressions.data?.data ?? []).map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2 font-mono text-xs">{row.email}</td>
                        <td className="p-2">{row.reason}</td>
                        {isAdmin && (
                          <td className="p-2">
                            <Button size="sm" variant="ghost" onClick={() => remove.mutate(row.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(suppressions.data?.data.length ?? 0) === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">No suppressions yet.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consent history</CardTitle>
          </CardHeader>
          <CardContent>
            {consents.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {(consents.data?.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.revokedAt ? "muted" : "success"}>{c.type}</Badge>
                      <span className="text-muted-foreground">{c.subjectType}:{c.subjectId.slice(0, 8)}…</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Basis: {c.basis}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.grantedAt}
                      {c.revokedAt ? ` · revoked ${c.revokedAt}` : ""}
                    </p>
                  </div>
                ))}
                {(consents.data?.data.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No consent records yet.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Data subject requests (DSAR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DsarPanel />
        </CardContent>
      </Card>
    </PageShell>
  );
}

function DsarPanel() {
  const authReady = useAuthReady();
  const api = useComplianceApi();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState<DsarRow["requestType"]>("access");

  const dsar = useQuery({
    queryKey: ["dsar"],
    queryFn: () => api.listDsar(),
    enabled: authReady,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createDsar({
        subjectEmail: email.trim(),
        requestType,
        fulfillmentMode: requestType === "access" || requestType === "portability" ? "auto" : "manual",
      }),
    onSuccess: () => {
      setEmail("");
      qc.invalidateQueries({ queryKey: ["dsar"] });
    },
  });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="subject@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select value={requestType} onChange={(e) => setRequestType(e.target.value as DsarRow["requestType"])}>
          <option value="access">Access</option>
          <option value="portability">Portability</option>
          <option value="erasure">Erasure</option>
          <option value="rectification">Rectification</option>
        </Select>
        <Button disabled={!email.trim() || create.isPending} onClick={() => create.mutate()}>
          Submit DSAR
        </Button>
      </div>
      {create.isError && <Alert variant="error">{formatQueryError(create.error)}</Alert>}
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {(dsar.data?.data ?? []).map((row) => (
          <div key={row.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={row.status === "completed" ? "success" : "warning"}>{row.status}</Badge>
              <span>{row.requestType}</span>
              <span className="font-mono text-xs">{row.subjectEmail}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
