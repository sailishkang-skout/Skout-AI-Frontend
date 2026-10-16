"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Loader2, RefreshCw, ShieldAlert, User, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCrmApi } from "@/lib/crm";
import { timeAgoShort } from "@/lib/signals";
import type { CrmConflictItem } from "@/types/api";

export function CrmConflictQueue() {
  const crmApi = useCrmApi();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [customConflictId, setCustomConflictId] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState<string>("");

  const conflictsQuery = useQuery({
    queryKey: ["crm", "conflicts", filterStatus],
    queryFn: () =>
      crmApi.listConflicts({
        status: filterStatus === "all" ? undefined : filterStatus,
        limit: 50,
      }),
    refetchInterval: 15_000,
  });

  const resolveMutation = useMutation({
    mutationFn: (params: { id: string; choice: "skout" | "external" | "custom"; customValue?: string }) =>
      crmApi.resolveConflict(params.id, { choice: params.choice, customValue: params.customValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "hubspot", "health"] });
      setResolvingId(null);
      setCustomConflictId(null);
      setCustomValue("");
    },
    onError: () => {
      setResolvingId(null);
    },
  });

  const conflicts: CrmConflictItem[] = conflictsQuery.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Conflict Resolution Queue
            </CardTitle>
            <CardDescription>
              Side-by-side resolution of divergent fields where manual review policy was triggered.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border bg-muted p-0.5 text-xs">
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${
                  filterStatus === "pending"
                    ? "bg-background font-medium text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterStatus("pending")}
              >
                Pending
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${
                  filterStatus === "all"
                    ? "bg-background font-medium text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterStatus("all")}
              >
                All
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => conflictsQuery.refetch()}
              disabled={conflictsQuery.isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${conflictsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {conflictsQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading conflict queue…
          </div>
        ) : conflicts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No {filterStatus === "pending" ? "pending " : ""}conflicts found. Sync is aligned.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {conflicts.map((conflict) => {
              const isPending = conflict.status === "pending";
              const isSelectedCustom = customConflictId === conflict.id;

              return (
                <div key={conflict.id} className="p-4 space-y-3">
                  {/* Header info */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize text-foreground">
                        {conflict.entityType}: {conflict.fieldName}
                      </span>
                      <Badge
                        tone={
                          isPending
                            ? "warning"
                            : conflict.status === "resolved_skout"
                              ? "info"
                              : "success"
                        }
                      >
                        {conflict.status.replace("_", " ")}
                      </Badge>
                      <span className="text-muted-foreground">
                        Policy: <code>{conflict.policy}</code>
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      Detected {timeAgoShort(conflict.createdAt)}
                    </span>
                  </div>

                  {/* Side by side comparison */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                    <div className="rounded border border-border bg-card p-3 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground font-medium">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> Skout Value
                        </span>
                        {conflict.skoutUpdatedAt && (
                          <span>{timeAgoShort(conflict.skoutUpdatedAt)}</span>
                        )}
                      </div>
                      <div className="font-mono text-sm bg-muted/40 p-2 rounded break-all">
                        {conflict.skoutValue || <em className="text-muted-foreground">&lt;empty&gt;</em>}
                      </div>
                    </div>

                    <div className="rounded border border-border bg-card p-3 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground font-medium">
                        <span className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> External Value
                        </span>
                        {conflict.externalUpdatedAt && (
                          <span>{timeAgoShort(conflict.externalUpdatedAt)}</span>
                        )}
                      </div>
                      <div className="font-mono text-sm bg-muted/40 p-2 rounded break-all">
                        {conflict.externalValue || <em className="text-muted-foreground">&lt;empty&gt;</em>}
                      </div>
                    </div>
                  </div>

                  {/* Custom Override Form */}
                  {isSelectedCustom && (
                    <div className="flex items-center gap-2 pt-2">
                      <Input
                        placeholder="Enter custom value…"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button
                        size="sm"
                        disabled={!customValue.trim() || resolveMutation.isPending}
                        onClick={() => {
                          setResolvingId(conflict.id);
                          resolveMutation.mutate({
                            id: conflict.id,
                            choice: "custom",
                            customValue: customValue.trim(),
                          });
                        }}
                      >
                        Apply Override
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCustomConflictId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Actions for pending conflicts */}
                  {isPending && !isSelectedCustom && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolvingId === conflict.id}
                        onClick={() => {
                          setResolvingId(conflict.id);
                          resolveMutation.mutate({ id: conflict.id, choice: "skout" });
                        }}
                      >
                        Keep Skout
                      </Button>

                      <Button
                        size="sm"
                        variant="default"
                        disabled={resolvingId === conflict.id}
                        onClick={() => {
                          setResolvingId(conflict.id);
                          resolveMutation.mutate({ id: conflict.id, choice: "external" });
                        }}
                      >
                        Use External
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolvingId === conflict.id}
                        onClick={() => {
                          setCustomConflictId(conflict.id);
                          setCustomValue(conflict.skoutValue || conflict.externalValue || "");
                        }}
                      >
                        <Edit3 className="mr-1 h-3 w-3" />
                        Custom
                      </Button>
                    </div>
                  )}

                  {/* Resolved resolution info */}
                  {!isPending && conflict.resolvedValue && (
                    <div className="text-xs text-muted-foreground">
                      Resolved with: <code className="bg-muted px-1 rounded">{conflict.resolvedValue}</code>
                      {conflict.resolvedAt && ` · ${timeAgoShort(conflict.resolvedAt)}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
