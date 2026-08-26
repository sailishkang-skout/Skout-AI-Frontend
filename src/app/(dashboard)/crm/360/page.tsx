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
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>{mode === "account" ? "Company" : "Contact"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(mode === "account" ? data.company : data.contact, null, 2)}
              </pre>
            </CardContent>
          </Card>
          {"deals" in data && (
            <Card>
              <CardHeader>
                <CardTitle>Deals ({Array.isArray(data.deals) ? data.deals.length : 0})</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {Array.isArray(data.deals) && data.deals.length
                  ? data.deals.map((d: { id?: string; name?: string }) => (
                      <div key={String(d.id)}>{String(d.name ?? d.id)}</div>
                    ))
                  : "No deals"}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Signals / timeline</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Signals: {Array.isArray(data.signals) ? data.signals.length : 0} · Timeline:{" "}
              {Array.isArray(data.timeline) ? data.timeline.length : 0}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
