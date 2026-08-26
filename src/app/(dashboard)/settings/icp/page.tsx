"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EMPTY_ICP, IcpForm } from "@/components/icp/icp-form";
import { useIcpApi } from "@/lib/icp";
import { isIcpConfigured } from "@/lib/scoring";
import { useAuthReady } from "@/lib/api-client";
import type { AsyncJobView, IcpConfig } from "@/types/api";

function IcpSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = searchParams.get("return");
  const queryClient = useQueryClient();
  const icpApi = useIcpApi();
  const authReady = useAuthReady();
  const [config, setConfig] = useState<IcpConfig>(EMPTY_ICP);
  const [saved, setSaved] = useState(false);
  const [rescoreJob, setRescoreJob] = useState<AsyncJobView | null>(null);
  const [rescoreError, setRescoreError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const pollStopRef = useRef(false);

  const pollRescoreJob = async (jobId: string) => {
    pollStopRef.current = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (pollStopRef.current) return;
      let job: AsyncJobView;
      try {
        job = await icpApi.getRescoreJob(jobId);
      } catch {
        setRescoreError("Could not track re-score job.");
        return;
      }
      setRescoreJob(job);
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") return;
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const cancelRescore = async () => {
    if (!rescoreJob?.id) return;
    pollStopRef.current = true;
    setCancelling(true);
    try {
      const job = await icpApi.cancelRescoreJob(rescoreJob.id);
      setRescoreJob(job);
    } catch {
      setRescoreError("Could not cancel re-score job.");
    } finally {
      setCancelling(false);
    }
  };

  const icp = useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    enabled: authReady,
  });

  useEffect(() => {
    if (icp.data?.config) setConfig(icp.data.config);
  }, [icp.data]);

  useEffect(() => () => {
    pollStopRef.current = true;
  }, []);

  const save = useMutation({
    mutationFn: () =>
      icpApi.save({
        ...config,
        // Never drop wizard completion when editing ICP fields in settings.
        onboarding: config.onboarding ?? icp.data?.config?.onboarding,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["icp"], data);
      queryClient.invalidateQueries({ queryKey: ["icp"] });
      if (data.config) setConfig(data.config);
      setSaved(true);
      setRescoreError(null);
      setRescoreJob(null);

      const jobRef = data.rescoreJob;
      if (jobRef?.jobId && jobRef.status === "pending") {
        void pollRescoreJob(jobRef.jobId);
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
          <>
            <GuideLink slug="search-icp" label="ICP guide" compact />
            <Link
              href="/onboarding/icp"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent sm:w-auto"
            >
              Setup wizard
            </Link>
          </>
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

      {rescoreError && <Alert variant="error">{rescoreError}</Alert>}

      {rescoreJob && rescoreJob.status !== "completed" && rescoreJob.status !== "failed" && rescoreJob.status !== "cancelled" && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Re-scoring stored prospects…
                {rescoreJob.result?.total ? ` ${rescoreJob.result.scored ?? 0}/${rescoreJob.result.total}` : ""}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelRescore}
                disabled={cancelling}
                className="h-7 gap-1 px-2 text-xs"
              >
                {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Cancel
              </Button>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={rescoreJob.progress ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${rescoreJob.progress ?? 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {rescoreJob?.status === "completed" && (
        <Alert variant="default">
          Re-scored {rescoreJob.result?.scored ?? 0} prospect{(rescoreJob.result?.scored ?? 0) === 1 ? "" : "s"}.
        </Alert>
      )}

      {rescoreJob?.status === "cancelled" && <Alert variant="default">Re-score cancelled.</Alert>}

      {rescoreJob?.status === "failed" && (
        <Alert variant="error">{rescoreJob.errorMessage ?? "Re-score failed."}</Alert>
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
