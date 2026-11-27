"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MAX_CRM_FIELDS, needsValue, operatorLabel, valueInput, type CrmFilterDraft, type CrmObjectInfo, type CrmOperator, type CrmSelection } from "@/lib/workbooks-v2-crm";

const n = (value: number) => value.toLocaleString("en-US");

/** Which records: all of them, one of the CRM's saved selections, or those matching filters. */
export function CrmSelectionPicker({ info, selection, onChange }: { info: CrmObjectInfo; selection: CrmSelection; onChange: (selection: CrmSelection) => void }) {
  const { views, fields, filters } = info;
  const choose = (kind: CrmSelection["kind"]) => {
    if (kind === selection.kind) return;
    onChange(kind === "all" ? { kind } : kind === "view" ? { kind, viewId: "" } : { kind, filters: [] });
  };
  const rows = selection.kind === "filters" ? selection.filters : [];
  const update = (next: CrmFilterDraft[]) => onChange({ kind: "filters", filters: next });
  const change = (index: number, filter: CrmFilterDraft) => update(rows.map((f, i) => (i === index ? filter : f)));
  const fieldOf = (name: string) => fields.find((f) => f.name === name);
  const noViews = !views.available ? views.reason : !views.items.length ? `You have no ${views.label.toLowerCase()}s for these records.` : null;

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold">Which records</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="crm-selection" checked={selection.kind === "all"} onChange={() => choose("all")} />
          All records
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="crm-selection" checked={selection.kind === "view"} disabled={Boolean(noViews)} onChange={() => choose("view")} />
          A {views.label}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="crm-selection" checked={selection.kind === "filters"} onChange={() => choose("filters")} />
          Filtered records
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{noViews ?? views.note}</p>

      {selection.kind === "view" ? (
        <Select aria-label={views.label} className="max-w-md" value={selection.viewId} onChange={(e) => onChange({ kind: "view", viewId: e.target.value })}>
          <option value="">Choose a {views.label}</option>
          {views.items.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
              {view.count === null ? "" : ` (${n(view.count)})`}
            </option>
          ))}
        </Select>
      ) : null}

      {selection.kind === "filters" ? (
        <div className="space-y-2">
          {rows.map((filter, index) => {
            const field = fieldOf(filter.field);
            const kind = field ? valueInput(field.type) : "text";
            const label = `Filter ${index + 1}`;
            return (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={`${label} field`}
                  className="w-56"
                  value={filter.field}
                  onChange={(e) => change(index, { field: e.target.value, operator: fieldOf(e.target.value)?.operators[0] ?? "equals", value: "" })}
                >
                  <option value="">Choose a field</option>
                  {fields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                {field ? (
                  <Select aria-label={`${label} condition`} className="w-44" value={filter.operator} onChange={(e) => change(index, { ...filter, operator: e.target.value as CrmOperator })}>
                    {field.operators.map((operator) => (
                      <option key={operator} value={operator}>
                        {operatorLabel(operator, field.type)}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {field && needsValue(filter.operator) ? (
                  kind === "boolean" ? (
                    <Select aria-label={`${label} value`} className="w-32" value={filter.value} onChange={(e) => change(index, { ...filter, value: e.target.value })}>
                      <option value="">Choose</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </Select>
                  ) : (
                    <Input aria-label={`${label} value`} className="w-48" type={kind} maxLength={500} value={filter.value} onChange={(e) => change(index, { ...filter, value: e.target.value })} />
                  )
                ) : null}
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => update(rows.filter((_, i) => i !== index))}>
                  <X aria-hidden />
                </Button>
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" variant="outline" disabled={rows.length >= filters.max} onClick={() => update([...rows, { field: "", operator: "equals", value: "" }])}>
              <Plus aria-hidden />
              Add filter
            </Button>
            <span className="text-xs text-muted-foreground">
              Records must match every filter. Up to {filters.max}.
            </span>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

/** Which of the CRM's or Apollo's fields to bring in. */
export function CrmFieldPicker({ info, chosen, onChange }: { info: { fields: Array<{ name: string; label: string }> }; chosen: string[]; onChange: (fields: string[]) => void }) {
  const [search, setSearch] = useState("");
  const wanted = search.trim().toLowerCase();
  const shown = info.fields.filter((f) => !wanted || f.label.toLowerCase().includes(wanted) || f.name.toLowerCase().includes(wanted));
  // Kept in the order they were chosen, which is the order of the preview's columns.
  const toggle = (name: string, on: boolean) => onChange(on ? [...chosen, name] : chosen.filter((f) => f !== name));

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold">Fields to import</legend>
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Search fields" placeholder="Search fields" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="text-xs text-muted-foreground">
          {n(chosen.length)} of {n(info.fields.length)} chosen (up to {MAX_CRM_FIELDS})
        </span>
      </div>
      <ul className="grid max-h-52 gap-x-4 overflow-y-auto rounded-md border p-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((field) => (
          <li key={field.name}>
            <label className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={chosen.includes(field.name)}
                disabled={!chosen.includes(field.name) && chosen.length >= MAX_CRM_FIELDS}
                onChange={(e) => toggle(field.name, e.target.checked)}
              />
              <span className="truncate" title={field.name}>
                {field.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {!shown.length ? <Alert>No field matches “{search}”.</Alert> : null}
    </fieldset>
  );
}
