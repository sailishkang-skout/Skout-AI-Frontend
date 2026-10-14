"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useAuthReady } from "@/lib/api-client";
import { can, COMMERCIAL_PERMS } from "@/lib/cops-commercial";
import { advancedErrorMessage, useCopsAdvancedApi, type AccountContractFields } from "@/lib/cops-commercial-advanced";
import { Field } from "../form-field";

const FIELDS: Array<{ key: keyof AccountContractFields; label: string; placeholder: string }> = [
  { key: "region", label: "Region", placeholder: "e.g. EU" },
  { key: "segment", label: "Segment", placeholder: "e.g. enterprise" },
  { key: "legal_entity", label: "Legal entity", placeholder: "e.g. Acme GmbH" },
];

/**
 * COPS-08: the account details that pick the contract template when a contract is sent for
 * signature (Bible p.32). Stored as the account's custom fields. Read-only without write access.
 */
export function ContractFieldsCard({ accountId, permissions }: { accountId: string; permissions: readonly string[] }) {
  const api = useCopsAdvancedApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const queryKey = ["cops-contract-fields", accountId];
  const query = useQuery({ queryKey, queryFn: () => api.contractFields(accountId), enabled: authReady, retry: false });
  const saved = query.data?.data;
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canWrite = can(permissions, [...COMMERCIAL_PERMS.contractWrite]);

  useEffect(() => {
    if (saved) setForm({ region: saved.region ?? "", segment: saved.segment ?? "", legal_entity: saved.legal_entity ?? "" });
  }, [saved]);

  if (!saved && !query.isError) return null;
  const changed = saved && FIELDS.some((f) => (form[f.key] ?? "") !== (saved[f.key] ?? ""));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.setContractFields(accountId, { region: form.region ?? "", segment: form.segment ?? "", legal_entity: form.legal_entity ?? "" });
      toast({ title: "Contract details saved", variant: "success" });
      await queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      setError(advancedErrorMessage(err, "Could not save the contract details."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-4" data-testid="contract-fields">
      <div>
        <p className="text-sm font-medium">Contract details</p>
        <p className="text-xs text-muted-foreground">Pick the contract template when a contract is sent for signature. Leave a field empty to match any template.</p>
      </div>
      {query.isError && <Alert variant="error">{advancedErrorMessage(query.error, "Could not load the contract details.")}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      {saved && (
        <div className="grid gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} aria-label={f.label} placeholder={f.placeholder} maxLength={f.key === "legal_entity" ? 200 : 100} disabled={!canWrite} />
            </Field>
          ))}
        </div>
      )}
      {canWrite && saved && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={busy || !changed}>
            {busy && <Loader2 className="animate-spin" />}
            Save contract details
          </Button>
        </div>
      )}
    </div>
  );
}
