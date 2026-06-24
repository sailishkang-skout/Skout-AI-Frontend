import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import type { AnalyticsReport } from "@/types/api";

export const ANALYTICS_REPORT_KEY = ["analytics", "report"] as const;

export function useAnalyticsApi() {
  const fetchApi = useApiFetch();
  return {
    getReport: (days = 30) =>
      fetchApi<{ data: AnalyticsReport }>(`/api/v1/analytics/report?days=${days}`, {
        workspaceId: WORKSPACE_ID,
      }),
  };
}

const ACTION_LABELS: Record<string, string> = {
  enrichment: "Enrichment",
  search: "Prospect search",
  ai_score: "ICP scoring",
  export_hubspot: "HubSpot export",
  admin_topup: "Credit top-up",
  razorpay_purchase: "Razorpay purchase",
  provision: "Initial credits",
};

export function formatCreditAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function downloadAnalyticsCsv(report: AnalyticsReport) {
  const lines = [
    "Skout AI — Usage report",
    `Workspace,${report.workspaceName}`,
    `Period,${report.period.days} days`,
    `From,${report.period.from}`,
    `To,${report.period.to}`,
    "",
    "Summary",
    `Credits balance,${report.credits.balance}`,
    `Credits spent,${report.credits.spent}`,
    `Credits added,${report.credits.added}`,
    `Enrichment jobs,${report.enrichment.totalJobs}`,
    `Enrichment success rate,${report.enrichment.successRate}%`,
    `Lists,${report.lists.count}`,
    `Prospects in lists,${report.lists.totalProspects}`,
    "",
    "Credits by action",
    "Action,Credits",
    ...report.credits.byAction.map((r) => `${formatCreditAction(r.action)},${r.credits}`),
    "",
    "Daily credit activity",
    "Date,Spent,Added",
    ...report.credits.daily.map((d) => `${d.date},${d.spent},${d.added}`),
    "",
    "Daily enrichment",
    "Date,Jobs,Completed",
    ...report.enrichment.daily.map((d) => `${d.date},${d.jobs},${d.completed}`),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `skout-analytics-${report.period.days}d-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
