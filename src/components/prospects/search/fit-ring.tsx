import { cn } from "@/lib/utils";

/** Stable pastel colour per name, so an avatar keeps its colour between visits. */
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/** Colour band for an ICP match score: strong, possible, weak. */
export function fitTone(score: number | null | undefined): string {
  if (typeof score !== "number") return "text-muted-foreground";
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 65) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/**
 * An avatar wrapped in a ring that fills with the person's ICP match score. Unscored people get a
 * dashed, empty ring so "not scored yet" is visible at a glance.
 */
export function FitRing({
  name,
  score,
  size = 44,
  stroke = 3,
  className,
}: {
  name: string;
  score?: number | null;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const has = typeof score === "number";
  const pct = has ? Math.max(0, Math.min(100, score)) : 0;
  const inset = stroke + Math.round(size / 14);
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      title={has ? `ICP match ${pct}` : "Not scored yet"}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-border"
          strokeDasharray={has ? undefined : "3 5"}
        />
        {has && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(c * pct) / 100} ${c}`}
            className={fitTone(score)}
          />
        )}
      </svg>
      <span
        className="absolute flex items-center justify-center rounded-full font-semibold text-[#1b1230]"
        style={{ inset, background: `hsl(${hueFor(name)} 70% 78%)`, fontSize: Math.max(11, Math.round(size / 3.6)) }}
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
    </div>
  );
}
