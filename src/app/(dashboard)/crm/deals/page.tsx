"use client";

import { useState } from "react";
import { CopsDealsTable } from "@/components/crm/cops-deals-table";
import { CrmQuickCreate } from "@/components/crm/crm-quick-create";
import { DealsBoard } from "@/components/crm/deals-board";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/utils";

export default function DealsPage() {
  // COPS-02: the Deals screen has kanban and table modes.
  const [view, setView] = useState<"board" | "table">("board");
  return (
    <PageShell width="full" data-testid="page-crm-deals">
      <PageHeader
        title="Deals"
        description={view === "board" ? "Drag a card to move it to a different stage." : "Filter, save views and reassign deals in bulk."}
        actions={<CrmQuickCreate />}
      />
      <div className="flex w-fit gap-1 rounded-lg border bg-muted/30 p-1" role="tablist" aria-label="Deals view">
        {(["board", "table"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v}
          </button>
        ))}
      </div>
      {view === "board" ? <DealsBoard /> : <CopsDealsTable />}
    </PageShell>
  );
}
