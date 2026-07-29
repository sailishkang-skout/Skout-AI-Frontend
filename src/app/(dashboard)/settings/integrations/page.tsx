"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Plug, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { GuideLink } from "@/components/guides/guide-link";
import { type IntegrationItem, useIntegrationsApi } from "@/lib/integrations";

const DEFAULT_UNIPILE_DSN = "https://api1.unipile.com:13111";

function ProviderCard({ item }: { item: IntegrationItem }) {
  const queryClient = useQueryClient();
  const api = useIntegrationsApi();
  const [apiKey, setApiKey] = useState("");
  const [dsn, setDsn] = useState(() =>
    item.dsnHint ? `https://${item.dsnHint}` : DEFAULT_UNIPILE_DSN
  );
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isUnipile = item.provider === "unipile";

  useEffect(() => {
    if (item.dsnHint) setDsn(`https://${item.dsnHint}`);
  }, [item.dsnHint]);

  const copyKey = async () => {
    if (!apiKey.trim()) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const save = useMutation({
    mutationFn: () =>
      api.save(item.provider, apiKey, isUnipile ? { dsn: dsn.trim() || DEFAULT_UNIPILE_DSN } : undefined),
    onSuccess: () => {
      setApiKey("");
      setShowKey(false);
      setCopied(false);
      setError(null);
      setSuccess(
        isUnipile
          ? `${item.name} connected. Use Deliverability to link LinkedIn/WhatsApp accounts.`
          : `${item.name} connected. Enrichment will use your key first (25% Skout credit discount).`
      );
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["linkedin-accounts"] });
    },
    onError: (err) => {
      setError(formatQueryError(err, "Could not save integration. Check your key and try again."));
    },
  });

  const remove = useMutation({
    mutationFn: () => api.remove(item.provider),
    onSuccess: () => {
      setSuccess(
        isUnipile
          ? `${item.name} removed. Platform Unipile env (if set) will be used.`
          : `${item.name} removed. Skout platform keys will be used when available.`
      );
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["linkedin-accounts"] });
    },
  });

  const test = useMutation({
    mutationFn: () =>
      api.test(
        item.provider,
        apiKey.trim() || undefined,
        isUnipile ? { dsn: dsn.trim() || DEFAULT_UNIPILE_DSN } : undefined
      ),
    onSuccess: () => {
      setError(null);
      setSuccess(apiKey.trim() ? "API key is valid." : "Stored key is valid.");
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => setError(formatQueryError(err, "Test failed — check the API key.")),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <CardTitle className="text-base sm:text-lg">{item.name}</CardTitle>
              {item.category === "messaging" && <Badge tone="muted">Messaging</Badge>}
              {item.category === "enrichment" && <Badge tone="muted">Enrichment</Badge>}
            </div>
            <CardDescription>{item.description}</CardDescription>
          </div>
          {item.connected ? (
            <Badge tone="success">Connected {item.keyHint}</Badge>
          ) : (
            <Badge tone="muted">Not connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{item.creditDiscount}</p>
        {isUnipile && item.connected && item.dsnHint && (
          <p className="text-xs text-muted-foreground">Current DSN · {item.dsnHint}</p>
        )}

        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {isUnipile && (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`dsn-${item.provider}`}>
              Unipile DSN
            </label>
            <Input
              id={`dsn-${item.provider}`}
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={DEFAULT_UNIPILE_DSN}
              value={dsn}
              onChange={(e) => setDsn(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Must match the DSN shown in Unipile for this API key. Then connect LinkedIn/WhatsApp under
              Deliverability.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`key-${item.provider}`}>
            API key
          </label>
          <div className="relative">
            <Input
              id={`key-${item.provider}`}
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={item.connected ? "Enter a new key to replace stored key" : "Paste your API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-[4.75rem] font-mono text-sm"
            />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <button
                type="button"
                onClick={copyKey}
                disabled={!apiKey.trim()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                aria-label="Copy API key"
                title="Copy"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setShowKey((visible) => !visible)}
                disabled={!apiKey.trim()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                aria-label={showKey ? "Hide API key" : "Show API key"}
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {apiKey.trim().length > 0 && apiKey.trim().length < 8 && (
            <p className="text-[11px] text-muted-foreground">Paste a key of at least 8 characters.</p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || apiKey.trim().length < 8}
            className="w-full sm:w-auto"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {item.connected ? "Update key" : "Save key"}
          </Button>
          <Button
            variant="outline"
            onClick={() => test.mutate()}
            disabled={test.isPending || (!item.connected && apiKey.trim().length < 8)}
            className="w-full sm:w-auto"
          >
            {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Test connection
          </Button>
          {item.connected && (
            <Button
              variant="outline"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="w-full sm:w-auto"
            >
              {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </Button>
          )}
          <a
            href={item.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent sm:w-auto"
          >
            <ExternalLink className="h-4 w-4" />
            Get API key
          </a>
        </div>

        {item.lastValidatedAt && (
          <p className="text-xs text-muted-foreground">
            Last validated {new Date(item.lastValidatedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function IntegrationsSettingsPage() {
  const authReady = useAuthReady();
  const api = useIntegrationsApi();

  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: api.list,
    enabled: authReady,
  });

  const messaging = integrations.data?.data.filter((i) => i.category === "messaging") ?? [];
  const enrichment = integrations.data?.data.filter((i) => i.category !== "messaging") ?? [];

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Integrations"
        description="Connect Unipile for LinkedIn/WhatsApp outreach, and your own enrichment provider API keys (BYOK). Workspace keys are preferred before platform defaults."
        actions={<GuideLink slug="integrations" label="Integrations guide" />}
      />

      <DemoBanner />

      {integrations.error && (
        <Alert
          variant="error"
          title="Couldn't load integrations"
          onRetry={() => integrations.refetch()}
        >
          {formatQueryError(integrations.error, "Please try again.")}
        </Alert>
      )}

      {integrations.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      )}

      {messaging.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Messaging</h2>
          <div className="space-y-4">
            {messaging.map((item) => (
              <ProviderCard key={item.provider} item={item} />
            ))}
          </div>
        </div>
      )}

      {enrichment.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Enrichment</h2>
          <div className="space-y-4">
            {enrichment.map((item) => (
              <ProviderCard key={item.provider} item={item} />
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
