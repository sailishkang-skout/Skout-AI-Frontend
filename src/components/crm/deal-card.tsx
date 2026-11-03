"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/crm-display";
import { useDealsApi } from "@/lib/crm/deals";
import type { Company, Deal } from "@/types/crm";

const CARD_TONES = [
  "bg-rose-50 dark:bg-rose-950/40",
  "bg-amber-50 dark:bg-amber-950/40",
  "bg-violet-50 dark:bg-violet-950/40",
  "bg-background",
];

const AVATAR_TONES = [
  "bg-rose-400",
  "bg-blue-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-violet-400",
  "bg-cyan-400",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickTone(tones: string[], seed: string): string {
  return tones[hashString(seed) % tones.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0] ?? "?"];
  return chars.join("").toUpperCase();
}

export function DealCard({
  deal,
  company,
  stageId,
}: {
  deal: Deal;
  company: Company | undefined;
  /** The column this card currently renders in — carried as sortable `data` so
   * `onDragEnd` can tell which column a card was dropped into/near. */
  stageId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { stageId },
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const dealsApi = useDealsApi();

  const removeDeal = useMutation({
    mutationFn: () => dealsApi.remove(deal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
    },
    onError: () => {
      window.alert("Could not delete this deal. Try again.");
    },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const label = company?.name ?? "No company";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative cursor-grab touch-none rounded-xl p-3 shadow-sm transition-shadow",
        pickTone(CARD_TONES, deal.id),
        isDragging && "opacity-60 shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/crm/deals/${deal.id}`} className="min-w-0 flex-1 hover:underline">
          <p className="line-clamp-2 text-sm font-semibold">{deal.name}</p>
        </Link>
        <div className="relative shrink-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md bg-background/60 p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label="Deal actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onPointerDown={(e) => e.stopPropagation()} onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-md border bg-background shadow-md"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm(`Delete "${deal.name}"? This cannot be undone.`)) {
                      removeDeal.mutate();
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-foreground/40"
          style={{ width: `${Math.min(100, Math.max(0, deal.probability ?? 0))}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
              pickTone(AVATAR_TONES, company?.id ?? label)
            )}
            aria-hidden
          >
            {initials(label)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{label}</p>
            {deal.closeDate && (
              <p className="text-[10px] text-muted-foreground">{deal.closeDate.slice(0, 10)}</p>
            )}
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(deal.amount, deal.currency)}</p>
      </div>
    </div>
  );
}
