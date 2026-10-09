"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { cn } from "@/lib/utils";
import { COMMERCIAL_POLL_MS, humanize, statusTone, useCopsCommercialApi, useMyPermissions } from "@/lib/cops-commercial";
import { CommercialDesk } from "./commercial-desk";

/**
 * Customer 360 Commercial (and Documents) tab. Polls the account's commercial summary so proposal,
 * MSA, payment and gate status change on screen without a refresh (COPS-03 acceptance).
 */
export function CopsCommercialTab({ accountId, mode = "commercial" }: { accountId: string; mode?: "commercial" | "documents" }) {
  const api = useCopsCommercialApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const [selected, setSelected] = useState<string | null>(null);
  const queryKey = ["cops-commercial", accountId];

  const view = useQuery({
    queryKey,
    queryFn: () => api.accountCommercial(accountId),
    enabled: authReady && Boolean(accountId),
    refetchInterval: (query) =>
      query.state.error instanceof CopsRequestError && query.state.error.envelope?.code === "FORBIDDEN" ? false : COMMERCIAL_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["cops-360", accountId] });
  };

  if (view.isLoading) return <Skeleton className="h-40 w-full rounded-md" />;
  if (view.isError) {
    const forbidden = view.error instanceof CopsRequestError && view.error.envelope?.code === "FORBIDDEN";
    return (
      <Alert variant={forbidden ? "default" : "error"} data-testid="commercial-error">
        {forbidden ? "Commercial details are visible to roles with commercial access." : "Could not load commercial details."}
      </Alert>
    );
  }

  const summaries = view.data?.data ?? [];
  if (summaries.length === 0) {
    // Bible Appendix G: no opportunities -> create/import the first one.
    return (
      <div className="rounded-md border border-dashed p-8 text-center" data-testid="commercial-empty">
        <p className="text-sm font-medium">No open opportunities on this account</p>
        <Link href="/crm/deals" className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
          Create or import the first opportunity
        </Link>
      </div>
    );
  }

  const current = summaries.find((s) => s.opportunity.id === selected) ?? summaries[0];

  return (
    <div className="space-y-4" data-testid={`commercial-tab-${mode}`}>
      {summaries.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Opportunities">
          {summaries.map((s) => (
            <button
              key={s.opportunity.id}
              type="button"
              role="tab"
              aria-selected={s.opportunity.id === current.opportunity.id}
              onClick={() => setSelected(s.opportunity.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm",
                s.opportunity.id === current.opportunity.id ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent"
              )}
            >
              {s.opportunity.name}
              <Badge tone={statusTone(s.opportunity.commercial_state ?? "draft")} className="capitalize">
                {s.opportunity.commercial_state ? humanize(s.opportunity.commercial_state) : "not started"}
              </Badge>
            </button>
          ))}
        </div>
      )}
      <CommercialDesk summary={current} permissions={permissions} onChanged={refresh} documentsOnly={mode === "documents"} />
      <p className="text-right text-xs text-muted-foreground" aria-live="polite">
        Updates automatically{view.isFetching ? " · refreshing…" : ""}
      </p>
    </div>
  );
}
