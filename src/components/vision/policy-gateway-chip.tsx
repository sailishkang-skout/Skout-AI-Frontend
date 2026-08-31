"use client";

import { Badge } from "@/components/ui/badge";
import type { AutomationMode } from "@/lib/dexter-platform";

const MODE_LABEL: Record<AutomationMode, string> = {
  ask: "Ask",
  auto: "Auto",
  draft: "Draft",
  approve: "Approve",
};

const MODE_TONE: Record<AutomationMode, "info" | "success" | "warning" | "danger"> = {
  ask: "info",
  auto: "success",
  draft: "warning",
  approve: "danger",
};

type BadgeTone = "default" | "success" | "warning" | "danger" | "info" | "muted";

export function PolicyGatewayChip({
  actionKey,
  mode,
  loading,
}: {
  actionKey?: string;
  mode?: AutomationMode | string;
  loading?: boolean;
}) {
  const normalized = (mode ?? "ask") as AutomationMode;
  const label = MODE_LABEL[normalized] ?? String(mode ?? "Policy");
  const tone: BadgeTone = MODE_TONE[normalized] ?? "muted";

  return (
    <Badge tone={loading ? "muted" : tone} title={actionKey ? `Policy: ${actionKey}` : "Automation policy"}>
      Policy · {loading ? "…" : label}
    </Badge>
  );
}
