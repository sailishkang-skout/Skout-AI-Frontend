"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatMoney, humanize, type Proposal, type ProposalVersion } from "@/lib/cops-commercial";

/**
 * Read-only view of one proposal version. A sent version cannot be edited (the database rejects
 * it); the server re-checks its content hash on every read and this view shows the result.
 */
export function SentVersionViewer({
  proposal,
  version,
  onClose,
}: {
  proposal: Proposal;
  version: ProposalVersion | null;
  onClose: () => void;
}) {
  if (!version) return null;
  const money = (minor: number) => formatMoney(minor, version.currency);
  return (
    <Dialog open onClose={onClose} title={`${proposal.title} · v${version.version}`} className="max-w-2xl">
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {version.sent_at ? (
            <Badge tone="info">Sent {new Date(version.sent_at).toLocaleString()}</Badge>
          ) : (
            <Badge tone="warning">Draft, not sent</Badge>
          )}
          {version.hash_valid === true && (
            <Badge tone="success" className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Matches the sent content
            </Badge>
          )}
          {version.hash_valid === false && (
            <Badge tone="danger" className="inline-flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" aria-hidden /> Stored content differs from what was sent
            </Badge>
          )}
          <span className="text-muted-foreground">
            {humanize(version.billing_cadence)} · {version.term_months} months · {version.currency}
          </span>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Line items</caption>
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {version.line_items.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">{l.description}</td>
                  <td className="px-3 py-2 capitalize">{l.kind}</td>
                  <td className="px-3 py-2 text-right">{l.quantity}</td>
                  <td className="px-3 py-2 text-right">{money(l.unit_amount_minor)}</td>
                  <td className="px-3 py-2 text-right">{l.discount_pct ? `${l.discount_pct}%` : "—"}</td>
                  <td className="px-3 py-2 text-right">{money(l.net_minor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{money(version.totals.subtotal_minor)}</dd>
          <dt className="text-muted-foreground">Discount{version.discount_pct ? ` (incl. ${version.discount_pct}%)` : ""}</dt>
          <dd className="text-right">−{money(version.totals.discount_minor)}</dd>
          <dt className="text-muted-foreground">Tax{version.tax_pct ? ` (${version.tax_pct}%)` : ""}</dt>
          <dd className="text-right">{money(version.totals.tax_minor)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{money(version.totals.total_minor)}</dd>
        </dl>

        {version.notes && <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">{version.notes}</p>}
        {version.content_hash && (
          <p className="break-all text-xs text-muted-foreground">
            Content hash (SHA-256): <code>{version.content_hash}</code>
          </p>
        )}
      </div>
    </Dialog>
  );
}
