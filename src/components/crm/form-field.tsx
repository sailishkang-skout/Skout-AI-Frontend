import type { FieldSourceEntry } from "@/types/crm";

/** Shared label+control wrapper for the CRM entity form Sheets. */
export function Field({
  label,
  required,
  fieldSource,
  children,
}: {
  label: string;
  required?: boolean;
  /** R13.3 — pass the field's provenance entry to show an "auto-filled" badge next to the label. */
  fieldSource?: FieldSourceEntry;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
        {fieldSource && fieldSource.source !== "manual" && <AutoFilledBadge entry={fieldSource} />}
      </span>
      {children}
    </label>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  enrichment: "enrichment",
  meeting_bot: "meeting notes",
  call_note: "call notes",
};

/** R13.3 — small pill marking a field as auto-filled (vs. manually entered), with source + confidence. */
export function AutoFilledBadge({ entry }: { entry: FieldSourceEntry }) {
  const label = SOURCE_LABEL[entry.source] ?? entry.source;
  const confidencePct = entry.confidence !== undefined ? ` · ${Math.round(entry.confidence * 100)}%` : "";
  return (
    <span
      className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal normal-case text-primary"
      title={`Auto-filled from ${label} on ${new Date(entry.setAt).toLocaleDateString()}${confidencePct}`}
    >
      auto · {label}
      {confidencePct}
    </span>
  );
}
