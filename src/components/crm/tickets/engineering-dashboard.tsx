"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { minutesText, percentText, useCopsTicketsApi } from "@/lib/cops-tickets";

/**
 * COPS-12 Engineering dashboard (Bible p.56): open, aged, MTTA, MTTR, reopen rate, SLA breach
 * rate and incident-linked tickets. Each tile's tooltip is the metric's definition from the API.
 */
export function EngineeringDashboard({ tier }: { tier?: string }) {
  const api = useCopsTicketsApi();
  const authReady = useAuthReady();
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["cops-ticket-metrics", days, tier], queryFn: () => api.metrics(days, tier || undefined), enabled: authReady, retry: false, refetchInterval: 60_000 });
  const m = q.data?.data;
  if (q.isLoading) return <Skeleton className="h-20 w-full rounded-md" />;
  if (q.isError) return <Alert variant="error">Could not load the engineering metrics.</Alert>;
  // Nothing to show until the API returns the metrics object (an older API has no metrics route).
  if (!m || typeof m !== "object" || Array.isArray(m) || typeof m.open !== "number") return null;

  const tiles: { key: keyof typeof m.definitions | string; label: string; value: string; warn?: boolean }[] = [
    { key: "open", label: "Open", value: String(m.open) },
    { key: "aged", label: "Aged (7d+)", value: String(m.aged), warn: m.aged > 0 },
    { key: "at_risk", label: "SLA at risk", value: String(m.at_risk), warn: m.at_risk > 0 },
    { key: "mtta_minutes", label: "MTTA", value: minutesText(m.mtta_minutes) },
    { key: "mttr_minutes", label: "MTTR", value: minutesText(m.mttr_minutes) },
    { key: "breach_rate", label: "Breach rate", value: percentText(m.breach_rate), warn: (m.breach_rate ?? 0) > 0.1 },
    { key: "reopen_rate", label: "Reopen rate", value: percentText(m.reopen_rate) },
    { key: "incident_linked", label: "Incident-linked", value: String(m.incident_linked) },
  ];
  return (
    <section className="space-y-2" data-testid="engineering-dashboard">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Last {m.window_days} days</h2>
        <Select aria-label="Window" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-28">
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {tiles.map((t) => (
          <div key={t.key} className="rounded-md border p-2" title={m.definitions?.[t.key] ?? undefined} data-testid={`metric-${t.key}`}>
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className={`text-lg font-semibold ${t.warn ? "text-amber-600 dark:text-amber-400" : ""}`}>{t.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
