"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2, Target } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListRow } from "@/components/layout/list-row";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import type { ListMemberDetail } from "@/types/api";

function memberLabel(m: ListMemberDetail) {
  const name = m.snapshot.fullName ?? m.prospectId;
  const parts = [m.snapshot.title, m.snapshot.companyName].filter(Boolean);
  return { name, subtitle: parts.join(" · ") };
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
      queryClient.invalidateQueries({ queryKey: ["lists", listId, "members"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400) {
        setScoreError("Set up your ICP before scoring leads.");
      } else {
        setScoreError("Could not score this list.");
      }
    },
  });

  const membersQuery = useQuery({
    queryKey: ["lists", listId, "members"],
    queryFn: () => enrichmentApi.getListMembers(listId),
    enabled: authReady && Boolean(listId),
  });

  const list = detail.data;
  const members = membersQuery.data ?? [];

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
      {detail.error && <Alert variant="warning">List not found or API unavailable.</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          {list && list.prospectCount > 0 && (
            <CardDescription>
              {list.prospectCount} prospect{list.prospectCount === 1 ? "" : "s"} in this list.{" "}
              <Link href="/lists" className="text-primary underline underline-offset-2">
                Go to enrichment
              </Link>{" "}
              to bulk-enrich, or{" "}
              <Link href="/prospects/search" className="text-primary underline underline-offset-2">
                search
              </Link>{" "}
              to add more.
            </CardDescription>
          )}
          {(!list || list.prospectCount === 0) && (
            <CardDescription>ICP scores reflect your workspace ICP settings.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {(detail.isLoading || membersQuery.isLoading) && (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {membersQuery.error && (
            <Alert variant="warning">Could not load members.</Alert>
          )}
          {!detail.isLoading && !membersQuery.isLoading && members.length > 0 && (
            <ul>
              {members.map((m) => {
                const { name, subtitle } = memberLabel(m);
                return (
                  <ListRow key={m.prospectId}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">{name}</p>
                        {subtitle && (
                          <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                        )}
                        {m.snapshot.email && (
                          <p className="text-xs text-muted-foreground">{m.snapshot.email}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">Not scored</span>
                    </div>
                  </ListRow>
                );
              })}
            </ul>
          )}
          {!detail.isLoading && !membersQuery.isLoading && !membersQuery.error && members.length === 0 && (
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
