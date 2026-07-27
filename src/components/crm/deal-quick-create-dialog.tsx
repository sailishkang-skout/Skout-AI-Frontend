"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useDealsApi } from "@/lib/crm/deals";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { CURRENCY_OPTIONS } from "@/lib/crm-display";
import { Field } from "./form-field";
import type { Deal } from "@/types/crm";

export function DealQuickCreateDialog({
  open,
  onClose,
  pipelineId,
  stageId,
  stageName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  pipelineId: string;
  stageId: string;
  stageName: string;
  onCreated?: (deal: Deal) => void;
}) {
  const queryClient = useQueryClient();
  const companiesApi = useCompaniesApi();
  const dealsApi = useDealsApi();
  const authReady = useAuthReady();

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(CURRENCY_OPTIONS[0]);

  const companies = useQuery({
    queryKey: ["crm", "companies", { forPicker: true }],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: open && authReady,
  });

  useEffect(() => {
    if (!open) return;
    setName("");
    setCompanyId("");
    setAmount("");
    setCurrency(CURRENCY_OPTIONS[0]);
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      dealsApi.create({
        name: name.trim(),
        companyId,
        amount: amount ? Number(amount) : undefined,
        currency,
        pipelineId,
        stageId,
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
      onCreated?.(saved);
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={`Add deal to ${stageName}`}>
      <div className="space-y-4">
        {create.isError && (
          <Alert variant="error">{formatQueryError(create.error, "Could not create this deal.")}</Alert>
        )}

        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme — Annual Contract" />
        </Field>
        <Field label="Company" required>
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={companies.isLoading}>
            <option value="">Select a company…</option>
            {companies.data?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || !companyId || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create deal
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
