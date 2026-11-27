"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DATA_TYPES,
  DEDUPE_OPTIONS,
  MAX_COLUMN_NAME,
  checkMapping,
  confirmBody,
  initialChoices,
  type Choice,
  type DataType,
  type DedupeState,
  type ImportPreview,
  type WorkbookColumn,
  type WorkbookImport,
} from "@/lib/workbooks-v2-import";

const SKIP = "skip";
const NEW = "new";

/** Choosing where each file column goes, how to find duplicates, and checking the first rows before anything is added. */
export function MappingStep({
  upload,
  preview,
  columns,
  busy,
  errors,
  onConfirm,
  onCancel,
}: {
  upload: WorkbookImport;
  preview: ImportPreview;
  columns: WorkbookColumn[];
  /** A confirm or cancel is on its way. */
  busy: boolean;
  /** Why the server refused the last attempt. */
  errors: string[];
  onConfirm: (body: ReturnType<typeof confirmBody>) => void;
  onCancel: () => void;
}) {
  const [choices, setChoices] = useState<Choice[]>(() => initialChoices(preview));
  const [dedupe, setDedupe] = useState<DedupeState>({ key: null });
  const check = checkMapping(preview.headers, choices, columns, dedupe);
  const inputs = columns.filter((c) => c.type === "input");
  const total = upload.counts.total;
  const keyLabel = DEDUPE_OPTIONS.find((o) => o.value === dedupe.key)?.label;
  const nameOf = (header: number) => preview.headers[header]?.name || `Column ${header + 1}`;

  const change = (header: number, choice: Choice) => setChoices((all) => all.map((c, i) => (i === header ? choice : c)));
  const pick = (header: number, value: string) => {
    if (value === SKIP) return change(header, { kind: "skip" });
    if (value !== NEW) return change(header, { kind: "existing", columnId: value });
    const suggested = preview.suggestions.find((s) => s.header === header)?.target;
    const start = suggested && "newColumn" in suggested ? suggested.newColumn : null;
    change(header, { kind: "new", name: start?.name ?? nameOf(header).slice(0, MAX_COLUMN_NAME), dataType: start?.dataType ?? "text" });
  };
  const destination = (header: number) => {
    const choice = choices[header]!;
    if (choice.kind === "new") return `${choice.name || "unnamed"} (new)`;
    if (choice.kind === "existing") return columns.find((c) => c.id === choice.columnId)?.name ?? "unknown column";
    return null;
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{upload.fileName}</span> has {total.toLocaleString("en-US")} row{total === 1 ? "" : "s"}. Nothing is added until you confirm.
      </p>

      <section aria-labelledby="import-mapping">
        <h3 id="import-mapping" className="mb-2 text-sm font-semibold">
          Map the columns
        </h3>
        <ul className="divide-y rounded-md border">
          {preview.headers.map((header) => {
            const choice = choices[header.index]!;
            const name = nameOf(header.index);
            const examples = preview.rows.map((r) => r.values[header.index]?.trim()).filter(Boolean).slice(0, 2);
            const error = check.columnErrors[header.index];
            const warning = check.warnings[header.index];
            return (
              <li key={header.index} className="space-y-2 p-3">
                <div className="grid gap-2 sm:grid-cols-2 sm:items-start">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{examples.length ? examples.join(" · ") : "No values in the first rows"}</p>
                  </div>
                  <div className="space-y-2">
                    <Select aria-label={`Import “${name}” into`} value={choice.kind === "existing" ? choice.columnId : choice.kind} onChange={(e) => pick(header.index, e.target.value)}>
                      <option value={SKIP}>Don’t import</option>
                      <option value={NEW}>New column</option>
                      {inputs.length ? (
                        <optgroup label="Workbook columns">
                          {inputs.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </Select>
                    {choice.kind === "new" ? (
                      <div className="flex gap-2">
                        <Input
                          aria-label={`Name of the new column for “${name}”`}
                          value={choice.name}
                          maxLength={MAX_COLUMN_NAME}
                          onChange={(e) => change(header.index, { ...choice, name: e.target.value })}
                        />
                        <Select
                          className="w-40 shrink-0"
                          aria-label={`Type of the new column for “${name}”`}
                          value={choice.dataType}
                          onChange={(e) => change(header.index, { ...choice, dataType: e.target.value as DataType })}
                        >
                          {DATA_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : null}
                  </div>
                </div>
                {error ? <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}
                {!error && warning ? <p className="text-xs text-amber-700 dark:text-amber-300">{warning}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Skip duplicates by</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {DEDUPE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input type="radio" name="dedupe" value={option.value} checked={dedupe.key === option.value} onChange={() => setDedupe({ key: option.value })} />
              {option.label}
            </label>
          ))}
        </div>
        {dedupe.key && dedupe.key !== "none" ? (
          <>
            {check.keyHeaders.length > 1 || (check.keyHeaders.length === 1 && check.keyHeader === null) ? (
              <Select
                aria-label={`Column that holds the ${keyLabel}`}
                className="max-w-sm"
                value={check.keyHeader ?? ""}
                onChange={(e) => setDedupe({ key: dedupe.key, header: e.target.value === "" ? undefined : Number(e.target.value) })}
              >
                <option value="">Choose the column that holds the {keyLabel}</option>
                {check.keyHeaders.map((h) => (
                  <option key={h} value={h}>
                    {nameOf(h)}
                  </option>
                ))}
              </Select>
            ) : null}
            <p className="text-xs text-muted-foreground">
              A row is skipped when its {keyLabel} is already in {check.keyHeader === null ? "that column" : `“${destination(check.keyHeader)}”`} or appears earlier in the file. Existing rows are never changed. Rows with no {keyLabel} are imported.
            </p>
          </>
        ) : null}
      </fieldset>

      <section aria-labelledby="import-preview">
        <h3 id="import-preview" className="mb-2 text-sm font-semibold">
          {total > preview.rows.length ? `First ${preview.rows.length} of ${total.toLocaleString("en-US")} rows` : `All ${preview.rows.length} rows`}
        </h3>
        <div className="max-h-96 overflow-auto rounded-md border">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-medium">
                  Line
                </th>
                {preview.headers.map((h) => (
                  <th key={h.index} scope="col" className="min-w-32 px-2 py-1.5 align-top font-medium">
                    <span className="block">{nameOf(h.index)}</span>
                    <span className="block font-normal text-muted-foreground">{destination(h.index) ? `→ ${destination(h.index)}` : "not imported"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.line} className={row.problem ? "border-t bg-amber-50 dark:bg-amber-950/30" : "border-t"}>
                  <td className="px-2 py-1 text-muted-foreground">
                    {row.line}
                    {row.problem ? <span className="block text-amber-700 dark:text-amber-300">{row.problem}</span> : null}
                  </td>
                  {preview.headers.map((h) => (
                    <td key={h.index} className="max-w-64 truncate px-2 py-1">
                      {row.values[h.index] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {errors.length ? (
        <Alert variant="error">
          <ul className="space-y-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy || check.blocker !== null} onClick={() => onConfirm(confirmBody(choices, dedupe, check.keyHeader))}>
          {busy ? "Working…" : `Import ${total.toLocaleString("en-US")} row${total === 1 ? "" : "s"}`}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        {check.blocker ? <p className="text-sm text-muted-foreground">{check.blocker}</p> : null}
      </div>
    </div>
  );
}
