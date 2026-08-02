"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { BarChart3, Download, Loader2, MessageSquare, Send, Sparkles, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAiChatApi,
  type ChartSpec,
  type ChatAction,
  type ChatContext,
  type ChatExportArtifact,
  type ChatMode,
} from "@/lib/ai-chat";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("ai-chat");

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  action?: ChatAction;
  applied?: boolean;
  sequenceId?: string;
  draftId?: string;
  segregated?: boolean;
  exports?: ChatExportArtifact[];
  failed?: boolean;
}

interface AiChatBoxProps {
  /** Context passed to the model (what the user is editing). */
  context?: ChatContext;
  /** When provided, email actions can be adopted into the caller's editor. */
  onApplyEmail?: (email: { subject: string; html: string }) => void;
  /** Called after a sequence is created (auto mode or Apply). */
  onSequenceCreated?: (sequenceId: string) => void;
  title?: string;
  /** Default chat mode. Ask = propose; Auto = apply. */
  defaultMode?: ChatMode;
  /**
   * In Ask mode, also queue email proposals into AI Review (requires context.prospectId).
   * Keeps AI-generated outreach segregated from live sends until approved.
   */
  stageForReview?: boolean;
}

const ALLOWED_EMAIL_TAGS = new Set(["P", "STRONG", "EM", "A", "BR", "UL", "LI"]);

function isSafeHref(href: string): boolean {
  return (
    href.startsWith("https://") ||
    href.startsWith("http://") ||
    href.startsWith("mailto:") ||
    href === "{{unsubscribeUrl}}"
  );
}

/** Allow only the small HTML subset supported by AI-generated email actions. */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "")
      .replace(/\s(?:href|src)\s*=\s*(['"])\s*(?:javascript|data):[\s\S]*?\1/gi, "");
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (!ALLOWED_EMAIL_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    const href = element.tagName === "A" ? element.getAttribute("href") ?? "" : "";
    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }

    if (element.tagName === "A" && isSafeHref(href)) {
      element.setAttribute("href", href);
      element.setAttribute("rel", "noopener noreferrer");
    }
  }

  return root.innerHTML;
}

/** Strip markdown/download URLs when Export ready card already shows the file. */
export function stripExportLinks(text: string, artifacts: ChatExportArtifact[] = []): string {
  let out = text;
  out = out.replace(/\[[^\]]*\]\(([^)]*\/api\/v1\/ai\/exports\/download[^)]*)\)/gi, "");
  out = out.replace(/https?:\/\/[^\s)]+\/api\/v1\/ai\/exports\/download[^\s)]*/gi, "");
  for (const a of artifacts) {
    if (a.downloadUrl) out = out.split(a.downloadUrl).join("");
    if (a.path) out = out.split(a.path).join("");
  }
  out = out.replace(/you can download it using the link below:?\s*/gi, "");
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

