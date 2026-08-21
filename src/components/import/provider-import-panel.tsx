"use client";

/** R22.2 — generic GTM-provider import UI (HubSpot, Apollo). Same three-step flow regardless of
 * provider: pick a source list → optionally preview → commit into a Skout list. Adding a third
 * provider server-side needs no change here beyond a new entry in IMPORT_PROVIDERS. */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { useImportAdaptersApi } from "@/lib/import-adapters";
import type { ImportProvider } from "@/types/api";

const PREVIEW_LIMIT = 25;
const MAX_CONTACTS = 500;

export function ProviderImportPanel({ provider, description }: { provider: ImportProvider; description: string }) {
  const authReady = useAuthReady();
  const adapters = useImportAdaptersApi();
  const enrichmentApi = useEnrichmentApi();
  const queryClient = useQueryClient();

  const [sourceListId, setSourceListId] = useState("");
  const [destListId, setDestListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const providerLists = useQuery({
    queryKey: ["import-provider-lists", provider],
    queryFn: () => adapters.listLists(provider),
    enabled: authReady,
    retry: false,
  });

  const skoutLists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const preview = useQuery({
    queryKey: ["import-provider-contacts", provider, sourceListId],
    queryFn: () => adapters.listContacts(provider, { listId: sourceListId || undefined, maxContacts: PREVIEW_LIMIT }),
    enabled: authReady && previewOpen,
    retry: false,
  });

  const commit = useMutation({
    mutationFn: () =>
      adapters.commit(provider, {
        sourceListId: sourceListId || undefined,
        listId: destListId || undefined,
        newListName: !destListId && newListName.trim() ? newListName.trim() : undefined,
        maxContacts: MAX_CONTACTS,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
  });

  const canCommit = Boolean(destListId || newListName.trim()) && !commit.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import from {provider === "hubspot" ? "HubSpot" : "Apollo"}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {providerLists.isError && (
          <Alert variant="error">
            {formatQueryError(
              providerLists.error,
              `Could not reach ${provider}. Connect it in Settings → Integrations first.`
            )}
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Source list</label>
          <Select
            value={sourceListId}
            onChange={(e) => {
              setSourceListId(e.target.value);
              setPreviewOpen(false);
            }}
            disabled={providerLists.isLoading || providerLists.isError}
          >
            <option value="">
              {providerLists.isLoading ? "Loading lists…" : "All contacts (no list filter)"}
            </option>
            {(providerLists.data?.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.count})
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Destination Skout list</label>
            <Select value={destListId} onChange={(e) => setDestListId(e.target.value)}>
              <option value="">— None / new list —</option>
              {(skoutLists.data?.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.prospectCount})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Or new list name</label>
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={`${provider === "hubspot" ? "HubSpot" : "Apollo"} import`}
              disabled={Boolean(destListId)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={providerLists.isError}>
            Preview contacts
          </Button>
          <Button onClick={() => commit.mutate()} disabled={!canCommit}>
            {commit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Import into Skout
          </Button>
          <span className="text-xs text-muted-foreground">Up to {MAX_CONTACTS} contacts per import.</span>
        </div>

        {previewOpen && (
          <div className="rounded-md border">
            {preview.isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading preview…</p>
            ) : preview.isError ? (
              <p className="p-3 text-sm text-muted-foreground">
                {formatQueryError(preview.error, "Could not load contacts.")}
              </p>
            ) : (preview.data?.data.length ?? 0) === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No contacts found for this selection.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.data?.data ?? []).map((c, idx) => (
                      <tr key={`${c.email ?? c.companyDomain}-${idx}`} className="border-b last:border-0">
                        <td className="px-3 py-2">{c.fullName ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.companyName ?? c.companyDomain}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.title ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-muted-foreground">Showing first {PREVIEW_LIMIT} contacts.</p>
              </div>
            )}
          </div>
        )}

        {commit.isError && (
          <Alert variant="error">{formatQueryError(commit.error, "Import failed.")}</Alert>
        )}
        {commit.data && (
          <Alert variant="success">
            Imported {commit.data.data.imported} contact{commit.data.data.imported === 1 ? "" : "s"} into “
            {commit.data.data.listName}”
            {commit.data.data.skipped > 0 ? ` (${commit.data.data.skipped} skipped)` : ""}.{" "}
            <Link href={`/lists/${commit.data.data.listId}`} className="font-medium underline">
              Open list
            </Link>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
