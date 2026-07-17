"use client";

import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS } from "@/lib/product-tour";

interface WelcomeModalProps {
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ onStart, onSkip }: WelcomeModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <button
          type="button"
          onClick={onSkip}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Skip welcome"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>

        <h2 id="welcome-tour-title" className="text-xl font-semibold tracking-tight">
          Welcome to Skout AI
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A quick {TOUR_STEPS.length}-step tour shows how to import prospects, build lists, and
          launch outreach. Takes about a minute — you can skip anytime.
        </p>

        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-medium text-foreground">1.</span> Dashboard snapshot
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">2.</span> Import lists
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">3.</span> Enrich & organize
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">4.</span> Sequences & inbox
          </li>
        </ul>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
          <Button type="button" onClick={onStart}>
            Start tour
          </Button>
        </div>
      </div>
    </div>
  );
}
