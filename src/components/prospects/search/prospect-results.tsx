"use client";

import { ChevronRight, Linkedin, Loader2, Mail, Phone, RefreshCw, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalBadges } from "@/components/signals/signal-badges";
import { FieldEvidenceBadge } from "@/components/prospects/field-evidence-badge";
import { cn } from "@/lib/utils";
import type { ProspectSummary } from "@/types/api";
import { FitRing, fitTone } from "./fit-ring";

export interface RevealState {
  email?: string;
  status?: string;
  phone?: string;
  failed?: boolean;
  tried?: { email?: boolean; phone?: boolean };
}

export type RevealKind = "email" | "phone";

export interface ProspectResultsProps {
  view: "table" | "cards";
  results: ProspectSummary[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  enriched: Record<string, RevealState | undefined>;
  /** ICP match (0–100) for a row, from the result or a stored/just-run score. */
  scoreOf: (p: ProspectSummary) => number | undefined;
  icpReady: boolean;
  pendingEnrichId?: string;
  pendingScoreId?: string;
  revealing?: { id: string; kind: RevealKind };
  onEnrich: (p: ProspectSummary) => void;
  onScore: (p: ProspectSummary) => void;
  onReveal: (p: ProspectSummary, kind: RevealKind) => void;
  onOpen: (p: ProspectSummary) => void;
}

const GRID =
  "grid grid-cols-[20px_minmax(240px,2.2fr)_minmax(190px,1.6fr)_minmax(110px,.9fr)_minmax(190px,1.5fr)_minmax(140px,1.1fr)_150px] items-center gap-3.5";

function companyLabel(p: ProspectSummary): string {
  const domain = p.companyDomain && !p.companyDomain.endsWith("linkedin-capture.local") ? p.companyDomain : "";
  return p.companyName || domain || "—";
}

function companyMeta(p: ProspectSummary): string {
  return [p.industry, p.employeeCount ? `${p.employeeCount.toLocaleString()} emp.` : ""].filter(Boolean).join(" · ");
}

function locationOf(p: ProspectSummary): string {
  return [p.city, p.country].filter(Boolean).join(", ");
}

function scoreText(p: ProspectSummary, score: number | undefined): string {
  if (score == null) return "Not scored";
  return p.timingScore != null ? `ICP ${score} · Timing ${p.timingScore}` : `ICP ${score}`;
}

function NameLine({ p, onOpen }: { p: ProspectSummary; onOpen: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button type="button" onClick={onOpen} className="truncate text-left text-sm font-semibold hover:text-primary hover:underline">
        {p.fullName}
      </button>
      {p.linkedinUrl && (
        <a
          href={p.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${p.fullName} on LinkedIn`}
          className="shrink-0 text-[#4f8fe8] hover:opacity-80"
        >
          <Linkedin className="h-3.5 w-3.5" />
        </a>
      )}
      {p.origin === "extension" && (
        <span
          title="Captured with the Skout extension"
          className="shrink-0 rounded bg-primary/10 px-1.5 text-[10px] font-bold leading-[17px] text-primary"
        >
          EXT
        </span>
      )}
    </div>
  );
}

function RevealCell({
  p,
  kind,
  state,
  busy,
  disabled,
  onReveal,
}: {
  p: ProspectSummary;
  kind: RevealKind;
  state: RevealState | undefined;
  busy: boolean;
  disabled: boolean;
  onReveal: () => void;
}) {
  const value = kind === "email" ? state?.email : state?.phone;
  if (value) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        {kind === "email" && (
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              state?.status === "valid" ? "bg-emerald-500" : state?.status ? "bg-amber-500" : "bg-muted-foreground"
            )}
            title={state?.status}
            aria-hidden="true"
          />
        )}
        <span className="truncate font-mono text-xs" title={kind === "email" ? state?.status : undefined}>
          {value}
        </span>
        {kind === "email" && <FieldEvidenceBadge entityId={p.prospectId} entityType="prospect" attribute="email" />}
      </div>
    );
  }
  if (state?.tried?.[kind]) {
    return <span className="text-xs text-muted-foreground">No {kind} found</span>;
  }
  if (p.recordType === "company") return <span className="text-xs text-muted-foreground">—</span>;
  const Icon = kind === "email" ? Mail : Phone;
  return (
    <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onReveal} disabled={disabled}>
      {busy ? <Loader2 className="animate-spin" /> : <Icon />}
      Get {kind}
    </Button>
  );
}

export function ProspectResults(props: ProspectResultsProps) {
  const { view, results, selected, onToggleSelect, enriched, scoreOf, icpReady } = props;

  const actions = (p: ProspectSummary, score: number | undefined, compact: boolean) => {
    const e = enriched[p.prospectId];
    const pendingEnrich = props.pendingEnrichId === p.prospectId;
    const pendingScore = props.pendingScoreId === p.prospectId;
    return (
      <>
        {score == null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={compact ? "h-7 px-2 text-xs" : "flex-1"}
            onClick={() => props.onScore(p)}
            disabled={pendingScore || !icpReady}
            title={icpReady ? undefined : "Set up your ICP to score leads"}
          >
            {pendingScore ? <Loader2 className="animate-spin" /> : <Target />}
            Score
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={compact ? "h-7 px-2.5 text-xs" : "flex-1"}
          onClick={() => props.onEnrich(p)}
          disabled={pendingEnrich}
        >
          {pendingEnrich ? <Loader2 className="animate-spin" /> : e?.failed ? <RefreshCw /> : <Zap />}
          {e?.failed ? "Retry" : "Enrich"}
        </Button>
      </>
    );
  };

  if (view === "cards") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4" data-testid="prospect-results">
        {results.map((p) => {
          const score = scoreOf(p);
          const e = enriched[p.prospectId];
          const isSelected = selected.has(p.prospectId);
          const revealingThis = props.revealing?.id === p.prospectId;
          return (
            <article
              key={p.prospectId}
              className={cn(
                "relative flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary",
                isSelected ? "border-primary" : "border-border"
              )}
            >
              <input
                type="checkbox"
                className="absolute right-4 top-4 h-4 w-4"
                checked={isSelected}
                onChange={() => onToggleSelect(p.prospectId)}
                aria-label={`Select ${p.fullName}`}
              />
              <div className="flex items-center gap-3.5 pr-6">
                <FitRing name={p.fullName} score={score} size={64} stroke={4} />
                <div className="min-w-0">
                  <NameLine p={p} onOpen={() => props.onOpen(p)} />
                  <div className="truncate text-xs text-muted-foreground">{p.title || "—"}</div>
                  <div className={cn("text-xs font-semibold", fitTone(score))}>{scoreText(p, score)}</div>
                </div>
              </div>
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-semibold">{companyLabel(p)}</span>
                  <span className="shrink-0 text-muted-foreground">{locationOf(p)}</span>
                </div>
                {companyMeta(p) && <div className="text-xs text-muted-foreground">{companyMeta(p)}</div>}
                {p.signals && p.signals.length > 0 && <SignalBadges entityId={p.companyId} entityType="company" signals={p.signals} />}
              </div>
              <div className="space-y-1.5 rounded-xl bg-background p-2.5">
                {(["email", "phone"] as const).map((kind) => (
                  <div key={kind} className="flex min-h-[28px] items-center justify-between gap-2">
                    <span className="text-[11px] capitalize text-muted-foreground">{kind}</span>
                    <RevealCell
                      p={p}
                      kind={kind}
                      state={e}
                      busy={revealingThis && props.revealing?.kind === kind}
                      disabled={revealingThis || props.pendingEnrichId === p.prospectId}
                      onReveal={() => props.onReveal(p, kind)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                {actions(p, score, false)}
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => props.onOpen(p)}>
                  Details
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="prospect-results">
      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className={cn(GRID, "border-b px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground")}>
            <span />
            <span>Person</span>
            <span>Company</span>
            <span>Location</span>
            <span>Email</span>
            <span>Phone</span>
            <span />
          </div>
          {results.map((p) => {
            const score = scoreOf(p);
            const e = enriched[p.prospectId];
            const isSelected = selected.has(p.prospectId);
            const revealingThis = props.revealing?.id === p.prospectId;
            return (
              <div
                key={p.prospectId}
                className={cn(GRID, "border-b px-5 py-3 last:border-b-0 hover:bg-muted/40", isSelected && "bg-primary/5")}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isSelected}
                  onChange={() => onToggleSelect(p.prospectId)}
                  aria-label={`Select ${p.fullName}`}
                />
                <div className="flex min-w-0 items-center gap-3">
                  <FitRing name={p.fullName} score={score} />
                  <div className="min-w-0">
                    <NameLine p={p} onOpen={() => props.onOpen(p)} />
                    <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                      <span className="truncate">{p.title || "—"}</span>
                      <FieldEvidenceBadge entityId={p.prospectId} entityType="prospect" attribute="title" />
                      <span className={cn("shrink-0 font-semibold", fitTone(score))}>· {scoreText(p, score)}</span>
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{companyLabel(p)}</div>
                  {companyMeta(p) && <div className="truncate text-[11px] text-muted-foreground">{companyMeta(p)}</div>}
                  {p.signals && p.signals.length > 0 && (
                    <SignalBadges entityId={p.companyId} entityType="company" signals={p.signals} className="mt-1" />
                  )}
                </div>
                <span className="truncate text-[13px] text-muted-foreground">{locationOf(p) || "—"}</span>
                {(["email", "phone"] as const).map((kind) => (
                  <div key={kind} className="min-w-0">
                    <RevealCell
                      p={p}
                      kind={kind}
                      state={e}
                      busy={revealingThis && props.revealing?.kind === kind}
                      disabled={revealingThis || props.pendingEnrichId === p.prospectId}
                      onReveal={() => props.onReveal(p, kind)}
                    />
                    {kind === "email" && e?.failed && !revealingThis && (
                      <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">Lookup failed, try again</div>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-end gap-1">
                  {actions(p, score, true)}
                  <button
                    type="button"
                    onClick={() => props.onOpen(p)}
                    aria-label={`Open details for ${p.fullName}`}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
