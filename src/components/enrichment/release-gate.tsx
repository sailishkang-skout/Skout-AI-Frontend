"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiFetch, useAuthReady } from "@/lib/api-client";

export interface EnrichmentRelease {
  enabled: boolean;
  stage: "internal" | "general";
  reason: string | null;
}

/**
 * Whether LinkedIn enrichment is released to this workspace (ENR-06). The API is what enforces
 * it; this only lets the dashboard say so instead of showing a row of failed requests. If the
 * answer cannot be fetched the screens are shown, and the API still refuses what it must.
 */
export function useEnrichmentRelease() {
  const apiFetch = useApiFetch();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["enrichment-release"],
    queryFn: () => apiFetch<EnrichmentRelease>("/api/v1/enrichment/release"),
    enabled: authReady,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Screens under /enrichment that are not part of the gated LinkedIn enrichment release. */
const UNGATED = [/^\/enrichment\/?$/, /^\/enrichment\/workbooks(\/|$)/];

export function EnrichmentNotReleased({ reason }: { reason: string | null }) {
  return (
    <PageShell>
      <PageHeader title="Enrichment" description="" />
      <div data-testid="enrichment-not-released">
        <Alert variant="warning" title="Not available in this workspace yet">
          {reason ?? "LinkedIn enrichment is in internal release and is not enabled for this workspace."} Ask your Skout contact if you expected to have access.
        </Alert>
      </div>
    </PageShell>
  );
}

/** Wraps the enrichment screens: shows them when released, and says why not otherwise. */
export function EnrichmentReleaseGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const gated = !UNGATED.some((pattern) => pattern.test(pathname.replace(/^\/app/, "")));
  const release = useEnrichmentRelease();
  if (!gated) return <>{children}</>;
  if (release.isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </PageShell>
    );
  }
  if (release.data && !release.data.enabled) return <EnrichmentNotReleased reason={release.data.reason} />;
  return <>{children}</>;
}
