"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2, Target } from "lucide-react";
import { ScoreBadge } from "@/components/scoring/score-badge";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListRow } from "@/components/layout/list-row";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";

function memberLabel(snapshot: Record<string, unknown>, prospectId: string) {
  const name = typeof snapshot.fullName === "string" ? snapshot.fullName : prospectId;
  const title = typeof snapshot.title === "string" ? snapshot.title : "";
  const domain = typeof snapshot.companyDomain === "string" ? snapshot.companyDomain : "";
  return { name, subtitle: [title, domain].filter(Boolean).join(" · ") };
}

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const listId = params.id;
  const queryClient = useQueryClient();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  const [scoreError, setScoreError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["lists", listId],
    queryFn: () => enrichmentApi.getList(listId),
    enabled: authReady && Boolean(listId),
  });

  const scoreAll = useMutation({
    mutationFn: () => enrichmentApi.scoreList(listId),
    onSuccess: () => {
      setScoreError(null);
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400) {
        setScoreError("Set up your ICP before scoring leads.");
      } else {
        setScoreError("Could not score this list.");
      }
    },
  });

  const list = detail.data?.list;
  const members = detail.data?.members ?? [];

  return (
    <PageShell>
      <div className="mb-4">
        <Link
          href="/lists"
          className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to lists
        </Link>
      </div>

      <PageHeader
        title={list?.name ?? "List"}
        description={
          list
            ? `${list.prospectCount} prospect${list.prospectCount === 1 ? "" : "s"}`
            : "Loading list…"
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={!members.length || scoreAll.isPending}
            onClick={() => scoreAll.mutate()}
          >
            {scoreAll.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Target className="h-4 w-4" />
            )}
            Score all
          </Button>
        }
      />

      <DemoBanner />

      {scoreError && <Alert variant="warning">{scoreError}</Alert>}

      {detail.error && (
        <Alert variant="warning">List not found or API unavailable.</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>ICP scores reflect your workspace ICP settings.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length ? (
            <ul>
              {members.map((m) => {
                const { name, subtitle } = memberLabel(m.snapshot, m.prospectId);
                return (
                  <ListRow key={m.prospectId}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{name}</p>
                        {subtitle && (
                          <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                        )}
                      </div>
                      {m.score ? (
                        <ScoreBadge score={m.score.score} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not scored</span>
                      )}
                    </div>
                  </ListRow>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No prospects in this list yet. Add some from{" "}
              <Link href="/prospects/search" className="text-primary underline underline-offset-2">
                search
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
