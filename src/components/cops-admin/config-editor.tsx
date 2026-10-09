"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { adminErrorMessage, CONFIG_EMPTY, CONFIG_FIELDS, formToValue, useCopsAdminApi, valueToForm, type ConfigVersion } from "@/lib/cops-admin";

type Kind = keyof typeof CONFIG_FIELDS;
const TEXTAREA = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * COPS-07 editor for one config kind (trial templates, credit packages, email templates). A save is
 * always a new version with a reason; the history lists every version and can restore one. The
 * built-in default is shown as version 0 until the workspace saves its own.
 */
export function ConfigEditor({ kind, title, emptyTitle, emptyHint, canWrite, keyHint }: { kind: Kind; title: string; emptyTitle: string; emptyHint: string; canWrite: boolean; keyHint: string }) {
  const api = useCopsAdminApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const fields = CONFIG_FIELDS[kind];
  const [editing, setEditing] = useState<{ key: string; isNew: boolean; version: number } | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [newKey, setNewKey] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  const list = useQuery({ queryKey: ["cops-admin-config", kind], queryFn: () => api.list(kind), enabled: authReady });
  const history = useQuery({
    queryKey: ["cops-admin-config-versions", kind, historyKey],
    queryFn: () => api.versions(kind, historyKey as string),
    enabled: authReady && Boolean(historyKey),
  });
  const rows = list.data?.data ?? [];

  function open(row: ConfigVersion | null) {
    setEditing(row ? { key: row.key, isNew: false, version: row.version } : { key: "", isNew: true, version: 0 });
    setForm(valueToForm(fields, row ? row.value : CONFIG_EMPTY[kind]));
    setNewKey("");
    setReason("");
    setError(null);
  }

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cops-admin-config", kind] }),
      queryClient.invalidateQueries({ queryKey: ["cops-admin-config-versions", kind] }),
    ]);

  async function save() {
    if (!editing) return;
    const key = editing.isNew ? newKey.trim() : editing.key;
    setBusy(true);
    setError(null);
    try {
      await api.save(kind, key, formToValue(fields, form), reason.trim(), editing.isNew ? undefined : editing.version);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(adminErrorMessage(err, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  async function restore(version: number) {
    if (!historyKey) return;
    const why = window.prompt(`Why restore version ${version}? This is recorded in the audit log.`);
    if (!why?.trim()) return;
    setError(null);
    try {
      await api.rollback(kind, historyKey, version, why.trim());
      await refresh();
    } catch (err) {
      setError(adminErrorMessage(err, "Could not restore that version."));
    }
  }

  const keyOk = !editing?.isNew || /^[a-z0-9][a-z0-9_-]{0,63}$/.test(newKey.trim());
  const requiredOk = fields.every((f) => !f.required || String(form[f.name] ?? "").trim() !== "");
  const valid = keyOk && requiredOk && reason.trim().length > 0;

  return (
    <div className="space-y-3" data-testid={`config-editor-${kind}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {canWrite && !editing && (
          <Button size="sm" onClick={() => open(null)} data-testid={`config-new-${kind}`}>
            New
          </Button>
        )}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {list.isLoading ? (
        <Skeleton className="h-24 w-full rounded-md" />
      ) : list.isError ? (
        <Alert variant="error">{adminErrorMessage(list.error, "Could not load this configuration.")}</Alert>
      ) : rows.length === 0 && !editing ? (
        <div className="rounded-md border border-dashed p-6 text-center" data-testid={`config-empty-${kind}`}>
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" data-testid={`config-row-${r.key}`}>
              <div className="min-w-0">
                <span className="font-medium">{String(r.value.name ?? r.value.subject ?? r.key)}</span>{" "}
                <span className="text-xs text-muted-foreground">{r.key}</span>{" "}
                <Badge tone={r.is_system_default ? "muted" : "info"}>{r.is_system_default ? "built-in default" : `v${r.version}`}</Badge>
              </div>
              <div className="flex gap-2">
                {!r.is_system_default && (
                  <Button size="sm" variant="outline" onClick={() => setHistoryKey(historyKey === r.key ? null : r.key)}>
                    History
                  </Button>
                )}
                {canWrite && (
                  <Button size="sm" variant="outline" onClick={() => open(r)} data-testid={`config-edit-${r.key}`}>
                    Edit
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {historyKey && (
        <div className="rounded-md border p-3" data-testid="config-history">
          <p className="text-sm font-medium">Version history: {historyKey}</p>
          {history.isLoading ? (
            <Skeleton className="mt-2 h-12 w-full rounded-md" />
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {(history.data?.data ?? []).map((v, i) => (
                <li key={v.version} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">v{v.version}</span> · {v.created_at ? new Date(v.created_at).toLocaleString() : ""} · {v.reason}
                    {v.restored_from_version ? ` (restored from v${v.restored_from_version})` : ""}
                  </span>
                  {canWrite && i > 0 && (
                    <button type="button" className="underline" onClick={() => restore(v.version)}>
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-3 rounded-md border p-3" data-testid="config-form">
          <p className="text-sm font-medium">{editing.isNew ? "New" : `Edit ${editing.key} (saves as v${editing.version + 1})`}</p>
          {editing.isNew && (
            <label className="block text-xs">
              Key
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} aria-label="Key" placeholder={keyHint} />
              {!keyOk && newKey && <span className="text-destructive">Lowercase letters, digits, - and _ only</span>}
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.name} className={f.type === "longtext" ? "block text-xs sm:col-span-2" : "block text-xs"}>
                {f.label}
                {f.required ? " *" : ""}
                {f.type === "boolean" ? (
                  <input type="checkbox" className="ml-2 align-middle" checked={Boolean(form[f.name])} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} aria-label={f.label} />
                ) : f.type === "longtext" ? (
                  <textarea rows={3} className={TEXTAREA} value={String(form[f.name] ?? "")} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} aria-label={f.label} />
                ) : (
                  <Input type={f.type === "number" ? "number" : "text"} value={String(form[f.name] ?? "")} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} aria-label={f.label} />
                )}
                {f.help && <span className="text-muted-foreground">{f.help}</span>}
              </label>
            ))}
          </div>
          <label className="block text-xs">
            Reason for this change *
            <Input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for this change" placeholder="Recorded in the audit log" maxLength={1000} />
          </label>
          <p className="text-xs text-muted-foreground">Saving creates a new version. Anything already running keeps the version it started with.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy || !valid} data-testid="config-save">
              {busy && <Loader2 className="animate-spin" />}
              Save new version
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
