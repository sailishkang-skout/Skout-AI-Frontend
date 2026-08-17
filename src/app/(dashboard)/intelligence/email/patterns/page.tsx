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

function decisionTone(decision: string): "success" | "danger" | "warning" {
  if (decision === "STRONG" || decision === "GOOD") return "success";
  if (decision === "REJECT") return "danger";
  return "warning";
}

export default function EmailPatternsPage() {
  const emailIntel = useEmailIntelApi();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");

  const patterns = useMutation({
    mutationFn: () =>
      emailIntel.patterns({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        domain: domain.trim(),
      }),
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Patterns"
        description="Rank the likely email address patterns for a domain from historical evidence."
      />

      <Card>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              patterns.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
              <Input
                placeholder="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>
            <Input
              placeholder="company.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              required
            />
            <Button type="submit" disabled={patterns.isPending} className="w-full">
              {patterns.isPending ? "Ranking…" : "Rank patterns"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {patterns.isError && (
        <Alert variant="error" title="Couldn't rank patterns">
          {formatQueryError(patterns.error, "Could not rank email patterns.")}
        </Alert>
      )}

      {patterns.isSuccess && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {patterns.data.recommended ? "Recommended" : "No confident pattern"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {patterns.data.recommended && (
              <div className="flex items-center justify-between rounded-lg border bg-accent/30 px-3 py-2.5">
                <p className="font-mono text-sm font-medium">{patterns.data.recommended.email}</p>
                <Badge tone="success">{patterns.data.recommended.confidence}% confidence</Badge>
              </div>
            )}
            {patterns.data.candidates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">All candidates</p>
                {patterns.data.candidates.map((candidate) => (
                  <div
                    key={candidate.email}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="font-mono">{candidate.email}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone="muted">{candidate.pattern}</Badge>
                      <Badge tone={decisionTone(candidate.decision)}>{candidate.decision}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
