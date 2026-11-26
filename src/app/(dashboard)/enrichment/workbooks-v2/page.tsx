"use client";

import Link from "next/link";
import { Table2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RUN_ACCESS_MESSAGE, useWorkbookPermissions } from "@/lib/workbook-permissions";

/**
 * Entry point for Workbooks V2 (WB2-002). The route is only reachable when the workspace has the
 * WORKBOOKS_V2 switch on: AccessGate (in the dashboard shell) shows "not on your plan" otherwise, and the
 * API refuses /workbooks-v2 for workspaces without it. The workbook grid itself is built in later tickets.
 */
export default function WorkbooksV2Page() {
  const { canRun, known } = useWorkbookPermissions();
  return (
    <PageShell width="narrow">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Workbooks V2 <Badge tone="info">Beta</Badge>
          </span>
        }
        description="The new live-spreadsheet workbook, with one column per enrichment step. It is being rolled out workspace by workspace."
      />
      {known && !canRun ? <Alert variant="default">{RUN_ACCESS_MESSAGE}</Alert> : null}
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <Table2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Your workspace has early access to Workbooks V2.</p>
            <p className="text-muted-foreground">
              The new workbook is still being built, so there is nothing to open here yet. Your existing workbooks are
              unchanged and keep working.
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
