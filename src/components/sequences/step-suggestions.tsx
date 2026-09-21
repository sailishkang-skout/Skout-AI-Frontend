"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthReady } from "@/lib/api-client";
import { useSequencesApi, type StepSuggestion, type SuggestStepInput } from "@/lib/sequences";
import { cn } from "@/lib/utils";
import type { SequenceLinkedinAction, SequenceStepType } from "@/types/api";

const SUGGESTABLE_LINKEDIN_ACTIONS: ReadonlySet<string> = new Set(["connect", "message", "inmail"]);
const STALE_MS = 10 * 60 * 1000;

/** Email, plus the LinkedIn actions that carry written copy. Everything else has nothing to draft. */
function toTarget(
  stepType: SequenceStepType,
  linkedinAction: SequenceLinkedinAction | null | undefined
): Pick<SuggestStepInput, "stepType" | "linkedinAction"> | null {
  if (stepType === "email") return { stepType };
  if (stepType === "linkedin" && linkedinAction && SUGGESTABLE_LINKEDIN_ACTIONS.has(linkedinAction)) {
    return { stepType, linkedinAction: linkedinAction as "connect" | "message" | "inmail" };
  }
  return null;
}

function plainPreview(body: string): string {
  return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Context-aware AI drafts for an Email / LinkedIn step. The server grounds them in the sequence's
 * name, its neighbouring steps and audience; the rep just picks one. Always optional — failures
 * never block manual editing.
 */
export function StepSuggestions({
  sequenceId,
  stepId,
  stepType,
  linkedinAction,
  empty,
  autoLoad,
  applyLabel = "Use this",
  onApply,
}: {
  sequenceId: string;
  stepId: string;
  stepType: SequenceStepType;
  linkedinAction?: SequenceLinkedinAction | null;
  /** The step's fields are blank — only then do we fetch without being asked. */
  empty: boolean;
  /** Fetch on mount for an empty step. Off for always-mounted lists so we don't fan out AI calls. */
  autoLoad: boolean;
  applyLabel?: string;
  onApply: (suggestion: StepSuggestion) => void;
}) {
  const authReady = useAuthReady();
  const sequencesApi = useSequencesApi();
  const target = toTarget(stepType, linkedinAction);
  const [open, setOpen] = useState(autoLoad && empty);
  const avoidRef = useRef<string[]>([]);

  const query = useQuery({
    queryKey: ["sequence-step-suggestions", sequenceId, stepId, target?.stepType, target?.linkedinAction ?? null],
    queryFn: () =>
      sequencesApi.suggestStep(sequenceId, {
        ...target!,
        stepId,
        excludeAngles: avoidRef.current,
      }),
    enabled: authReady && open && target !== null,
    staleTime: STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!target) return null;

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        Suggest ideas
      </Button>
    );
  }

  const suggestions = query.data?.suggestions ?? [];

  function refresh() {
    avoidRef.current = suggestions.map((s) => s.angle);
    void query.refetch();
  }

  return (
    <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/50 p-2.5 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5" />
          AI suggestions
          <span className="font-normal text-muted-foreground">· tailored to this sequence</span>
        </span>
        {suggestions.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[11px]"
            disabled={query.isFetching}
            onClick={refresh}
          >
            <RefreshCw className={cn("h-3 w-3", query.isFetching && "animate-spin")} />
            New ideas
          </Button>
        )}
      </div>

      {query.isPending && (
        <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Drafting suggestions…
        </p>
      )}

      {query.isError && (
        <p className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
          Couldn&apos;t load suggestions.
          <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={refresh}>
            Try again
          </Button>
        </p>
      )}

      {suggestions.length > 0 && (
        <ul className={cn("space-y-1.5", query.isFetching && "opacity-60")}>
          {suggestions.map((s) => (
            <li key={s.angle}>
              <button
                type="button"
                aria-label={`${applyLabel}: ${s.angle}`}
                onClick={() => {
                  onApply(s);
                  setOpen(false);
                }}
                className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-left transition-colors hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{s.angle}</span>
                  <span className="text-[10px] font-medium text-violet-600 dark:text-violet-300">{applyLabel}</span>
                </span>
                {s.subject && <span className="mt-0.5 block truncate text-xs text-foreground">{s.subject}</span>}
                <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                  {plainPreview(s.body)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
