"use client";

import type { AutomationNode, AutomationNodeType } from "@/lib/automations";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** Text areas aren't a shared UI component here — a plain textarea matching Input's look. */
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

/** Any text field below can reference an earlier step's output, e.g. {{n1.status}}. */
function TemplateHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Reference an earlier step&apos;s output with <code className="rounded bg-muted px-1 py-0.5">{"{{nodeId.field}}"}</code> —
      e.g. <code className="rounded bg-muted px-1 py-0.5">{"{{n1.status}}"}</code>.
    </p>
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
}

/**
 * Per-node-type config form. Field names/shapes must exactly match what each backend node
 * handler destructures from `config` (apps/api/src/services/automation-nodes/*.node.ts) — this
 * is the one place a mismatch would silently produce an empty/undefined value at run time.
 */
export function NodeConfigPanel({ node, onChange }: NodeConfigPanelProps) {
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

    case "condition":
      return (
        <div className="space-y-3">
          <Field label="Source node ID">
            <Input
              data-testid="config-sourceNodeId"
              value={(config.sourceNodeId as string) ?? ""}
              onChange={(e) => set({ sourceNodeId: e.target.value })}
              placeholder="n1"
            />
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
          <TemplateHint />
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
          <TemplateHint />
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
          <TemplateHint />
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
            <Input
              data-testid="config-activityType"
              value={(config.activityType as string) ?? "workflow_action"}
              onChange={(e) => set({ activityType: e.target.value })}
            />
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
  { type: "approval", label: "Approval" },
];
