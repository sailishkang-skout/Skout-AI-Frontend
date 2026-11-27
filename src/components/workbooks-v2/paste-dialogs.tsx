"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DATA_TYPES, MAX_COLUMN_NAME, dataTypeLabel, type DataType } from "@/lib/workbooks-v2-import";
import { columnsForBlock, freeName, type GridColumnInfo } from "@/lib/workbooks-v2-grid";

const n = (value: number) => value.toLocaleString("en-US");

export interface NewColumnSpec {
  name: string;
  dataType: DataType;
}

/** A list that has nowhere to go where it was pasted: pick a column that takes it, or make one. */
export function ChooseColumnDialog({
  reason,
  values,
  detected,
  columns,
  exclude,
  onAppend,
  onCreate,
  onClose,
}: {
  reason: string;
  values: string[][];
  detected: DataType | null;
  columns: GridColumnInfo[];
  /** The column the list was refused by. */
  exclude?: string;
  onAppend: (columnId: string) => void;
  onCreate: (column: NewColumnSpec) => void;
  onClose: () => void;
}) {
  const type: DataType = detected ?? "text";
  const count = values.filter((line) => line[0]!.trim()).length;
  const matching = columns.filter((c) => c.editable && c.dataType === type && c.id !== exclude);
  const name = freeName(detected ? dataTypeLabel(detected) : "Pasted", columns.map((c) => c.name));
  return (
    <Dialog open onClose={onClose} title="Choose where these go">
      <div className="space-y-4 p-1 text-sm">
        <Alert variant="warning">{reason}</Alert>
        <p>
          Nothing has been pasted yet. {count === 1 ? "The value" : `The ${n(count)} values`} will be added as {count === 1 ? "a new row" : "new rows"}, so nothing is overwritten.
        </p>
        <div className="flex flex-col gap-2">
          {matching.map((c) => (
            <Button key={c.id} type="button" className="h-auto min-h-10 whitespace-normal" onClick={() => onAppend(c.id)}>
              Add to “{c.name}”
            </Button>
          ))}
          <Button type="button" className="h-auto min-h-10 whitespace-normal" variant={matching.length ? "outline" : "default"} onClick={() => onCreate({ name, dataType: type })}>
            Create column “{name}” ({dataTypeLabel(type)}) and add {count === 1 ? "it" : "them"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** A paste into a workbook with no column that can be typed in. */
export function CreateColumnsDialog({ values, taken, onCreate, onClose }: { values: string[][]; taken: string[]; onCreate: (columns: NewColumnSpec[]) => void; onClose: () => void }) {
  const specs = columnsForBlock(values, taken);
  return (
    <Dialog open onClose={onClose} title="Add columns for this paste">
      <div className="space-y-4 p-1 text-sm">
        <p>
          This workbook has no input column yet. Create {specs.length === 1 ? "this column" : `these ${specs.length} columns`} and add {n(values.length)} row{values.length === 1 ? "" : "s"}?
        </p>
        <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
          {specs.map((s) => (
            <li key={s.name} className="flex justify-between px-3 py-1.5">
              <span>{s.name}</span>
              <span className="text-muted-foreground">{dataTypeLabel(s.dataType)}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button type="button" onClick={() => onCreate(specs)}>
            Create and paste
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function ConfirmClearDialog({ cells, onConfirm, onClose }: { cells: number; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={`Clear ${n(cells)} cells?`}>
      <div className="space-y-4 p-1 text-sm">
        <p>Their values will be removed. This can’t be undone.</p>
        <div className="flex gap-2">
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Clear cells
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function AddColumnDialog({ busy, error, onAdd, onClose }: { busy: boolean; error: string | null; onAdd: (column: NewColumnSpec) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<DataType>("text");
  return (
    <Dialog open onClose={onClose} title="Add an input column">
      <form
        className="space-y-4 p-1 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !busy) onAdd({ name: name.trim(), dataType });
        }}
      >
        <label className="block space-y-1">
          <span className="font-medium">Column name</span>
          <Input autoFocus value={name} maxLength={MAX_COLUMN_NAME} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-medium">Holds</span>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={dataType} onChange={(e) => setDataType(e.target.value as DataType)}>
            {DATA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Adding…" : "Add column"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
