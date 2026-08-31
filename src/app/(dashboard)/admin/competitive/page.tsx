"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useCompetitiveApi } from "@/lib/competitive";
import { useWorkspaceRole } from "@/lib/workspace-role";

/** §2 — Competitive win/loss entry UI (GTM validation gate for regional intelligence). */
export default function CompetitiveWinLossPage() {
  const authReady = useAuthReady();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const api = useCompetitiveApi();
  const qc = useQueryClient();
  const [accountName, setAccountName] = useState("");
  const [outcome, setOutcome] = useState<"won" | "lost">("won");

  const winLoss = useQuery({
    queryKey: ["competitive-win-loss"],
    queryFn: api.getWinLoss,
    enabled: authReady && isAdmin,
  });

  const addDeal = useMutation({
    mutationFn: () => api.addDeal({ accountName: accountName.trim(), outcome }),
    onSuccess: () => {
      setAccountName("");
      qc.invalidateQueries({ queryKey: ["competitive-win-loss"] });
    },
  });

  const assign = useMutation({
    mutationFn: () => api.assignOwner(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitive-win-loss"] }),
  });

  if (!isAdmin) {
    return (
      <PageShell>
        <Alert variant="error">Win/loss review requires owner or admin role.</Alert>
      </PageShell>
    );
  }

  const minDeals = winLoss.data?.defaults.minDeals ?? 4;
  const reviewed = winLoss.data?.data?.dealsReviewed ?? winLoss.data?.deals.length ?? 0;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Competitive win / loss"
        description="Record real deals to validate regional intelligence and positioning claims."
        actions={
          <Button variant="outline" disabled={assign.isPending} onClick={() => assign.mutate()}>
            Assign me as owner
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Trophy className="h-5 w-5 text-primary" />
          <span>
            Progress: <strong>{reviewed}</strong> / {minDeals} deals
          </span>
          <Badge tone={reviewed >= minDeals ? "success" : "warning"}>
            {reviewed >= minDeals ? "Validated" : "In progress"}
          </Badge>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add deal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as "won" | "lost")}>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </Select>
          <Button disabled={!accountName.trim() || addDeal.isPending} onClick={() => addDeal.mutate()}>
            Save deal
          </Button>
        </CardContent>
      </Card>

      {winLoss.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-2">
          {(winLoss.data?.deals ?? []).map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <span className="font-medium">{d.accountName}</span>
                <Badge tone={d.outcome === "won" ? "success" : "danger"}>{d.outcome}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {addDeal.isError && (
        <Alert variant="error">{formatQueryError(addDeal.error, "Could not save competitive deal.")}</Alert>
      )}
    </PageShell>
  );
}
