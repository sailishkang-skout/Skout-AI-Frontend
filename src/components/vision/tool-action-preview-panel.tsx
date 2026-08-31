"use client";

import { Button } from "@/components/ui/button";
import type { ToolActionPreview } from "@/lib/ai-chat";
import { SideEffectPreview } from "./side-effect-preview";

export function ToolActionPreviewPanel({
  preview,
  onConfirm,
  confirming,
  compact,
}: {
  preview: ToolActionPreview;
  onConfirm?: () => void;
  confirming?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs"
          : "space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
      }
    >
      <div>
        <p className="font-semibold text-foreground">Review before executing</p>
        <p className="text-muted-foreground">{preview.scope}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Tool: {preview.toolName}</p>
      </div>
      {preview.assumptions.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
          {preview.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <SideEffectPreview
        effects={preview.externalSideEffects}
        affectedCount={preview.affectedRecordCount}
        creditCost={preview.creditCost}
        compact={compact}
      />
      {onConfirm && (
        <Button size="sm" disabled={confirming} onClick={onConfirm}>
          {confirming ? "Running…" : "Confirm and run"}
        </Button>
      )}
    </div>
  );
}
