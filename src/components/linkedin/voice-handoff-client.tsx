"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, RefreshCw, Send } from "lucide-react";
import { useDexterPlatformApi, type LinkedinVoiceHandoff } from "@/lib/dexter-platform";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LinkedinVoiceHandoffClient() {
  const params = useParams<{ token: string }>();
  const api = useDexterPlatformApi();
  const token = params.token;
  const [handoff, setHandoff] = useState<(LinkedinVoiceHandoff & { scriptText?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api
      .getLinkedinVoiceHandoff(token)
      .then((res) => setHandoff(res.data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Handoff not found"));
  }, [token]);

  async function confirm() {
    if (!token) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await api.confirmLinkedinVoiceSent(token);
      setHandoff((prev) => (prev ? { ...prev, status: res.data.status } : prev));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setConfirming(false);
    }
  }

  if (error && !handoff) {
    return <p className="p-6 text-sm text-destructive">{error}</p>;
  }
  if (!handoff) {
    return <p className="p-6 text-sm text-muted-foreground">Loading handoff…</p>;
  }

  const confirmed = handoff.status === "confirmed";

  return (
    <Card className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">LinkedIn voice handoff</h1>
      <p className="text-sm text-muted-foreground">
        Record this in the LinkedIn mobile app for {handoff.prospectName ?? "your prospect"}, then confirm. Skout
        cannot send it for you.
      </p>
      {handoff.scriptText && (
        <blockquote className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">{handoff.scriptText}</blockquote>
      )}
      <div className="flex flex-wrap gap-2">
        {handoff.scriptText && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => {
              void navigator.clipboard.writeText(handoff.scriptText ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy script"}
          </Button>
        )}
        {handoff.linkedinUrl && (
          <a
            href={handoff.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-md border border-input px-3 text-sm"
          >
            Open LinkedIn <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {confirmed ? (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> Confirmed on the timeline
        </div>
      ) : (
        <Button type="button" onClick={confirm} disabled={confirming} className="gap-2">
          {confirming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          I sent this voice message
        </Button>
      )}
    </Card>
  );
}
