"use client";

import { Badge } from "@/components/ui/badge";

export function DataFreshnessChip({
  label,
  updatedAt,
  loading,
}: {
  label: string;
  updatedAt?: string | Date | null;
  loading?: boolean;
}) {
  const text = (() => {
    if (loading) return "Refreshing…";
    if (!updatedAt) return "Live";
    const ts = typeof updatedAt === "string" ? new Date(updatedAt).getTime() : updatedAt.getTime();
    if (Number.isNaN(ts)) return "Live";
    const mins = Math.round((Date.now() - ts) / 60_000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  })();

  return (
    <Badge tone="muted" title={`${label} freshness`}>
      {label} · {text}
    </Badge>
  );
}
