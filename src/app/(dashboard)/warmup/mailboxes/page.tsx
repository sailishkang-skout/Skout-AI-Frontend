"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  mailboxLabel,
  useWarmupToolApi,
  type WarmupMailbox,
  type WarmupProvider,
} from "@/lib/warmup-tool";

export default function WarmupMailboxesPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [provider, setProvider] = useState<WarmupProvider>("GMAIL");

  const list = useQuery({
    queryKey: ["warmup-tool", "mailboxes"],
    queryFn: () => api.listMailboxes(),
    enabled: authReady,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createMailbox({
        emailAddress: emailAddress.trim(),
        provider,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    onSuccess: () => {
      setEmailAddress("");
      setDisplayName("");
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "mailboxes"] });
    },
  });

  const action = useMutation({
    mutationFn: async ({
      id,
      kind,
    }: {
      id: string;
      kind: "enable" | "disable" | "connect";
    }) => {
      if (kind === "enable") return api.enableMailbox(id);
      if (kind === "disable") return api.disableMailbox(id);
      const mailbox = (list.data ?? []).find((m) => m.id === id);
      if (mailbox?.provider === "MICROSOFT365") {
        const res = await api.connectMicrosoft(id);
        if (res.authorizationUrl) window.open(res.authorizationUrl, "_blank", "noopener,noreferrer");
        return res;
      }
      const res = await api.connectGoogle(id);
      if (res.authorizationUrl) window.open(res.authorizationUrl, "_blank", "noopener,noreferrer");
      return res;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["warmup-tool", "mailboxes"] }),
  });

  const mailboxes = list.data ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Mailboxes"
        description="Register sending identities, connect OAuth, then enable them for warm-up. These are the inboxes that ramp volume and protect deliverability."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add mailbox</CardTitle>
          <CardDescription>
            Creates a Warm-Up Tool mailbox for this workspace. Next step: Connect OAuth, then Enable.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_auto_auto]">
          <Input
            type="email"
            placeholder="mailbox@company.com"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
          />
          <Input
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as WarmupProvider)}
          >
            <option value="GMAIL">Gmail</option>
            <option value="MICROSOFT365">Microsoft 365</option>
          </select>
          <Button
            disabled={!emailAddress.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </CardContent>
        {create.isError && (
          <Alert className="mx-6 mb-4">
            {formatQueryError(create.error, "Could not create mailbox. Check the email and provider.")}
          </Alert>
        )}
      </Card>

      {list.isError && (
        <Alert className="mb-4">
          {formatQueryError(list.error, "Could not load mailboxes.")}
        </Alert>
      )}
      {action.isError && (
        <Alert className="mb-4">
          {formatQueryError(
            action.error,
            "Mailbox action failed. If Connect failed with configuration error, Google/Microsoft OAuth secrets are not set on SkoutDev yet."
          )}
        </Alert>
      )}

      <Alert className="mb-4">
        Typical order: Create → Connect OAuth (needs Google/Microsoft app credentials on the Warm-Up service) → Enable → Warm-up control → Start.
      </Alert>

      <div className="space-y-3">
        {list.isLoading && <p className="text-sm text-muted-foreground">Loading mailboxes…</p>}
        {!list.isLoading && mailboxes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No mailboxes yet. Add a Gmail or Microsoft 365 address to begin warm-up.
          </p>
        )}
        {mailboxes.map((m: WarmupMailbox) => (
          <Card key={m.id}>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{mailboxLabel(m)}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {m.provider && <Badge tone="muted">{String(m.provider)}</Badge>}
                  {m.status && <Badge>{String(m.status)}</Badge>}
                  {typeof m.enabled === "boolean" && (
                    <Badge tone={m.enabled ? "success" : "warning"}>
                      {m.enabled ? "enabled" : "disabled"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                  <Button
                  size="sm"
                  variant="outline"
                  onClick={() => action.mutate({ id: m.id, kind: "connect" })}
                >
                  {m.provider === "MICROSOFT365" ? "Connect Microsoft" : "Connect Google"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => action.mutate({ id: m.id, kind: "enable" })}
                >
                  Enable
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => action.mutate({ id: m.id, kind: "disable" })}
                >
                  Disable
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
