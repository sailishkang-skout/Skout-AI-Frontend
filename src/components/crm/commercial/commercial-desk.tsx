"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Copy, ExternalLink, FilePlus2, FileSignature, Link2, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  can,
  commercialErrorMessage,
  commercialTimeline,
  COMMERCIAL_PERMS,
  CONTRACT_KIND_LABEL,
  formatMoney,
  humanize,
  statusTone,
  useCopsCommercialApi,
  type CommercialSummary,
  type Contract,
  type Proposal,
  type ProposalVersion,
} from "@/lib/cops-commercial";
import { ContractDialog } from "./contract-dialog";
import { PaymentLinkDialog } from "./payment-link-dialog";
import { ProposalBuilderDialog } from "./proposal-builder-dialog";
import { ReasonDialog } from "./reason-dialog";
import { SentVersionViewer } from "./sent-version-viewer";

const PROPOSAL_STATUSES = [
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
] as const;
const CONTRACT_STATUSES = [
  { value: "signed", label: "Signed" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
] as const;

type ReasonAction =
  | { kind: "proposal-status"; proposal: Proposal }
  | { kind: "contract-status"; contract: Contract }
  | { kind: "approve-trial" }
  | { kind: "override" };

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Condition({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs">
      {met ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
      <span className={met ? "" : "text-muted-foreground"}>
        {label}
        <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
      </span>
    </li>
  );
}

/** Which conditions the gate's policy actually needs, in the order a deal meets them. */
function gateConditions(s: CommercialSummary) {
  const c = s.gate.conditions;
  const list: Array<{ met: boolean; label: string }> = [];
  if (s.gate.policy === "trial_approval_only") list.push({ met: c.trial_approved, label: "Trial approved" });
  if (s.gate.policy === "signature" || s.gate.policy === "signature+payment") list.push({ met: c.signature_complete, label: "MSA or order form signed" });
  if (s.gate.policy === "payment" || s.gate.policy === "signature+payment") list.push({ met: c.payment_complete, label: "Payment received" });
  if (s.gate.policy === "manual_override") list.push({ met: c.overridden, label: "Manual approval to provision" });
  return list;
}

/**
 * Commercial Desk for one opportunity (Bible p.62): value and configuration summary, documents
 * with versions, signature and payment timeline, payment links, and the provisioning gate.
 * Actions a user may not take are not shown; the data stays visible read-only.
 */
export function CommercialDesk({
  summary,
  permissions,
  onChanged,
  documentsOnly = false,
}: {
  summary: CommercialSummary;
  permissions: readonly string[];
  onChanged: () => void;
  documentsOnly?: boolean;
}) {
  const api = useCopsCommercialApi();
  const { opportunity, proposals, contracts, payment_requests: payments, gate } = summary;
  const [builder, setBuilder] = useState<{ proposal: Proposal | null } | null>(null);
  const [contractDialog, setContractDialog] = useState<{ contract: Contract | null } | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [viewing, setViewing] = useState<{ proposal: Proposal; version: ProposalVersion } | null>(null);
  const [reason, setReason] = useState<ReasonAction | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const allowed = (key: keyof typeof COMMERCIAL_PERMS) => can(permissions, COMMERCIAL_PERMS[key]);
  const value = opportunity.amount ? `${Number(opportunity.amount).toLocaleString()} ${opportunity.currency}` : "No value set";

  async function send(id: string, fn: () => Promise<unknown>, what: string) {
    setSending(id);
    try {
      await fn();
      toast({ title: `${what} sent`, variant: "success" });
      onChanged();
    } catch (err) {
      toast({ title: `Could not send the ${what.toLowerCase()}`, description: commercialErrorMessage(err, "Please try again."), variant: "destructive" });
    } finally {
      setSending(null);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    toast({ title: "Payment link copied", variant: "success" });
  }

  const documents = (
    <Section
      title="Documents"
      action={
        <div className="flex gap-2">
          {allowed("proposalWrite") && (
            <Button size="sm" variant="outline" onClick={() => setBuilder({ proposal: null })}>
              <FilePlus2 /> New proposal
            </Button>
          )}
          {allowed("contractWrite") && (
            <Button size="sm" variant="outline" onClick={() => setContractDialog({ contract: null })}>
              <FileSignature /> Add MSA / order form / DPA
            </Button>
          )}
        </div>
      }
    >
      {proposals.length === 0 && contracts.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No proposal or contract yet.{allowed("proposalWrite") ? " Start with a proposal." : ""}
        </p>
      ) : (
        <ul className="divide-y rounded-md border" data-testid="commercial-documents">
          {proposals.map((p) => {
            const latest = p.versions.at(-1);
            const canSendLatest = latest && !latest.sent_at && !["accepted", "declined", "expired"].includes(p.status);
            return (
              <li key={p.id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="muted">Proposal</Badge>
                  <span className="text-sm font-medium">{p.title}</span>
                  <Badge tone={statusTone(p.status)} className="capitalize">
                    {p.status}
                  </Badge>
                  {latest && <span className="text-xs text-muted-foreground">{formatMoney(latest.totals.total_minor, latest.currency)}</span>}
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {canSendLatest && allowed("send") && (
                      <Button size="sm" disabled={sending === p.id} onClick={() => send(p.id, () => api.sendProposal(p.id), "Proposal")}>
                        <Send /> Send v{latest.version}
                      </Button>
                    )}
                    {allowed("proposalWrite") && !["accepted", "declined", "expired"].includes(p.status) && (
                      <Button size="sm" variant="outline" onClick={() => setBuilder({ proposal: p })}>
                        Edit (new version)
                      </Button>
                    )}
                    {p.status === "sent" && allowed("status") && (
                      <Button size="sm" variant="outline" onClick={() => setReason({ kind: "proposal-status", proposal: p })}>
                        Record outcome
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setViewing({ proposal: p, version: v })}
                      className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
                      aria-label={`View version ${v.version}${v.sent_at ? " (sent)" : " (draft)"}`}
                    >
                      v{v.version} {v.sent_at ? "· sent" : "· draft"}
                      {v.hash_valid === false ? " · changed!" : ""}
                    </button>
                  ))}
                </div>
                {p.status_reason && <p className="text-xs text-muted-foreground">Reason: {p.status_reason}</p>}
              </li>
            );
          })}
          {contracts.map((c) => {
            const latest = c.versions.at(-1);
            const closed = ["signed", "declined", "expired"].includes(c.status);
            return (
              <li key={c.id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="muted">{CONTRACT_KIND_LABEL[c.kind]}</Badge>
                  <span className="text-sm font-medium">{c.title}</span>
                  <Badge tone={statusTone(c.status)} className="capitalize">
                    {c.status}
                  </Badge>
                  {latest && (
                    <a href={latest.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      v{latest.version} <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {latest && !latest.sent_at && !closed && allowed("send") && (
                      <Button size="sm" disabled={sending === c.id} onClick={() => send(c.id, () => api.sendContract(c.id), CONTRACT_KIND_LABEL[c.kind])}>
                        <Send /> Send v{latest.version}
                      </Button>
                    )}
                    {!closed && allowed("status") && (
                      <Button size="sm" variant="outline" onClick={() => setContractDialog({ contract: c })}>
                        New version
                      </Button>
                    )}
                    {c.status === "sent" && allowed("status") && (
                      <Button size="sm" variant="outline" onClick={() => setReason({ kind: "contract-status", contract: c })}>
                        Record signature / outcome
                      </Button>
                    )}
                  </div>
                </div>
                {latest && (
                  <p className="break-all text-xs text-muted-foreground">
                    SHA-256 {latest.file_sha256.slice(0, 16)}…{latest.sent_at ? ` · sent ${new Date(latest.sent_at).toLocaleDateString()}` : ""}
                    {c.signed_at ? ` · signed ${new Date(c.signed_at).toLocaleDateString()}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );

  const timeline = commercialTimeline(summary);

  return (
    <div className="space-y-5" data-testid={`commercial-desk-${opportunity.id}`}>
      {!documentsOnly && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Opportunity value</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deal type</p>
            <p className="text-sm font-medium">{opportunity.deal_type ?? "Default"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Commercial state</p>
            <Badge tone={statusTone(opportunity.commercial_state ?? "draft")} className="capitalize">
              {opportunity.commercial_state ? humanize(opportunity.commercial_state) : "Not started"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Provisioning gate</p>
            <Badge tone={gate.fired_at ? "success" : gate.open ? "info" : "warning"} data-testid="gate-status">
              {gate.fired_at ? "Provisioning requested" : gate.open ? "Open" : "Waiting"}
            </Badge>
          </div>
        </div>
      )}

      {documents}

      {!documentsOnly && (
        <>
          <Section
            title="Payments"
            action={
              allowed("payment") && (
                <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
                  <Link2 /> Payment link
                </Button>
              )
            }
          >
            {payments.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No payment requested yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {payments.map((pr) => (
                  <li key={pr.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                    <span className="font-medium">{formatMoney(pr.amount_minor, pr.currency)}</span>
                    <Badge tone={statusTone(pr.status)} className="capitalize">
                      {pr.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{pr.description}</span>
                    {pr.status === "requested" && (
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => copyLink(pr.checkout_url)} aria-label="Copy payment link">
                        <Copy /> Copy link
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Signature and payment timeline">
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing sent yet.</p>
              ) : (
                <ol className="space-y-2" data-testid="commercial-timeline">
                  {timeline.map((t, i) => (
                    <li key={`${t.at}-${i}`} className="flex items-start gap-2 text-sm">
                      <Badge tone={statusTone(t.status)} className="mt-0.5 capitalize">
                        {t.kind}
                      </Badge>
                      <span className="flex-1">{t.label}</span>
                      <time className="text-xs text-muted-foreground" dateTime={t.at}>
                        {new Date(t.at).toLocaleString()}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title="Provisioning gate">
              <div className="space-y-2 rounded-md border p-3" data-testid="gate-card">
                <p className="text-sm">
                  Policy: <span className="font-medium">{humanize(gate.policy)}</span>
                  <span className="text-xs text-muted-foreground"> ({gate.policy_source === "deal_type" ? "deal type" : gate.policy_source === "workspace_default" ? "workspace default" : "default"})</span>
                </p>
                <ul className="space-y-1">
                  {gateConditions(summary).map((c) => (
                    <Condition key={c.label} met={c.met} label={c.label} />
                  ))}
                </ul>
                {gate.fired_at ? (
                  <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Provisioning requested {new Date(gate.fired_at).toLocaleString()}
                  </p>
                ) : null}
                {gate.override && (
                  <p className="text-xs text-muted-foreground">
                    Overridden {new Date(gate.override.at).toLocaleString()}: {gate.override.reason}
                  </p>
                )}
                {!gate.fired_at && allowed("approve") && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {gate.policy === "trial_approval_only" && !gate.conditions.trial_approved && (
                      <Button size="sm" onClick={() => setReason({ kind: "approve-trial" })}>
                        Approve trial
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setReason({ kind: "override" })}>
                      Override gate
                    </Button>
                  </div>
                )}
              </div>
            </Section>
          </div>
        </>
      )}

      <ProposalBuilderDialog
        open={Boolean(builder)}
        onClose={() => setBuilder(null)}
        opportunityId={opportunity.id}
        defaultCurrency={opportunity.currency}
        proposal={builder?.proposal}
        onSaved={onChanged}
      />
      <ContractDialog
        open={Boolean(contractDialog)}
        onClose={() => setContractDialog(null)}
        opportunityId={opportunity.id}
        proposals={proposals}
        contract={contractDialog?.contract}
        onSaved={onChanged}
      />
      <PaymentLinkDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        opportunityId={opportunity.id}
        opportunityName={opportunity.name}
        defaultCurrency={opportunity.currency}
        proposals={proposals}
        onSaved={onChanged}
      />
      {viewing && <SentVersionViewer proposal={viewing.proposal} version={viewing.version} onClose={() => setViewing(null)} />}

      <ReasonDialog
        open={reason?.kind === "proposal-status"}
        onClose={() => setReason(null)}
        title="Record proposal outcome"
        statuses={PROPOSAL_STATUSES}
        confirmLabel="Save outcome"
        onSubmit={async ({ status, reason: why }) => {
          if (reason?.kind !== "proposal-status") return;
          await api.setProposalStatus(reason.proposal.id, status!, why);
          onChanged();
        }}
      />
      <ReasonDialog
        open={reason?.kind === "contract-status"}
        onClose={() => setReason(null)}
        title="Record signature or outcome"
        description="Phase 1 records signatures manually; e-signature arrives in a later release."
        statuses={CONTRACT_STATUSES}
        confirmLabel="Save"
        onSubmit={async ({ status, reason: why }) => {
          if (reason?.kind !== "contract-status") return;
          await api.setContractStatus(reason.contract.id, status!, why);
          onChanged();
        }}
      />
      <ReasonDialog
        open={reason?.kind === "approve-trial"}
        onClose={() => setReason(null)}
        title="Approve trial"
        description="Provisioning is requested as soon as the trial is approved."
        confirmLabel="Approve"
        onSubmit={async ({ reason: why }) => {
          await api.approveTrial(opportunity.id, why);
          onChanged();
        }}
      />
      <ReasonDialog
        open={reason?.kind === "override"}
        onClose={() => setReason(null)}
        title="Override the provisioning gate"
        description="Requests provisioning now, whatever the policy. Recorded in the audit log as an override with your reason."
        confirmLabel="Override and provision"
        destructive
        onSubmit={async ({ reason: why }) => {
          await api.overrideGate(opportunity.id, why);
          onChanged();
        }}
      />
    </div>
  );
}
