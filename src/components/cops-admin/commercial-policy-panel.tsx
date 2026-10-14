"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { adminErrorMessage, useCopsAdminApi, type ConfigKind, type ConfigVersion } from "@/lib/cops-admin";
import { APPROVER_LABEL, APPROVER_ROLES, type ApproverRole } from "@/lib/cops-commercial-advanced";
import {
  approvalPolicyProblem,
  BAND_RULES,
  describeBand,
  dunningDays,
  dunningProblem,
  toMajor,
  toMinor,
  withDunningDays,
  type ApprovalPolicy,
  type Band,
  type DunningPolicy,
  type PolicyKind,
  type PriceBook,
  type RenewalPolicy,
} from "@/lib/cops-commercial-policy";

const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

/**
 * One policy kind, one key ("default"): shows the value in force, and for an admin an edit form.
 * Every save is a new version and needs a reason, like the rest of this page.
 */
function PolicySection<T>({
  kind,
  title,
  hint,
  canWrite,
  summary,
  problem,
  children,
}: {
  kind: PolicyKind;
  title: string;
  hint: string;
  canWrite: boolean;
  summary: (value: T) => React.ReactNode;
  problem: (value: T) => string | null;
  children: (value: T, set: (next: T) => void) => React.ReactNode;
}) {
  const api = useCopsAdminApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const queryKey = ["cops-admin-config", kind];
  const list = useQuery({ queryKey, queryFn: () => api.list(kind as ConfigKind), enabled: authReady });
  const row: ConfigVersion | undefined = list.data?.data.find((r) => r.key === "default");
  const [draft, setDraft] = useState<T | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(null);
    setReason("");
    setError(null);
  }, [row?.version]);

  if (list.isLoading) return <Skeleton className="h-32 w-full rounded-md" />;
  if (list.isError || !row) {
    return (
      <Alert variant="error" data-testid={`policy-error-${kind}`}>
        Could not load {title.toLowerCase()}.
      </Alert>
    );
  }
  const value = row.value as T;
  const invalid = draft ? problem(draft) : null;

  async function save() {
    if (!draft || !row) return;
    setBusy(true);
    setError(null);
    try {
      await api.save(kind as ConfigKind, "default", draft as Record<string, unknown>, reason.trim(), row.is_system_default ? undefined : row.version);
      await queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      setError(adminErrorMessage(err, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-testid={`policy-${kind}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {title}
          <Badge tone="muted">{row.is_system_default ? "built-in default" : `v${row.version}`}</Badge>
          {canWrite && !draft && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDraft(structuredClone(value))} data-testid={`policy-edit-${kind}`}>
              Edit
            </Button>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!draft ? (
          <div className="text-sm" data-testid={`policy-summary-${kind}`}>
            {summary(value)}
          </div>
        ) : (
          <>
            {children(draft, setDraft)}
            {(invalid || error) && (
              <Alert variant="error" data-testid={`policy-problem-${kind}`}>
                {invalid ?? error}
              </Alert>
            )}
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this change (recorded in the audit log)" aria-label={`Reason for changing ${title.toLowerCase()}`} maxLength={1000} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy || Boolean(invalid) || !reason.trim()} data-testid={`policy-save-${kind}`}>
                {busy && <Loader2 className="animate-spin" />}
                Save as a new version
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ApproverBoxes({ value, onChange, label }: { value: ApproverRole[]; onChange: (next: ApproverRole[]) => void; label: string }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {APPROVER_ROLES.map((role) => (
        <label key={role} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={value.includes(role)}
            aria-label={`${label}: ${APPROVER_LABEL[role]}`}
            onChange={(e) => onChange(APPROVER_ROLES.filter((r) => (r === role ? e.target.checked : value.includes(r))))}
          />
          {APPROVER_LABEL[role]}
        </label>
      ))}
    </span>
  );
}

/** Bands of one rule. `scale` shows money rules in major units while the stored value stays minor. */
function BandsEditor({ label, unit, bands, onChange, scale = 1 }: { label: string; unit: string; bands: Band[]; onChange: (next: Band[]) => void; scale?: number }) {
  const edit = (index: number, patch: Partial<Band>) => onChange(bands.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  const show = (n: number | null) => (n == null || Number.isNaN(n) ? "" : String(n / scale));
  const read = (v: string) => (scale === 1 ? num(v) : Math.round(num(v) * scale));
  return (
    <fieldset className="space-y-1.5 rounded-md border p-3">
      <legend className="px-1 text-xs font-medium">
        {label} <span className="font-normal text-muted-foreground">({unit})</span>
      </legend>
      {bands.length === 0 && <p className="text-xs text-muted-foreground">No bands: this rule never asks for approval.</p>}
      {bands.map((band, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="text-xs">Over</span>
          <Input className="w-24" inputMode="decimal" value={show(band.over)} onChange={(e) => edit(i, { over: read(e.target.value) })} aria-label={`${label} band ${i + 1} over`} />
          <span className="text-xs">up to</span>
          <Input
            className="w-24"
            inputMode="decimal"
            placeholder="no limit"
            value={show(band.up_to)}
            onChange={(e) => edit(i, { up_to: e.target.value.trim() === "" ? null : read(e.target.value) })}
            aria-label={`${label} band ${i + 1} up to`}
          />
          <ApproverBoxes value={band.approvers} onChange={(approvers) => edit(i, { approvers })} label={`${label} band ${i + 1}`} />
          <Button variant="ghost" size="sm" onClick={() => onChange(bands.filter((_, j) => j !== i))} aria-label={`Remove ${label} band ${i + 1}`}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const last = bands.at(-1);
          const start = last ? (last.up_to ?? last.over) : 0;
          onChange([...bands.map((b, i) => (i === bands.length - 1 && b.up_to == null ? { ...b, up_to: b.over } : b)), { over: start, up_to: null, approvers: ["sales_manager"] }]);
        }}
      >
        <Plus /> Add a band
      </Button>
    </fieldset>
  );
}

function BandList({ bands, format }: { bands: Band[] | null; format?: (n: number) => string }) {
  if (!bands) return <span className="text-muted-foreground">switched off</span>;
  if (bands.length === 0) return <span className="text-muted-foreground">no approval needed</span>;
  return <span>{bands.map((b) => describeBand(b, format)).join("; ")}</span>;
}

/**
 * COPS-08 commercial policy (Bible p.34-37): who approves what, what an unpaid bill does and when,
 * the price per seat in each currency, and how far ahead a renewal opens. Editable here without a
 * deploy; the server checks every save.
 */
export function CommercialPolicyPanel({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="space-y-4" data-testid="commercial-policy-panel">
      <PolicySection<ApprovalPolicy>
        kind="approval_policy"
        title="Approval rules"
        hint="Every rule that matches a proposal applies, and the proposal needs every approver named. A value at a threshold needs no approval; anything over it does."
        canWrite={canWrite}
        problem={approvalPolicyProblem}
        summary={(p) => (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {BAND_RULES.map((rule) => (
              <div key={rule.key} className="contents">
                <dt className="text-muted-foreground">{rule.label}</dt>
                <dd>
                  <BandList bands={p[rule.key]} />
                </dd>
              </div>
            ))}
            {Object.entries(p.contract_value_minor).map(([currency, bands]) => (
              <div key={currency} className="contents">
                <dt className="text-muted-foreground">Contract value ({currency})</dt>
                <dd>{bands ? <BandList bands={bands} format={(n) => toMajor(n).toLocaleString()} /> : <span className="text-amber-600">no thresholds: not checked</span>}</dd>
              </div>
            ))}
            <dt className="text-muted-foreground">Custom clauses</dt>
            <dd>{p.custom_clauses ? p.custom_clauses.approvers.map((r) => APPROVER_LABEL[r]).join(" + ") : "switched off"}</dd>
            <dt className="text-muted-foreground">Non-standard SLA</dt>
            <dd>{p.non_standard_sla ? p.non_standard_sla.approvers.map((r) => APPROVER_LABEL[r]).join(" + ") : "switched off"}</dd>
            <dt className="text-muted-foreground">Approvals lapse after</dt>
            <dd>{p.expires_after_days} days</dd>
          </dl>
        )}
      >
        {(p, set) => (
          <div className="space-y-3">
            {BAND_RULES.map((rule) => (
              <BandsEditor key={rule.key} label={rule.label} unit={rule.unit} bands={p[rule.key] ?? []} onChange={(bands) => set({ ...p, [rule.key]: bands })} />
            ))}
            {Object.entries(p.contract_value_minor).map(([currency, bands]) => (
              <BandsEditor key={currency} label={`Contract value ${currency}`} unit={currency} scale={100} bands={bands ?? []} onChange={(next) => set({ ...p, contract_value_minor: { ...p.contract_value_minor, [currency]: next } })} />
            ))}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-32 font-medium">Custom clauses</span>
              <ApproverBoxes label="Custom clauses" value={p.custom_clauses?.approvers ?? []} onChange={(a) => set({ ...p, custom_clauses: a.length ? { approvers: a } : null })} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-32 font-medium">Non-standard SLA</span>
              <ApproverBoxes label="Non-standard SLA" value={p.non_standard_sla?.approvers ?? []} onChange={(a) => set({ ...p, non_standard_sla: a.length ? { approvers: a } : null })} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <span className="w-32 font-medium">Approvals lapse after</span>
              <Input className="w-24" type="number" min={1} max={365} value={Number.isNaN(p.expires_after_days) ? "" : p.expires_after_days} onChange={(e) => set({ ...p, expires_after_days: num(e.target.value) })} aria-label="Approvals lapse after days" />
              days
            </label>
          </div>
        )}
      </PolicySection>

      <PolicySection<DunningPolicy>
        kind="dunning_policy"
        title="Unpaid bills"
        hint="Day 0 is the due date of the oldest unpaid bill. Paying restores access at once. Nothing is ever deleted because a payment failed."
        canWrite={canWrite}
        problem={(p) => dunningProblem(dunningDays(p))}
        summary={(p) => {
          const d = dunningDays(p);
          return (
            <p>
              Past due with full access until day {d.restricted - 1}. Restricted from day {d.restricted} (no new credit use or outreach). Suspended from day {d.suspended}. Closed on day {d.closed}.{" "}
              {p.invoiced_accounts_auto_suspend ? "Invoiced accounts follow the same timeline." : "Invoiced accounts are never suspended automatically."}
            </p>
          );
        }}
      >
        {(p, set) => {
          const d = dunningDays(p);
          const field = (key: "restricted" | "suspended" | "closed", label: string) => (
            <label className="flex items-center gap-2 text-xs">
              <span className="w-40 font-medium">{label}</span>
              <Input className="w-24" type="number" min={1} value={Number.isNaN(d[key]) ? "" : d[key]} onChange={(e) => set(withDunningDays(p, { ...d, [key]: num(e.target.value) }))} aria-label={`${label} day`} />
            </label>
          );
          return (
            <div className="space-y-2">
              {field("restricted", "Restricted from day")}
              {field("suspended", "Suspended from day")}
              {field("closed", "Closed on day")}
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={p.suspend_when_provider_halted} onChange={(e) => set({ ...p, suspend_when_provider_halted: e.target.checked })} aria-label="Suspend when the provider stops retrying" />
                Suspend at once when the payment provider stops retrying
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={p.invoiced_accounts_auto_suspend} onChange={(e) => set({ ...p, invoiced_accounts_auto_suspend: e.target.checked })} aria-label="Invoiced accounts follow the same timeline" />
                Invoiced accounts follow the same timeline (off: Finance decides)
              </label>
            </div>
          );
        }}
      </PolicySection>

      <PolicySection<PriceBook>
        kind="price_book"
        title="Price book"
        hint="Per seat, per month, on annual billing. A customer is billed in their own currency; nothing is converted."
        canWrite={canWrite}
        problem={(p) =>
          Object.values(p.currencies).every((c) => Number.isInteger(c.seat_month_annual_minor) && c.seat_month_annual_minor > 0) && p.month_to_month_surcharge_pct >= 0 && p.month_to_month_surcharge_pct <= 100
            ? null
            : "Each price must be above zero and the surcharge between 0 and 100%."
        }
        summary={(p) => (
          <p>
            {Object.entries(p.currencies)
              .map(([currency, c]) => `${currency} ${toMajor(c.seat_month_annual_minor).toLocaleString()} (${c.status})`)
              .join(" · ")}{" "}
            · month to month +{p.month_to_month_surcharge_pct}%
          </p>
        )}
      >
        {(p, set) => (
          <div className="space-y-2">
            {Object.entries(p.currencies).map(([currency, c]) => (
              <div key={currency} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="w-12 font-medium">{currency}</span>
                <Input
                  className="w-28"
                  inputMode="decimal"
                  value={Number.isNaN(c.seat_month_annual_minor) ? "" : toMajor(c.seat_month_annual_minor)}
                  onChange={(e) => set({ ...p, currencies: { ...p.currencies, [currency]: { ...c, seat_month_annual_minor: toMinor(num(e.target.value)) } } })}
                  aria-label={`${currency} price per seat per month`}
                />
                <Select className="w-36" value={c.status} onChange={(e) => set({ ...p, currencies: { ...p.currencies, [currency]: { ...c, status: e.target.value as typeof c.status } } })} aria-label={`${currency} price status`}>
                  <option value="benchmarked">Benchmarked</option>
                  <option value="suggested">Suggested</option>
                  <option value="confirmed">Confirmed by Finance</option>
                </Select>
              </div>
            ))}
            <label className="flex items-center gap-2 text-xs">
              <span className="font-medium">Month-to-month surcharge</span>
              <Input className="w-20" type="number" min={0} max={100} value={Number.isNaN(p.month_to_month_surcharge_pct) ? "" : p.month_to_month_surcharge_pct} onChange={(e) => set({ ...p, month_to_month_surcharge_pct: num(e.target.value) })} aria-label="Month-to-month surcharge percent" />%
            </label>
          </div>
        )}
      </PolicySection>

      <PolicySection<RenewalPolicy>
        kind="renewal_policy"
        title="Renewals"
        hint="A renewal opportunity is opened once per term, this many days before the term ends."
        canWrite={canWrite}
        problem={(p) => (Number.isInteger(p.lead_days) && p.lead_days >= 1 && p.lead_days <= 365 ? null : "Lead time must be 1 to 365 days.")}
        summary={(p) => <p>Opened {p.lead_days} days before the end of the term.</p>}
      >
        {(p, set) => (
          <label className="flex items-center gap-2 text-xs">
            <span className="font-medium">Open the renewal</span>
            <Input className="w-24" type="number" min={1} max={365} value={Number.isNaN(p.lead_days) ? "" : p.lead_days} onChange={(e) => set({ lead_days: num(e.target.value) })} aria-label="Renewal lead days" />
            days before the term ends
          </label>
        )}
      </PolicySection>
    </div>
  );
}
