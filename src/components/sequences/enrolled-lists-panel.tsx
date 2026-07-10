"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ListChecks, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { Alert } from "@/components/ui/alert";
import { useSequencesApi } from "@/lib/sequences";
import { sequenceStatusTone } from "@/lib/sequences";

export function EnrolledListsPanel({ sequenceId }: { sequenceId: string }) {
  const authReady = useAuthReady();
  const sequencesApi = useSequencesApi();

  const query = useQuery({
    queryKey: ["sequences", sequenceId, "lists"],
    queryFn: () => sequencesApi.listEnrolledLists(sequenceId),
    enabled: authReady && Boolean(sequenceId),
  });

  const rows = query.data?.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          Enrolled lists
        </CardTitle>
        <CardDescription>
          Lists whose prospects are running through this sequence.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {query.isLoading && (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {query.error && (
          <div className="p-4">
            <Alert variant="error">{formatQueryError(query.error, "Could not load lists.")}</Alert>
          </div>
        )}

        {!query.isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <ListChecks className="h-6 w-6" />
            No lists enrolled yet. Go to the <strong>Enroll</strong> tab to enroll a list.
          </div>
        )}

        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">List</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
                <th className="px-4 py-2.5 font-medium text-right">Active</th>
                <th className="px-4 py-2.5 font-medium text-right">Done</th>
                <th className="px-4 py-2.5 font-medium">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.listId} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/lists/${row.listId}`}
                      className="flex items-center gap-1.5 font-medium text-foreground hover:underline"
                    >
                      {row.listName}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    <span className="flex items-center justify-end gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {row.total}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.active > 0 ? (
                      <Badge tone="info">{row.active}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.completed > 0 ? (
                      <Badge tone="success">{row.completed}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(row.enrolledAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
