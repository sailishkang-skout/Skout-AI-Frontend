"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { fieldErrorsByPath } from "@/lib/cops-error";
import { useCopsBulkReassignApi, useCopsSavedViewsApi, type SavedViewObject } from "@/lib/cops-crm";
import type { WorkspaceMember } from "@/types/api";

/** Readable text for a COPS error: permission, first field error, or the server message. */
export function copsErrorText(err: unknown, fallback: string): string {
  if (err instanceof CopsRequestError && err.envelope) {
    if (err.envelope.code === "FORBIDDEN") return "You don't have permission for this.";
    const first = Object.values(fieldErrorsByPath(err.envelope))[0];
    return first ?? err.envelope.message;
  }
  return fallback;
}

/**
 * Saved views for one CRM object: pick a view, save the current filters (optionally shared with
 * the team), and delete a view you own. Shared by the accounts and opportunities tables.
 */
export function SavedViewPicker({
  object,
  viewId,
  onChange,
  currentFilters,
  sort,
  canSave,
}: {
  object: SavedViewObject;
  viewId: string;
  onChange: (viewId: string) => void;
  currentFilters: Record<string, unknown>;
  sort?: string;
  canSave: boolean;
}) {
  const api = useCopsSavedViewsApi(object);
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const key = ["cops-saved-views", object];

  const views = useQuery({ queryKey: key, queryFn: () => api.list(), enabled: authReady });
  const save = useMutation({
    mutationFn: () => api.save({ name: name.trim(), filters: currentFilters, sort, shared }),
    onSuccess: (res) => {
      setSaving(false);
      setName("");
      queryClient.invalidateQueries({ queryKey: key });
      onChange(res.data.id);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => {
      onChange("");
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const current = views.data?.data.find((v) => v.id === viewId);

  return (
    <>
      <Select aria-label="Saved view" value={viewId} onChange={(e) => onChange(e.target.value)} className="h-9 w-52">
        <option value="">All records</option>
        {(views.data?.data ?? []).map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
            {v.shared ? " (shared)" : ""}
          </option>
        ))}
      </Select>
      {current?.mine && (
        <Button variant="ghost" size="sm" onClick={() => remove.mutate(current.id)} disabled={remove.isPending}>
          Delete view
        </Button>
      )}
      {!saving ? (
        <Button variant="outline" size="sm" onClick={() => setSaving(true)} disabled={!canSave}>
          Save view
        </Button>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name"
            aria-label="View name"
            className="h-9 w-40 rounded-md border bg-background px-3 text-sm"
            autoFocus
          />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            Share with team
          </label>
          <Button size="sm" type="submit" disabled={!name.trim() || save.isPending}>
            Save
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setSaving(false)}>
            Cancel
          </Button>
        </form>
      )}
      {save.isError && <Alert variant="error">{copsErrorText(save.error, "Could not save this view.")}</Alert>}
    </>
  );
}

/** Bulk "Assign owner" bar with a required reason, for accounts or opportunities. */
export function BulkOwnerBar({
  object,
  selectedIds,
  members,
  onDone,
  invalidateKey,
}: {
  object: "accounts" | "opportunities";
  selectedIds: string[];
  members: WorkspaceMember[];
  onDone: () => void;
  invalidateKey: readonly unknown[];
}) {
  const reassign = useCopsBulkReassignApi(object);
  const queryClient = useQueryClient();
  const [ownerId, setOwnerId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const noun = object === "accounts" ? "account" : "opportunity";
  const nameOf = (id: string) => {
    const m = members.find((x) => x.userId === id);
    return m ? m.fullName || m.email : "the new owner";
  };

  const bulk = useMutation({
    mutationFn: () => reassign(selectedIds, ownerId, reason.trim()),
    onSuccess: (res) => {
      const { updated, skipped_ids } = res.data;
      const plural = updated === 1 ? noun : object === "accounts" ? "accounts" : "opportunities";
      setMessage({ ok: true, text: `Reassigned ${updated} ${plural} to ${nameOf(ownerId)}.${skipped_ids.length ? ` ${skipped_ids.length} skipped.` : ""}` });
      setReason("");
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      onDone();
    },
    onError: (err) => setMessage({ ok: false, text: copsErrorText(err, `Could not reassign these ${object}.`) }),
  });

  return (
    <>
      {selectedIds.length > 0 && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm"
          data-testid="bulk-reassign-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            bulk.mutate();
          }}
        >
          <span className="font-medium">{selectedIds.length} selected</span>
          <Select aria-label="New owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="h-8 w-48">
            <option value="">Assign owner…</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName || m.email}
              </option>
            ))}
          </Select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            aria-label="Reason"
            className="h-8 w-56 rounded-md border bg-background px-2 text-sm"
          />
          <Button size="sm" type="submit" disabled={!ownerId || !reason.trim() || bulk.isPending}>
            {bulk.isPending ? "Assigning…" : "Assign"}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={onDone}>
            Clear
          </Button>
        </form>
      )}
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}
    </>
  );
}
