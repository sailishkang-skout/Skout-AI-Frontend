"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCompaniesApi } from "@/lib/crm/companies";
import { formatQueryError } from "@/lib/api-client";
import { Field } from "./form-field";
import type { Company, CompanyStatus } from "@/types/crm";

const STATUS_OPTIONS: CompanyStatus[] = ["active", "customer", "churned"];

export function CompanyFormSheet({
  open,
  onClose,
  company,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Omit for create, pass an existing Company for edit. */
  company?: Company;
  onSaved?: (company: Company) => void;
}) {
  const queryClient = useQueryClient();
  const companiesApi = useCompaniesApi();
  const isEdit = Boolean(company);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [revenue, setRevenue] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<CompanyStatus>("active");

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? "");
    setDomain(company?.domain ?? "");
    setIndustry(company?.industry ?? "");
    setEmployeeCount(company?.employeeCount != null ? String(company.employeeCount) : "");
    setRevenue(company?.revenue != null ? String(company.revenue) : "");
    setLocation(company?.location ?? "");
    setStatus(company?.status ?? "active");
  }, [open, company]);

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        domain: domain.trim() || undefined,
        industry: industry.trim() || undefined,
        employeeCount: employeeCount ? Number(employeeCount) : undefined,
        revenue: revenue ? Number(revenue) : undefined,
        location: location.trim() || undefined,
        status,
      };
      return isEdit ? companiesApi.update(company!.id, input) : companiesApi.create(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "companies"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["crm", "companies", company!.id] });
      onSaved?.(saved);
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit company" : "New company"}
      description="Companies are the accounts your contacts and deals belong to."
    >
      <div className="space-y-4">
        {save.isError && (
          <Alert variant="error">{formatQueryError(save.error, "Could not save this company.")}</Alert>
        )}

        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
        </Field>
        <Field label="Domain">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
        </Field>
        <Field label="Industry" fieldSource={company?.fieldSources.industry}>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employees" fieldSource={company?.fieldSources.employeeCount}>
            <Input
              type="number"
              min={0}
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
            />
          </Field>
          <Field label="Revenue" fieldSource={company?.fieldSources.revenue}>
            <Input type="number" min={0} value={revenue} onChange={(e) => setRevenue(e.target.value)} />
          </Field>
        </div>
        <Field label="Location" fieldSource={company?.fieldSources.location}>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin, TX" />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as CompanyStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create company"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
