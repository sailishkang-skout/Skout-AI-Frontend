import { Badge } from "@/components/ui/badge";
import { scoreBandLabel, scoreBandTone } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export function ScoreBadge({
  score,
  reasoning,
  className,
}: {
  score: number;
  reasoning?: string | null;
  className?: string;
}) {
  return (
    <Badge
      tone={scoreBandTone(score)}
      className={cn("tabular-nums", className)}
      title={reasoning ?? undefined}
    >
      {score} · {scoreBandLabel(score)}
    </Badge>
  );
}
