import { Badge } from "@/components/ui/badge";
import { scoreBandLabel, scoreBandTone } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export function ScoreBadge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  return (
    <Badge tone={scoreBandTone(score)} className={cn("tabular-nums", className)}>
      {score} · {scoreBandLabel(score)}
    </Badge>
  );
}
