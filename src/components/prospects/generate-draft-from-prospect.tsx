"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatQueryError } from "@/lib/api-client";
import { useAiDraftsApi } from "@/lib/ai-drafts";

/**
 * Compact "generate an AI outreach draft" widget embedded in the prospect detail sheet.
 * The draft is created with status `pending_review` and shows up in the AI Review queue.
 */
export function GenerateDraftFromProspect({
  prospectId,
  fullName,
  title,
  companyName,
  companyDomain,
}: {
  prospectId: string;
  fullName?: string;
  title?: string;
  companyName?: string;
  companyDomain?: string;
}) {
  const draftsApi = useAiDraftsApi();

  const generate = useMutation({
    mutationFn: () =>
      draftsApi.create({ prospectId, fullName, title, companyName, companyDomain }),
  });

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">AI outreach draft</p>
          {!generate.isSuccess && !generate.isError && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Generate a personalized email for human review.
            </p>
          )}
          {generate.isSuccess && (
            <p className="mt-1 text-xs text-green-700 dark:text-green-400">
              Draft created —{" "}
              <Link href="/ai/review" className="font-medium underline">
                review it in the AI queue →
              </Link>
            </p>
          )}
          {generate.isError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {formatQueryError(generate.error, "Could not generate draft.")}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 text-xs"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {generate.isPending ? "Generating…" : "Generate draft"}
        </Button>
      </div>
    </div>
  );
}
