import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CLAIM_EXCLUSION, type Claim } from "@/lib/enrichment-campaigns";
import { formatCaptureDate, sourceLabel } from "@/lib/enrichment-research";

/**
 * One talking point with the evidence it words: source, capture time, confidence, and whether
 * the source is verified or discovery-only. A claim that cannot be used says why.
 */
export function ClaimEvidence({ claim }: { claim: Claim }) {
  return (
    <li className="space-y-1" data-testid="claim" data-usable={claim.usable} data-state={claim.state}>
      <p className={claim.usable ? "text-sm" : "text-sm text-muted-foreground line-through"}>{claim.text}</p>
      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={claim.state === "verified" ? "success" : claim.state === "discovery" ? "warning" : "muted"}>
          {claim.state === "verified" ? "Verified" : claim.state === "discovery" ? "Discovery" : "Unverified"}
        </Badge>
        <Badge tone="muted">
          {sourceLabel(claim.source)} · captured {formatCaptureDate(claim.capturedAt)} · {Math.round(claim.confidence * 100)}% confidence
        </Badge>
        {claim.stale && <Badge tone="danger">Stale</Badge>}
        {claim.sourceUrl && (
          <a href={claim.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-muted-foreground hover:text-primary" aria-label={`Open the source of this ${claim.attribute} claim`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {claim.excludedReason && <p className="text-xs text-amber-700 dark:text-amber-300">Not used in copy: {CLAIM_EXCLUSION[claim.excludedReason]}.</p>}
    </li>
  );
}
