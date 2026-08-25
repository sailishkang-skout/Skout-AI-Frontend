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
import { usePipelinesApi } from "@/lib/crm/pipelines";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { CURRENCY_OPTIONS } from "@/lib/crm-display";
import { Field } from "./form-field";
import type { Deal, DealStatus } from "@/types/crm";

const STATUS_OPTIONS: DealStatus[] = ["open", "won", "lost"];

export function DealFormSheet({
  open,
  onClose,
  deal,
  defaultCompanyId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  deal?: Deal;
  defaultCompanyId?: string;
  onSaved?: (deal: Deal) => void;
}) {
  const queryClient = useQueryClient();
  const companiesApi = useCompaniesApi();
  const dealsApi = useDealsApi();
  const pipelinesApi = usePipelinesApi();
  const authReady = useAuthReady();
  const isEdit = Boolean(deal);

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(CURRENCY_OPTIONS[0]);
  const [closeDate, setCloseDate] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [status, setStatus] = useState<DealStatus>("open");

  const companies = useQuery({
    queryKey: ["crm", "companies", { forPicker: true }],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: open && authReady,
  });

  const pipelines = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => pipelinesApi.list(),
    enabled: open && authReady,
  });

  const stages = pipelines.data?.data.find((p) => p.id === pipelineId)?.stages ?? [];

  useEffect(() => {
    if (!open) return;
    setName(deal?.name ?? "");
    setCompanyId(deal?.companyId ?? defaultCompanyId ?? "");
    setAmount(deal?.amount != null ? String(deal.amount) : "");
    setCurrency(deal?.currency ?? CURRENCY_OPTIONS[0]);
    setCloseDate(deal?.closeDate ? deal.closeDate.slice(0, 10) : "");
    setStageId(deal?.stageId ?? "");
    setStatus(deal?.status ?? "open");
  }, [open, deal, defaultCompanyId]);

  // Defaults to the deal's existing pipeline when editing, or the workspace default when
  // creating fresh — waits for the pipelines list since isDefault isn't known up front.
  useEffect(() => {
    if (!open || !pipelines.data) return;
    if (deal?.pipelineId) {
      setPipelineId(deal.pipelineId);
      return;
    }
    setPipelineId((cur) =>
      cur && pipelines.data!.data.some((p) => p.id === cur)
        ? cur
        : (pipelines.data!.data.find((p) => p.isDefault) ?? pipelines.data!.data[0])?.id ?? ""
    );
  }, [open, deal, pipelines.data]);

  const save = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return dealsApi.update(deal!.id, {
          name: name.trim(),
          companyId: companyId || undefined,
          amount: amount ? Number(amount) : undefined,
          currency,
          closeDate: closeDate || undefined,
          stageId: stageId || undefined,
          status,
        });
      }
      return dealsApi.create({
        name: name.trim(),
        companyId,
        amount: amount ? Number(amount) : undefined,
        currency,
        closeDate: closeDate || undefined,
        pipelineId: pipelineId || undefined,
        stageId: stageId || undefined,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["crm", "deals", deal!.id] });
      onSaved?.(saved);
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit deal" : "New deal"}
      description="Deals track a revenue opportunity through your pipeline."
    >
      <div className="space-y-4">
        {save.isError && (
          <Alert variant="error">{formatQueryError(save.error, "Could not save this deal.")}</Alert>
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
              {(CURRENCY_OPTIONS as readonly string[]).includes(currency) ? null : (
                <option value={currency}>{currency}</option>
              )}
              {CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Close date">
          <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
        </Field>
        {!isEdit && (pipelines.data?.data.length ?? 0) > 1 && (
          <Field label="Pipeline">
            <Select
              value={pipelineId}
              onChange={(e) => {
                setPipelineId(e.target.value);
                setStageId("");
              }}
              disabled={pipelines.isLoading}
            >
              {pipelines.data?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {stages.length > 0 && (
          <Field label="Stage">
            <Select value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={pipelines.isLoading}>
              {stages
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        {isEdit && (
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as DealStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!name.trim() || !companyId || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create deal"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
