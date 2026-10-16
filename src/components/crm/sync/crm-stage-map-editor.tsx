"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmApi } from "@/lib/crm";
import type { CrmSkoutStage } from "@/types/api";

/**
 * COPS-09: which Skout stage a deal starts in when it is first pulled from HubSpot. A pull never
 * moves an existing deal; stage moves stay on the deals board (transition rules apply).
 */
export function CrmStageMapEditor({ provider = "hubspot" }: { provider?: string }) {
  const crmApi = useCrmApi();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const query = useQuery({
    queryKey: ["crm", provider, "stage-map"],
    queryFn: () => crmApi.getStageMap(provider),
  });

  useEffect(() => {
    if (query.data?.data) setDraft(query.data.data.map);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => crmApi.saveStageMap(provider, draft),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["crm", provider, "stage-map"] });
      window.setTimeout(() => setSaved(false), 3000);
    },
  });

  const data = query.data?.data;
  const byPipeline = useMemo(() => {
    const groups = new Map<string, { name: string; stages: CrmSkoutStage[] }>();
    for (const s of data?.skoutStages ?? []) {
      const g = groups.get(s.pipelineId) ?? { name: s.pipelineName, stages: [] };
      g.stages.push(s);
      groups.set(s.pipelineId, g);
    }
    return Array.from(groups.values());
  }, [data?.skoutStages]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <GitBranch className="h-4 w-4 text-primary" />
              Deal stages
            </CardTitle>
            <CardDescription>
              The Skout stage a deal starts in when it first comes from HubSpot. Unmapped stages start in the first
              stage of your default pipeline. Existing deals are never moved by a sync.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !data?.providerPipelines}>
            {save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save stages
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {saved && <Alert variant="success">Stage map saved.</Alert>}
        {save.isError && <Alert variant="error">{save.error instanceof Error ? save.error.message : "The stage map was not saved"}</Alert>}
        {query.isLoading && <p className="text-muted-foreground">Loading stages…</p>}
        {query.isError && <Alert variant="error">{query.error instanceof Error ? query.error.message : "Could not load stages"}</Alert>}
        {data && !data.providerPipelines && (
          <Alert variant="warning">The HubSpot pipelines could not be read right now. Check the connection on the Overview tab.</Alert>
        )}
        {data?.providerPipelines?.map((pipeline) => (
          <div key={pipeline.id} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">HubSpot pipeline: {pipeline.label}</p>
            <div className="divide-y divide-border rounded-md border border-border">
              {pipeline.stages.map((stage) => (
                <label key={stage.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs">
                  <span>{stage.label}</span>
                  <select
                    aria-label={`Skout stage for ${stage.label}`}
                    value={draft[stage.id] ?? ""}
                    onChange={(e) => {
                      const next = { ...draft };
                      if (e.target.value) next[stage.id] = e.target.value;
                      else delete next[stage.id];
                      setDraft(next);
                    }}
                    className="h-8 rounded border border-border bg-background px-2 text-xs"
                  >
                    <option value="">Default (first stage)</option>
                    {byPipeline.map((g) => (
                      <optgroup key={g.name} label={g.name}>
                        {g.stages.map((s) => (
                          <option key={s.stageId} value={s.stageId}>
                            {s.stageName}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
