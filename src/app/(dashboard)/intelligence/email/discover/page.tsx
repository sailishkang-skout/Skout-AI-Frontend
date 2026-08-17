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

export default function EmailDiscoverPage() {
  const emailIntel = useEmailIntelApi();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");

  const discover = useMutation({
    mutationFn: () =>
      emailIntel.discover({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        domain: domain.trim(),
      }),
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Discover"
        description="Find and verify the most likely email address for a person at a company."
      />

      <Card>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              discover.mutate();
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
                placeholder="Last name (optional)"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
            <Input
              placeholder="company.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              required
            />
            <Button type="submit" disabled={discover.isPending} className="w-full">
              {discover.isPending ? "Discovering…" : "Discover email"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {discover.isError && (
        <Alert variant="error" title="Couldn't discover an email">
          {formatQueryError(discover.error, "Could not discover an email.")}
        </Alert>
      )}

      {discover.isSuccess && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {discover.data.recommendedEmail ? "Recommended" : "No confident match"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {discover.data.recommendedEmail && (
              <div className="flex items-center justify-between rounded-lg border bg-accent/30 px-3 py-2.5">
                <p className="font-mono text-sm font-medium">{discover.data.recommendedEmail}</p>
                {discover.data.recommendedConfidence != null && (
                  <Badge tone="success">{discover.data.recommendedConfidence}% confidence</Badge>
                )}
              </div>
            )}
            {discover.data.candidates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">All candidates</p>
                {discover.data.candidates.map((candidate) => (
                  <div
                    key={candidate.email}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="font-mono">{candidate.email}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone="muted">{candidate.pattern}</Badge>
                      <Badge
                        tone={
                          candidate.decision === "STRONG" || candidate.decision === "GOOD"
                            ? "success"
                            : candidate.decision === "REJECT"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {candidate.decision}
                      </Badge>
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
