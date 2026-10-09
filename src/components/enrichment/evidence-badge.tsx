import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCaptureDate, sourceLabel, type EvidenceFact } from "@/lib/enrichment-research";

const STATE_LABEL = { verified: "Verified source", discovery: "Discovery only", unverified: "Unverified" } as const;
const STATE_TONE = { verified: "success", discovery: "warning", unverified: "muted" } as const;

/**
 * Provenance for one displayed fact: where it was seen, when it was captured, and how much
 * weight it carries. Rendered next to every fact so nothing reads as more certain than it is.
 */
export function EvidenceBadge({ fact }: { fact: EvidenceFact | undefined }) {
  if (!fact) {
    return (
      <Badge tone="muted" data-testid="evidence-badge" data-state="missing">
        No recorded source
      </Badge>
    );
  }
  const label = `${sourceLabel(fact.source)} · captured ${formatCaptureDate(fact.capturedAt)} · ${Math.round(fact.confidence * 100)}% confidence`;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle" data-testid="evidence-badge" data-state={fact.state}>
      <Badge tone={STATE_TONE[fact.state]} title={`${STATE_LABEL[fact.state]}. Seen ${formatCaptureDate(fact.observedAt)}.`}>
        {label}
      </Badge>
      {fact.stale && <Badge tone="danger">Stale</Badge>}
      {fact.sourceUrl && (
        <a
          href={fact.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center text-muted-foreground hover:text-primary"
          aria-label={`Open the source of ${fact.attribute}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}

/** A labelled value with its evidence badge. */
export function Fact({ label, children, fact }: { label: string; children: React.ReactNode; fact: EvidenceFact | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
      <EvidenceBadge fact={fact} />
    </div>
  );
}

export function EmploymentBadge({ state }: { state: "verified" | "candidate" | "unknown" }) {
  if (state === "verified") return <Badge tone="success">Verified employee</Badge>;
  if (state === "candidate") return <Badge tone="warning">Discovered candidate</Badge>;
  return <Badge tone="muted">Employer unknown</Badge>;
}

export function IdentityBadge({ identity }: { identity: "public_profile" | "sales_lead" | "none" }) {
  if (identity === "public_profile") return <Badge tone="info">Public profile</Badge>;
  if (identity === "sales_lead") return <Badge tone="muted">Sales Navigator lead</Badge>;
  return <Badge tone="muted">No LinkedIn identity</Badge>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const button = "rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <nav className="flex items-center justify-between gap-3 pt-2 text-sm" aria-label="Pagination">
      <span className="text-muted-foreground">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <span className="flex items-center gap-2">
        <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button type="button" className={button} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </span>
    </nav>
  );
}
