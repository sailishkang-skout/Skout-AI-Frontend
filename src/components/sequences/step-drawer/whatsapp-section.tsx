import { CopyEditor } from "./copy-editor";
import type { SectionProps } from "./section-types";
import { TimingRow } from "./timing-row";

export function WhatsappSection({ draft, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <TimingRow draft={draft} onChange={onChange} />
      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Sent via your connected WhatsApp account. Prospects need a phone number (enrich or import). Connect under
        Deliverability → WhatsApp.
      </p>
      <CopyEditor
        kind="plain"
        ariaLabel="WhatsApp message"
        placeholder="WhatsApp message — supports {{firstName}}, {{companyName}}, etc."
        value={draft.body}
        onChange={(body) => onChange({ body })}
        withVariables
      />
    </div>
  );
}
