"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ListPlus, Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { RecordSignalDialog } from "@/components/signals/record-signal-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
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
  const router = useRouter();
  const { stackScore } = account;
  const visibleSignals = [...account.signals].sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/crm/360?mode=account&id=${encodeURIComponent(account.companyId)}`}
              className="truncate text-sm font-semibold hover:underline"
            >
              {account.companyName ?? account.companyId}
            </Link>
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

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-2 text-xs">
          <Button
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => router.push("/sequences")}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Activate outbound
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => router.push("/lists")}
          >
            <ListPlus className="h-3.5 w-3.5" />
            Add to List
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => router.push("/sequences")}
          >
            <Send className="h-3.5 w-3.5" />
            Enroll Sequence
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignalCenterPage() {
  const authReady = useAuthReady();
  const signalsApi = useSignalsApi();
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedBand, setSelectedBand] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  const accountsQuery = useQuery({
    queryKey: ACCOUNT_SIGNALS_QUERY_KEY,
    queryFn: () => signalsApi.listAccounts({ limit: 100 }),
    enabled: authReady,
  });

  const availableSignalTypes = useMemo(() => {
    if (!accountsQuery.data) return [];
    const types = new Set<string>();
    for (const acc of accountsQuery.data.data) {
      for (const sig of acc.signals) {
        types.add(sig.signalType);
      }
    }
    return Array.from(types);
  }, [accountsQuery.data]);

  const filteredAccounts = useMemo(() => {
    if (!accountsQuery.data) return [];
    return accountsQuery.data.data.filter((acc) => {
      if (selectedBand !== "all" && acc.stackScore.band !== selectedBand) {
        return false;
      }
      if (selectedType !== "all" && !acc.signals.some((s) => s.signalType === selectedType)) {
        return false;
      }
      return true;
    });
  }, [accountsQuery.data, selectedBand, selectedType]);

  return (
    <PageShell>
      <PageHeader
        title="Signal Center"
        description="Fresh, sourced signals ranked by strength — activate hot accounts into lists or sequences."
        actions={
          <Button onClick={() => setRecordOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Record Signal
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Band:</span>
          {(["all", "hot", "warm", "cool"] as const).map((band) => (
            <Button
              key={band}
              variant={selectedBand === band ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => setSelectedBand(band)}
            >
              {band === "all" ? "All Bands" : BAND_LABEL[band]}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signal Type:</span>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-8 text-xs w-48"
          >
            <option value="all">All Types ({availableSignalTypes.length})</option>
            {availableSignalTypes.map((type) => (
              <option key={type} value={type}>
                {signalIcon(type)} {signalLabel(type)}
              </option>
            ))}
          </Select>
        </div>
      </div>

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

      {accountsQuery.data && filteredAccounts.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {accountsQuery.data.data.length === 0
            ? "No accounts have a live signal right now."
            : "No accounts match the selected band and type filters."}
        </div>
      )}

      {filteredAccounts.length > 0 && (
        <div className="space-y-3">
          {filteredAccounts.map((account) => (
            <AccountCard key={account.companyId} account={account} />
          ))}
        </div>
      )}

      <RecordSignalDialog open={recordOpen} onClose={() => setRecordOpen(false)} />
    </PageShell>
  );
}
