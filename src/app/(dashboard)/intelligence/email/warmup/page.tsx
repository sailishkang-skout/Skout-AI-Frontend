"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError } from "@/lib/api-client";
import { useEmailIntelApi } from "@/lib/email-intel";

export default function EmailWarmupPage() {
  const emailIntel = useEmailIntelApi();
  const [domain, setDomain] = useState("");

  const status = useMutation({
    mutationFn: (value: string) => emailIntel.warmupStatus(value),
  });

  return (
    <PageShell width="narrow">
      <PageHeader title="Warm-up" description="Sending-reputation warm-up status per domain." />

      <Alert variant="warning" title="Not live yet">
        The warm-up engine is scaffolded but not yet sending mail — every domain will show as
        disabled below until it ships. This page is wired end-to-end and ready for when it does.
      </Alert>

      <Card>
        <CardContent className="pt-6">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (domain.trim()) status.mutate(domain.trim());
            }}
          >
            <Input
              placeholder="company.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              required
            />
            <Button type="submit" disabled={status.isPending}>
              {status.isPending ? "Checking…" : "Check status"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {status.isError && (
        <Alert variant="error" title="Couldn't check warm-up status">
          {formatQueryError(status.error, "Could not load warm-up status.")}
        </Alert>
      )}

      {status.isSuccess && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{status.data.domain}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge tone={status.data.enabled ? "success" : "muted"}>
                {status.data.enabled ? "Active" : status.data.phase}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Score</span>
              <span>{status.data.score ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Day in program</span>
              <span>{status.data.dayInProgram ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
