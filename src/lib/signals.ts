import { useApiFetch } from "./api-client";
import type { AccountSignalSummary, Signal } from "@/types/api";

interface ListSignalsEnvelope {
  entityId: string;
  entityType: string;
  data: Signal[];
  total: number;
}

interface ListAccountSignalsEnvelope {
  data: AccountSignalSummary[];
  total: number;
}

export const ACCOUNT_SIGNALS_QUERY_KEY = ["signals", "accounts"] as const;

/** R11.1/R11.2/R11.3/8.5 — unified signal timeline + Signal Center account ranking.
 * Backend: apps/api/src/routes/signal.routes.ts. */
export function useSignalsApi() {
  const fetchApi = useApiFetch();
  return {
    list: (entityId: string, opts?: { entityType?: string; signalType?: string; limit?: number }) => {
      const params = new URLSearchParams({ entityId });
      if (opts?.entityType) params.set("entityType", opts.entityType);
      if (opts?.signalType) params.set("signalType", opts.signalType);
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      return fetchApi<ListSignalsEnvelope>(`/api/v1/signals?${params.toString()}`);
    },
    /** 8.5 Signal Center — every activated account with a live signal, ranked by stack score. */
    listAccounts: (opts?: { limit?: number }) => {
      const params = new URLSearchParams();
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      const qs = params.toString();
      return fetchApi<ListAccountSignalsEnvelope>(`/api/v1/signals/accounts${qs ? `?${qs}` : ""}`);
    },
  };
}

const SIGNAL_ICON: Record<string, string> = {
  recent_funding: "💰",
  recent_hiring: "📈",
  headcount_growth: "📈",
  leadership_change: "👤",
  tech_adopted: "🔧",
  tech_dropped: "🔧",
  tech_adoption: "🔧",
  product_launch: "🚀",
  market_expansion: "🌐",
  new_office: "🏢",
  acquisition: "🤝",
  website_change: "🌐",
  engagement_decay: "⚠️",
  negative_sentiment: "⚠️",
  budget_freeze: "🧊",
};

export function signalIcon(signalType: string): string {
  return SIGNAL_ICON[signalType] ?? "🎯";
}

export function signalLabel(signalType: string): string {
  return signalType
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Risk-type signals (R18) get a distinct visual treatment from opportunity signals. */
export function isRiskSignal(signalType: string): boolean {
  return signalType === "engagement_decay" || signalType === "negative_sentiment" || signalType === "budget_freeze";
}

export function signalReasonText(signal: Signal): string {
  return signal.value?.reason ?? signal.value?.detail ?? signalLabel(signal.signalType);
}

export function timeAgoShort(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
