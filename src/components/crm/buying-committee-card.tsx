"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "./form-field";
import { useBuyingCommitteeApi } from "@/lib/crm/buying-committee";
import { useContactsApi } from "@/lib/crm/contacts";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { isForbiddenError } from "@/lib/workspace-role";
import { COMMITTEE_ROLE_LABEL, COMMITTEE_ROLE_TONE } from "@/lib/crm-display";
import type { CommitteeMember, CommitteeMemberRole } from "@/types/crm";

const ROLE_OPTIONS: CommitteeMemberRole[] = [
  "economic_buyer",
  "champion",
  "influencer",
  "blocker",
  "user",
  "unknown",
];

/** One committee-member row. Fetches its own contact record (like `EntityPreview` on the
 * identity-merge review page) rather than requiring the parent to have every contact
 * preloaded — the committee's contacts don't necessarily overlap with any other list
 * already in the query cache. */
function MemberRow({
  member,
  onEdit,
  onRemove,
  removing,
}: {
  member: CommitteeMember;
  onEdit: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const contactsApi = useContactsApi();
  const authReady = useAuthReady();
  const contact = useQuery({
    queryKey: ["crm", "contacts", member.contactId],
    queryFn: () => contactsApi.get(member.contactId),
    enabled: authReady,
  });

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        {contact.isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : contact.isError ? (
          <p className="text-sm text-muted-foreground">Contact unavailable</p>
        ) : (
          <p className="truncate text-sm font-medium">
            {contact.data?.firstName} {contact.data?.lastName}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={COMMITTEE_ROLE_TONE[member.role]}>{COMMITTEE_ROLE_LABEL[member.role]}</Badge>
          <span className="text-xs text-muted-foreground">Influence {member.influence}/5</span>
        </div>
        {member.notes && <p className="mt-1 truncate text-xs text-muted-foreground">{member.notes}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit member">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} disabled={removing} aria-label="Remove member">
          {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </li>
  );
}

/** §8.12 CRM Intelligence — deal-scoped BuyingCommittee. Lists members, and lets a rep
 * add/edit/remove them. "Edit" reuses the add endpoint (it's an upsert on the backend keyed
 * by committeeId+contactId), so there's only ever one save path here. */
export function BuyingCommitteeCard({ dealId, companyId }: { dealId: string; companyId: string | null }) {
  const queryClient = useQueryClient();
  const api = useBuyingCommitteeApi();
  const contactsApi = useContactsApi();
  const authReady = useAuthReady();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommitteeMember | null>(null);
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState<CommitteeMemberRole>("unknown");
  const [influence, setInfluence] = useState(3);
  const [notes, setNotes] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["crm", "buying-committee", dealId],
    queryFn: () => api.listForDeal(dealId),
    enabled: authReady && Boolean(dealId),
  });
  const members = membersQuery.data?.members ?? [];

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", { companyId, forCommittee: true }],
    queryFn: () => contactsApi.list(companyId ? { companyId, limit: 200 } : { limit: 200 }),
    enabled: dialogOpen && authReady,
  });

  useEffect(() => {
    if (!dialogOpen) return;
    setContactId(editing?.contactId ?? "");
    setRole(editing?.role ?? "unknown");
    setInfluence(editing?.influence ?? 3);
    setNotes(editing?.notes ?? "");
  }, [dialogOpen, editing]);

  const existingContactIds = new Set(members.map((m) => m.contactId));

  const save = useMutation({
    mutationFn: () => api.addMember(dealId, { contactId, role, influence, notes: notes.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "buying-committee", dealId] });
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (memberId: string) => api.removeMember(memberId),
    onMutate: (memberId) => {
      setRemoveError(null);
      setRemovingId(memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "buying-committee", dealId] });
    },
    onError: (err) => {
      setRemoveError(
        isForbiddenError(err)
          ? "You don't have permission to remove committee members."
          : formatQueryError(err, "Could not remove this member.")
      );
    },
    onSettled: () => setRemovingId(null),
  });

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(member: CommitteeMember) {
    setEditing(member);
    setDialogOpen(true);
  }

  const pickableContacts = (contactsQuery.data?.data ?? []).filter(
    (c) => editing !== null || !existingContactIds.has(c.id)
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold">Buying committee</CardTitle>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add member
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {removeError && (
          <Alert variant="warning" dismissible>
            {removeError}
          </Alert>
        )}

        {membersQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : membersQuery.isError ? (
          <Alert variant="error" onRetry={() => membersQuery.refetch()}>
            {formatQueryError(membersQuery.error, "Could not load the buying committee.")}
          </Alert>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No committee members yet — add the people involved in this deal.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                onEdit={() => openEdit(member)}
                onRemove={() => remove.mutate(member.id)}
                removing={removingId === member.id && remove.isPending}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit committee member" : "Add committee member"}
      >
        <div className="space-y-4">
          {save.isError && (
            <Alert variant="error">
              {isForbiddenError(save.error)
                ? "You don't have permission to manage this deal's buying committee."
                : formatQueryError(save.error, "Could not save this committee member.")}
            </Alert>
          )}

          <Field label="Contact" required>
            {editing ? (
              <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Contact can&apos;t be changed once added — remove and re-add to assign a different person.
              </p>
            ) : (
              <>
                <Select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={contactsQuery.isLoading}>
                  <option value="">Select a contact…</option>
                  {pickableContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName ?? ""}
                    </option>
                  ))}
                </Select>
                {!companyId && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    This deal has no linked company yet, so this lists contacts workspace-wide.
                  </p>
                )}
              </>
            )}
          </Field>

          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as CommitteeMemberRole)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {COMMITTEE_ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Influence (1 low – 5 high)">
            <Select value={String(influence)} onChange={(e) => setInfluence(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={!contactId || save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add member"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
