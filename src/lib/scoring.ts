import type { IcpConfig } from "@/types/api";

export function isIcpConfigured(config: IcpConfig | null | undefined): boolean {
  if (!config) return false;
  return Boolean(
    config.industries?.length ||
      config.countries?.length ||
      config.seniorities?.length ||
      config.minEmployees != null ||
      config.maxEmployees != null
  );
}

export function scoreBandLabel(score: number): "High" | "Medium" | "Low" {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export function scoreBandTone(score: number): "success" | "warning" | "muted" {
  if (score >= 75) return "success";
  if (score >= 45) return "warning";
  return "muted";
}
