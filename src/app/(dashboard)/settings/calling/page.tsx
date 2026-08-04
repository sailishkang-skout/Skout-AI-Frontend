"use client";

/** R20.2 — Twilio click-to-call setup: your own agent phone number + workspace status. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { useCallsApi } from "@/lib/calls";

interface MeData {
  phone?: string | null;
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

  const enabled = config.data?.data.enabled ?? false;
  const currentPhone = phone ?? me.data?.phone ?? "";

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Calling"
        description="Click-to-call dials your phone first, then bridges to the prospect once you pick up — no separate softphone needed."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Workspace status</CardTitle>
          <Badge tone={enabled ? "success" : "muted"}>{enabled ? "Connected" : "Not configured"}</Badge>
        </CardHeader>
        <CardContent>
          {!enabled && (
            <p className="text-sm text-muted-foreground">
              Calling requires a Twilio account. Ask a workspace admin to set{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">TWILIO_ACCOUNT_SID</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">TWILIO_AUTH_TOKEN</code>, and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">TWILIO_PHONE_NUMBER</code> in the API
              environment. See the Phase 1 dependency doc for details.
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
            We call this number first when you click "Call" on a contact. E.164 format, e.g.{" "}
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
    </PageShell>
  );
}
