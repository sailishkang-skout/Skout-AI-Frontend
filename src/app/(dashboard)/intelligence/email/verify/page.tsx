"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError } from "@/lib/api-client";
import {
  useEmailIntelApi,
  type EmailIntelBatchResult,
  type EmailIntelVerifyResult,
} from "@/lib/email-intel";

function ResultRow({ result }: { result: EmailIntelVerifyResult }) {
  const status = result.verificationStatus?.status ?? (result.success ? "UNKNOWN" : "ERROR");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{result.email}</p>
        {result.error && <p className="text-xs text-destructive">{result.error}</p>}
        {result.suggestedDomain && (
          <p className="text-xs text-muted-foreground">
            Did you mean <span className="font-medium text-foreground">{result.suggestedDomain}</span>?
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={statusTone(status.toLowerCase())}>{status}</Badge>
        {result.sendEligibility && (
          <Badge tone={result.sendEligibility.allowed ? "success" : "warning"}>
            {result.sendEligibility.decision}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function EmailVerifyPage() {
  const emailIntel = useEmailIntelApi();
  const [email, setEmail] = useState("");
  const [batchInput, setBatchInput] = useState("");

  const verify = useMutation({
    mutationFn: (value: string) => emailIntel.verify(value),
  });

  const verifyBatch = useMutation({
    mutationFn: (values: string[]) => emailIntel.verifyBatch(values),
  });

  const batchEmails = batchInput
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Verify"
        description="SMTP/MX/catch-all checks and send-eligibility for one email, or a batch."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Single email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (email.trim()) verify.mutate(email.trim());
            }}
          >
            <Input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button type="submit" disabled={verify.isPending}>
              {verify.isPending ? "Verifying…" : "Verify"}
            </Button>
          </form>

          {verify.isError && (
            <Alert variant="error" title="Couldn't verify that email">
              {formatQueryError(verify.error, "Could not verify that email.")}
            </Alert>
          )}
          {verify.isSuccess && <ResultRow result={verify.data} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (batchEmails.length > 0) verifyBatch.mutate(batchEmails);
            }}
          >
            <textarea
              className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={"One email per line, e.g.\nalice@company.com\nbob@company.com"}
              value={batchInput}
              onChange={(event) => setBatchInput(event.target.value)}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {batchEmails.length} email{batchEmails.length === 1 ? "" : "s"}
              </p>
              <Button type="submit" disabled={verifyBatch.isPending || batchEmails.length === 0}>
                {verifyBatch.isPending ? "Verifying…" : "Verify batch"}
              </Button>
            </div>
          </form>

          {verifyBatch.isError && (
            <Alert variant="error" title="Couldn't verify that batch">
              {formatQueryError(verifyBatch.error, "Could not verify that batch.")}
            </Alert>
          )}
          {verifyBatch.isSuccess && (
            <div className="space-y-2">
              {(verifyBatch.data as EmailIntelBatchResult).results.map((result) => (
                <ResultRow key={result.email} result={result} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
