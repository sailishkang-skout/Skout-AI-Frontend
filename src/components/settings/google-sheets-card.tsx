"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sheet, Unlink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeatureOn } from "@/lib/access";
import { authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { SHEETS_CONNECTION_KEY, useGoogleSheetsApi } from "@/lib/google-sheets";

const BADGE = {
  connected: { tone: "success", label: "Connected" },
  needs_reauth: { tone: "warning", label: "Reconnect required" },
  not_connected: { tone: "muted", label: "Not connected" },
} as const;

/**
 * Your Google Sheets connection (WB2-025): connect, reconnect or disconnect. Shown where Workbooks V2 is on, and
 * wherever a connection exists, so it can always be removed.
 */
export function GoogleSheetsCard() {
  const api = useGoogleSheetsApi();
  const client = useQueryClient();
  const authReady = useAuthReady();
  const offered = useFeatureOn("workbooks_v2");
  const [confirming, setConfirming] = useState(false);
  const connection = useQuery({ ...authQueryOptions, queryKey: SHEETS_CONNECTION_KEY, queryFn: api.status, enabled: authReady });
  const connect = useMutation({ mutationFn: api.start, onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl) });
  const disconnect = useMutation({
    mutationFn: api.disconnect,
    onSuccess: () => {
      setConfirming(false);
      return client.invalidateQueries({ queryKey: SHEETS_CONNECTION_KEY });
    },
  });

  const data = connection.data;
  const linked = Boolean(data && data.status !== "not_connected");
  if (!offered && !linked) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg">Google Sheets</CardTitle>
            <CardDescription>
              Add rows to workbooks from your spreadsheets. Skout asks to read your spreadsheets, never to change them, and reads only the ones whose link you
              paste. Each teammate connects their own Google account.
            </CardDescription>
          </div>
          {data ? <Badge tone={BADGE[data.status].tone}>{BADGE[data.status].label}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connection.isError ? (
          <Alert variant="error" onRetry={() => void connection.refetch()}>
            {formatQueryError(connection.error, "Your Google Sheets connection could not be loaded.")}
          </Alert>
        ) : null}
        {connect.error ? <Alert variant="error">{formatQueryError(connect.error, "The connection could not be started.")}</Alert> : null}
        {disconnect.error ? <Alert variant="error">{formatQueryError(disconnect.error, "Google Sheets could not be disconnected.")}</Alert> : null}
        {disconnect.data?.disconnected ? (
          <Alert variant={disconnect.data.revokedAtGoogle ? "success" : "warning"}>
            {disconnect.data.revokedAtGoogle
              ? "Disconnected, and access was withdrawn at Google. Rows already imported are unchanged."
              : "Disconnected: Skout deleted its access. Google didn’t confirm the withdrawal, so remove Skout under Third-party access in your Google account too. Rows already imported are unchanged."}
          </Alert>
        ) : null}
        {data?.status === "needs_reauth" ? <p className="text-sm">Google access expired or was removed. Reconnect to import or pull new rows.</p> : null}
        {data && !data.configured && !linked ? <p className="text-sm text-muted-foreground">Google Sheets isn’t set up on this server.</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Sheet className="h-4 w-4 text-muted-foreground" aria-hidden />
          {data && data.status !== "connected" && data.configured ? (
            <Button size="sm" disabled={connect.isPending} onClick={() => connect.mutate()}>
              {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {data.status === "needs_reauth" ? "Reconnect Google Sheets" : "Connect Google Sheets"}
            </Button>
          ) : null}
          {linked && !confirming ? (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              <Unlink className="h-3.5 w-3.5" aria-hidden />
              Disconnect
            </Button>
          ) : null}
          {linked && confirming ? (
            <>
              <span className="text-sm">Imports and pulls using your connection will stop.</span>
              <Button size="sm" variant="destructive" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                {disconnect.isPending ? "Disconnecting…" : "Yes, disconnect"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
