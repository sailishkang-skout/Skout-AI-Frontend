"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Coins, Loader2, Mail, Phone, Sparkles, Zap } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { enrichmentApi } from "@/lib/enrichment";
import type { EnrichField, EnrichmentJob, FieldResult } from "@/types/api";

const ALL_FIELDS: { id: EnrichField; label: string }[] = [
  { id: "company", label: "Firmographics" },
  { id: "email", label: "Email finder" },
  { id: "validation", label: "Email verify" },
  { id: "phone", label: "Phone (score-gated)" },
];

function resultValue(results: FieldResult[], field: string): string | undefined {
  return results.find((r) => r.field === field)?.value;
}

export default function EnrichmentPage() {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<EnrichField[]>(["company", "email", "validation"]);
  const [formError, setFormError] = useState<string | null>(null);

  const credits = useQuery({
    queryKey: ["enrichment", "credits"],
    queryFn: enrichmentApi.getCredits,
    retry: false,
  });

  const jobs = useQuery({
    queryKey: ["enrichment", "jobs"],
    queryFn: enrichmentApi.listJobs,
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.data.some((j: EnrichmentJob) => j.status === "running" || j.status === "queued")
        ? 2000
        : false,
  });

  const enrich = useMutation({
    mutationFn: () =>
      enrichmentApi.enrichProspect(
        domain.trim(),
        {
          companyDomain: domain.trim(),
          fullName: fullName.trim() || undefined,
          title: title.trim() || undefined,
          email: email.trim() || undefined,
        },
        fields
      ),
    onSuccess: () => {
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["enrichment"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        setFormError("Insufficient credits — top up to run more enrichments.");
      } else if (err instanceof ApiError) {
        setFormError(`API error (${err.status}). Is the backend running on port 3001?`);
      } else {
        setFormError("Could not reach the API. Start the backend on port 3001.");
      }
    },
  });

  const toggleField = (id: EnrichField) =>
    setFields((cur) => (cur.includes(id) ? cur.filter((f) => f !== id) : [...cur, id]));

  const canSubmit = domain.trim().length > 0 && fields.length > 0 && !enrich.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Enrichment Console</h1>
          <p className="text-muted-foreground">
            On-demand PAL waterfall — firmographics, email finding + verification, and
            score-gated phone. Verified-only persistence; credits charged per outcome.
          </p>
        </div>
        <Card className="min-w-[160px]">
          <CardContent className="flex items-center gap-3 p-4">
            <Coins className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Credits</p>
              <p className="text-2xl font-semibold">
                {credits.isLoading ? "—" : credits.data?.balance ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enrich a prospect</CardTitle>
          <CardDescription>
            Activates the record to your workspace, scores it, then runs the selected
            providers. Phone only runs when the AI lead score exceeds 80.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Company domain *" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Known email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {ALL_FIELDS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleField(f.id)}
                className={
                  "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                  (fields.includes(f.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent")
                }
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => enrich.mutate()} disabled={!canSubmit}>
              {enrich.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Run enrichment
            </Button>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>

          {enrich.data && (
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={statusTone(enrich.data.status)}>{enrich.data.status}</Badge>
                <span className="text-sm text-muted-foreground">
                  {enrich.data.creditsUsed} credit(s) used
                </span>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <ResultRow icon={<Mail className="h-4 w-4" />} label="Email" value={resultValue(enrich.data.results, "email")} status={resultValue(enrich.data.results, "email_status")} />
                <ResultRow icon={<Phone className="h-4 w-4" />} label="Phone" value={resultValue(enrich.data.results, "phone")} />
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent jobs</CardTitle>
            <CardDescription>Live status — refreshes while jobs are running.</CardDescription>
          </div>
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {jobs.error && (
            <p className="text-sm text-red-600">API unavailable — start the backend on port 3001.</p>
          )}
          {jobs.data?.data.length ? (
            <ul className="divide-y">
              {jobs.data.data.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.prospectId.slice(0, 16)}…</p>
                    <p className="text-muted-foreground">
                      {job.fieldsRequested.join(", ")} · {job.trigger}
                      {resultValue(job.results, "email") ? ` · ${resultValue(job.results, "email")}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground">{job.creditsUsed} cr</span>
                    <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            !jobs.error && <p className="text-sm text-muted-foreground">No enrichment jobs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultRow({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  status?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{label}:</span>
      <span>{value ?? "—"}</span>
      {status && <Badge tone={statusTone(status)}>{status}</Badge>}
    </div>
  );
}
