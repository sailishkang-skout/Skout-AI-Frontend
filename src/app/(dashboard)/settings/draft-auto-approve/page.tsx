"use client";

/** R13.2 — auto-route AI drafts by score/segment. When enabled, a freshly generated draft whose
 * prospect clears the ICP-score and confidence thresholds (and isn't on an "always review" list)
 * is approved automatically instead of waiting in the review queue. Auto-approved drafts still
 * show in the queue, tagged, so nothing sends silently-unseen. */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useDraftAutoApproveApi } from "@/lib/draft-auto-approve";
import { useEnrichmentApi } from "@/lib/enrichment";

export default function DraftAutoApprovePage() {
  const authReady = useAuthReady();
  const api = useDraftAutoApproveApi();
  const enrichmentApi = useEnrichmentApi();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [minIcpScore, setMinIcpScore] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const [alwaysReview, setAlwaysReview] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const settings = useQuery({
    queryKey: ["draft-auto-approve"],
    queryFn: api.get,
    enabled: authReady,
  });

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  useEffect(() => {
    const s = settings.data?.data;
    if (!s) return;
    setEnabled(s.enabled);
    setMinIcpScore(s.minIcpScore != null ? String(s.minIcpScore) : "");
    setMinConfidence(s.minConfidence != null ? String(Math.round(s.minConfidence * 100)) : "");
    setAlwaysReview(new Set(s.alwaysReviewListIds ?? []));
  }, [settings.data?.data]);

  const save = useMutation({
    mutationFn: () =>
      api.update({
        enabled,
        minIcpScore: minIcpScore.trim() ? Number(minIcpScore) : null,
        minConfidence: minConfidence.trim() ? Number(minConfidence) / 100 : null,
        alwaysReviewListIds: Array.from(alwaysReview),
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(["draft-auto-approve"], res);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const toggleList = (id: string) => {
    setAlwaysReview((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PageShell width="narrow" data-testid="page-draft-auto-approve">
      <PageHeader
        title="AI draft auto-approve"
        description="Skip the review queue for high-confidence drafts to your best-fit prospects. Everything else keeps waiting for a human."
        actions={<GuideLink slug="draft-auto-approve" label="Auto-approve guide" />}
      />

      {settings.isError && (
        <Alert variant="error">{formatQueryError(settings.error, "Could not load settings.")}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-approve thresholds</CardTitle>
          <CardDescription>
            A draft auto-approves only when it clears every threshold below and its prospect is not on an
            always-review list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enable auto-approve
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Minimum ICP score (0–100)</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={minIcpScore}
                onChange={(e) => setMinIcpScore(e.target.value)}
                placeholder="e.g. 80"
                disabled={!enabled}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Minimum draft confidence (0–100)</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => setMinConfidence(e.target.value)}
                placeholder="e.g. 75"
                disabled={!enabled}
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Always review these lists</p>
            <p className="text-xs text-muted-foreground">
              Drafts to prospects on these lists always wait for a human, no matter the score.
            </p>
            {lists.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading lists…</p>
            ) : (lists.data?.data.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No lists yet.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {lists.data!.data.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={alwaysReview.has(l.id)}
                      onChange={() => toggleList(l.id)}
                      disabled={!enabled}
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {save.isError && (
            <Alert variant="error">{formatQueryError(save.error, "Could not save settings.")}</Alert>
          )}
          {saved && <Alert variant="success">Settings saved.</Alert>}

          <div className="flex items-center gap-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save settings
            </Button>
            <Link href="/ai/review" className="text-sm text-muted-foreground hover:text-foreground">
              View review queue →
            </Link>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
