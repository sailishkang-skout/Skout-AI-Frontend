"use client";

import { DealsBoard } from "@/components/crm/deals-board";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function DealsPage() {
  return (
    <PageShell width="full" data-testid="page-crm-deals">
      <PageHeader title="Deals" description="Drag a card to move it to a different stage." />
      <DealsBoard />
    </PageShell>
  );
}
