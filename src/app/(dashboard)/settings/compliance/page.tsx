"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
  UserX,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useComplianceApi, type DsarRow } from "@/lib/compliance";
import { useWorkspaceRole } from "@/lib/workspace-role";

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return isoString;
  }
}

/** §16 — Consent + suppression center. */
export default function ComplianceCenterPage() {
  const authReady = useAuthReady();
  const api = useComplianceApi();
  const qc = useQueryClient();
  const { canDelete: isAdmin } = useWorkspaceRole();

  const [email, setEmail] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const suppressions = useQuery({
    queryKey: ["suppressions", debouncedSearch],
    queryFn: () => api.listSuppressions({ email: debouncedSearch || undefined, limit: 50 }),
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
      toast.success(`Suppression added for ${email.trim()}`, "Email Suppressed");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["suppressions"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Could not add suppression"), "Suppression Failed");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.removeSuppression(id),
    onSuccess: () => {
      toast.info("Suppression entry removed", "Suppression Removed");
      qc.invalidateQueries({ queryKey: ["suppressions"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Could not remove suppression"), "Removal Failed");
    },
  });

  return (
    <PageShell width="wide">
      <PageHeader
        title="Compliance center"
        description="Unified consent audit trail, email suppression (DNC) list, and DSAR management across all outreach channels."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Email Suppression List (DNC) */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserX className="h-4 w-4 text-rose-500" />
                Suppression list (DNC)
              </CardTitle>
              <Badge tone="muted" className="text-[10px]">
                {suppressions.data?.data.length ?? 0} Suppressed
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Prevents autonomous outreach to unsubscribed, opted-out, or bounced addresses.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* Add DNC Form (Admin only) */}
            {isAdmin && (
              <div className="flex gap-2">
                <Input
                  placeholder="contact@target-domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email.trim() && !add.isPending) {
                      add.mutate();
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={!email.trim() || add.isPending}
                  onClick={() => add.mutate()}
                  className="h-8 gap-1 text-xs whitespace-nowrap"
                >
                  {add.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Add DNC
                </Button>
              </div>
            )}

            {/* Filter Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search suppressed emails…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {add.isError && (
              <Alert variant="error">{formatQueryError(add.error, "Could not add suppression.")}</Alert>
            )}

            {suppressions.isLoading ? (
              <Skeleton className="h-48 w-full rounded-lg" />
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border/70 custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/90 backdrop-blur-sm text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Reason</th>
                      {isAdmin && <th className="py-2.5 px-2 text-right w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {(suppressions.data?.data ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 3 : 2} className="py-8 text-center text-muted-foreground">
                          {debouncedSearch ? "No suppressions match your search." : "No suppressions added yet."}
                        </td>
                      </tr>
                    ) : (
                      (suppressions.data?.data ?? []).map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-foreground font-medium">
                            {row.email}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-[11px] capitalize">
                            <span className="rounded bg-muted px-1.5 py-0.5 border border-border/40">
                              {row.reason}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-2 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
                                onClick={() => remove.mutate(row.id)}
                                title="Remove suppression"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consent History */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" />
                Consent history
              </CardTitle>
              <Badge tone="success" className="text-[10px]">
                Audit Ready
              </Badge>
            </div>
            <CardDescription className="text-xs">
              GDPR, CCPA, and opt-in consent records captured across touchpoints.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {consents.isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {(consents.data?.data ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40">
                      <Shield className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    <p className="mt-2 text-xs font-medium text-foreground">No consent records yet</p>
                    <p className="text-[11px] text-muted-foreground">Consent records stream automatically when leads interact.</p>
                  </div>
                ) : (
                  (consents.data?.data ?? []).map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-border/70 bg-card p-3 text-xs transition-colors hover:bg-muted/30"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={c.revokedAt ? "muted" : "success"}
                            className="capitalize text-[10px]"
                          >
                            {c.type}
                          </Badge>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {c.subjectType}:{c.subjectId.slice(0, 8)}…
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(c.grantedAt)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>Basis: <strong className="font-medium text-foreground">{c.basis}</strong></span>
                        {c.revokedAt && (
                          <span className="text-rose-500 font-medium">
                            · Revoked {formatRelativeTime(c.revokedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Subject Access Requests (DSAR) Panel */}
      <Card className="mt-6 border-border/80 shadow-xs">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <div>
                <CardTitle className="text-base">Data Subject Requests (DSAR)</CardTitle>
                <CardDescription className="text-xs">
                  Process Right-to-Access, Erasure, and Portability requests per GDPR Article 15–20.
                </CardDescription>
              </div>
            </div>
            <Badge tone="info" className="text-[10px] uppercase">
              Privacy Portal
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
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
      toast.success(`DSAR ${requestType} request submitted for ${email.trim()}`, "Request Filed");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["dsar"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Failed to submit DSAR request"), "Submission Failed");
    },
  });

  return (
    <>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Input
          placeholder="subject@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 text-xs font-mono max-w-sm"
        />
        <Select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as DsarRow["requestType"])}
          className="h-8 text-xs sm:w-44"
        >
          <option value="access">Access (Art. 15)</option>
          <option value="portability">Portability (Art. 20)</option>
          <option value="erasure">Erasure (Art. 17)</option>
          <option value="rectification">Rectification (Art. 16)</option>
        </Select>
        <Button
          size="sm"
          disabled={!email.trim() || create.isPending}
          onClick={() => create.mutate()}
          className="h-8 gap-1 text-xs whitespace-nowrap"
        >
          {create.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Submit DSAR
        </Button>
      </div>

      {create.isError && (
        <Alert variant="error">{formatQueryError(create.error, "Could not submit DSAR.")}</Alert>
      )}

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {dsar.isLoading ? (
          <Skeleton className="h-28 w-full rounded-lg" />
        ) : (dsar.data?.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No active DSAR requests.</p>
        ) : (
          (dsar.data?.data ?? []).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={row.status === "completed" ? "success" : "warning"}
                  className="text-[10px] capitalize"
                >
                  {row.status}
                </Badge>
                <span className="font-semibold text-foreground uppercase text-[10px] font-mono">
                  {row.requestType}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {row.subjectEmail}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {row.fulfillmentMode} fulfillment
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
