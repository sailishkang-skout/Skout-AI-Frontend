import { useApiFetch, useApiFetchBlob } from "./api-client";
import { triggerBlobDownload } from "./import-prospects";
import type { ReportCadence, ReportSchedule, ReportSnapshot, RevenueForecast } from "@/types/api";

export const FORECASTS_QUERY_KEY = ["forecasts"] as const;
export const REPORT_SCHEDULES_QUERY_KEY = ["report-schedules"] as const;
export const reportSnapshotsQueryKey = (scheduleId: string) => ["report-schedules", scheduleId, "snapshots"] as const;

export function currentPeriodLabel(): string {
  return new Date().toISOString().slice(0, 7);
}

export function useReportingApi() {
  const fetchApi = useApiFetch();
  const fetchBlob = useApiFetchBlob();

  return {
    getForecast: (periodLabel: string) => fetchApi<RevenueForecast>(`/api/v1/forecasts/${periodLabel}`),
    listForecasts: () => fetchApi<{ data: RevenueForecast[]; total: number }>("/api/v1/forecasts"),
    refreshModel: (periodLabel: string) =>
      fetchApi<RevenueForecast>(`/api/v1/forecasts/${periodLabel}/refresh-model`, { method: "POST" }),
    setManagerAdjustment: (periodLabel: string, amount: number, reason: string) =>
      fetchApi<RevenueForecast>(`/api/v1/forecasts/${periodLabel}/manager-adjustment`, {
        method: "PUT",
        body: JSON.stringify({ amount, reason }),
      }),
    setRepCommitment: (periodLabel: string, amount: number, reason: string) =>
      fetchApi<RevenueForecast>(`/api/v1/forecasts/${periodLabel}/rep-commitment`, {
        method: "PUT",
        body: JSON.stringify({ amount, reason }),
      }),

    listSchedules: () => fetchApi<{ data: ReportSchedule[]; total: number }>("/api/v1/report-schedules"),
    createSchedule: (input: { name: string; cadence: ReportCadence; recipientEmails: string[] }) =>
      fetchApi<ReportSchedule>("/api/v1/report-schedules", { method: "POST", body: JSON.stringify(input) }),
    setScheduleEnabled: (id: string, enabled: boolean) =>
      fetchApi<ReportSchedule>(`/api/v1/report-schedules/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
    deleteSchedule: (id: string) => fetchApi<void>(`/api/v1/report-schedules/${id}`, { method: "DELETE" }),
    deliverNow: (id: string) => fetchApi<unknown>(`/api/v1/report-schedules/${id}/deliver`, { method: "POST" }),
    listSnapshots: (id: string) =>
      fetchApi<{ data: ReportSnapshot[]; total: number }>(`/api/v1/report-schedules/${id}/snapshots`),

    exportSnapshot: async (scheduleId: string, snapshotId: string, version: number, format: "pdf" | "xlsx") => {
      const blob = await fetchBlob(`/api/v1/report-schedules/${scheduleId}/snapshots/${snapshotId}/export?format=${format}`);
      triggerBlobDownload(blob, `board-pack-v${version}.${format}`);
    },
    exportBoardPack: async (format: "pdf" | "xlsx", periodLabel?: string) => {
      const blob = await fetchBlob("/api/v1/board-pack/export", {
        method: "POST",
        body: JSON.stringify({ format, periodLabel }),
      });
      triggerBlobDownload(blob, `board-pack-${periodLabel ?? currentPeriodLabel()}.${format}`);
    },
  };
}
