"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePromotionApi } from "@/lib/crm/promotion";
import { useAuthReady, formatQueryError, ApiError } from "@/lib/api-client";

/** Dashboard panel for prospects the enrichment pipeline flagged as scoring above the
 *  workspace's deal-promotion threshold — one click turns a candidate into a real
 *  Company/Contact/Deal. See settings/workspace for the threshold control. */
export function PromotionCandidatesPanel() {
  const queryClient = useQueryClient();
  const promotionApi = usePromotionApi();
  const authReady = useAuthReady();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [promotedMsg, setPromotedMsg] = useState<string | null>(null);

  const candidates = useQuery({
    queryKey: ["crm", "promotion-candidates"],
    queryFn: promotionApi.listCandidates,
    enabled: authReady,
  });

  const promote = useMutation({
    mutationFn: (id: string) => promotionApi.promote(id),
    onSuccess: (_result, id) => {
      const candidate = candidates.data?.data.find((c) => c.id === id);
      setPromotedMsg(`${candidate?.fullName ?? candidate?.companyName ?? "Prospect"} promoted to a new deal.`);
      queryClient.invalidateQueries({ queryKey: ["crm", "promotion-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "dashboard", "overview"] });
      setTimeout(() => setPromotedMsg(null), 4000);
    },
    onError: (err) => {
      // A 409 (already promoted by someone else) or 404 (candidate gone) just means the row is
      // stale — refresh the list instead of surfacing a scary error for a harmless race.
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
        queryClient.invalidateQueries({ queryKey: ["crm", "promotion-candidates"] });
      }
    },
    onSettled: () => setPendingId(null),
  });

  const rows = candidates.data?.data ?? [];
  const staleRace = promote.isError && promote.error instanceof ApiError && [404, 409].includes(promote.error.status);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Promotion candidates
        </CardTitle>
        {rows.length > 0 && <Badge tone="info">{rows.length}</Badge>}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {candidates.isError && (
          <Alert variant="error" onRetry={() => candidates.refetch()}>
            {formatQueryError(candidates.error, "Could not load promotion candidates.")}
          </Alert>
        )}
        {promotedMsg && <Alert variant="success">{promotedMsg}</Alert>}
        {promote.isError && !staleRace && (
          <Alert variant="error" dismissible>
            {formatQueryError(promote.error, "Could not promote this prospect.")}
          </Alert>
        )}

        {candidates.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No prospects above your{" "}
            <Link href="/settings/workspace" className="underline underline-offset-2">
              deal-promotion threshold
            </Link>{" "}
            right now.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.fullName ?? "Unknown"}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.companyName ?? "—"}</p>
                </div>
                <Badge tone="success">Score {c.score}</Badge>
                <Button
                  size="sm"
                  disabled={promote.isPending && pendingId === c.id}
                  onClick={() => {
                    setPendingId(c.id);
                    promote.mutate(c.id);
                  }}
                >
                  {promote.isPending && pendingId === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Promote
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
