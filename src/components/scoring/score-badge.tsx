import { cn } from "@/lib/utils";
import { scoreBandColor, scoreBandLabel } from "@/lib/scoring";

const SIZE = 36;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function ScoreBadge({
  score,
  reasoning,
  className,
}: {
  score: number;
  reasoning?: string | null;
  className?: string;
}) {
  const colors = scoreBandColor(score);
  const band = scoreBandLabel(score);
  const filled = CIRCUMFERENCE * (1 - score / 100);

  return (
    <span
      title={reasoning ?? undefined}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      {/* circular arc */}
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className={colors.track}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={filled}
          strokeLinecap="round"
          className={cn(colors.ring, "transition-all duration-500")}
        />
      </svg>

      {/* score number */}
      <span className={cn("text-sm font-bold tabular-nums leading-none", colors.text)}>
        {score}
        <span className="text-[10px] font-normal opacity-70">/100</span>
      </span>

      {/* band pill */}
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", colors.badge)}>
        {band}
      </span>
    </span>
  );
}

/** Compact inline version used in list rows */
export function ScorePill({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const colors = scoreBandColor(score);
  const band = scoreBandLabel(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        colors.badge,
        colors.border,
        className,
      )}
    >
      {score}
      <span className="opacity-60">·</span>
      {band}
    </span>
  );
}
