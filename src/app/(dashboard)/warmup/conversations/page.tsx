"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MailboxSelect, WarmupEmpty } from "@/components/warmup/warmup-ui";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { mailboxLabel, useWarmupToolApi } from "@/lib/warmup-tool";

export default function WarmupConversationsPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();
  const [mailboxId, setMailboxId] = useState("");
  const [selected, setSelected] = useState("");

  const mailboxes = useQuery({
    queryKey: ["warmup-tool", "mailboxes"],
    queryFn: () => api.listMailboxes(),
    enabled: authReady,
  });

  const conversations = useQuery({
    queryKey: ["warmup-tool", "conversations", mailboxId],
    queryFn: () => api.listConversations(mailboxId),
    enabled: authReady && Boolean(mailboxId),
  });

  const detail = useQuery({
    queryKey: ["warmup-tool", "conversation", selected],
    queryFn: () => api.getConversation(selected),
    enabled: authReady && Boolean(selected),
  });

  const classifications = useQuery({
    queryKey: ["warmup-tool", "classifications", selected],
    queryFn: () => api.get(`/conversations/${selected}/classifications`),
    enabled: authReady && Boolean(selected),
  });

  const signals = useQuery({
    queryKey: ["warmup-tool", "policy-signals", selected],
    queryFn: () => api.get(`/conversations/${selected}/policy-signals`),
    enabled: authReady && Boolean(selected),
  });

  const poll = useMutation({
    mutationFn: () => api.pollIntegrationEvents(50),
  });

  const list = conversations.data ?? [];
  const detailObj =
    detail.data && typeof detail.data === "object" ? (detail.data as Record<string, unknown>) : null;

  return (
    <PageShell>
      <PageHeader
        title="Conversations and signals"
        description="Warm-up threads require a mailbox filter (upstream API). Empty lists are normal until warm-up mail is exchanged."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <MailboxSelect
          value={mailboxId}
          onChange={(id) => {
            setMailboxId(id);
            setSelected("");
          }}
          options={(mailboxes.data ?? []).map((m) => ({ id: m.id, label: mailboxLabel(m) }))}
          placeholder="Select a mailbox (required)"
        />
        <Button variant="outline" disabled={poll.isPending} onClick={() => poll.mutate()}>
          {poll.isPending ? "Polling…" : "Poll integration events"}
        </Button>
      </div>

      {!mailboxId && (
        <Alert className="mb-4">Choose a mailbox to load conversations. Listing all mailboxes is not supported by the API.</Alert>
      )}

      {conversations.isError && (
        <Alert className="mb-4">{formatQueryError(conversations.error, "Could not load conversations.")}</Alert>
      )}
      {poll.isError && (
        <Alert className="mb-4">{formatQueryError(poll.error, "Could not poll integration events.")}</Alert>
      )}
      {poll.isSuccess && (
        <Alert className="mb-4">
          Polled {poll.data.polled} event(s). Next cursor: {poll.data.nextCursor ?? "none"}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mailboxId && conversations.isLoading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {mailboxId && !conversations.isLoading && list.length === 0 && (
              <WarmupEmpty>No conversations for this mailbox yet.</WarmupEmpty>
            )}
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent/40"
                onClick={() => setSelected(c.id)}
              >
                <span className="truncate">{c.subject || c.id.slice(0, 8) + "…"}</span>
                <div className="flex gap-2">
                  {c.state && <Badge tone="muted">{c.state}</Badge>}
                  {c.channel && <Badge tone="muted">{c.channel}</Badge>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversation detail</CardTitle>
            </CardHeader>
            <CardContent>
              {!selected && <WarmupEmpty>Select a conversation.</WarmupEmpty>}
              {selected && detail.isLoading && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
              {selected && detailObj && (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">State:</span>{" "}
                    {String(detailObj.state ?? "—")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Subject:</span>{" "}
                    {String(detailObj.subject ?? "—")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Last message:</span>{" "}
                    {detailObj.lastMessageAt
                      ? new Date(String(detailObj.lastMessageAt)).toLocaleString()
                      : "—"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classifications &amp; policy signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!selected && <WarmupEmpty>Select a conversation.</WarmupEmpty>}
              {selected && (
                <>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Classifications</p>
                    {classifications.isLoading ? (
                      <p className="text-muted-foreground">Loading…</p>
                    ) : (
                      <WarmupEmpty>No classifications yet (or empty response).</WarmupEmpty>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Policy signals</p>
                    {signals.isLoading ? (
                      <p className="text-muted-foreground">Loading…</p>
                    ) : (
                      <WarmupEmpty>No policy signals yet (or empty response).</WarmupEmpty>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
