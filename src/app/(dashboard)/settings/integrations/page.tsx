"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Plug, Trash2 } from "lucide-react";
import { useState } from "react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { GuideLink } from "@/components/guides/guide-link";
import { type IntegrationItem, useIntegrationsApi } from "@/lib/integrations";

function ProviderCard({ item }: { item: IntegrationItem }) {
  const queryClient = useQueryClient();
  const api = useIntegrationsApi();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    mutationFn: () => api.save(item.provider, apiKey),
    onSuccess: () => {
      setApiKey("");
      setShowKey(false);
      setCopied(false);
      setError(null);
      setSuccess(`${item.name} connected. Enrichment will use your key first (25% Skout credit discount).`);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.message === "invalid_api_key") {
          setError("That API key was rejected by the provider. Check the key and try again.");
        } else if (err.message === "provider_timeout") {
          setError("Provider timed out — try again in a moment.");
        } else {
          setError("Could not save integration. Check your key and try again.");
        }
      } else {
        setError("Could not save integration.");
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => api.remove(item.provider),
    onSuccess: () => {
      setSuccess(`${item.name} removed. Skout platform keys will be used when available.`);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const test = useMutation({
    mutationFn: () => api.test(item.provider, apiKey.trim() || undefined),
    onSuccess: () => {
      setError(null);
      setSuccess(apiKey.trim() ? "API key is valid." : "Stored key is valid.");
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: () => setError("Test failed — check the API key."),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg">{item.name}</CardTitle>
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

        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="warning">{error}</Alert>}

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

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Enrichment integrations"
        description="Connect your own provider API keys. Your keys are tried first; Skout platform keys are used as fallback. You pay the provider directly and get 25% off Skout credits when your key is used."
        actions={<GuideLink slug="integrations" label="Integrations guide" />}
      />

      <DemoBanner />

      {integrations.error && (
        <Alert variant="error" title="Something went wrong" dismissible>
          We couldn&apos;t load your integrations. Please try again.
        </Alert>
      )}

      {integrations.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading integrations…
        </div>
      )}

      <div className="space-y-4">
        {integrations.data?.data.map((item) => (
          <ProviderCard key={item.provider} item={item} />
        ))}
      </div>
    </PageShell>
  );
}
