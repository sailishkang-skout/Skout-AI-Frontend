"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthReady } from "@/lib/api-client";
import { trackCops } from "@/lib/cops-analytics";
import { useCopsAccountApi, useCopsAccountListApi, type MergeConflict } from "@/lib/cops-crm";
import { CopsRequestError } from "@/lib/cops-fetch";

const show = (v: unknown) => (v == null || v === "" ? "—" : String(v));

/**
 * COPS-02 account merge (Bible p.20): merge a duplicate into this account. The server first reports
 * conflicting fields; the survivor (this account) keeps its values, the duplicate fills only its
 * empty fields, and every reference, external id and timeline event moves to the survivor.
 */
export function AccountMergeDialog({ open, onClose, survivorId, survivorName }: { open: boolean; onClose: () => void; survivorId: string; survivorName: string }) {
  const api = useCopsAccountApi();
  const list = useCopsAccountListApi();
  const authReady = useAuthReady();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [conflicts, setConflicts] = useState<MergeConflict[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useQuery({
    queryKey: ["cops-merge-search", q],
    queryFn: () => list.list({ q, limit: 8 }),
    enabled: authReady && open && q.trim().length >= 2 && !duplicate,
  });
  const candidates = (search.data?.data ?? []).filter((a) => a.id !== survivorId);

  const merge = useMutation({
    mutationFn: (confirm: boolean) => api.mergeAccounts({ survivor_id: survivorId, duplicate_id: duplicate!.id, reason: reason.trim(), confirm }),
    onSuccess: (res) => {
      if (res.data.status === "review_required") {
        setConflicts(res.data.conflicts);
        return;
      }
      trackCops("cops.accounts_merged", { conflict_count: res.data.conflicts_resolved_to_survivor.length });
      onClose();
      router.refresh();
    },
    onError: (e) => setError(e instanceof CopsRequestError ? e.message : "Could not merge the accounts."),
  });

  const reset = () => {
    setDuplicate(null);
    setConflicts(null);
    setError(null);
  };
  const canSubmit = Boolean(duplicate) && reason.trim().length >= 8 && !merge.isPending;

  return (
    <Dialog open={open} onClose={onClose} title={`Merge a duplicate into ${survivorName}`} description={`${survivorName} is kept. The duplicate's contacts, deals, tickets, timeline and external CRM links move here, and the duplicate is removed.`}>
      <div className="space-y-3" data-testid="account-merge-dialog">
        {!duplicate ? (
          <div className="space-y-2">
            <Input aria-label="Find the duplicate account" placeholder="Search accounts by name or domain" value={q} onChange={(e) => setQ(e.target.value)} />
            {search.isError && <Alert variant="error">Could not search accounts.</Alert>}
            <ul className="max-h-48 space-y-1 overflow-auto">
              {candidates.map((a) => (
                <li key={a.id}>
                  <button type="button" className="w-full rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setDuplicate({ id: a.id, name: a.name })} data-testid="merge-candidate">
                    {a.name}
                  </button>
                </li>
              ))}
              {q.trim().length >= 2 && search.isSuccess && candidates.length === 0 && <li className="text-xs text-muted-foreground">No other account matches.</li>}
            </ul>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
            <span>
              Duplicate: <strong>{duplicate.name}</strong>
            </span>
            <button type="button" className="text-xs text-primary hover:underline" onClick={reset}>
              Change
            </button>
          </div>
        )}

        <textarea
          aria-label="Why merge"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why these are the same account (at least 8 characters)"
          maxLength={500}
          className="w-full rounded-md border bg-background px-2 py-1 text-sm"
        />

        {conflicts && (
          <div className="space-y-1" data-testid="merge-conflicts">
            <p className="text-sm font-medium">These fields differ. {survivorName} keeps its value:</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1">Field</th>
                  <th>Kept</th>
                  <th>Duplicate</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c) => (
                  <tr key={c.field} className="border-t">
                    <td className="py-1">{c.field.replace(/_/g, " ")}</td>
                    <td>{show(c.survivor_value)}</td>
                    <td className="text-muted-foreground">{show(c.duplicate_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => merge.mutate(Boolean(conflicts))} data-testid="merge-submit">
            {merge.isPending ? "Merging…" : conflicts ? "Merge, keeping this account's values" : "Merge"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
