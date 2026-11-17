"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FacetChoice {
  /** Stable key for the choice. */
  key: string;
  label: string;
  /** The stored values this choice stands for (a country can be stored as "IN" and "India"). */
  values: string[];
  count: number | null;
}

interface FacetMultiSelectProps {
  id: string;
  label: string;
  choices: FacetChoice[];
  /** Stored values currently selected. */
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  loading?: boolean;
}

/**
 * Pick several values from what's actually in the data, with how many records each one has.
 * Choices come from the search index, so a selection can always match something.
 */
export function FacetMultiSelect({
  id,
  label,
  choices,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  loading,
}: FacetMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const isChosen = (c: FacetChoice) => c.values.some((v) => selectedSet.has(v));
  const chosen = choices.filter(isChosen);
  // Values from older lists that aren't among today's choices still show and can be removed.
  const known = new Set(choices.flatMap((c) => c.values));
  const orphans = selected.filter((v) => !known.has(v));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? choices.filter((c) => c.label.toLowerCase().includes(q)) : choices;
  }, [choices, search]);

  const toggle = (c: FacetChoice) => {
    if (isChosen(c)) onChange(selected.filter((v) => !c.values.includes(v)));
    else onChange([...selected, ...c.values.filter((v) => !selectedSet.has(v))]);
  };

  const summary = [...chosen.map((c) => c.label), ...orphans];

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <span id={`${id}-label`} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        id={id}
        aria-labelledby={`${id}-label ${id}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm"
      >
        <span className={cn("truncate", summary.length === 0 && "text-muted-foreground")}>
          {summary.length ? summary.join(", ") : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="mb-2 h-8"
          />
          {orphans.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {orphans.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(selected.filter((s) => s !== v))}
                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                >
                  {v} <X className="h-3 w-3" aria-label={`Remove ${v}`} />
                </button>
              ))}
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto">
            {loading && <li className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</li>}
            {!loading && visible.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">No matching values in your data.</li>
            )}
            {visible.map((c) => {
              const inputId = `${id}-${c.key}`;
              return (
                <li key={c.key}>
                  <label htmlFor={inputId} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <input id={inputId} type="checkbox" checked={isChosen(c)} onChange={() => toggle(c)} />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.count != null && <span className="text-xs tabular-nums text-muted-foreground">{c.count}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
