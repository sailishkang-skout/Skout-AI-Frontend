"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EMPTY_ICP, IcpForm } from "@/components/icp/icp-form";
import { useIcpApi } from "@/lib/icp";
import { pollScoreJob, useEnrichmentApi } from "@/lib/enrichment";
import { isIcpConfigured } from "@/lib/scoring";
import { useAuthReady } from "@/lib/api-client";
import type { IcpConfig } from "@/types/api";

function IcpSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = searchParams.get("return");
  const queryClient = useQueryClient();
  const icpApi = useIcpApi();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  const [config, setConfig] = useState<IcpConfig>(EMPTY_ICP);
  const [saved, setSaved] = useState(false);
  const [rescoreStatus, setRescoreStatus] = useState<string | null>(null);

  const icp = useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    enabled: authReady,
  });

  useEffect(() => {
    if (icp.data?.config) setConfig(icp.data.config);
  }, [icp.data]);

  const save = useMutation({
    mutationFn: () =>
      icpApi.save({
        ...config,
        // Never drop wizard completion when editing ICP fields in settings.
        onboarding: config.onboarding ?? icp.data?.config?.onboarding,
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(["icp"], data);
      queryClient.invalidateQueries({ queryKey: ["icp"] });
      if (data.config) setConfig(data.config);
      setSaved(true);
      setRescoreStatus(null);

      const jobRef = data.rescoreJob;
      if (jobRef?.jobId && jobRef.status === "pending") {
        setRescoreStatus("Re-scoring stored prospects…");
        try {
          const job = await pollScoreJob(enrichmentApi.getScoreJob, jobRef.jobId, 90, 2000, (j) => {
            const scored = j.result?.scored ?? 0;
            const total = j.result?.total ?? scored;
            if (j.status === "running" || j.status === "pending") {
              setRescoreStatus(`Re-scoring… ${scored}/${total}`);
            }
          });
          if (job.status === "completed") {
            const scored = job.result?.scored ?? 0;
            setRescoreStatus(`Re-scored ${scored} prospect${scored === 1 ? "" : "s"}.`);
          } else {
            setRescoreStatus(job.errorMessage ?? "Re-score failed.");
          }
        } catch {
          setRescoreStatus("Could not track re-score job.");
        }
      } else if (jobRef?.status === "completed") {
        setRescoreStatus(`Re-scored ${jobRef.scored ?? 0} prospect(s).`);
      }

      if (returnPath && isIcpConfigured(config)) {
        router.replace(returnPath);
        return;
      }
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const setupRequired = Boolean(returnPath);

  return (
    <PageShell width="narrow">
      <PageHeader
        title="ICP settings"
        description="Ideal Customer Profile for AI scoring and enrichment prioritization."
        actions={
          <Link
            href="/onboarding/icp"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent sm:w-auto"
          >
            Setup wizard
          </Link>
        }
      />

      <DemoBanner />

      {setupRequired && !isIcpConfigured(config) && (
        <Alert variant="warning">
          Configure your ICP before running enrichment. Save your profile below to continue.
        </Alert>
      )}

      {icp.error && (
        <Alert variant="error" title="Something went wrong" dismissible>
          We couldn&apos;t load your ICP settings. Please try again.
        </Alert>
      )}

      {rescoreStatus && (
        <Alert variant={rescoreStatus.includes("failed") ? "error" : "default"}>{rescoreStatus}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Workspace ICP</CardTitle>
          <CardDescription>
            {icp.data?.version != null ? `Version ${icp.data.version}` : "Not saved yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <IcpForm value={config} onChange={setConfig} />
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || icp.isLoading || !icp.isSuccess}
            className="w-full sm:w-auto"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : null}
            {saved ? "Saved" : "Save ICP"}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}

export default function IcpSettingsPage() {
  return (
    <Suspense
      fallback={
        <PageShell width="narrow">
          <PageHeader title="ICP settings" description="Loading…" />
        </PageShell>
      }
    >
      <IcpSettingsContent />
    </Suspense>
  );
}
