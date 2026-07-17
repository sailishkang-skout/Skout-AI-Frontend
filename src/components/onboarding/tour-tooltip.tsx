"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TourStep } from "@/lib/product-tour";

interface TourTooltipProps {
  step: TourStep;
  stepIndex: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TourTooltip({
  step,
  stepIndex,
  total,
  onNext,
  onBack,
  onSkip,
}: TourTooltipProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const pad = 6;

  useLayoutEffect(() => {
    let cancelled = false;
    let tries = 0;

    const tick = () => {
      if (cancelled) return;
      const next = readTargetRect(step.target);
      if (next) {
        setRect(next);
        return;
      }
      tries += 1;
      if (tries < 40) {
        window.setTimeout(tick, 80);
      } else {
        // Fallback: center tooltip if target missing (e.g. mobile drawer closed)
        setRect(null);
      }
    };

    tick();
    const onResize = () => {
      const next = readTargetRect(step.target);
      if (next) setRect(next);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [step.target, step.href]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const isLast = stepIndex >= total - 1;
  const tooltipStyle = (() => {
    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      } as const;
    }
    const preferredTop = rect.top + rect.height + pad + 12;
    const spaceBelow = window.innerHeight - preferredTop;
    const placeAbove = spaceBelow < 200 && rect.top > 220;
    const top = placeAbove ? Math.max(12, rect.top - pad - 12) : preferredTop;
    const left = Math.min(
      Math.max(16, rect.left),
      window.innerWidth - 320 - 16
    );
    return {
      top,
      left,
      transform: placeAbove ? "translateY(-100%)" : undefined,
    };
  })();

  return (
    <div className="fixed inset-0 z-[90]" aria-live="polite">
      {/* Dim overlay with spotlight cutout */}
      <div className="absolute inset-0 bg-black/50" onClick={onSkip} aria-hidden />
      {rect && (
        <div
          className="pointer-events-none absolute z-[91] rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        className="absolute z-[92] w-[min(100%-2rem,20rem)] rounded-xl border border-border bg-background p-4 shadow-2xl"
        style={tooltipStyle}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Step {stepIndex + 1} of {total}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
        </div>

        <div
          className="mb-3 flex gap-1"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <h3 id="tour-step-title" className="text-base font-semibold">
          {step.title}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={stepIndex === 0}
            onClick={onBack}
          >
            Back
          </Button>
          <Button type="button" size="sm" onClick={onNext}>
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
