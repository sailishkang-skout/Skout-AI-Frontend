"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

type OAuthReturn = { ok: boolean; provider: string; reason: string | null };

const PROVIDER_NAMES: Record<string, string> = { google: "Google", microsoft: "Microsoft" };

const OAUTH_REASON_HINTS: Record<string, string> = {
  warmup_tool_not_configured: "The Warm-Up service isn't configured on this environment.",
  warmup_tool_unavailable: "The Warm-Up service couldn't be reached. Try again in a minute.",
};

/**
 * The API's OAuth callback sends the browser back here with
 * `?oauth=connected|error&provider=…&reason=…`. Read it once, then strip it
 * from the URL so a refresh doesn't show the notice again.
 */
function useOAuthReturn(): OAuthReturn | null {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [notice] = useState<OAuthReturn | null>(() => {
    const oauth = searchParams?.get("oauth");
    if (oauth !== "connected" && oauth !== "error") return null;
    return {
      ok: oauth === "connected",
      provider: searchParams?.get("provider") ?? "",
      reason: searchParams?.get("reason"),
    };
  });

  useEffect(() => {
    if (notice) router.replace(pathname ?? "/warmup/mailboxes", { scroll: false });
    // Run once on mount: the notice is captured in state already.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return notice;
}

export default function WarmupMailboxesPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const oauthReturn = useOAuthReturn();
  const oauthProviderName = oauthReturn ? PROVIDER_NAMES[oauthReturn.provider] ?? "provider" : "";
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

      {oauthReturn?.ok && (
        <Alert variant="success" className="mb-4" dismissible title={`${oauthProviderName} mailbox connected`}>
          OAuth is set up. Next, click Enable on the mailbox, then start it from Warm-up control.
        </Alert>
      )}
      {oauthReturn && !oauthReturn.ok && (
        <Alert variant="error" className="mb-4" dismissible title={`Could not connect ${oauthProviderName}`}>
          {(oauthReturn.reason && OAUTH_REASON_HINTS[oauthReturn.reason]) ??
            "The sign-in didn't complete. Click Connect again; if it keeps failing, share the code below with support."}
          {oauthReturn.reason && (
            <span className="mt-1 block font-mono text-xs opacity-70">{oauthReturn.reason}</span>
          )}
        </Alert>
      )}

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
