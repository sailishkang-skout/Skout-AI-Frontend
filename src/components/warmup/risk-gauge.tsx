"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const LEVEL_COLOR: Record<string, string> = {
  LOW: "stroke-green-500",
  MEDIUM: "stroke-amber-500",
  HIGH: "stroke-orange-500",
  CRITICAL: "stroke-red-500",
  UNKNOWN: "stroke-muted-foreground/40",
};

const LEVEL_TEXT: Record<string, string> = {
  LOW: "text-green-600 dark:text-green-400",
  MEDIUM: "text-amber-600 dark:text-amber-400",
  HIGH: "text-orange-600 dark:text-orange-400",
  CRITICAL: "text-red-600 dark:text-red-400",
  UNKNOWN: "text-muted-foreground",
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RiskGauge({ score, level }: { score: number; level: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedScore(score));
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const clamped = Math.max(0, Math.min(100, animatedScore));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const colorClass = LEVEL_COLOR[level] ?? LEVEL_COLOR.UNKNOWN;
  const textClass = LEVEL_TEXT[level] ?? LEVEL_TEXT.UNKNOWN;

  return (
    <div className="flex flex-col items-center gap-1" role="img" aria-label={`Risk score ${score} out of 100, ${level.toLowerCase()}`}>
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className={cn("transition-[stroke-dashoffset] duration-700 ease-out", colorClass)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-semibold tabular-nums", textClass)}>{score}</span>
          <span className="text-[0.65rem] text-muted-foreground">/ 100</span>
        </div>
      </div>
      <span className={cn("text-sm font-medium", textClass)}>{level} risk</span>
    </div>
  );
}
