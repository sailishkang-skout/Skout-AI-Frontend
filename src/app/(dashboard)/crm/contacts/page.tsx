"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Plus, Trash2, Users2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactFormSheet } from "@/components/crm/contact-form-sheet";
import { useContactsApi } from "@/lib/crm/contacts";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useWorkspaceRole, isForbiddenError } from "@/lib/workspace-role";

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const contactsApi = useContactsApi();
  const authReady = useAuthReady();
  const { canDelete } = useWorkspaceRole();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const contacts = useQuery({
    queryKey: ["crm", "contacts"],
    queryFn: () => contactsApi.list({ limit: 100 }),
    enabled: authReady,
  });

  const remove = useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
    },
    onError: (err) => {
      setDeleteError(
        isForbiddenError(err)
          ? "You don't have permission to delete this — ask a workspace admin or owner."
          : formatQueryError(err, "Could not delete this contact.")
      );
    },
  });

  const rows = contacts.data?.data ?? [];

  return (
    <PageShell data-testid="page-crm-contacts">
      <PageHeader
        title="Contacts"
        description="The people you sell to."
        actions={
          <Button data-testid="create-contact-button" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4" />
            New contact
          </Button>
        }
      />

      {contacts.isError && (
        <Alert variant="error" onRetry={() => contacts.refetch()}>
          {formatQueryError(contacts.error, "Could not load contacts.")}
        </Alert>
      )}
      {deleteError && <Alert variant="warning" dismissible>{deleteError}</Alert>}

      {contacts.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <Users2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No contacts yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Add a contact to start tracking your relationships.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link href={`/crm/contacts/${contact.id}`} className="hover:underline">
                    <p className="truncate font-medium">
                      {contact.firstName} {contact.lastName}
                    </p>
                  </Link>
                  {contact.title && <p className="truncate text-xs text-muted-foreground">{contact.title}</p>}
                  {contact.email && <p className="truncate text-xs text-muted-foreground">{contact.email}</p>}
                  <Badge tone="info" className="mt-2">
                    {contact.lifecycleStage.toUpperCase()}
                  </Badge>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(contact.id)}
                    disabled={remove.isPending && remove.variables === contact.id}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    aria-label={`Delete ${contact.firstName}`}
                  >
                    {remove.isPending && remove.variables === contact.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContactFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </PageShell>
  );
}
