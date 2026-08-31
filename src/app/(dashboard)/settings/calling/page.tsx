"use client";

/** R20.2 — Twilio click-to-call setup: your own agent phone number + workspace status. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GuideLink } from "@/components/guides/guide-link";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { useCallsApi } from "@/lib/calls";
import { CallCopilotPanel } from "@/components/crm/call-copilot-panel";

interface MeData {
  phone?: string | null;
}

interface WorkspaceData {
  data: { meetingBotAutoJoinDefault: boolean };
}

export default function CallingSettingsPage() {
  const authReady = useAuthReady();
  const apiFetch = useApiFetch();
  const callsApi = useCallsApi();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ["calls", "config"],
    queryFn: callsApi.getConfig,
    enabled: authReady,
  });

  const me = useQuery<MeData>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/v1/me"),
    enabled: authReady,
  });

  const save = useMutation({
    mutationFn: (value: string) => callsApi.setMyPhone(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["calls", "config"] });
    },
  });

  const workspace = useQuery<WorkspaceData>({
    queryKey: ["workspace", "current"],
    queryFn: () => apiFetch("/api/v1/workspaces/current"),
    enabled: authReady,
  });

  // R16.2 — workspace-wide default for new meetings' auto-join-bot flag; a per-meeting checkbox
  // (in the meeting form) always overrides this.
  const setAutoJoinDefault = useMutation({
    mutationFn: (nextEnabled: boolean) =>
      apiFetch("/api/v1/workspaces/current/meeting-bot-auto-join", {
        method: "PUT",
        body: JSON.stringify({ enabled: nextEnabled }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace", "current"] }),
  });

  const enabled = config.data?.data.enabled ?? false;
  const currentPhone = phone ?? me.data?.phone ?? "";
  const autoJoinDefault = workspace.data?.data.meetingBotAutoJoinDefault ?? false;

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Calling"
        description="Click-to-call dials your phone first, then bridges to the prospect once you pick up — no separate softphone needed."
        actions={<GuideLink slug="calling" label="Calling guide" />}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Workspace status</CardTitle>
          <Badge tone={enabled ? "success" : "muted"}>
            {enabled ? "Connected" : "Not configured"}
            {config.data?.data.callerId ? ` · ${config.data.data.callerId}` : ""}
          </Badge>
        </CardHeader>
        <CardContent>
          {!enabled && (
            <p className="text-sm text-muted-foreground">
              Calling requires Telnyx plus a caller ID. Order a DID under{" "}
              <a className="underline" href="/settings/numbers">
                Phone numbers
              </a>
              , or set <code className="rounded bg-muted px-1 py-0.5 text-xs">TELNYX_PHONE_NUMBER</code> as a fallback.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your phone number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We call this number first when you click &quot;Call&quot; on a contact. E.164 format, e.g.{" "}
            <span className="font-mono">+14155551234</span>.
          </p>
          {save.isError && <Alert variant="error">{formatQueryError(save.error, "Could not save your phone number.")}</Alert>}
          {save.isSuccess && <Alert variant="success">Saved.</Alert>}
          <div className="flex gap-2">
            <Input value={currentPhone} onChange={(e) => setPhone(e.target.value)} placeholder="+14155551234" />
            <Button disabled={save.isPending || !currentPhone.trim()} onClick={() => save.mutate(currentPhone.trim())}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting bot — auto-join default</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            New meetings inherit this default; each meeting can still override it individually.
            When on, the meeting bot joins on its own shortly before a meeting starts — no manual
            &quot;Schedule bot&quot; click needed. Recording/transcription still requires participant consent.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoJoinDefault}
              disabled={setAutoJoinDefault.isPending}
              onChange={(e) => setAutoJoinDefault.mutate(e.target.checked)}
            />
            Auto-join by default for new meetings
          </label>
          {setAutoJoinDefault.isError && (
            <Alert variant="error">{formatQueryError(setAutoJoinDefault.error, "Could not save this setting.")}</Alert>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <CallCopilotPanel title="Live calling copilot" />
      </div>
    </PageShell>
  );
}
