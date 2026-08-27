"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";

/** §8.4 — Account / Person 360 compose view. */
export default function Account360Page() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const [mode, setMode] = useState<"account" | "person">("account");
  const [id, setId] = useState("");
  const [lookupId, setLookupId] = useState<string | null>(null);

  const account = useQuery({
    queryKey: ["account-360", lookupId],
    queryFn: () => api.getAccount360(lookupId!),
    enabled: authReady && mode === "account" && Boolean(lookupId),
  });

  const person = useQuery({
    queryKey: ["person-360", lookupId],
    queryFn: () => api.getPerson360(lookupId!),
    enabled: authReady && mode === "person" && Boolean(lookupId),
  });

  const active = mode === "account" ? account : person;
  const data = active.data?.data;

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Account & Person 360"
        description="Unified read of company/contact, deals, timeline, and signals — one graph, many views."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 pt-6">
          <div className="flex gap-2">
            <Button variant={mode === "account" ? "default" : "secondary"} onClick={() => setMode("account")}>
              Account
            </Button>
            <Button variant={mode === "person" ? "default" : "secondary"} onClick={() => setMode("person")}>
              Person
            </Button>
          </div>
          <Input
            className="max-w-md"
            placeholder={mode === "account" ? "Company UUID" : "Contact UUID"}
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
          <Button onClick={() => setLookupId(id.trim())} disabled={!id.trim()}>
            Load
          </Button>
        </CardContent>
      </Card>

      {active.isError && <Alert variant="error">{formatQueryError(active.error, "360 load failed.")}</Alert>}

      {data && (
        <div className="space-y-4">
          {/* Main Record Header Card */}
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  {mode === "account"
                    ? ((data as unknown as { company?: { name?: string } }).company?.name ?? "Account Profile")
                    : ((data as unknown as { professionalFacts?: { fullName?: string } }).professionalFacts?.fullName ?? "Person Profile")}
                </CardTitle>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary capitalize">
                  {mode} 360 View
                </span>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {mode === "account" ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Domain</p>
                    <p>{(data as unknown as { company?: { domain?: string } }).company?.domain ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Industry</p>
                    <p>{(data as unknown as { company?: { industry?: string } }).company?.industry ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Employees</p>
                    <p>{(data as unknown as { company?: { employeeCount?: number } }).company?.employeeCount ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Location</p>
                    <p>{(data as unknown as { company?: { country?: string } }).company?.country ?? "N/A"}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Title</p>
                    <p>{(data as unknown as { professionalFacts?: { title?: string } }).professionalFacts?.title ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Email</p>
                    <p>{(data as unknown as { professionalFacts?: { email?: string } }).professionalFacts?.email ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Company</p>
                    <p>{(data as unknown as { professionalFacts?: { companyName?: string } }).professionalFacts?.companyName ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Seniority</p>
                    <p>{(data as unknown as { professionalFacts?: { seniority?: string } }).professionalFacts?.seniority ?? "N/A"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account View: Buying Committee & Influence Map */}
          {mode === "account" && "buyingCommittee" in data && Array.isArray(data.buyingCommittee) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Buying Committee & Influence Map</span>
                  <span className="text-xs font-normal text-muted-foreground">{data.buyingCommittee.length} Stakeholders</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.buyingCommittee.map((member: { id: string; fullName: string; title: string; role: string; email?: string }) => (
                    <div key={member.id} className="rounded-lg border bg-card p-3 shadow-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{member.fullName}</p>
                        <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          {member.role}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{member.title}</p>
                      {member.email && <p className="text-xs text-muted-foreground font-mono">{member.email}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Person View: Professional Facts vs Inferred Context */}
          {mode === "person" && "professionalFacts" in data && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Verified Professional Facts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Full Name:</span>
                    <span className="font-semibold">{(data as unknown as { professionalFacts?: { fullName?: string } }).professionalFacts?.fullName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Work Email:</span>
                    <span className="font-semibold">{(data as unknown as { professionalFacts?: { email?: string } }).professionalFacts?.email ?? "Unverified"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Title:</span>
                    <span className="font-semibold">{(data as unknown as { professionalFacts?: { title?: string } }).professionalFacts?.title ?? "Unverified"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Company Domain:</span>
                    <span className="font-semibold">{(data as unknown as { professionalFacts?: { companyDomain?: string } }).professionalFacts?.companyDomain ?? "N/A"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Inferred Intent & Activity Context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Intent Signals Recorded:</span>
                    <span className="font-semibold">{(data as unknown as { inferredContext?: { signalsCount?: number } }).inferredContext?.signalsCount ?? 0} Signals</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Timeline Activity Touchpoints:</span>
                    <span className="font-semibold">{(data as unknown as { inferredContext?: { activityCount?: number } }).inferredContext?.activityCount ?? 0} Touchpoints</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Deals Section */}
          {"deals" in data && Array.isArray(data.deals) && data.deals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Associated Deals ({data.deals.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.deals.map((d: { id?: string; name?: string; amount?: number; stage?: string }) => (
                  <div key={String(d.id)} className="flex items-center justify-between rounded border p-2.5 text-xs">
                    <span className="font-semibold">{String(d.name ?? d.id)}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono">${d.amount ?? 0}</span>
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-primary font-medium">{d.stage ?? "Open"}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Universal Chronological Timeline Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Universal Activity & Intent Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(data.timeline) && data.timeline.length > 0 ? (
                <div className="space-y-3">
                  {data.timeline.map((act: { id?: string; type?: string; title?: string; occurredAt?: string; description?: string }) => (
                    <div key={String(act.id)} className="flex items-start gap-3 border-b pb-2.5 text-xs last:border-b-0">
                      <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
                        •
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground">{act.title ?? act.type ?? "Activity Touchpoint"}</p>
                          <span className="text-[10px] text-muted-foreground">
                            {act.occurredAt ? new Date(act.occurredAt).toLocaleDateString() : "Recent"}
                          </span>
                        </div>
                        {act.description && <p className="text-muted-foreground">{act.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No recent chronological timeline events recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
