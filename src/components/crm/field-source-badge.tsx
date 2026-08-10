import { Sparkles } from "lucide-react";
import type { FieldSource, FieldSourcesMap } from "@/types/crm";

const SOURCE_LABEL: Record<Exclude<FieldSource, "manual">, string> = {
  enrichment: "enrichment",
  meeting_bot: "meeting notes",
  call_note: "call notes",
};

/**
 * R13.3 AC2 — visually distinguishes an auto-filled field from one a human typed in. Renders
 * nothing for "manual" (or missing) provenance — a human-entered field should look like any
 * other field, not carry an icon that implies something automated touched it.
 */
export function FieldSourceBadge({ field, fieldSources }: { field: string; fieldSources: FieldSourcesMap }) {
  const entry = fieldSources[field];
  if (!entry || entry.source === "manual") return null;

  const label = SOURCE_LABEL[entry.source];
  const confidencePct = entry.confidence != null ? Math.round(entry.confidence * 100) : null;
  const title = `Auto-filled via ${label}${confidencePct != null ? ` (${confidencePct}% confidence)` : ""} — edit it to make it manual.`;

  return (
    <span
      title={title}
      className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
    >
      <Sparkles className="h-2.5 w-2.5" />
      via {label}
    </span>
  );
}
