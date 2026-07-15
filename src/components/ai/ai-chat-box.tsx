"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAiChatApi,
  type ChatAction,
  type ChatContext,
  type ChatMode,
} from "@/lib/ai-chat";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  action?: ChatAction;
  applied?: boolean;
  sequenceId?: string;
}

interface AiChatBoxProps {
  /** Context passed to the model (what the user is editing). */
  context?: ChatContext;
  /** When provided, email actions can be adopted into the caller's editor. */
  onApplyEmail?: (email: { subject: string; html: string }) => void;
  /** Called after a sequence is created (auto mode or Apply). */
  onSequenceCreated?: (sequenceId: string) => void;
  title?: string;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "");
}

export function AiChatBox({ context, onApplyEmail, onSequenceCreated, title = "Skout AI assistant" }: AiChatBoxProps) {
  const api = useAiChatApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("ask");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  const commitSequence = useMutation({
    mutationFn: (action: Extract<ChatAction, { type: "sequence" }>) =>
      api.createFromSteps({ name: action.name, steps: action.steps }),
    onSuccess: (seq) => {
      onSequenceCreated?.(seq.id);
      router.push(`/sequences/${seq.id}`);
    },
  });

  const send = useMutation({
    mutationFn: (history: ChatTurn[]) =>
      api.chat({
        messages: history.map((t) => ({ role: t.role, content: t.content })),
        mode,
        context,
      }),
    onSuccess: (res) => {
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, action: res.action, applied: res.applied, sequenceId: res.sequenceId },
      ]);
      // Auto mode: apply immediately.
      if (mode === "auto") {
        if (res.action.type === "email") onApplyEmail?.({ subject: res.action.subject, html: res.action.html });
        if (res.action.type === "sequence" && res.applied && res.sequenceId) {
          onSequenceCreated?.(res.sequenceId);
          router.push(`/sequences/${res.sequenceId}`);
        }
      }
      scrollToBottom();
    },
    onError: () => {
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry — I couldn't process that. Please try again." },
      ]);
      scrollToBottom();
    },
  });

  function handleSend() {
    const text = input.trim();
    if (!text || send.isPending) return;
    const next = [...turns, { role: "user" as const, content: text }];
    setTurns(next);
    setInput("");
    send.mutate(next);
    scrollToBottom();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
        aria-label="Open AI assistant"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col rounded-xl border border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            {(["ask", "auto"] as ChatMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded px-2 py-0.5 capitalize",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                title={m === "auto" ? "Apply changes automatically" : "Propose changes; you confirm"}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {turns.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-6 w-6" />
            <p>Ask me to write an email, tweak your copy, or design a sequence.</p>
            <p className="text-xs">
              <span className="font-medium">Ask</span> proposes changes to confirm;{" "}
              <span className="font-medium">Auto</span> applies them directly.
            </p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {t.content && <p className="whitespace-pre-wrap">{t.content}</p>}
              {t.action && t.action.type !== "none" && (
                <ActionCard
                  action={t.action}
                  applied={t.applied}
                  sequenceId={t.sequenceId}
                  mode={mode}
                  committing={commitSequence.isPending}
                  onApplyEmail={onApplyEmail}
                  onApplySequence={(a) => commitSequence.mutate(a)}
                />
              )}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-border p-2">
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
          className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        <Button size="sm" onClick={handleSend} disabled={!input.trim() || send.isPending} className="shrink-0">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  applied,
  sequenceId,
  mode,
  committing,
  onApplyEmail,
  onApplySequence,
}: {
  action: ChatAction;
  applied?: boolean;
  sequenceId?: string;
  mode: ChatMode;
  committing: boolean;
  onApplyEmail?: (email: { subject: string; html: string }) => void;
  onApplySequence: (action: Extract<ChatAction, { type: "sequence" }>) => void;
}) {
  if (action.type === "email") {
    return (
      <div className="mt-2 space-y-1 rounded-md border border-border bg-background p-2 text-foreground">
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
      </div>
    );
  }

  if (action.type === "sequence") {
    return (
      <div className="mt-2 space-y-1 rounded-md border border-border bg-background p-2 text-foreground">
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

  return null;
}
