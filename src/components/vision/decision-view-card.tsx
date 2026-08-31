"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatQueryError } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";
import { FieldEvidenceBadge } from "@/components/prospects/field-evidence-badge";

export function DecisionViewCard({
  decision,
  entityType,
  entityId,
  compact,
}: {
  decision: Record<string, unknown>;
  entityType?: "contact" | "deal" | "company";
  entityId?: string;
  compact?: boolean;
}) {
  const api = useDexterPlatformApi();
  const qc = useQueryClient();
  const id = String(decision.id ?? "");
  const status = String(decision.status ?? "open");
  const open = status === "open";

  const decide = useMutation({
    mutationFn: (choice: "decided" | "dismissed") => api.decide(id, choice),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["decision-views"] });
      void qc.invalidateQueries({ queryKey: ["vision-decisions"] });
    },
  });

  return (
    <Card className={compact ? "border-dashed" : undefined}>
      <CardContent className={compact ? "space-y-2 p-3" : "space-y-3 p-4"}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{String(decision.title ?? "Decision")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{String(decision.recommendation ?? "")}</p>
          </div>
          <Badge tone={open ? "warning" : "success"}>{status}</Badge>
        </div>

        {entityType === "contact" && entityId && (
          <p className="text-xs text-muted-foreground">
            Evidence
            <FieldEvidenceBadge entityType="prospect" entityId={entityId} attribute="title" />
          </p>
        )}

        {decide.isError && (
          <p className="text-xs text-red-600">{formatQueryError(decide.error, "Decision failed.")}</p>
        )}

        {open && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate("decided")}>
              <CheckSquare className="mr-1 h-3.5 w-3.5" />
              Decide
            </Button>
            <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate("dismissed")}>
              <X className="mr-1 h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
