"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useModelPerformanceApi } from "@/lib/enterprise-control-plane";
import { useWorkspaceRole } from "@/lib/workspace-role";

/** §8.15 — Model/prompt performance tracking UI. */
export default function ModelPerformancePage() {
  const authReady = useAuthReady();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const api = useModelPerformanceApi();

  const report = useQuery({
    queryKey: ["model-performance"],
    queryFn: api.getReport,
    enabled: authReady && isAdmin,
  });

  if (!isAdmin) {
    return (
      <PageShell>
        <Alert variant="error">Model performance requires owner or admin role.</Alert>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title="Model performance"
        description="Precision, calibration, override rate, and downstream outcome metrics for AI models in this workspace."
      />

      {report.isError && (
        <Alert variant="error">{formatQueryError(report.error, "Could not load model performance report.")}</Alert>
      )}

      {report.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(report.data ?? {}).map(([section, value]) => (
            <Card key={section}>
              <CardHeader>
                <CardTitle className="text-base capitalize">{section.replace(/_/g, " ")}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted/30 p-3 text-xs">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
