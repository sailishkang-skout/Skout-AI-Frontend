"use client";

import { AlertTriangle } from "lucide-react";

export function SideEffectPreview({
  effects,
  affectedCount,
  creditCost,
  compact,
}: {
  effects: string[];
  affectedCount?: number;
  creditCost?: number;
  compact?: boolean;
}) {
  if (!effects.length && affectedCount == null && creditCost == null) return null;

  return (
    <div
      className={
        compact
          ? "rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px]"
          : "rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
      }
    >
      <p className="flex items-center gap-1 font-semibold text-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
        Side effects preview
      </p>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {effects.map((fx) => (
          <li key={fx}>• {fx}</li>
        ))}
        {affectedCount != null && <li>• Affects ~{affectedCount.toLocaleString()} record(s)</li>}
        {creditCost != null && creditCost > 0 && <li>• Estimated {creditCost} credit(s)</li>}
      </ul>
    </div>
  );
}
