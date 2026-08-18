"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

function measureTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Scroll target into view once per step — never from scroll/resize handlers. */
function ensureTargetVisible(target: string) {
  const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  });

  useLayoutEffect(() => {
    let cancelled = false;
    let tries = 0;

    const measure = () => {
      if (cancelled) return;
      const next = measureTargetRect(step.target);
      if (next) {
        setRect(next);
        return;
      }
      tries += 1;
      if (tries < 40) {
        window.setTimeout(measure, 80);
      } else {
        // Fallback: center tooltip if target missing (e.g. mobile drawer closed)
        setRect(null);
      }
    };

    // Scroll once when the step changes, then measure with settled layout.
    ensureTargetVisible(step.target);
    measure();

    const onScrollOrResize = () => {
      const next = measureTargetRect(step.target);
      if (next) setRect(next);
    };
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [step.target, step.href]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onSkip]);

  const isLast = stepIndex >= total - 1;

  // Runs after the card has rendered with real content, so offsetHeight/Width reflect this
  // step's actual body length — then clamps against the viewport so the card can never render
  // partially off-screen, however tall the content or however close the target is to an edge.
  useLayoutEffect(() => {
    if (!rect) {
      setStyle({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }
    const margin = 12;
    const cardHeight = cardRef.current?.offsetHeight ?? 280;
    const cardWidth = cardRef.current?.offsetWidth ?? 352;

    const spaceBelow = window.innerHeight - (rect.top + rect.height + pad + margin);
    const spaceAbove = rect.top - pad - margin;
    const placeAbove = spaceBelow < cardHeight && spaceAbove >= cardHeight;

    const preferredTop = placeAbove
      ? rect.top - pad - margin - cardHeight
      : rect.top + rect.height + pad + margin;
    // Clamp regardless of which side was chosen — guarantees the card stays fully on-screen
    // even when neither side has enough room (e.g. a target pinned to a viewport corner).
    const top = Math.min(Math.max(margin, preferredTop), window.innerHeight - cardHeight - margin);
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - cardWidth - margin);

    setStyle({ top, left, transform: undefined });
  }, [rect, pad, step.body, step.details, stepIndex]);

  return (
    <div className="fixed inset-0 z-[90]" aria-live="polite">
      {/* Dim overlay with spotlight cutout */}
      <div className="absolute inset-0 bg-black/50" onClick={onSkip} aria-hidden />
      {rect && (
        <div
          className="pointer-events-none absolute z-[91] rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
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
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        className="absolute z-[92] w-[min(100%-2rem,22rem)] rounded-xl border border-border bg-background p-4 shadow-2xl"
        style={style}
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
          className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
          />
        </div>

        <h3 id="tour-step-title" className="text-base font-semibold">
          {step.title}
        </h3>
        <div className="mt-1.5 max-h-[40vh] space-y-2 overflow-y-auto pr-0.5">
          <p className="text-sm text-muted-foreground">{step.body}</p>
          {step.details && step.details.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {step.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>

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
