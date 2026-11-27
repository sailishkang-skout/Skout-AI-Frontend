"use client";

import Link from "next/link";
import { useState } from "react";
import { Table2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AddProspects } from "@/components/workbooks-v2/add-prospects";
import { CrmImport } from "@/components/workbooks-v2/crm-import";
import { CsvImport } from "@/components/workbooks-v2/csv-import";
import { WebhookCard } from "@/components/workbooks-v2/webhook-card";
import { WorkbookGrid } from "@/components/workbooks-v2/workbook-grid";
import { RUN_ACCESS_MESSAGE, useWorkbookPermissions } from "@/lib/workbook-permissions";

/**
 * Entry point for Workbooks V2 (WB2-002). The route is only reachable when the workspace has the
 * WORKBOOKS_V2 switch on: AccessGate (in the dashboard shell) shows "not on your plan" otherwise, and the
 * API refuses /workbooks-v2 for workspaces without it. CSV import (WB2-020), adding Skout prospects (WB2-021), CRM
 * import (WB2-023), a first grid for looking at, typing and pasting rows (WB2-022) and the workbook's inbound webhook
 * (WB2-026) live here; the full grid is built in WB2-071.
 */
export default function WorkbooksV2Page() {
  const { canEdit, canRun, known } = useWorkbookPermissions();
  const [workbook, setWorkbook] = useState<{ id: string; name: string } | null>(null);
  return (
    <PageShell>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Workbooks V2 <Badge tone="info">Beta</Badge>
          </span>
        }
        description="The new live-spreadsheet workbook, with one column per enrichment step. It is being rolled out workspace by workspace."
      />
      {known && !canRun ? <Alert variant="default">{RUN_ACCESS_MESSAGE}</Alert> : null}
      {known ? <CsvImport canEdit={canEdit} onWorkbook={setWorkbook} /> : null}
      {known && canEdit && workbook ? <AddProspects workbook={workbook} /> : null}
      {known && canEdit && workbook ? <CrmImport key={workbook.id} workbook={workbook} /> : null}
      {known && workbook ? <WorkbookGrid workbook={workbook} canEdit={canEdit} /> : null}
      {known && workbook ? <WebhookCard key={`webhook-${workbook.id}`} workbook={workbook} canEdit={canEdit} /> : null}
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <Table2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Your workspace has early access to Workbooks V2.</p>
            <p className="text-muted-foreground">
              The new workbook is still being built: you can add rows, type and paste, but you can&apos;t sort, filter,
              undo or run columns yet. Your existing workbooks are unchanged and keep working.
            </p>
            <Link href="/enrichment/workbooks" className="font-medium text-primary underline-offset-4 hover:underline">
              Go to your workbooks
            </Link>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
