"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare, Search, UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError } from "@/lib/api-client";
import {
  useLinkedinMessagingApi,
  type MessagingAccount,
  type LinkedinPerson,
} from "@/lib/linkedin-messaging";
import { cn } from "@/lib/utils";

type PeopleMode = "connections" | "search";
type ComposeAction = { person: LinkedinPerson; action: "connect" | "message" };

export function LinkedinFindPeople({
  accounts,
  accountId,
  onChangeAccount,
}: {
  accounts: MessagingAccount[];
  accountId: string | undefined;
  onChangeAccount: (id: string | undefined) => void;
}) {
  const api = useLinkedinMessagingApi();
  const [mode, setMode] = useState<PeopleMode>("connections");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [compose, setCompose] = useState<ComposeAction | null>(null);
  const [composeText, setComposeText] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setStatusMsg(null);
    setCompose(null);
  }, [mode, accountId]);

  const peopleQuery = useQuery({
    queryKey: ["messaging", "linkedin", "people", accountId, mode, submittedQuery],
    queryFn: () =>
      api.searchPeople({
        accountId,
        mode,
        q: submittedQuery || undefined,
        limit: 25,
      }),
    enabled: Boolean(accountId) && (mode === "connections" || submittedQuery.trim().length > 0),
  });

  const outreachMutation = useMutation({
    mutationFn: () => {
      if (!compose) throw new Error("No person selected");
      return api.outreach({
        accountId,
        action: compose.action,
        providerId: compose.person.providerId,
        text: composeText.trim() || undefined,
      });
    },
    onSuccess: (_res, _vars) => {
      const action = compose?.action;
      const name = compose?.person.fullName;
      setCompose(null);
      setComposeText("");
      setStatusMsg(
        action === "connect"
          ? `Connection request sent to ${name}.`
          : `Message sent to ${name}.`
      );
    },
  });

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setSubmittedQuery(query.trim());
    if (mode === "connections") {
      // connections can load with empty query; force refetch via submittedQuery
      setSubmittedQuery(query.trim());
    }
  }

  const people = peopleQuery.data?.data ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b p-4">
        {accounts.length > 0 && (
          <select
            className="h-8 w-full max-w-sm rounded-md border border-border bg-background px-2 text-xs"
            value={accountId ?? ""}
            onChange={(e) => onChangeAccount(e.target.value || undefined)}
            aria-label="LinkedIn account"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName || a.unipileAccountId}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
          <button
            type="button"
            onClick={() => {
              setMode("connections");
              setSubmittedQuery(query.trim());
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "connections"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            My connections
          </button>
          <button
            type="button"
            onClick={() => setMode("search")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "search"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Search LinkedIn
          </button>
        </div>

        <form onSubmit={runSearch} className="flex flex-wrap gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "connections"
                ? "Filter connections by name…"
                : "Search people (e.g. product manager Bengaluru)"
            }
            className="max-w-md"
          />
          <Button type="submit" className="gap-1.5" disabled={peopleQuery.isFetching}>
            {peopleQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {mode === "connections" ? "Filter" : "Search"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          {mode === "connections"
            ? "Browse or filter your 1st-degree connections, then message them."
            : "Find people on LinkedIn and send a connection request (or message if already connected)."}
        </p>
      </div>

      {statusMsg && (
        <div className="shrink-0 px-4 pt-3">
          <Alert variant="success">{statusMsg}</Alert>
        </div>
      )}

      {peopleQuery.error && (
        <div className="shrink-0 px-4 pt-3">
          <Alert variant="error" onRetry={() => peopleQuery.refetch()}>
            {formatQueryError(peopleQuery.error, "Could not load LinkedIn people.")}
          </Alert>
        </div>
      )}

      {outreachMutation.error && (
        <div className="shrink-0 px-4 pt-3">
          <Alert variant="error">
            {formatQueryError(outreachMutation.error, "Outreach action failed.")}
          </Alert>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mode === "search" && !submittedQuery && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <Search className="h-10 w-10 opacity-20" />
            <p className="text-sm">Enter keywords to search LinkedIn people.</p>
          </div>
        )}

        {(mode === "connections" || submittedQuery) && peopleQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg border p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!peopleQuery.isLoading && (mode === "connections" || submittedQuery) && people.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No people found. Try a different query.
          </div>
        )}

        <div className="space-y-2">
          {people.map((person) => (
            <div
              key={person.providerId}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                {person.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={person.pictureUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {person.fullName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{person.fullName}</p>
                    {person.networkDistance && (
                      <Badge tone="muted" className="text-[10px]">
                        {person.networkDistance.replace("DISTANCE_", "")}°
                      </Badge>
                    )}
                  </div>
                  {person.headline && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{person.headline}</p>
                  )}
                  {person.location && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{person.location}</p>
                  )}
                  {person.profileUrl && (
                    <a
                      href={person.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      View profile
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {person.canMessage || mode === "connections" ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setCompose({ person, action: "message" });
                      setComposeText("");
                      setStatusMsg(null);
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Message
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setCompose({ person, action: "connect" });
                      setComposeText("");
                      setStatusMsg(null);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Connect
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {compose && (
        <div className="shrink-0 border-t bg-background p-4">
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {compose.action === "connect" ? "Connection request" : "Message"} to{" "}
                {compose.person.fullName}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCompose(null);
                  setComposeText("");
                }}
              >
                Cancel
              </Button>
            </div>
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              rows={3}
              placeholder={
                compose.action === "connect"
                  ? "Optional note (LinkedIn limits apply)…"
                  : "Write your LinkedIn message…"
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-end">
              <Button
                className="gap-1.5"
                disabled={
                  outreachMutation.isPending ||
                  (compose.action === "message" && !composeText.trim())
                }
                onClick={() => outreachMutation.mutate()}
              >
                {outreachMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : compose.action === "connect" ? (
                  <UserPlus className="h-4 w-4" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                {compose.action === "connect" ? "Send request" : "Send message"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
