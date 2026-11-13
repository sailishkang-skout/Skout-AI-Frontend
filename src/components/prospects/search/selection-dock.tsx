"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronUp, Loader2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mode = "add" | "enrich";

/**
 * Floating bar shown while people are selected. Both actions need a list (Enrich runs a
 * workbook on a list), so each opens the same list picker and acts on the list picked.
 */
export function SelectionDock({
  count,
  lists,
  onAdd,
  onEnrich,
  onClear,
  addPending,
  enrichPending,
}: {
  count: number;
  lists: { id: string; name: string; prospectCount: number }[];
  onAdd: (listId: string) => void;
  onEnrich: (listId: string) => void;
  onClear: () => void;
  addPending: boolean;
  enrichPending: boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mode) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMode(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [mode]);

  if (count === 0) return null;
  const pick = (listId: string) => {
    if (mode === "enrich") onEnrich(listId);
    else onAdd(listId);
    setMode(null);
  };

  return (
    <div className="pointer-events-none sticky bottom-6 z-20 mt-6 flex justify-center" data-testid="selection-dock">
      <div
        ref={ref}
        className="pointer-events-auto relative flex items-center gap-2 rounded-full bg-foreground py-2 pl-4 pr-2 text-background shadow-2xl"
      >
        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
          {count}
        </span>
        <span className="mr-1 text-[13px] font-semibold">selected</span>
        <Button type="button" size="sm" className="rounded-full" onClick={() => setMode(mode === "add" ? null : "add")} disabled={addPending}>
          {addPending ? <Loader2 className="animate-spin" /> : null}
          Add to list
          <ChevronUp />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
          onClick={() => setMode(mode === "enrich" ? null : "enrich")}
          disabled={enrichPending}
        >
          {enrichPending ? <Loader2 className="animate-spin" /> : <Zap />}
          Enrich
        </Button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="rounded-full p-1.5 text-background/80 hover:bg-background/10 hover:text-background"
        >
          <X className="h-4 w-4" />
        </button>

        {mode && (
          <div
            role="menu"
            className="absolute bottom-14 left-1/2 w-[280px] -translate-x-1/2 rounded-xl border border-border bg-card p-1.5 text-foreground shadow-xl"
          >
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {mode === "enrich" ? "Enrich into a list" : "Choose a list"}
            </div>
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                role="menuitem"
                onClick={() => pick(l.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted"
              >
                <span className="truncate">{l.name}</span>
                <span className="text-muted-foreground">{l.prospectCount}</span>
              </button>
            ))}
            {lists.length === 0 && <p className="px-2.5 py-2 text-[13px] text-muted-foreground">You have no lists yet.</p>}
            <Link href="/lists" role="menuitem" className="block rounded-lg px-2.5 py-2 text-[13px] text-primary hover:bg-muted">
              Create a list first
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
