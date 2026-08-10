"use client";

/** R17.1 settings surface + R17.4 — per-type delivery channel & Slack webhook. */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { useNotificationsApi } from "@/lib/notifications";
import type { NotificationChannel } from "@/types/api";

interface MeData {
  role?: string;
}

interface WorkspaceCurrentData {
  data: { id: string; name: string; slug: string; slackWebhookUrl: string | null };
}

const NOTIFICATION_TYPES: { type: string; label: string; description: string }[] = [
  { type: "*", label: "Default for all types", description: "Applied to any notification type without its own override below." },
  { type: "activation_rule", label: "Auto-activation rule fired", description: "When an R13.4 rule activates, lists, or enrolls a prospect." },
  { type: "signal_alert", label: "Signal alert", description: "A qualifying signal (funding, hiring, intent spike) on an owned account." },
  { type: "reminder", label: "Task / sequence reminder", description: "A task or manual sequence step is due." },
  { type: "test", label: "Test notifications", description: "Notifications sent via the \"Send test\" button below." },
];

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: "In-app only",
  email: "Email only",
  both: "In-app + email",
};

export default function NotificationSettingsPage() {
  const authReady = useAuthReady();
  const apiFetch = useApiFetch();
  const notificationsApi = useNotificationsApi();
  const queryClient = useQueryClient();
  const [slackUrl, setSlackUrl] = useState<string | null>(null);

  const me = useQuery<MeData>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/v1/me"),
    enabled: authReady,
  });
  const isAdmin = me.data?.role === "owner" || me.data?.role === "admin";

  const workspace = useQuery<WorkspaceCurrentData>({
    queryKey: ["workspace-current-slack"],
    queryFn: () => apiFetch("/api/v1/workspaces/current"),
    enabled: authReady,
  });

  const preferences = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: notificationsApi.listPreferences,
    enabled: authReady,
  });

  const prefMap = useMemo(() => {
    const map = new Map<string, NotificationChannel>();
    for (const p of preferences.data?.data ?? []) map.set(p.type, p.channel);
    return map;
  }, [preferences.data]);

  const setPref = useMutation({
    mutationFn: ({ type, channel }: { type: string; channel: NotificationChannel }) =>
      notificationsApi.setPreference(type, channel),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] }),
  });

  const saveSlack = useMutation({
    mutationFn: (url: string | null) =>
      apiFetch("/api/v1/workspaces/current/slack-webhook", { method: "PUT", body: JSON.stringify({ url }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-current-slack"] });
      setSlackUrl(null);
    },
  });

  const sendTest = useMutation({ mutationFn: notificationsApi.sendTest });

  const currentSlackUrl = slackUrl ?? workspace.data?.data.slackWebhookUrl ?? "";

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Notifications"
        description="Choose how you're notified per alert type, and connect Slack for high-priority delivery outside the app."
        actions={
          <Button variant="outline" size="sm" disabled={sendTest.isPending} onClick={() => sendTest.mutate()}>
            <Send className="h-4 w-4" />
            Send test
          </Button>
        }
      />

      {sendTest.isSuccess && <Alert variant="success">Test notification sent — check the bell icon.</Alert>}
      {sendTest.isError && <Alert variant="error">{formatQueryError(sendTest.error, "Only owners/admins can send test notifications.")}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery channel per type</CardTitle>
        </CardHeader>
        <CardContent>
          {preferences.isError && (
            <Alert variant="error">{formatQueryError(preferences.error, "Could not load preferences.")}</Alert>
          )}
          <div className="divide-y">
            {NOTIFICATION_TYPES.map(({ type, label, description }) => (
              <div key={type} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Select
                  className="w-44 shrink-0"
                  value={prefMap.get(type) ?? "in_app"}
                  onChange={(e) => setPref.mutate({ type, channel: e.target.value as NotificationChannel })}
                >
                  <option value="in_app">{CHANNEL_LABEL.in_app}</option>
                  <option value="email">{CHANNEL_LABEL.email}</option>
                  <option value="both">{CHANNEL_LABEL.both}</option>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Slack delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste an{" "}
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              incoming webhook URL
            </a>{" "}
            for a Slack channel. Every notification delivers there in addition to in-app and email — workspace-wide,
            not per-user. Owner/admin only.
          </p>
          {!isAdmin ? (
            <Alert variant="default">Only workspace owners or admins can change this.</Alert>
          ) : (
            <>
              {saveSlack.isError && (
                <Alert variant="error">{formatQueryError(saveSlack.error, "Could not save the webhook URL.")}</Alert>
              )}
              <div className="flex gap-2">
                <Input
                  value={currentSlackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/…"
                />
                <Button
                  variant="outline"
                  disabled={saveSlack.isPending}
                  onClick={() => saveSlack.mutate(currentSlackUrl.trim() || null)}
                >
                  Save
                </Button>
                {workspace.data?.data.slackWebhookUrl && (
                  <Button variant="ghost" disabled={saveSlack.isPending} onClick={() => saveSlack.mutate(null)}>
                    Disconnect
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
