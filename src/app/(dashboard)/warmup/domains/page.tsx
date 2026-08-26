"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  useWarmupToolApi,
  type DnsEvidenceStatus,
  type WarmupDomain,
} from "@/lib/warmup-tool";

const DNS_OPTIONS: DnsEvidenceStatus[] = ["PASS", "FAIL", "MISSING", "UNKNOWN", "ERROR"];

function DnsSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DnsEvidenceStatus;
  onChange: (v: DnsEvidenceStatus) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value as DnsEvidenceStatus)}
      >
        {DNS_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function WarmupDomainsPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const [domainName, setDomainName] = useState("");
  const [provider, setProvider] = useState<"GMAIL" | "MICROSOFT365" | "UNKNOWN">("UNKNOWN");
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [mx, setMx] = useState<DnsEvidenceStatus>("UNKNOWN");
  const [spf, setSpf] = useState<DnsEvidenceStatus>("UNKNOWN");
  const [dkim, setDkim] = useState<DnsEvidenceStatus>("UNKNOWN");
  const [dmarc, setDmarc] = useState<DnsEvidenceStatus>("UNKNOWN");

  const list = useQuery({
    queryKey: ["warmup-tool", "domains"],
    queryFn: () => api.listDomains(),
    enabled: authReady,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createDomain({
        domainName: domainName.trim().toLowerCase(),
        provider,
      }),
    onSuccess: () => {
      setDomainName("");
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "domains"] });
    },
  });

  const verify = useMutation({
    mutationFn: (id: string) => api.verifyDomain(id, { mx, spf, dkim, dmarc }),
    onSuccess: () => {
      setVerifyId(null);
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "domains"] });
    },
  });

  const domains = list.data ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Domains"
        description="Register customer sending domains and record DNS auth evidence (SPF/DKIM/DMARC/MX). Healthy domains protect warm-up and outreach reputation."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add domain</CardTitle>
          <CardDescription>
            Use the apex domain only (example.com). Verification never assumes DNS — you submit evidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="example.com"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as typeof provider)}
          >
            <option value="UNKNOWN">Provider unknown</option>
            <option value="GMAIL">Gmail</option>
            <option value="MICROSOFT365">Microsoft 365</option>
          </select>
          <Button disabled={!domainName.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Adding…" : "Add"}
          </Button>
        </CardContent>
        {create.isError && (
          <Alert className="mx-6 mb-4">
            {formatQueryError(create.error, "Could not add domain. Use domainName like example.com.")}
          </Alert>
        )}
      </Card>

      {list.isError && (
        <Alert className="mb-4">{formatQueryError(list.error, "Could not load domains.")}</Alert>
      )}
      {verify.isError && (
        <Alert className="mb-4">{formatQueryError(verify.error, "Domain verification failed.")}</Alert>
      )}

      {verifyId && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Submit DNS evidence</CardTitle>
            <CardDescription>
              Set each check from your DNS lookup, then apply. PASS means you confirmed the record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <DnsSelect label="MX" value={mx} onChange={setMx} />
            <DnsSelect label="SPF" value={spf} onChange={setSpf} />
            <DnsSelect label="DKIM" value={dkim} onChange={setDkim} />
            <DnsSelect label="DMARC" value={dmarc} onChange={setDmarc} />
          </CardContent>
          <div className="flex gap-2 px-6 pb-4">
            <Button disabled={verify.isPending} onClick={() => verify.mutate(verifyId)}>
              {verify.isPending ? "Applying…" : "Apply verification"}
            </Button>
            <Button variant="outline" onClick={() => setVerifyId(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {domains.map((d: WarmupDomain) => (
          <Card key={d.id}>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{d.domainName ?? d.id}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {d.status && <Badge>{String(d.status)}</Badge>}
                  {d.verificationStatus && (
                    <Badge tone="muted">{String(d.verificationStatus)}</Badge>
                  )}
                  {d.provider && <Badge tone="muted">{String(d.provider)}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  MX {d.mxStatus ?? "—"} · SPF {d.spfStatus ?? "—"} · DKIM {d.dkimStatus ?? "—"} ·
                  DMARC {d.dmarcStatus ?? "—"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setVerifyId(d.id)}>
                Verify DNS
              </Button>
            </CardContent>
          </Card>
        ))}
        {!list.isLoading && domains.length === 0 && (
          <p className="text-sm text-muted-foreground">No domains yet.</p>
        )}
      </div>
    </PageShell>
  );
}
