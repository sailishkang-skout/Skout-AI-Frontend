"use client";

/** R11.3 — signal overlay: badges/icons for funding, hiring, tech-stack change, intent spikes
 * shown directly on company/prospect cards and list/TAM table views, instead of buried in a
 * filter panel. Badges render from the lightweight `signals[]` already embedded on search
 * results; clicking one lazily fetches the full timeline (source/confidence) for the popover. */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/lib/api-client";
import { signalIcon, signalLabel, timeAgoShort, useSignalsApi, isRiskSignal } from "@/lib/signals";
import { cn } from "@/lib/utils";

export interface SignalBadgeSource {
  type: string;
  observedAt: string;
  detail?: string;
}

const MAX_BADGES = 3;

export function SignalBadges({
  entityId,
  entityType = "company",
  signals,
  className,
}: {
  entityId: string;
  entityType?: "prospect" | "company";
  signals: SignalBadgeSource[] | undefined;
  className?: string;
}) {
  const top = [...(signals ?? [])]
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    .slice(0, MAX_BADGES);

  if (top.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {top.map((s, i) => (
        <SignalBadge key={`${s.type}-${i}`} entityId={entityId} entityType={entityType} signal={s} />
      ))}
    </span>
  );
}

function SignalBadge({
  entityId,
  entityType,
  signal,
}: {
  entityId: string;
  entityType: "prospect" | "company";
  signal: SignalBadgeSource;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const authReady = useAuthReady();
  const signalsApi = useSignalsApi();

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const detail = useQuery({
    queryKey: ["signals", entityId, entityType],
    queryFn: () => signalsApi.list(entityId, { entityType }),
    enabled: authReady && open,
  });

  const risk = isRiskSignal(signal.type);

  return (
    <span className="relative" ref={ref}>
      {/* Signal badges render inline inside other clickable rows (e.g. prospect search's
          row-opens-detail button) — a real <button> here would be invalid, nested-button HTML,
          so this is a span acting as one instead. */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }
        }}
        title={`${signalLabel(signal.type)} — ${timeAgoShort(signal.observedAt)}`}
        className={cn(
          "inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-xs transition-transform hover:scale-110",
          risk ? "bg-amber-100 dark:bg-amber-950/50" : "bg-primary/10 dark:bg-primary/20"
        )}
      >
        {signalIcon(signal.type)}
      </span>

      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-6 z-50 w-64 rounded-md border border-border bg-background p-3 text-left shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold">{signalLabel(signal.type)}</p>
          {signal.detail && <p className="mt-0.5 text-xs text-muted-foreground">{signal.detail}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">{new Date(signal.observedAt).toLocaleString()}</p>

          <div className="mt-2 border-t pt-2">
            {detail.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading history…</p>
            ) : detail.isError ? (
              <p className="text-xs text-muted-foreground">Could not load signal detail.</p>
            ) : (
              <ul className="space-y-1.5">
                {(detail.data?.data ?? []).slice(-5).reverse().map((d) => (
                  <li key={d.id} className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{signalLabel(d.signalType)}</span>
                    {d.source && <span> · {d.source}</span>}
                    {d.confidence != null && <span> · {Math.round(d.confidence * 100)}% confidence</span>}
                    <br />
                    {new Date(d.detectedAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
