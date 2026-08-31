"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatQueryError } from "@/lib/api-client";
import { useIntegrationsApi } from "@/lib/integrations";

/** R22.3 — import Apollo sequences as draft Skout sequences (also surfaced on Import page). */
export function ApolloSequenceImporter({ compact = false }: { compact?: boolean }) {
  const api = useIntegrationsApi();
  const queryClient = useQueryClient();
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const sequences = useQuery({
    queryKey: ["integrations", "apollo", "sequences"],
    queryFn: api.listApolloSequences,
  });

  const importOne = useMutation({
    mutationFn: (id: string) => api.importApolloSequence(id),
    onSuccess: (_res, id) => {
      setImportedIds((prev) => new Set(prev).add(id));
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
  });

  return (
    <div className={compact ? "space-y-3" : "space-y-3 border-t border-border pt-4"}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Import sequences from Apollo</h3>
          {!compact && (
            <p className="text-xs text-muted-foreground">
              Optional — migrate cadences as draft sequences for review before activation.
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" disabled={sequences.isFetching} onClick={() => sequences.refetch()}>
          {sequences.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {sequences.data ? "Refresh" : "Browse sequences"}
        </Button>
      </div>

      {sequences.isError && (
        <Alert variant="error">{formatQueryError(sequences.error, "Could not load Apollo sequences.")}</Alert>
      )}
      {importOne.isError && (
        <Alert variant="error">{formatQueryError(importOne.error, "Could not import this sequence.")}</Alert>
      )}

      {sequences.data &&
        (sequences.data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No email sequences found in this Apollo account.</p>
        ) : (
          <div className="divide-y rounded-md border border-border">
            {sequences.data.data.map((seq) => {
              const imported = importedIds.has(seq.id);
              return (
                <div key={seq.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{seq.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {seq.numSteps} step{seq.numSteps === 1 ? "" : "s"} · {seq.active ? "active" : "inactive"} in Apollo
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={imported || (importOne.isPending && importOne.variables === seq.id)}
                    onClick={() => importOne.mutate(seq.id)}
                  >
                    {importOne.isPending && importOne.variables === seq.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {imported ? "Imported" : "Import as draft"}
                  </Button>
                </div>
              );
            })}
          </div>
        ))}

      <p className="text-xs text-muted-foreground">
        Imported sequences land as drafts in{" "}
        <Link href="/sequences" className="font-medium underline underline-offset-2">
          Sequences
        </Link>{" "}
        — review steps before activating. Non-email steps import as manual task steps when Apollo&apos;s step type
        can&apos;t be mapped directly.
      </p>
    </div>
  );
}
