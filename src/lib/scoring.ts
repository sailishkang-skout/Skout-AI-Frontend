import type { IcpConfig } from "@/types/api";

export function isIcpConfigured(config: IcpConfig | null | undefined): boolean {
  if (!config) return false;
  return Boolean(
    config.industries?.length ||
      config.countries?.length ||
      config.seniorities?.length ||
      config.titles?.length ||
      config.keywords?.length ||
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

export function scoreBandColor(score: number) {
  if (score >= 75)
    return {
      ring: "stroke-emerald-500",
      track: "stroke-emerald-100 dark:stroke-emerald-950",
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    };
  if (score >= 45)
    return {
      ring: "stroke-amber-400",
      track: "stroke-amber-100 dark:stroke-amber-950",
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    };
  return {
    ring: "stroke-rose-400",
    track: "stroke-rose-100 dark:stroke-rose-950",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  };
}
