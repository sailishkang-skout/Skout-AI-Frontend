"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Mail, Plus } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { sequenceStatusTone, useSequencesApi } from "@/lib/sequences";
import type { Sequence } from "@/types/api";

export default function SequencesPage() {
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const authReady = useAuthReady();
  const [name, setName] = useState("");

  const sequences = useQuery({
    queryKey: ["sequences"],
    queryFn: sequencesApi.list,
    enabled: authReady,
  });

  const sequenceData = sequences.data?.data ?? [];

  const createSequence = useMutation({
    mutationFn: () => sequencesApi.create(name.trim()),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
  });

  return (
    <PageShell data-testid="page-sequences">
      <PageHeader
        title="Sequences"
        description="Multi-step outbound cadences — build a sequence, enroll prospects, and track open/click/reply performance per step."
      />

      <DemoBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Create a sequence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4 sm:flex-row sm:items-center">
            <Input
              placeholder="e.g. SaaS VP outreach — 4 touch"
              className="min-w-0 flex-1 bg-background"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && createSequence.mutate()}
            />
            <Button
              onClick={() => createSequence.mutate()}
              disabled={!name.trim() || createSequence.isPending}
              className="w-full shrink-0 sm:w-auto"
            >
              {createSequence.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create sequence
            </Button>
          </div>
        </CardContent>
      </Card>

      {sequences.error && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => sequences.refetch()}>
          We couldn&apos;t load your sequences. Please try again.
        </Alert>
      )}

      {sequences.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sequenceData.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sequenceData.map((seq) => (
            <SequenceCard key={seq.id} sequence={seq} />
          ))}
        </div>
      ) : (
        !sequences.error && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No sequences yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Create a sequence above, then add steps and enroll prospects.
                </p>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </PageShell>
  );
}

function SequenceCard({ sequence }: { sequence: Sequence }) {
  return (
    <Card className="flex flex-col" data-testid="sequence-card" data-sequence-name={sequence.name}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/sequences/${sequence.id}`} className="min-w-0 hover:underline">
            <CardTitle className="line-clamp-2 text-base leading-snug">{sequence.name}</CardTitle>
          </Link>
          <Badge tone={sequenceStatusTone(sequence.status)}>{sequence.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        <Link
          href={`/sequences/${sequence.id}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          Open sequence
        </Link>
      </CardContent>
    </Card>
  );
}
