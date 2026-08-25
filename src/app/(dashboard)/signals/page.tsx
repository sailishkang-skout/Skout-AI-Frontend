"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  ACCOUNT_SIGNALS_QUERY_KEY,
  isRiskSignal,
  signalIcon,
  signalLabel,
  signalReasonText,
  timeAgoShort,
  useSignalsApi,
} from "@/lib/signals";
import type { AccountSignalSummary, Signal, SignalStackBand } from "@/types/api";

const BAND_TONE: Record<SignalStackBand, BadgeProps["tone"]> = {
  hot: "danger",
  warm: "warning",
  cool: "info",
  none: "muted",
};

const BAND_LABEL: Record<SignalStackBand, string> = {
  hot: "🔥 Hot",
  warm: "Warm",
  cool: "Cool",
  none: "None",
};

function expiryNote(signal: Signal): { text: string; expired: boolean } | null {
  if (!signal.expiresAt) return null;
  const expiresAt = new Date(signal.expiresAt).getTime();
  const now = Date.now();
  if (expiresAt <= now) return { text: "Expired", expired: true };
  const daysLeft = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
  return { text: daysLeft <= 1 ? "Expires today" : `Expires in ${daysLeft}d`, expired: false };
}

function SignalRow({ signal }: { signal: Signal }) {
  const expiry = expiryNote(signal);
  const confidencePct = signal.confidence != null ? Math.round(signal.confidence * 100) : null;
  const risk = isRiskSignal(signal.signalType);

  return (
    <li className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
      <span
        className={
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs " +
          (risk ? "bg-amber-100 dark:bg-amber-950/50" : "bg-primary/10 dark:bg-primary/20")
        }
      >
        {signalIcon(signal.signalType)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{signalLabel(signal.signalType)}</span>
          <span className="text-xs text-muted-foreground">· {timeAgoShort(signal.observedAt)}</span>
          {confidencePct != null && (
            <Badge tone="default" className="text-[10px]">
              {confidencePct}% confidence
            </Badge>
          )}
          {expiry && (
            <Badge tone={expiry.expired ? "muted" : "warning"} className="text-[10px]">
              {expiry.text}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {signalReasonText(signal)}
          {signal.source ? ` · source: ${signal.source}` : ""}
        </p>
      </div>
    </li>
  );
}

function AccountCard({ account }: { account: AccountSignalSummary }) {
  const { stackScore } = account;
  const visibleSignals = [...account.signals].sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{account.companyName ?? account.companyId}</p>
            <p className="text-xs text-muted-foreground">
              {stackScore.distinctSignalTypes} distinct signal{stackScore.distinctSignalTypes === 1 ? "" : "s"}
              {stackScore.reachableDecisionMaker ? " · reachable decision-maker" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={BAND_TONE[stackScore.band]}>{BAND_LABEL[stackScore.band]}</Badge>
            <Badge tone="default">{stackScore.score}/100</Badge>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {visibleSignals.map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function SignalCenterPage() {
  const authReady = useAuthReady();
  const signalsApi = useSignalsApi();

  const accountsQuery = useQuery({
    queryKey: ACCOUNT_SIGNALS_QUERY_KEY,
    queryFn: () => signalsApi.listAccounts({ limit: 100 }),
    enabled: authReady,
  });

  return (
    <PageShell>
      <PageHeader
        title="Signal Center"
        description="Every account with a live signal, ranked by strength — multiple corroborated signals plus a reachable decision-maker score higher than one weak trigger."
      />

      {accountsQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {accountsQuery.error && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => accountsQuery.refetch()}>
          {formatQueryError(accountsQuery.error, "We couldn't load the signal ranking.")}
        </Alert>
      )}

      {accountsQuery.data && accountsQuery.data.data.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No accounts have a live signal right now.
        </div>
      )}

      {accountsQuery.data && accountsQuery.data.data.length > 0 && (
        <div className="space-y-3">
          {accountsQuery.data.data.map((account) => (
            <AccountCard key={account.companyId} account={account} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
