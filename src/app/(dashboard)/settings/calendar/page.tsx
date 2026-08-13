"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Loader2, Unlink } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useGoogleCalendarApi } from "@/lib/google-calendar";

export default function CalendarSettingsPage() {
  const api = useGoogleCalendarApi();
  const queryClient = useQueryClient();
  const authReady = useAuthReady();
  const searchParams = useSearchParams();

  const status = useQuery({
    queryKey: ["calendar", "connection"],
    queryFn: api.getStatus,
    enabled: authReady,
  });

  const connect = useMutation({
    mutationFn: api.getConnectUrl,
    onSuccess: (res) => {
      // Full-page navigation, not a popup: Google redirects back to our own callback,
      // which redirects to this same page with ?connected=google — no "sync" step needed
      // (unlike the Unipile hosted-auth flow, our own callback already wrote the connection).
      window.location.href = res.url;
    },
  });

  const disconnect = useMutation({
    mutationFn: api.disconnect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar", "connection"] }),
  });

  // After the OAuth redirect lands back here (?connected=google / ?connected=google_error),
  // refetch status and clear the query string.
  useEffect(() => {
    if (!authReady) return;
    const connected = searchParams.get("connected");
    if (connected === "google" || connected === "google_error") {
      queryClient.invalidateQueries({ queryKey: ["calendar", "connection"] });
      window.history.replaceState({}, "", "/settings/calendar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when auth/search params ready
  }, [authReady, searchParams]);

  const connectFailed = searchParams.get("connected") === "google_error";

  return (
    <PageShell width="narrow" data-testid="page-settings-calendar">
      <PageHeader
        title="Google Calendar"
        description="Connect your Google Calendar to schedule meetings with a real Meet link and invite attendees directly from Skout."
        actions={<GuideLink slug="google-calendar" label="Calendar guide" />}
      />

      {connectFailed && <Alert variant="error">Google Calendar connection failed or was cancelled.</Alert>}
      {connect.isError && (
        <Alert variant="error">{formatQueryError(connect.error, "Could not start the Google connect flow.")}</Alert>
      )}
      {disconnect.isError && (
        <Alert variant="error">{formatQueryError(disconnect.error, "Could not disconnect Google Calendar.")}</Alert>
      )}
      {status.isError && (
        <Alert variant="error" onRetry={() => status.refetch()}>
          {formatQueryError(status.error, "Could not load your Google Calendar connection status.")}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>
            Each teammate connects their own calendar — meetings you organize are created on
            your calendar and invites go out from your Google account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.isLoading ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : status.data?.connected ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
                  <Check className="h-4 w-4 text-green-700 dark:text-green-300" />
                </div>
                <div>
                  <p className="font-medium">Connected</p>
                  <p className="text-xs text-muted-foreground">{status.data.connectedEmail}</p>
                </div>
                <Badge tone="success">active</Badge>
              </div>
              <Button variant="outline" size="sm" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                {disconnect.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Not connected
              </div>
              <Button disabled={connect.isPending} onClick={() => connect.mutate()}>
                {connect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Connect Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
