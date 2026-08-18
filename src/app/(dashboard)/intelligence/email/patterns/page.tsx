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

  // Lowest priority number = most likely pattern.
  const ranked = [...(patterns.data?.patterns ?? [])].sort((a, b) => a.priority - b.priority);
  const top = ranked[0];

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Patterns"
        description="Rank the likely email address patterns for a domain, most likely first."
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
            <CardTitle className="text-base">{top ? "Most likely" : "No patterns generated"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {top && (
              <div className="flex items-center justify-between rounded-lg border bg-accent/30 px-3 py-2.5">
                <p className="font-mono text-sm font-medium">{top.email}</p>
                <Badge tone="success">{top.pattern}</Badge>
              </div>
            )}
            {ranked.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">All patterns</p>
                {ranked.slice(1).map((candidate) => (
                  <div
                    key={candidate.email}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="font-mono">{candidate.email}</span>
                    <Badge tone="muted">{candidate.pattern}</Badge>
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
