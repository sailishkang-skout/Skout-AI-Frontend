"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { adminErrorMessage, COPS_MODULES, formatMetric, GATE_POLICIES, humanizeAdmin, RETENTION_CATEGORIES, useCopsAdminApi, type RetentionRun } from "@/lib/cops-admin";

const TEXTAREA = "flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Panel({ title, hint, children, testId }: { title: string; hint?: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="space-y-3" data-testid={testId}>
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ReasonInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input value={value} onChange={(e) => onChange(e.target.value)} aria-label="Reason" placeholder="Reason (recorded in the audit log)" maxLength={1000} className="max-w-md" />;
}

/** Module switches. Admin itself cannot be turned off. */
export function FeatureFlagsPanel({ canWrite }: { canWrite: boolean }) {
  const api = useCopsAdminApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["cops-modules"], queryFn: () => api.modules(), enabled: authReady });
  const current = draft ?? q.data?.data ?? {};
  const changed = draft !== null && COPS_MODULES.some((m) => draft[m] !== q.data?.data[m]);

  async function save() {
    setError(null);
    try {
      await api.save("feature_flags", "default", { modules: Object.fromEntries(COPS_MODULES.map((m) => [m, current[m] !== false])) }, reason.trim());
      setDraft(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["cops-modules"] });
    } catch (err) {
      setError(adminErrorMessage(err, "Could not save the module switches."));
    }
  }

  return (
    <Panel title="Modules" hint="Turning a module off hides it and refuses its API for everyone in this workspace." testId="admin-flags">
      {error && <Alert variant="error">{error}</Alert>}
      {q.isLoading ? (
        <Skeleton className="h-24 w-full rounded-md" />
      ) : q.isError ? (
        <Alert variant="error">Could not load the module switches.</Alert>
      ) : (
        <ul className="divide-y rounded-md border">
          {COPS_MODULES.map((m) => (
            <li key={m} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="capitalize">{m}</span>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={current[m] !== false} disabled={!canWrite} onChange={(e) => setDraft({ ...current, [m]: e.target.checked })} aria-label={`${m} module`} />
                {current[m] !== false ? "On" : "Off"}
              </label>
            </li>
          ))}
        </ul>
      )}
      {changed && (
        <div className="flex flex-wrap items-center gap-2">
          <ReasonInput value={reason} onChange={setReason} />
          <Button size="sm" onClick={save} disabled={!reason.trim()} data-testid="flags-save">
            Save
          </Button>
        </div>
      )}
    </Panel>
  );
}

