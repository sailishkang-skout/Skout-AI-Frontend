"use client";

/** ADI-15 (§4, §10.1) — Account 360's "next action" rail: the active high-strength signals
 * driving this account, each independently one-click actionable — not just the single AI
 * suggestion NextBestActionCard already offers, and not just read-only text. */

import { useState } from "react";
import { Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrollInSequencePanel } from "@/components/lists/enroll-in-sequence-panel";
import { signalIcon, signalLabel, signalReasonText, timeAgoShort } from "@/lib/signals";
import type { Signal } from "@/types/api";

const MAX_RAIL_ITEMS = 3;
const HIGH_STRENGTH_CONFIDENCE_THRESHOLD = 0.7;

/** A signal is "active and high-strength" when it's confident, not expired, and the backend
 * has actually marked it as driving an activation path — not merely informational. */
function isActiveHighStrengthSignal(signal: Signal): boolean {
  if (signal.confidence == null || signal.confidence < HIGH_STRENGTH_CONFIDENCE_THRESHOLD) return false;
  if (signal.activationPaths.length === 0) return false;
  if (signal.expiresAt && new Date(signal.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

export function SignalActionRail({
  signals,
  enrollProspectId,
}: {
  signals: Signal[];
  /** The prospect to enroll if the user acts on a signal — null when no resolvable contact
   * exists for this record (e.g. an account with no buying-committee contact yet). */
  enrollProspectId: string | null;
}) {
  const [actingOnSignalId, setActingOnSignalId] = useState<string | null>(null);

  const railSignals = signals
    .filter(isActiveHighStrengthSignal)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, MAX_RAIL_ITEMS);

  if (railSignals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Radar className="h-4 w-4 text-primary" />
          Active signals — next actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border">
          {railSignals.map((signal) => (
            <li key={signal.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs">
                  {signalIcon(signal.signalType)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{signalLabel(signal.signalType)}</span>
                    <span className="text-xs text-muted-foreground">· {timeAgoShort(signal.observedAt ?? signal.detectedAt)}</span>
                    <Badge tone="default" className="text-[10px]">
                      {Math.round((signal.confidence ?? 0) * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{signalReasonText(signal)}</p>
                </div>
              </div>
              {enrollProspectId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setActingOnSignalId(signal.id)}
                >
                  Enroll in sequence
                </Button>
              )}
            </li>
          ))}
        </ul>

        {actingOnSignalId && enrollProspectId && (
          <EnrollInSequencePanel
            prospectIds={[enrollProspectId]}
            onCancel={() => setActingOnSignalId(null)}
            onEnrolled={() => setActingOnSignalId(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
