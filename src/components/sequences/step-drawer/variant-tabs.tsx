import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SequenceVariantKey } from "@/types/api";
import { splitPercentages, visibleKeys, type Weights } from "./variant-split";

const BAR_COLOR: Record<SequenceVariantKey, string> = {
  A: "bg-blue-500",
  B: "bg-violet-500",
  C: "bg-amber-500",
};

export function VariantTabs({
  godMode,
  weights,
  active,
  onActive,
  onToggleGodMode,
  onSplit,
}: {
  godMode: boolean;
  weights: Weights;
  active: SequenceVariantKey;
  onActive: (key: SequenceVariantKey) => void;
  onToggleGodMode: (on: boolean) => void;
  onSplit: (key: SequenceVariantKey, pct: number) => void;
}) {
  const pct = splitPercentages(weights, godMode);
  const keys = visibleKeys(godMode);

  return (
    <div className="space-y-2">
      <div role="tablist" aria-label="Variants" className="flex flex-wrap items-center gap-1.5">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            onClick={() => onActive(key)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              active === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            {key} · {pct[key]}%
            {key === "C" && (
              <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                God Mode
              </span>
            )}
          </button>
        ))}
        {!godMode && (
          <button
            type="button"
            onClick={() => onToggleGodMode(true)}
            className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            + C · God Mode
          </button>
        )}
      </div>

      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {keys.map((key) => (
          <div key={key} className={BAR_COLOR[key]} style={{ width: `${pct[key]}%` }} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted-foreground">Traffic split</span>
        {keys.map((key) => (
          <label key={key} className="flex items-center gap-1">
            {key}
            <Input
              type="number"
              min={0}
              max={100}
              aria-label={`Variant ${key} traffic %`}
              className="h-7 w-16 text-xs"
              value={pct[key]}
              onChange={(e) => onSplit(key, Number(e.target.value))}
            />
            %
          </label>
        ))}
      </div>

      {godMode && (
        <p className="text-[11px] text-muted-foreground">
          God Mode adds variant C for extra testing. Traffic follows the split above.{" "}
          <button type="button" className="underline" onClick={() => onToggleGodMode(false)}>
            Remove C
          </button>
        </p>
      )}
    </div>
  );
}