/** Commercial gate policy per deal type (COPS-03 store, edited here). */
export function GatePolicyPanel({ canWrite }: { canWrite: boolean }) {
  const api = useCopsAdminApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [dealType, setDealType] = useState("");
  const [policy, setPolicy] = useState<string>(GATE_POLICIES[0]);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["cops-gate-policies"], queryFn: () => api.gatePolicies(), enabled: authReady });
  const rows = q.data?.data ?? [];

  async function save() {
    setError(null);
    try {
      await api.setGatePolicy(dealType.trim(), policy);
      setDealType("");
      await queryClient.invalidateQueries({ queryKey: ["cops-gate-policies"] });
    } catch (err) {
      setError(adminErrorMessage(err, "Could not save the gate policy."));
    }
  }

  return (
    <Panel title="Commercial gate policy" hint="What must be true before a workspace is provisioned, per deal type. * is the default for deal types without their own rule." testId="admin-gate">
      {error && <Alert variant="error">{error}</Alert>}
      {q.isLoading ? (
        <Skeleton className="h-16 w-full rounded-md" />
      ) : q.isError ? (
        <Alert variant="error">{adminErrorMessage(q.error, "Could not load gate policies.")}</Alert>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No gate policy set yet. Add one below.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.deal_type} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{r.deal_type === "*" ? "All other deal types" : r.deal_type}</span>
              <Badge>{humanizeAdmin(r.policy)}</Badge>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={dealType} onChange={(e) => setDealType(e.target.value)} aria-label="Deal type" placeholder="Deal type, or *" className="w-44" />
          <Select value={policy} onChange={(e) => setPolicy(e.target.value)} aria-label="Policy" className="w-56">
            {GATE_POLICIES.map((p) => (
              <option key={p} value={p}>
                {humanizeAdmin(p)}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={save} disabled={!dealType.trim()}>
            Save policy
          </Button>
        </div>
      )}
    </Panel>
  );
}

/** Activation definitions: versions are listed; a change is a new version entered as milestones JSON. */
export function ActivationPanel({ canWrite }: { canWrite: boolean }) {
  const api = useCopsAdminApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ key: string; segment: string | null } | null>(null);
  const [json, setJson] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["cops-activation-templates"], queryFn: () => api.activationTemplates(), enabled: authReady });
  const rows = q.data?.data ?? [];

  async function save() {
    if (!editing) return;
    setError(null);
    let milestones: unknown;
    try {
      milestones = JSON.parse(json);
    } catch {
      setError("The milestones are not valid JSON.");
      return;
    }
    try {
      await api.newActivationVersion(editing.key, { segment: editing.segment, milestones, reason: reason.trim() });
      setEditing(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["cops-activation-templates"] });
    } catch (err) {
      setError(adminErrorMessage(err, "Could not save the new version."));
    }
  }

  return (
    <Panel title="Activation definitions" hint="Weighted milestones that define an activated customer. Accounts already onboarding keep the version they started with." testId="admin-activation">
      {error && <Alert variant="error">{error}</Alert>}
      {q.isLoading ? (
        <Skeleton className="h-24 w-full rounded-md" />
      ) : q.isError ? (
        <Alert variant="error">{adminErrorMessage(q.error, "Could not load activation definitions.")}</Alert>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((t) => (
            <li key={t.id} className="space-y-1 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{t.key}</span> v{t.version}
                  {t.segment ? ` · ${humanizeAdmin(t.segment)}` : ""} <Badge tone={t.is_system_default ? "muted" : "info"}>{t.is_system_default ? "built-in" : "workspace"}</Badge>
                </span>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing({ key: t.key, segment: t.segment });
                      setJson(JSON.stringify(t.milestones, null, 2));
                      setError(null);
                    }}
                  >
                    New version from this
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.milestones.map((m) => `${m.label} ${m.weight}%${m.required ? " (required)" : ""}`).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">New version of {editing.key}</p>
          <p className="text-xs text-muted-foreground">Weights must add up to 100, and at least one milestone other than first login must be required.</p>
          <textarea rows={10} className={TEXTAREA} value={json} onChange={(e) => setJson(e.target.value)} aria-label="Milestones JSON" />
          <div className="flex flex-wrap items-center gap-2">
            <ReasonInput value={reason} onChange={setReason} />
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!reason.trim()}>
              Save new version
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Retention policy per category, dry-run-first runs, and the data inventory. */
export function RetentionPanel({ canWrite }: { canWrite: boolean }) {
  const api = useCopsAdminApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<Record<string, string> | null>(null);
  const [reason, setReason] = useState("");
  const [applyReason, setApplyReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastDry, setLastDry] = useState<RetentionRun | null>(null);
  const policy = useQuery({ queryKey: ["cops-admin-config", "retention_policy"], queryFn: () => api.list("retention_policy"), enabled: authReady });
  const runs = useQuery({ queryKey: ["cops-retention-runs"], queryFn: () => api.retentionRuns(), enabled: authReady });
  const inventory = useQuery({ queryKey: ["cops-data-inventory"], queryFn: () => api.inventory(), enabled: authReady });

  const saved = (policy.data?.data[0]?.value as { categories?: Record<string, { days: number | null }> } | undefined)?.categories ?? {};
  const current = days ?? Object.fromEntries(RETENTION_CATEGORIES.map((c) => [c, saved[c]?.days == null ? "" : String(saved[c]!.days)]));
  const automatic = new Set((runs.data?.targets ?? []).map((t) => t.category));

  async function savePolicy() {
    setError(null);
    try {
      const categories = Object.fromEntries(RETENTION_CATEGORIES.map((c) => [c, { days: current[c] === "" ? null : Number(current[c]) }]));
      await api.save("retention_policy", "default", { categories }, reason.trim());
      setDays(null);
      setReason("");
      setLastDry(null);
      await queryClient.invalidateQueries({ queryKey: ["cops-admin-config", "retention_policy"] });
    } catch (err) {
      setError(adminErrorMessage(err, "Could not save the retention policy."));
    }
  }

  async function run(mode: "dry_run" | "apply") {
    setError(null);
    try {
      const res = await api.retentionRun(mode === "apply" ? { mode, dry_run_id: lastDry?.id, reason: applyReason.trim() } : { mode });
      setLastDry(mode === "dry_run" ? res.data : null);
      setApplyReason("");
      await queryClient.invalidateQueries({ queryKey: ["cops-retention-runs"] });
    } catch (err) {
      setError(adminErrorMessage(err, "The retention run failed."));
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Retention policy" hint="Days to keep each category. Empty keeps it indefinitely, which is the default. Audit logs cannot be kept for less than 365 days." testId="admin-retention">
        {error && <Alert variant="error">{error}</Alert>}
        {policy.isLoading ? (
          <Skeleton className="h-40 w-full rounded-md" />
        ) : (
          <ul className="divide-y rounded-md border">
            {RETENTION_CATEGORIES.map((c) => (
              <li key={c} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="capitalize">{humanizeAdmin(c)}</span>{" "}
                  <span className="text-xs text-muted-foreground">{automatic.has(c) ? "deleted automatically" : "removed only through a data request"}</span>
                </span>
                <Input
                  type="number"
                  min={30}
                  max={3650}
                  value={current[c]}
                  disabled={!canWrite || !automatic.has(c)}
                  onChange={(e) => setDays({ ...current, [c]: e.target.value })}
                  aria-label={`${humanizeAdmin(c)} days`}
                  placeholder="Keep"
                  className="w-28"
                />
              </li>
            ))}
          </ul>
        )}
        {days !== null && (
          <div className="flex flex-wrap items-center gap-2">
            <ReasonInput value={reason} onChange={setReason} />
            <Button size="sm" onClick={savePolicy} disabled={!reason.trim()} data-testid="retention-save">
              Save policy
            </Button>
          </div>
        )}
      </Panel>

      <Panel title="Retention runs" hint="A dry run counts what would be removed. Deleting needs a dry run from the last 24 hours and a reason." testId="admin-retention-runs">
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => run("dry_run")} data-testid="retention-dry-run">
              Dry run
            </Button>
            {lastDry && (
              <>
                <span className="text-sm" data-testid="retention-dry-result">
                  Would remove {lastDry.total_rows} row{lastDry.total_rows === 1 ? "" : "s"}.
                </span>
                {lastDry.total_rows > 0 && (
                  <>
                    <ReasonInput value={applyReason} onChange={setApplyReason} />
                    <Button size="sm" onClick={() => run("apply")} disabled={!applyReason.trim()} data-testid="retention-apply">
                      Delete {lastDry.total_rows} rows
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {(runs.data?.data.length ?? 0) === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No retention run yet. Start with a dry run.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {runs.data!.data.slice(0, 10).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>
                  <Badge tone={r.mode === "apply" ? "warning" : "muted"}>{r.mode === "apply" ? "deleted" : "dry run"}</Badge> {r.total_rows} rows · policy v{r.policy_version}
                  {r.reason ? ` · ${r.reason}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Data inventory" hint="Every table with its retention category and tags, read from the live schema." testId="admin-inventory">
        {inventory.isLoading ? (
          <Skeleton className="h-24 w-full rounded-md" />
        ) : inventory.isError ? (
          <Alert variant="error">{adminErrorMessage(inventory.error, "Could not load the data inventory.")}</Alert>
        ) : (
          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-background">
                <tr>
                  <th className="px-3 py-2">Table</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Tags</th>
                </tr>
              </thead>
              <tbody>
                {inventory.data!.data.map((r) => (
                  <tr key={r.table} className="border-t">
                    <td className="px-3 py-1 font-mono">{r.table}</td>
                    <td className="px-3 py-1">{humanizeAdmin(r.category)}</td>
                    <td className="px-3 py-1">{r.tags.map(humanizeAdmin).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Operational health numbers with their alert thresholds. */
export function OpsPanel() {
  const api = useCopsAdminApi();
  const authReady = useAuthReady();
  const q = useQuery({ queryKey: ["cops-ops-metrics"], queryFn: () => api.metrics(), enabled: authReady, refetchInterval: 60_000 });
  const tone = { ok: "success", warn: "warning", critical: "danger" } as const;
  return (
    <Panel title="Operations" hint="Health of the CustomerOps workflows in this workspace. Refreshes every minute." testId="admin-ops">
      {q.isLoading ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : q.isError ? (
        <Alert variant="error">{adminErrorMessage(q.error, "Could not load the operational metrics.")}</Alert>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {q.data!.data.metrics.map((m) => (
            <li key={m.key} className="rounded-md border p-3 text-sm" data-testid={`metric-${m.key}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                <Badge tone={tone[m.status]}>{m.status === "ok" ? "OK" : m.status === "warn" ? "Warning" : "Critical"}</Badge>
              </div>
              <p className="mt-1 text-lg font-semibold">{formatMetric(m)}</p>
              {m.status !== "ok" && <p className="text-xs text-muted-foreground">Runbook: {m.runbook}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