/** Light markdown: bold, external links, and in-app paths. */
function ChatText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re =
    /(\*\*[^*]+\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(?<![\w@])(\/[a-z0-9][a-z0-9/_-]*))/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    if (m[0].startsWith("**")) {
      parts.push(<strong key={key++}>{m[0].slice(2, -2)}</strong>);
    } else if (m[2] && m[3]) {
      parts.push(
        <a
          key={key++}
          href={m[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2"
        >
          {m[2]}
        </a>
      );
    } else if (m[4]) {
      parts.push(
        <Link key={key++} href={m[4]} className="font-medium underline underline-offset-2">
          {m[4]}
        </Link>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className="whitespace-pre-wrap break-words">{parts}</p>;
}

function suggestionsForPage(page?: string): string[] {
  if (!page) return SUGGESTIONS_GENERAL;
  if (page.startsWith("/prospects/search")) {
    return [
      "Find VP Sales in SaaS companies",
      "Who matches my ICP?",
      "Take me to smart lists",
      "Export search results tips",
    ];
  }
  if (page.startsWith("/lists")) {
    return [
      "Who is in this list?",
      "How do I enrich these prospects?",
      "Export list members as CSV",
      "Enroll this list into a sequence",
    ];
  }
  if (page.startsWith("/settings/icp") || page.startsWith("/onboarding")) {
    return [
      "Review my ICP config",
      "Suggest buyer titles for my product",
      "How does ICP scoring work?",
      "Take me to prospect search",
    ];
  }
  if (page.startsWith("/deliverability")) {
    return [
      "How healthy is my deliverability?",
      "How do I connect an inbox?",
      "Explain SPF, DKIM, and DMARC",
      "Show inbox warmup status",
    ];
  }
  if (page.startsWith("/analytics")) {
    return [
      "Weekly credit usage pie chart",
      "Export credit transactions",
      "Summarize enrichment activity",
      "What changed this week?",
    ];
  }
  if (page.startsWith("/inbox")) {
    return [
      "Summarize this thread",
      "Draft a reply to this prospect",
      "Show unread inbox counts",
      "Take me to AI Review",
    ];
  }
  return SUGGESTIONS_GENERAL;
}

const SUGGESTIONS_GENERAL = [
  "Weekly credit usage pie chart",
  "Find VP Sales in SaaS companies",
  "How do I import prospects?",
  "Export my credit transactions",
  "Take me to my sequences",
];

const SUGGESTIONS_CONTEXT = [
  "Write a cold email for this prospect",
  "Design a 4-step outbound sequence",
  "Shorten this copy and add urgency",
];


export function AiChatBox({
  context,
  onApplyEmail,
  onSequenceCreated,
  title = "Skout AI assistant",
  defaultMode = "ask",
  stageForReview = false,
}: AiChatBoxProps) {
  const api = useAiChatApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>(defaultMode);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAttemptRef = useRef<ChatTurn[]>([]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  const commitSequence = useMutation({
    mutationFn: (action: Extract<ChatAction, { type: "sequence" }>) =>
      api.createFromSteps({ name: action.name, steps: action.steps }),
    onSuccess: (seq) => {
      log.info("ai chat sequence created", { sequenceId: seq.id });
      onSequenceCreated?.(seq.id);
      router.push(`/sequences/${seq.id}`);
    },
    onError: (err) => {
      log.error("ai chat sequence create failed", err);
      const detail = err instanceof Error ? err.message : "Unknown error";
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry — I couldn't create that sequence (${detail}). Please try again.`,
        },
      ]);
      scrollToBottom();
    },
  });

  const send = useMutation({
    mutationFn: (history: ChatTurn[]) =>
      api.chat({
        messages: history.map((t) => ({ role: t.role, content: t.content })),
        mode,
        stageForReview: mode === "ask" && stageForReview,
        context,
      }),
    onSuccess: (res) => {
      log.info("ai chat reply received", {
        mode,
        actionType: res.action.type,
        applied: res.applied,
        sequenceId: res.sequenceId,
        draftId: res.draftId,
        exportCount: res.exports?.length ?? 0,
      });
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          action: res.action,
          applied: res.applied,
          sequenceId: res.sequenceId,
          draftId: res.draftId,
          segregated: res.segregated,
          exports: res.exports,
        },
      ]);
      // Auto mode: apply immediately (AI content is marked as applied, not staged).
      if (mode === "auto") {
        if (res.action.type === "email") onApplyEmail?.({ subject: res.action.subject, html: res.action.html });
        if (res.action.type === "sequence" && res.applied && res.sequenceId) {
          onSequenceCreated?.(res.sequenceId);
          router.push(`/sequences/${res.sequenceId}`);
        }
      }
      scrollToBottom();
    },
    onError: (err) => {
      log.error("ai chat send failed", err, { mode });
      const detail =
        err instanceof Error && err.message && err.message !== "Failed to fetch"
          ? err.message
          : null;
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: detail
            ? `Sorry — I couldn't process that (${detail}).`
            : "Sorry — I couldn't process that.",
          failed: true,
        },
      ]);
      scrollToBottom();
    },
  });

  function retryLast() {
    if (!lastAttemptRef.current.length || send.isPending) return;
    send.mutate(lastAttemptRef.current);
    scrollToBottom();
  }

  function handleSend() {
    const text = input.trim();
    if (!text || send.isPending) return;
    const next = [...turns, { role: "user" as const, content: text }];
    setTurns(next);
    setInput("");
    lastAttemptRef.current = next;
    send.mutate(next);
    scrollToBottom();
  }

  if (!open) {
    return (
      <button
        type="button"
        data-tour="nav-ai-chat"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/20 transition hover:scale-105 hover:ring-primary/30"
        aria-label="Open AI assistant"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  const suggestions =
    context?.kind === "general" ? suggestionsForPage(context.page) : SUGGESTIONS_CONTEXT;

  return (
    <div
      data-tour="nav-ai-chat"
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 flex h-[min(38rem,calc(100dvh-5rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 via-background to-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{title}</p>
            <p className="text-[11px] text-muted-foreground">Workspace-aware · Ask or Auto</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs shadow-sm">
            {(["ask", "auto"] as ChatMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 capitalize transition-colors",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                title={
                  m === "auto"
                    ? "Auto: apply AI output immediately"
                    : "Ask: propose only — you confirm (optionally queue to AI Review)"
                }
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-border bg-muted/30 px-4 py-1.5 text-[11px] text-muted-foreground">
        {mode === "ask" ? (
          <>
            <span className="font-medium text-foreground">Ask</span> — AI proposes; you apply.
            {stageForReview && context?.prospectId
              ? " Emails also go to AI Review."
              : " AI stays segregated until you confirm."}
          </>
        ) : (
          <>
            <span className="font-medium text-foreground">Auto</span> — AI applies to the editor /
            creates the sequence immediately.
          </>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {turns.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            {context?.kind === "general" ? (
              <p className="text-sm text-muted-foreground">
                Ask about this workspace, credits, exports, or how to use Skout.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask me to write an email, tweak copy, or design a sequence.
              </p>
            )}
            <div className="flex w-full flex-col gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={send.isPending}
                  onClick={() => {
                    const next = [...turns, { role: "user" as const, content: s }];
                    setTurns(next);
                    lastAttemptRef.current = next;
                    send.mutate(next);
                    scrollToBottom();
                  }}
                  className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/40 hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => {
          const display =
            t.role === "assistant" && t.exports?.length
              ? stripExportLinks(t.content, t.exports)
              : t.content;
          return (
            <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                  t.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border/60 bg-muted/80"
                )}
              >
                {display ? (
                  t.role === "assistant" ? (
                    <ChatText text={display} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{display}</p>
                  )
                ) : null}
                {t.action && t.action.type !== "none" && (
                  <ActionCard
                    action={t.action}
                    applied={t.applied}
                    sequenceId={t.sequenceId}
                    draftId={t.draftId}
                    segregated={t.segregated}
                    mode={mode}
                    committing={commitSequence.isPending}
                    onApplyEmail={onApplyEmail}
                    onApplySequence={(a) => commitSequence.mutate(a)}
                    onOpenReview={() => router.push("/ai/review")}
                  />
                )}
                {t.exports && t.exports.length > 0 && (
                  <ExportLinks exports={t.exports} onDownload={(a) => api.downloadExport(a)} />
                )}
                {t.failed && i === turns.length - 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7"
                    disabled={send.isPending}
                    onClick={retryLast}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/80 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/20 p-1.5 focus-within:ring-2 focus-within:ring-primary/20">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message the assistant…"
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm focus-visible:outline-none"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || send.isPending}
            className="h-9 w-9 shrink-0 rounded-lg p-0"
            aria-label="Send message"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  applied,
  sequenceId,
  draftId,
  segregated,
  mode,
  committing,
  onApplyEmail,
  onApplySequence,
  onOpenReview,
}: {
  action: ChatAction;
  applied?: boolean;
  sequenceId?: string;
  draftId?: string;
  segregated?: boolean;
  mode: ChatMode;
  committing: boolean;
  onApplyEmail?: (email: { subject: string; html: string }) => void;
  onApplySequence: (action: Extract<ChatAction, { type: "sequence" }>) => void;
  onOpenReview: () => void;
}) {
  if (action.type === "email") {
    return (
      <div className="mt-2 space-y-1 rounded-md border border-border bg-background p-2 text-foreground">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-200">
            AI draft
          </span>
          {segregated && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              In review
            </span>
          )}
        </div>
        <p className="text-xs font-semibold">{action.subject || "(no subject)"}</p>
        <div
          className="prose prose-sm max-w-none text-xs [&_*]:!text-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.html) }}
        />
        {onApplyEmail && mode === "ask" && (
          <Button size="sm" className="mt-1 h-7" onClick={() => onApplyEmail({ subject: action.subject, html: action.html })}>
            Apply to editor
          </Button>
        )}
        {onApplyEmail && mode === "auto" && <p className="text-[11px] text-muted-foreground">Applied to editor.</p>}
        {draftId && (
          <Button size="sm" variant="outline" className="mt-1 h-7" onClick={onOpenReview}>
            Open AI Review
          </Button>
        )}
      </div>
    );
  }

  if (action.type === "sequence") {
    return (
      <div className="mt-2 space-y-1 rounded-md border border-border bg-background p-2 text-foreground">
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-200">
          AI sequence
        </span>
        <p className="text-xs font-semibold">{action.name}</p>
        <ol className="ml-4 list-decimal text-xs text-muted-foreground">
          {action.steps.slice(0, 8).map((s, i) => (
            <li key={i}>
              <span className="capitalize">{s.stepType}</span>
              {s.delayDays > 0 ? ` · +${s.delayDays}d` : " · immediately"}
              {s.subject ? ` · "${s.subject}"` : ""}
            </li>
          ))}
        </ol>
        {applied && sequenceId ? (
          <p className="text-[11px] text-green-600 dark:text-green-400">Created — opening…</p>
        ) : (
          <Button size="sm" className="mt-1 h-7" disabled={committing} onClick={() => onApplySequence(action)}>
            {committing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Create sequence
          </Button>
        )}
      </div>
    );
  }

  if (action.type === "analysis") {
    return (
      <div className="mt-2 space-y-2 rounded-md border border-border bg-background p-2 text-foreground">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:bg-sky-950 dark:text-sky-200">
            Analysis
          </span>
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {action.title && <p className="text-xs font-semibold">{action.title}</p>}
        {action.summary && <p className="text-[11px] text-muted-foreground">{action.summary}</p>}
        <div className="space-y-3">
          {action.charts.map((chart, i) => (
            <ChartView key={`${chart.title}-${i}`} chart={chart} />
          ))}
        </div>
      </div>
    );
  }

  if (action.type === "navigate") {
    return (
      <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-foreground">
        <Link
          href={action.path}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          {action.label}
        </Link>
      </div>
    );
  }

  if (action.type === "ui_action") {
    return (
      <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-foreground">
        <p className="text-xs font-medium">{action.label}</p>
        <p className="text-[11px] text-muted-foreground">
          Open Dexter AI to run this action{action.confirm ? " (confirmation required)" : ""}.
        </p>
      </div>
    );
  }

  return null;
}

function ExportLinks({
  exports: artifacts,
  onDownload,
}: {
  exports: ChatExportArtifact[];
  onDownload: (a: ChatExportArtifact) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-2.5 space-y-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-2.5 text-foreground dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <div className="flex items-center gap-1.5">
        <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Export ready
        </span>
      </div>
      {artifacts.map((a) => (
        <div
          key={a.exportKey}
          className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2 text-xs shadow-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{a.filename}</p>
            <p className="text-[11px] text-muted-foreground">
              {a.rowCount.toLocaleString()} row{a.rowCount === 1 ? "" : "s"} · {a.dataset}
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 shrink-0"
            disabled={busy === a.exportKey}
            onClick={async () => {
              setError(null);
              setBusy(a.exportKey);
              try {
                await onDownload(a);
              } catch {
                setError("Download failed — try again.");
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === a.exportKey ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            Download
          </Button>
        </div>
      ))}
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function numericValue(row: Record<string, string | number | null>, key?: string): number {
  if (!key) {
    const firstNum = Object.values(row).find((v) => typeof v === "number");
    return typeof firstNum === "number" ? firstNum : Number(firstNum) || 0;
  }
  const v = row[key];
  return typeof v === "number" ? v : Number(v) || 0;
}

function labelValue(row: Record<string, string | number | null>, key?: string): string {
  if (key && row[key] != null) return String(row[key]);
  const first = Object.values(row).find((v) => typeof v === "string" || typeof v === "number");
  return first == null ? "" : String(first);
}

const PIE_COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#64748b", "#ec4899"];

function ChartView({ chart }: { chart: ChartSpec }) {
  const yKey = chart.yKeys?.[0];
  const xKey = chart.xKey;

  if (chart.kind === "metric") {
    return (
      <div className="rounded border border-border/60 p-2">
        <p className="text-[11px] text-muted-foreground">{chart.title}</p>
        <p className="text-lg font-semibold tabular-nums">
          {chart.value ?? "—"}
          {chart.unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{chart.unit}</span> : null}
        </p>
      </div>
    );
  }

  if (chart.kind === "table") {
    const cols =
      chart.columns && chart.columns.length > 0
        ? chart.columns
        : Object.keys(chart.data[0] ?? {}).map((k) => ({ key: k, label: k }));
    return (
      <div className="rounded border border-border/60 p-2">
        <p className="mb-1 text-[11px] font-medium">{chart.title}</p>
        <div className="max-h-40 overflow-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {cols.map((c) => (
                  <th key={c.key} className="pb-1 pr-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {chart.data.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c.key} className="py-1 pr-2 tabular-nums">
                      {row[c.key] == null ? "—" : String(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (chart.kind === "pie") {
    const slices = chart.data.map((row, i) => ({
      label: labelValue(row, xKey),
      value: Math.max(0, numericValue(row, yKey)),
      color: PIE_COLORS[i % PIE_COLORS.length]!,
    }));
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    let angle = 0;
    const paths = slices.map((slice) => {
      const start = angle;
      const sweep = (slice.value / total) * 360;
      angle += sweep;
      return { ...slice, start, sweep };
    });
    return (
      <div className="rounded border border-border/60 p-2">
        <p className="mb-2 text-[11px] font-medium">{chart.title}</p>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 42 42" className="h-20 w-20 shrink-0">
            {paths.map((p, i) => {
              if (p.sweep >= 359.9) {
                return <circle key={i} cx="21" cy="21" r="15.5" fill={p.color} />;
              }
              const r = 15.5;
              const startRad = ((p.start - 90) * Math.PI) / 180;
              const endRad = ((p.start + p.sweep - 90) * Math.PI) / 180;
              const x1 = 21 + r * Math.cos(startRad);
              const y1 = 21 + r * Math.sin(startRad);
              const x2 = 21 + r * Math.cos(endRad);
              const y2 = 21 + r * Math.sin(endRad);
              const large = p.sweep > 180 ? 1 : 0;
              return (
                <path
                  key={i}
                  d={`M 21 21 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                  fill={p.color}
                />
              );
            })}
            <circle cx="21" cy="21" r="8" className="fill-background" />
          </svg>
          <ul className="min-w-0 flex-1 space-y-1">
            {slices.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate">{s.label || "—"}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {s.value.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // bar / line / area — horizontal bar list (matches analytics page style, no new deps)
  const items = chart.data.map((row) => ({
    label: labelValue(row, xKey),
    value: Math.max(0, numericValue(row, yKey)),
  }));
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded border border-border/60 p-2">
      <p className="mb-2 text-[11px] font-medium">{chart.title}</p>
      {chart.description && (
        <p className="mb-2 text-[10px] text-muted-foreground">{chart.description}</p>
      )}
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No data</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 24).map((item, i) => (
            <li key={`${item.label}-${i}`}>
              <div className="mb-0.5 flex justify-between text-[10px]">
                <span className="truncate font-medium">{item.label || "—"}</span>
                <span className="tabular-nums text-muted-foreground">{item.value.toLocaleString()}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-sky-500/80"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
