"use client";

/** R19 — CRO Copilot: admin-only exec rollup + a scoped read-only chat over the same data. */

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Send, ShieldAlert, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiChatApi } from "@/lib/ai-chat";
import { useCrmDashboardApi } from "@/lib/crm/dashboard";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { formatMoney } from "@/lib/crm-display";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function CroChatPanel() {
  const aiChat = useAiChatApi();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: async (message: string) => {
      const next = [...turns, { role: "user" as const, content: message }];
      setTurns(next);
      setInput("");
      const res = await aiChat.chat({ messages: next, mode: "ask", agent: "cro" });
      setTurns([...next, { role: "assistant", content: res.reply }]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Ask CRO Copilot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          e.g. "Which deals are stalling?" or "How's rep activity this week?" — read-only, scoped to this rollup.
        </p>
        {send.isError && <Alert variant="error">{formatQueryError(send.error, "Could not reach CRO Copilot.")}</Alert>}
        {turns.length > 0 && (
          <div ref={scrollRef} className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
            {turns.map((t, i) => (
              <div key={i} className={t.role === "user" ? "text-right" : ""}>
                <p
                  className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    t.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"
                  }`}
                >
                  {t.content}
                </p>
              </div>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !send.isPending) send.mutate(input.trim());
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about pipeline, stale deals, rep activity…"
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <Button type="submit" size="sm" disabled={!input.trim() || send.isPending}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function CroCopilotPage() {
  const authReady = useAuthReady();
  const { role } = useWorkspaceRole();
  const dashboardApi = useCrmDashboardApi();

  const isAdmin = role === "owner" || role === "admin";
  const roleKnown = role !== undefined;

  const summary = useQuery({
    queryKey: ["crm", "cro-summary"],
    queryFn: dashboardApi.getCroSummary,
    enabled: authReady && isAdmin,
  });

  if (roleKnown && !isAdmin) {
    return (
      <PageShell width="narrow">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">CRO Copilot is for workspace owners and admins.</p>
            <p className="text-sm text-muted-foreground">Ask a workspace owner or admin if you need access.</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="CRO Copilot"
        description="Exec rollup — pipeline health, stale deals, and rep activity. Owner/admin only."
      />

      {summary.isError && (
        <Alert variant="error" onRetry={() => summary.refetch()}>
          {formatQueryError(summary.error, "Could not load the CRO rollup.")}
        </Alert>
      )}

      {summary.isLoading || !summary.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Open pipeline" value={formatMoney(summary.data.overview.pipelineValue, summary.data.overview.currency)} />
            <StatCard label="Open deals" value={summary.data.overview.openDeals} />
            <StatCard label="Overdue tasks" value={summary.data.overview.overdueTasks} />
            <StatCard label="Native-linked contacts" value={`${summary.data.switchingCost.nativeLinkRatePct}%`} />
          </div>

          {/* R14.3 — switching-cost signal: native-link rate alongside how much data left Skout
              this week via HubSpot/CSV export. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="HubSpot exports (7d)" value={summary.data.switchingCost.hubspotExportVolume7d} />
            <StatCard label="CSV exports (7d)" value={summary.data.switchingCost.csvExportVolume7d} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stale deals (14+ days untouched)</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.data.staleDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stale deals — pipeline is being actively worked.</p>
                ) : (
                  <div className="divide-y">
                    {summary.data.staleDeals.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="truncate">{d.name}</span>
                        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                          {formatMoney(d.amount, d.currency)}
                          <Badge tone="warning">{d.daysSinceUpdate}d</Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rep activity (last 7 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.data.repActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No logged activity in the last 7 days.</p>
                ) : (
                  <div className="divide-y">
                    {summary.data.repActivity.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>{r.name}</span>
                        <span className="tabular-nums text-muted-foreground">{r.activityCount7d}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <CroChatPanel />
        </>
      )}
    </PageShell>
  );
}
