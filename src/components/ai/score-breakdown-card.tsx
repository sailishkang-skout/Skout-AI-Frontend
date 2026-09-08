import type { ScoreBreakdown } from "@/lib/ai-chat";

const DIMENSION_LABELS: Record<string, string> = {
  industry: "Industry",
  seniority: "Seniority",
  geography: "Geography",
  company_size: "Company size",
  title: "Title",
  signals: "Intent signals",
};

function DimensionRow({
  name,
  dim,
}: {
  name: string;
  dim: { score: number; matched: boolean; explanation: string };
}) {
  const label = DIMENSION_LABELS[name] ?? name.replace(/_/g, " ");
  const pct = Math.max(0, Math.min(100, dim.score));
  const barColor = dim.matched ? "bg-emerald-500 dark:bg-emerald-400" : "bg-rose-400 dark:bg-rose-500";

  return (
    <div className="grid gap-1 py-1.5 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
            dim.matched
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
          }`}
          aria-hidden
        >
          {dim.matched ? "✓" : "✗"}
        </span>
        <span className="min-w-[80px] text-[11px] font-medium text-foreground">{label}</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="w-6 text-right text-[10px] font-semibold tabular-nums text-muted-foreground">
            {pct}
          </span>
        </div>
      </div>
      {dim.explanation && (
        <p className="pl-5 text-[10px] leading-snug text-muted-foreground">{dim.explanation}</p>
      )}
    </div>
  );
}

function bandTone(band: string): string {
  const b = band.toLowerCase();
  if (b === "strong" || b === "hot") return "text-emerald-600 dark:text-emerald-400";
  if (b === "medium" || b === "warm") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/** §8.13 SP-13 — renders explain_score's tool response as a structured breakdown instead of
 * plain chat text. Purely presentational: no data-fetching of its own (unlike
 * prospect-detail-sheet.tsx's IcpScoreCard, which owns an evidence-ledger query — not reusable
 * here as-is since a chat bubble already has the full tool response in hand). */
export function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreBreakdown }) {
  const { icp, signalStack } = breakdown;
  const dimensionEntries = Object.entries(icp.dimensions);

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-border bg-background p-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">ICP fit</span>
        <span className="flex items-center gap-1.5">
          <span className={`font-semibold capitalize ${bandTone(icp.band)}`}>{icp.band}</span>
          <span className="tabular-nums text-muted-foreground">{icp.score}/100</span>
        </span>
      </div>

      {dimensionEntries.length > 0 && (
        <div>
          {dimensionEntries.map(([name, dim]) => (
            <DimensionRow key={name} name={name} dim={dim} />
          ))}
        </div>
      )}

      {icp.reasoning && <p className="text-[10px] leading-snug text-muted-foreground">{icp.reasoning}</p>}

      <div className="flex items-center justify-between border-t border-border/40 pt-2">
        <span className="font-semibold text-foreground">Signal stack</span>
        <span className="flex items-center gap-1.5">
          <span className={`font-semibold capitalize ${bandTone(signalStack.band)}`}>{signalStack.band}</span>
          <span className="tabular-nums text-muted-foreground">{signalStack.score}/100</span>
        </span>
      </div>

      {signalStack.contributingSignals.length > 0 ? (
        <ul className="space-y-1">
          {signalStack.contributingSignals.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-foreground">{s.signalType.replace(/_/g, " ")}</span>
              <span className="tabular-nums text-muted-foreground">
                confidence {Math.round(s.confidence * 100)}% · weight {s.weight.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-muted-foreground">No timing signals contributing right now.</p>
      )}

      <p className="text-[10px] text-muted-foreground">
        {signalStack.distinctSignalTypes} distinct signal type{signalStack.distinctSignalTypes === 1 ? "" : "s"}
        {signalStack.reachableDecisionMaker ? " · reachable decision-maker" : ""}
        {icp.version ? ` · ICP v${icp.version}` : ""}
      </p>
    </div>
  );
}
