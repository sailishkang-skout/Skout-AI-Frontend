"use client";

import type { AutomationNode, AutomationNodeType } from "@/lib/automations";
import type { EnrichField } from "@/types/api";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** Mirrors src/app/(dashboard)/enrichment/page.tsx's ALL_FIELDS — same field set, same
 * toggle-chip pattern, so action_enrichment's config matches what a human enrichment run
 * already looks like instead of inventing a second UI for the same choice. */
const ENRICH_FIELDS: { id: EnrichField; label: string }[] = [
  { id: "company", label: "Firmographics" },
  { id: "email", label: "Email finder" },
  { id: "validation", label: "Email verify" },
  { id: "phone", label: "Phone" },
];

/** Text areas aren't a shared UI component here — a plain textarea matching Input's look. */
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

/**
 * Any text field below can reference an earlier step's output via {{nodeId.field}} — but nodeId
 * has to be the real id, not the short suffix shown on the canvas node (e.g. a node labeled
 * "action_http · 6407" is really "n1787869206593"; "6407" is just its last 4 characters for
 * display). Listing the real ids here — with a one-click copy — is what makes that usable instead
 * of a guessing game.
 */
function TemplateHint({ priorNodes }: { priorNodes: { id: string; label: string }[] }) {
  return (
    <div className="space-y-1.5 rounded-md border border-dashed border-border bg-muted/20 p-2.5 text-xs">
      <p className="text-muted-foreground">
        Reference an earlier step&apos;s output with <code className="rounded bg-muted px-1 py-0.5">{"{{nodeId.field}}"}</code> — use
        the full id below, not the short label shown on the canvas.
      </p>
      {priorNodes.length === 0 ? (
        <p className="text-muted-foreground">No earlier steps connected yet.</p>
      ) : (
        <ul className="space-y-1">
          {priorNodes.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                <code className="rounded bg-muted px-1 py-0.5">{n.id}</code> <span className="text-muted-foreground">({n.label})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(n.id);
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                data-testid={`copy-node-id-${n.id}`}
              >
                Copy id
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export interface NodeConfigPanelProps {
  node: AutomationNode;
  onChange: (config: Record<string, unknown>) => void;
  /** Nodes with a path into this one, nearest first — used by condition's Source node dropdown. */
  priorNodes?: { id: string; label: string }[];
}

/**
 * Per-node-type config form. Field names/shapes must exactly match what each backend node
 * handler destructures from `config` (apps/api/src/services/automation-nodes/*.node.ts) — this
 * is the one place a mismatch would silently produce an empty/undefined value at run time.
 */
export function NodeConfigPanel({ node, onChange, priorNodes = [] }: NodeConfigPanelProps) {
  const config = node.config;
  function set(patch: Record<string, unknown>) {
    onChange({ ...config, ...patch });
  }

  switch (node.type) {
    case "trigger":
      return (
        <div className="space-y-3">
          <Field label="Trigger type">
            <Select
              data-testid="config-triggerType"
              value={(config.triggerType as string) ?? "manual"}
              onChange={(e) => set({ triggerType: e.target.value })}
            >
              <option value="manual">Manual (Run now)</option>
              <option value="webhook">Inbound webhook</option>
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground">
            Event and schedule triggers aren&apos;t wired yet — this automation currently runs via
            a manual click or its webhook URL.
          </p>
        </div>
      );

    case "condition": {
      const sourceNodeId = (config.sourceNodeId as string) ?? "";
      const knownSource = priorNodes.some((n) => n.id === sourceNodeId);
      return (
        <div className="space-y-3">
          <Field label="Source node">
            <Select
              data-testid="config-sourceNodeId"
              value={sourceNodeId}
              onChange={(e) => set({ sourceNodeId: e.target.value })}
            >
              <option value="" disabled>
                {priorNodes.length ? "Select an earlier step" : "Connect an earlier step first"}
              </option>
              {priorNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
              {sourceNodeId && !knownSource && <option value={sourceNodeId}>{sourceNodeId} (not connected)</option>}
            </Select>
          </Field>
          <Field label="Field">
            <Input
              data-testid="config-field"
              value={(config.field as string) ?? ""}
              onChange={(e) => set({ field: e.target.value })}
              placeholder="status"
            />
          </Field>
          <Field label="Operator">
            <Select data-testid="config-op" value={(config.op as string) ?? "equals"} onChange={(e) => set({ op: e.target.value })}>
              <option value="equals">Equals</option>
              <option value="not_equals">Not equals</option>
            </Select>
          </Field>
          <Field label="Value">
            <Input
              data-testid="config-value"
              value={(config.value as string) ?? ""}
              onChange={(e) => set({ value: e.target.value })}
              placeholder="active"
            />
          </Field>
        </div>
      );
    }

    case "delay":
      return (
        <Field label="Delay (seconds)">
          <Input
            data-testid="config-seconds"
            type="number"
            min={0}
            value={(config.seconds as number) ?? 0}
            onChange={(e) => set({ seconds: Number(e.target.value) })}
          />
        </Field>
      );

    case "action_http":
      return (
        <div className="space-y-3">
          <TemplateHint priorNodes={priorNodes} />
          <Field label="URL">
            <Input data-testid="config-url" value={(config.url as string) ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Method">
            <Select data-testid="config-method" value={(config.method as string) ?? "GET"} onChange={(e) => set({ method: e.target.value })}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </Select>
          </Field>
          <Field label="Body (JSON)">
            <TextArea
              data-testid="config-body"
              value={typeof config.body === "string" ? config.body : config.body ? JSON.stringify(config.body) : ""}
              onChange={(e) => {
                try {
                  set({ body: JSON.parse(e.target.value) });
                } catch {
                  set({ body: e.target.value });
                }
              }}
              placeholder='{"key": "value"}'
            />
          </Field>
          <Field label="Credential ID (optional)">
            <Input
              data-testid="config-credentialId"
              value={(config.credentialId as string) ?? ""}
              onChange={(e) => set({ credentialId: e.target.value || undefined })}
              placeholder="Attach a saved credential"
            />
          </Field>
        </div>
      );

    case "action_notification":
      return (
        <div className="space-y-3">
          <TemplateHint priorNodes={priorNodes} />
          <Field label="Title">
            <Input data-testid="config-title" value={(config.title as string) ?? ""} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Body">
            <TextArea data-testid="config-notif-body" value={(config.body as string) ?? ""} onChange={(e) => set({ body: e.target.value })} />
          </Field>
          <Field label="Type">
            <Input
              data-testid="config-type"
              value={(config.type as string) ?? "workflow"}
              onChange={(e) => set({ type: e.target.value })}
            />
          </Field>
        </div>
      );

    case "action_crm_writeback":
      return (
        <div className="space-y-3">
          <TemplateHint priorNodes={priorNodes} />
          <Field label="Entity type">
            <Select
              data-testid="config-entityType"
              value={(config.entityType as string) ?? "contact"}
              onChange={(e) => set({ entityType: e.target.value })}
            >
              <option value="contact">Contact</option>
              <option value="company">Company</option>
              <option value="deal">Deal</option>
            </Select>
          </Field>
          <Field label="Entity ID">
            <Input data-testid="config-entityId" value={(config.entityId as string) ?? ""} onChange={(e) => set({ entityId: e.target.value })} />
          </Field>
          <Field label="Activity type">
            {/* Matches ActivityType in src/types/crm.ts exactly — the CRM timeline only has an
                icon/label for these five, and the DB column enforces nothing, so anything else
                silently falls back to an unstyled entry there. */}
            <Select
              data-testid="config-activityType"
              value={(config.activityType as string) ?? "note"}
              onChange={(e) => set({ activityType: e.target.value })}
            >
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="stage_change">Stage change</option>
            </Select>
          </Field>
          <Field label="Subject (optional)">
            <Input data-testid="config-subject" value={(config.subject as string) ?? ""} onChange={(e) => set({ subject: e.target.value })} />
          </Field>
        </div>
      );

    case "action_sequence_enroll":
      return (
        <div className="space-y-3">
          <Field label="Sequence ID">
            <Input data-testid="config-sequenceId" value={(config.sequenceId as string) ?? ""} onChange={(e) => set({ sequenceId: e.target.value })} />
          </Field>
          <Field label="Prospect ID">
            <Input data-testid="config-prospectId" value={(config.prospectId as string) ?? ""} onChange={(e) => set({ prospectId: e.target.value })} />
          </Field>
        </div>
      );

    case "action_ai": {
      // Config: { prospectId, prompt } — matches action-ai.node.ts's destructuring exactly,
      // both required (handler 422s otherwise).
      return (
        <div className="space-y-3">
          <TemplateHint priorNodes={priorNodes} />
          <Field label="Prospect ID">
            <Input
              data-testid="config-ai-prospectId"
              value={(config.prospectId as string) ?? ""}
              onChange={(e) => set({ prospectId: e.target.value })}
            />
          </Field>
          <Field label="Prompt">
            <TextArea
              data-testid="config-ai-prompt"
              value={(config.prompt as string) ?? ""}
              onChange={(e) => set({ prompt: e.target.value })}
              placeholder="e.g. Draft a follow-up email referencing their recent funding round"
            />
          </Field>
        </div>
      );
    }

    case "action_enrichment": {
      // Config: { companyDomain, fields?, fullName?, title?, email?, linkedinUrl?, prospectId? }
      // — companyDomain is the only field the handler requires; the rest is a Partial<ProspectSnapshot>
      // passed straight through to enrichProspect, same as the manual enrichment-run UI's inputs.
      const fields = (config.fields as EnrichField[] | undefined) ?? [];
      const toggleField = (id: EnrichField) =>
        set({ fields: fields.includes(id) ? fields.filter((f) => f !== id) : [...fields, id] });
      return (
        <div className="space-y-3">
          <Field label="Company domain">
            <Input
              data-testid="config-companyDomain"
              value={(config.companyDomain as string) ?? ""}
              onChange={(e) => set({ companyDomain: e.target.value })}
              placeholder="acme.com"
            />
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground">Fields to enrich</span>
            <div className="flex flex-wrap gap-1.5">
              {ENRICH_FIELDS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-testid={`config-enrich-field-${f.id}`}
                  onClick={() => toggleField(f.id)}
                  className={
                    fields.includes(f.id)
                      ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs text-primary"
                      : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Prospect ID (optional)">
            <Input
              data-testid="config-enrich-prospectId"
              value={(config.prospectId as string) ?? ""}
              onChange={(e) => set({ prospectId: e.target.value || undefined })}
            />
          </Field>
          <Field label="Full name (optional)">
            <Input
              data-testid="config-fullName"
              value={(config.fullName as string) ?? ""}
              onChange={(e) => set({ fullName: e.target.value || undefined })}
            />
          </Field>
          <Field label="Title (optional)">
            <Input
              data-testid="config-enrich-title"
              value={(config.title as string) ?? ""}
              onChange={(e) => set({ title: e.target.value || undefined })}
            />
          </Field>
          <Field label="Email (optional)">
            <Input
              data-testid="config-enrich-email"
              value={(config.email as string) ?? ""}
              onChange={(e) => set({ email: e.target.value || undefined })}
            />
          </Field>
          <Field label="LinkedIn URL (optional)">
            <Input
              data-testid="config-linkedinUrl"
              value={(config.linkedinUrl as string) ?? ""}
              onChange={(e) => set({ linkedinUrl: e.target.value || undefined })}
            />
          </Field>
        </div>
      );
    }

    case "action_crm_sync": {
      // Config: { entityType: "contact"|"deal", entityId, patch } — deliberately narrower than
      // action_crm_writeback's entityType (no "company"): crmSyncOwnedPatch only defines owned
      // fields for contact/deal (packages/shared/src/crm-sync-fields.ts), and this is the
      // "push-back" mechanism ADI-18's settings/crm status page already names — same term, same
      // conflict rule (a local edit is dropped if HubSpot's value changed more recently).
      return (
        <div className="space-y-3">
          <TemplateHint priorNodes={priorNodes} />
          <Field label="Entity type">
            <Select
              data-testid="config-sync-entityType"
              value={(config.entityType as string) ?? "contact"}
              onChange={(e) => set({ entityType: e.target.value })}
            >
              <option value="contact">Contact</option>
              <option value="deal">Deal</option>
            </Select>
          </Field>
          <Field label="Entity ID">
            <Input
              data-testid="config-sync-entityId"
              value={(config.entityId as string) ?? ""}
              onChange={(e) => set({ entityId: e.target.value })}
            />
          </Field>
          <Field label="Patch (JSON)">
            <TextArea
              data-testid="config-patch"
              value={typeof config.patch === "string" ? config.patch : config.patch ? JSON.stringify(config.patch) : ""}
              onChange={(e) => {
                try {
                  set({ patch: JSON.parse(e.target.value) });
                } catch {
                  set({ patch: e.target.value });
                }
              }}
              placeholder='{"firstName": "Ada"} — contact allows firstName/lastName/email/phone/title, deal allows name/amount. Pushed to HubSpot; unrecognized keys are dropped, not errored.'
            />
          </Field>
        </div>
      );
    }

    case "approval":
      return (
        <div className="space-y-3">
          <Field label="Entity type">
            <Input data-testid="config-approval-entityType" value={(config.entityType as string) ?? ""} onChange={(e) => set({ entityType: e.target.value })} />
          </Field>
          <Field label="Entity ID">
            <Input data-testid="config-approval-entityId" value={(config.entityId as string) ?? ""} onChange={(e) => set({ entityId: e.target.value })} />
          </Field>
          <p className="text-xs text-muted-foreground">
            Pauses the run for sign-off through the workspace&apos;s existing Policy Gateway.
          </p>
        </div>
      );

    default: {
      const _exhaustive: never = node.type;
      return <p className="text-xs text-muted-foreground">Unknown node type: {String(_exhaustive)}</p>;
    }
  }
}

export const ALL_NODE_TYPES: { type: AutomationNodeType; label: string }[] = [
  { type: "trigger", label: "Trigger" },
  { type: "condition", label: "Condition" },
  { type: "delay", label: "Delay" },
  { type: "action_http", label: "HTTP request" },
  { type: "action_notification", label: "Notification" },
  { type: "action_crm_writeback", label: "CRM writeback" },
  { type: "action_sequence_enroll", label: "Enroll in sequence" },
  { type: "action_ai", label: "AI draft" },
  { type: "action_enrichment", label: "Enrichment" },
  { type: "action_crm_sync", label: "CRM push-back" },
  { type: "approval", label: "Approval" },
];
