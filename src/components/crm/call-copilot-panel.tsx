"use client";

import { Phone, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CallButton } from "@/components/crm/call-button";
import { NextBestActionCard } from "@/components/crm/next-best-action-card";

/**
 * §17.13 — Calling workspace live AI copilot (MVP).
 * Combines click-to-call with evidence-backed next-best-action while on a call context.
 */
export function CallCopilotPanel({
  phone,
  contactId,
  prospectId,
  taskId,
  title = "Calling copilot",
}: {
  phone?: string | null;
  contactId?: string;
  prospectId?: string | null;
  taskId?: string;
  title?: string;
}) {
  const entityType = contactId ? "contact" : undefined;
  const entityId = contactId;

  return (
    <Card data-testid="call-copilot-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Start a call, then use the AI next-best-action below for objection handling, follow-ups, and CRM updates —
          grounded in your contact history.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <CallButton phone={phone} contactId={contactId} prospectId={prospectId} taskId={taskId} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            Live transcription copilot ships in a later phase; this panel uses call context + NBA today.
          </span>
        </div>
        {entityType && entityId ? (
          <NextBestActionCard entityType={entityType} entityId={entityId} />
        ) : prospectId ? (
          <p className="text-sm text-muted-foreground">
            Link this prospect to a CRM contact for full copilot recommendations.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
