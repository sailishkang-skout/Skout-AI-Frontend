"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FlaskConical,
  GitBranch,
  LayoutTemplate,
  Loader2,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuthReady } from "@/lib/api-client";
import { useSequencesApi } from "@/lib/sequences";
import { useEnrichmentApi } from "@/lib/enrichment";
import type { SequenceMode, SequenceTemplateSummary } from "@/types/api";

export type CreateSequencePath = "choose" | "manual" | "templates" | "dexter" | "abtest";

export function CreateSequenceDialog({
  open,
  onClose,
  initialPath = "choose",
}: {
  open: boolean;
  onClose: () => void;
  initialPath?: CreateSequencePath;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();

  const [path, setPath] = useState<CreateSequencePath>(initialPath);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [listId, setListId] = useState("");
  const [includeLinkedin, setIncludeLinkedin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["sequence-templates"],
    queryFn: sequencesApi.listTemplates,
    enabled: authReady && open && path === "templates",
  });

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady && open && path === "dexter",
  });

  useEffect(() => {
    if (open) setPath(initialPath);
  }, [open, initialPath]);

  function resetAndClose() {
    setPath(initialPath);
    setName("");
    setGoal("");
    setListId("");
    setIncludeLinkedin(true);
    setError(null);
    onClose();
  }

  function goToSequence(id: string) {
    queryClient.invalidateQueries({ queryKey: ["sequences"] });
    resetAndClose();
    router.push(`/sequences/${id}`);
  }

  function goToExperiment(id: string) {
    queryClient.invalidateQueries({ queryKey: ["sequences"] });
    queryClient.invalidateQueries({ queryKey: ["sequence-experiments"] });
    resetAndClose();
    router.push(`/sequences/experiments/${id}`);
  }

  const createManual = useMutation({
    mutationFn: () => sequencesApi.create(name.trim() || "Untitled sequence", "manual", "C"),
    onSuccess: (seq) => goToSequence(seq.id),
    onError: () => setError("Could not create the sequence. Please try again."),
  });

  const createFromTemplate = useMutation({
    mutationFn: (tpl: SequenceTemplateSummary) =>
      sequencesApi.createFromTemplate(tpl.key, name.trim() || tpl.name, tpl.mode),
    onSuccess: (seq) => goToSequence(seq.id),
    onError: () => setError("Could not create from that template. Please try again."),
  });

  const generate = useMutation({
    mutationFn: () =>
      sequencesApi.generate({
        goal: goal.trim(),
        listId: listId || undefined,
        channels: includeLinkedin ? ["email", "linkedin"] : ["email"],
      }),
    onSuccess: (seq) => goToSequence(seq.id),
    onError: () => setError("Dexter could not generate a sequence. Please try again."),
  });

  const createExperiment = useMutation({
    mutationFn: () =>
      sequencesApi.createExperiment({
        name: name.trim() || "A/B outreach test",
        fromTemplates: true,
        weightA: 50,
        weightB: 50,
        primaryMetric: "positive_reply",
      }),
    onSuccess: (exp) => goToExperiment(exp.id),
    onError: () => setError("Could not create the A/B experiment. Please try again."),
  });

  const busy = createManual.isPending || createFromTemplate.isPending || generate.isPending || createExperiment.isPending;

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      title={
        path === "choose"
          ? "Create a sequence"
          : path === "manual"
            ? "Build it manually"
            : path === "templates"
              ? "Use a template"
              : path === "abtest"
                ? "A/B experiment (50/50)"
                : "Do it with Dexter AI"
      }
      description={
        path === "choose"
          ? "Pick how you want to start. A and B are opinionated defaults; C is God Mode."
          : undefined
      }
      className="max-w-2xl"
    >
      {path !== "choose" && (
        <button
          type="button"
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            setPath("choose");
            setError(null);
          }}
        >
          ← Back
        </button>
      )}

      {path === "choose" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={PencilLine}
            title="Manually from scratch"
            description="God Mode visual builder — conditions, fallbacks, and A/B/C tests."
            onClick={() => setPath("manual")}
          />
          <ChoiceCard
            icon={LayoutTemplate}
            title="Use existing templates"
            description="A — Standard outreach or B — LinkedIn first. Same engine underneath."
            onClick={() => setPath("templates")}
          />
          <ChoiceCard
            icon={Sparkles}
            title="Do it with Dexter AI"
            description="Describe the goal. Dexter drafts a cadence you can edit."
            onClick={() => setPath("dexter")}
          />
          <ChoiceCard
            icon={FlaskConical}
            title="A/B experiment (50/50)"
            description="Spin up A vs B from templates. Prospects are hashed into one arm."
            onClick={() => setPath("abtest")}
          />
        </div>
      )}

      {path === "manual" && (
        <div className="space-y-4">
          <Input
            placeholder="e.g. Enterprise SaaS outbound"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createManual.mutate()}
          />
          <p className="text-xs text-muted-foreground">
            Opens God Mode (C). Add Email, LinkedIn, conditions, and fallbacks on the canvas.
          </p>
          <Button onClick={() => createManual.mutate()} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
            Open visual builder
          </Button>
        </div>
      )}

      {path === "templates" && (
        <div className="space-y-3">
          <Input
            placeholder="Optional custom name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {templates.isLoading && <p className="text-sm text-muted-foreground">Loading templates…</p>}
          {(templates.data?.data ?? []).map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              disabled={busy}
              onClick={() => createFromTemplate.mutate(tpl)}
              className="flex w-full flex-col items-start gap-1 rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex items-center gap-2">
                <ModePill mode={tpl.mode} />
                <span className="text-sm font-medium">{tpl.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{tpl.description}</span>
              <span className="text-[11px] text-muted-foreground">{tpl.channels.join(" · ")}</span>
            </button>
          ))}
        </div>
      )}

      {path === "abtest" && (
        <div className="space-y-4">
          <Input
            placeholder="e.g. Email-first vs LinkedIn-first"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createExperiment.mutate()}
          />
          <p className="text-xs text-muted-foreground">
            Creates Mode A (SaaS VP email) and Mode B (LinkedIn first) under one experiment. Assignment is deterministic: sha256(experimentId:prospectId).
          </p>
          <Button onClick={() => createExperiment.mutate()} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Create 50/50 experiment
          </Button>
        </div>
      )}

      {path === "dexter" && (
        <div className="space-y-3">
          <textarea
            rows={4}
            placeholder="Describe your goal, e.g. 'Book demos with RevOps leaders at mid-market SaaS; lead with our list-building time savings.'"
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <Select
            aria-label="Target list (optional)"
            value={listId}
            onChange={(e) => setListId(e.target.value)}
          >
            <option value="">Target list (optional — improves targeting)</option>
            {(lists.data?.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={includeLinkedin}
              onChange={(e) => setIncludeLinkedin(e.target.checked)}
            />
            Include LinkedIn touches
          </label>
          <Button
            onClick={() => generate.mutate()}
            disabled={!goal.trim() || busy}
            className="w-full"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate with Dexter
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </Dialog>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-accent/30"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}

function ModePill({ mode }: { mode?: SequenceMode }) {
  if (!mode) return null;
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
        mode === "A" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
        mode === "B" && "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
        mode === "C" && "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
      )}
    >
      {mode === "C" ? "God Mode" : `Mode ${mode}`}
    </span>
  );
}
