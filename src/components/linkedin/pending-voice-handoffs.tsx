"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, ExternalLink } from "lucide-react";
import { useDexterPlatformApi, type LinkedinVoiceHandoff } from "@/lib/dexter-platform";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * LVH-01 — a rep working sequences shouldn't have to remember to check /app/linkedin/voice for
 * pending handoffs one prospect at a time. This surfaces every "handed_off" (drafted, not yet
 * confirmed sent) voice handoff across the whole workspace — whether created from the standalone
 * wizard or parked by a "voice" sequence step — right at the top of the LinkedIn Voice Studio page.
 */
export function PendingVoiceHandoffsQueue() {
  const api = useDexterPlatformApi();
  const { data, isLoading } = useQuery({
    queryKey: ["linkedin-voice-handoffs", "pending"],
    queryFn: () => api.listLinkedinVoiceHandoffs(),
    refetchInterval: 60_000,
  });

  const pending = ((data?.data ?? []) as LinkedinVoiceHandoff[]).filter((h) => h.status === "handed_off");

  if (isLoading || pending.length === 0) return null;

  return (
    <Card className="p-4 space-y-3 border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold">Needs your action — voice notes awaiting send</h3>
        <Badge tone="warning">{pending.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        These are drafted and handed off to a mobile link, but not yet confirmed sent. A sequence
        step waiting on one of these pauses until you confirm (or it expires after 7 days).
      </p>
      <ul className="space-y-2">
        {pending.map((h) => (
          <li
            key={h.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{h.prospectName ?? h.prospectId ?? "Prospect"}</div>
              {h.expiresAt && (
                <div className="text-xs text-muted-foreground">
                  Expires {new Date(h.expiresAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <a
              href={h.mobileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open handoff <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
