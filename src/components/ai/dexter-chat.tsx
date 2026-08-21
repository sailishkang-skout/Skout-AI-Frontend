"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Loader2,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAiChatApi,
  type ChatAction,
  type ChatContext,
  type ChatExportArtifact,
  type ChatMode,
} from "@/lib/ai-chat";
import { executeDexterAction } from "@/lib/dexter-actions";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  warmSpeechVoices,
  type SpeechRecognitionLike,
} from "@/lib/dexter-speech";
import { createClientLogger } from "@/lib/logger";
import { sanitizeHtml, stripExportLinks } from "@/components/ai/ai-chat-box";

const log = createClientLogger("dexter");

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
  actionDone?: boolean;
  actionMessage?: string;
}

const DEXTER_SUGGESTIONS = [
  "Take me to my inbox",
  "How healthy is deliverability?",
  "Open AI Review",
  "Find VP Sales in SaaS",
  "Show weekly credit usage",
  "Take me to sequences",
];

interface DexterChatProps {
  context?: ChatContext;
  /** Shift left when another FAB (Sequences/Inbox chat) shares the corner. */
  offsetLeft?: boolean;
}

export function DexterChat({ context, offsetLeft = false }: DexterChatProps) {
  const api = useAiChatApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("ask");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [interim, setInterim] = useState("");
  const [micSupported] = useState(() => isSpeechRecognitionSupported());
  const [ttsSupported] = useState(() => isSpeechSynthesisSupported());
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speakCancelRef = useRef<(() => void) | null>(null);
  const lastAttemptRef = useRef<ChatTurn[]>([]);
  /** Finalized speech chunks while the mic is open — sent on stop or 10s silence. */
  const speechFinalRef = useRef("");
  const listeningRef = useRef(false);
  const interimRef = useRef("");
  const inputRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Auto-send after this long with no new speech results. */
  const SILENCE_SEND_MS = 10_000;

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopVoice = useCallback(() => {
    clearSilenceTimer();
    speakCancelRef.current?.();
    speakCancelRef.current = null;
    stopSpeaking();
    setSpeaking(false);
    listeningRef.current = false;
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    setListening(false);
    setInterim("");
    interimRef.current = "";
    speechFinalRef.current = "";
  }, [clearSilenceTimer]);

  useEffect(() => {
    warmSpeechVoices();
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  const speakReply = useCallback(
    (text: string) => {
      if (!voiceOn || !ttsSupported || !text.trim()) return;
      speakCancelRef.current?.();
      setSpeaking(true);
      const handle = speakText(text, {
        onEnd: () => {
          setSpeaking(false);
          speakCancelRef.current = null;
        },
      });
      speakCancelRef.current = handle.cancel;
    },
    [ttsSupported, voiceOn]
  );

  const runAction = useCallback(
    async (action: ChatAction, turnIndex: number, auto: boolean) => {
      if (action.type !== "navigate" && action.type !== "ui_action") return;
      if (action.type === "ui_action" && action.confirm && !auto) return;

      // R15.2 — enroll_list's audit log write now happens server-side in the same request as
      // the enroll itself (POST /ai/actions/enroll-list), not as a separate client call after
      // the fact — see executeDexterAction / api.enrollList.
      const result = await executeDexterAction(action, { router, enrollList: api.enrollList });
      setTurns((prev) =>
        prev.map((t, i) =>
          i === turnIndex
            ? {
                ...t,
                actionDone: result.ok,
                actionMessage: result.message,
              }
            : t
        )
      );
      if (result.message) {
        // Brief spoken confirmation for hands-free flow.
        if (voiceOn && auto) speakReply(result.message);
      }
      log.info("dexter action executed", {
        type: action.type,
        ok: result.ok,
        name: action.type === "ui_action" ? action.name : undefined,
      });
    },
    [api, router, speakReply, voiceOn]
  );

  const send = useMutation({
    mutationFn: (history: ChatTurn[]) => {
      // Soft style hint so replies stay human even before API image rebuild.
      // Shown history stays clean; only the outbound payload is enriched.
      const messages = history.map((t, i) => {
        const isLastUser = i === history.length - 1 && t.role === "user";
        return {
          role: t.role,
          content: isLastUser
            ? `${t.content}\n\n(Reply as Dexter: warm human teammate — think out loud briefly, discuss options, explain the why in natural spoken English. No robot/FAQ tone.)`
            : t.content,
        };
      });
      return api.chat({
        messages,
        mode,
        agent: "dexter",
        context,
      });
    },
    onSuccess: async (res) => {
      log.info("dexter reply", { actionType: res.action.type, mode });
      const assistantTurn: ChatTurn = {
        role: "assistant",
        content: res.reply,
        action: res.action,
        applied: res.applied,
        sequenceId: res.sequenceId,
        draftId: res.draftId,
        segregated: res.segregated,
        exports: res.exports,
      };
setTurns((prev) => [...prev, assistantTurn]);
      // Auto-run safe actions in voice mode (navigate + non-confirm ui_action).
      // Runs once via the mutation callback (not inside a state updater), so
      // React StrictMode's double-invoked updaters cannot fire it twice.
      const idx = turns.length; // index of the assistant turn being appended
      if (res.action.type === "navigate") {
        void runAction(res.action, idx, true);
      } else if (res.action.type === "ui_action" && !res.action.confirm) {
        void runAction(res.action, idx, true);
      }
      speakReply(res.reply);
      scrollToBottom();
    },
    onError: (err) => {
      log.error("dexter send failed", err);
      const detail = err instanceof Error ? err.message : null;
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
      speakReply("Sorry, I couldn't process that.");
      scrollToBottom();
    },
  });

function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    clearSilenceTimer();
    stopSpeaking();
    setSpeaking(false);
    // Build the next history outside the state updater. Scheduling send.mutate
    // inside the updater is unsafe: React StrictMode double-invokes updaters in
    // dev, which fired two identical chat requests and caused duplicate replies.
    const next = [...turns, { role: "user" as const, content: trimmed }];
    lastAttemptRef.current = next;
    setTurns(next);
    send.mutate(next);
    setInput("");
    inputRef.current = "";
    setInterim("");
    interimRef.current = "";
    scrollToBottom();
  }

  function handleSend() {
    if (listening) {
      // Finish the utterance first, then send from stop handler.
      finishListeningAndSend();
      return;
    }
    submitText(input);
  }

  function finishListeningAndSend() {
    clearSilenceTimer();
    const pending =
      `${speechFinalRef.current} ${interimRef.current}`.trim() || inputRef.current.trim();
    listeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
    setInterim("");
    interimRef.current = "";
    speechFinalRef.current = "";
    if (pending) submitText(pending);
  }

  function armSilenceTimer() {
    clearSilenceTimer();
    // Only auto-send once we've heard something.
    const hasSpeech =
      Boolean(speechFinalRef.current.trim()) ||
      Boolean(interimRef.current.trim()) ||
      Boolean(inputRef.current.trim());
    if (!listeningRef.current || !hasSpeech) return;

    silenceTimerRef.current = setTimeout(() => {
      if (!listeningRef.current) return;
      log.info("dexter silence auto-send", { ms: SILENCE_SEND_MS });
      finishListeningAndSend();
    }, SILENCE_SEND_MS);
  }

  function toggleListen() {
    if (!micSupported) return;

    // Second tap = you're done speaking → then Dexter replies.
    if (listening) {
      finishListeningAndSend();
      return;
    }

    clearSilenceTimer();
    stopSpeaking();
    setSpeaking(false);
    speechFinalRef.current = "";
    setInterim("");
    interimRef.current = "";

    const recognition = createSpeechRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let committed = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript ?? "";
        if ((result as { isFinal?: boolean }).isFinal) committed += piece;
        else interimText += piece;
      }
      speechFinalRef.current = committed.trim();
      interimRef.current = interimText.trim();
      setInterim(interimText.trim());
      // Mirror into the text box so you can edit before sending.
      const draft = `${committed} ${interimText}`.trim();
      if (draft) {
        inputRef.current = draft;
        setInput(draft);
      }
      // Reset the 10s pause clock whenever speech continues.
      armSilenceTimer();
    };
    recognition.onerror = (event) => {
      // "aborted" is expected when we stop on purpose.
      if (event.error !== "aborted" && event.error !== "no-speech") {
        log.warn("dexter speech error", { error: event.error });
      }
      if (event.error === "aborted") {
        clearSilenceTimer();
        listeningRef.current = false;
        setListening(false);
        return;
      }
      // no-speech: keep listening; silence timer still handles auto-send.
    };
    recognition.onend = () => {
      // Keep listening until the user taps stop or silence auto-send fires.
      if (!listeningRef.current) return;
      try {
        recognition.start();
      } catch {
        listeningRef.current = false;
        setListening(false);
        clearSilenceTimer();
      }
    };

    try {
      listeningRef.current = true;
      recognition.start();
      setListening(true);
    } catch (err) {
      log.warn("dexter mic start failed", { err });
      listeningRef.current = false;
      setListening(false);
    }
  }

  const commitSequence = useMutation({
    mutationFn: (action: Extract<ChatAction, { type: "sequence" }>) =>
      api.createFromSteps({ name: action.name, steps: action.steps }),
    onSuccess: (seq) => {
      router.push(`/sequences/${seq.id}`);
    },
  });

  const fabRight = offsetLeft
    ? "right-[max(5.75rem,calc(env(safe-area-inset-right)+4.25rem))]"
    : "right-[max(1.5rem,env(safe-area-inset-right))]";
  const panelRight = offsetLeft
    ? "right-[max(5.5rem,calc(env(safe-area-inset-right)+4rem))]"
    : "right-[max(1.25rem,env(safe-area-inset-right))]";

  if (!open) {
    return (
      <button
        type="button"
        data-tour="nav-ai-chat"
        data-testid="dexter-fab"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl ring-4 ring-emerald-500/25 transition hover:scale-105 hover:bg-emerald-500",
          fabRight
        )}
        aria-label="Open Dexter AI"
      >
        <Zap className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      data-tour="nav-ai-chat"
      data-testid="dexter-panel"
      className={cn(
        "fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex h-[min(40rem,calc(100dvh-5rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-background shadow-2xl",
        panelRight
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-emerald-600/15 via-background to-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Dexter AI</p>
            <p className="text-[11px] text-muted-foreground">
              Speaks · acts · {listening ? "listening…" : speaking ? "speaking…" : "ready"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-1 flex rounded-lg border border-border bg-background p-0.5 text-xs shadow-sm">
            {(["ask", "auto"] as ChatMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-2 py-1 capitalize transition-colors",
                  mode === m
                    ? "bg-emerald-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          {ttsSupported && (
            <button
              type="button"
              onClick={() => {
                if (voiceOn) stopVoice();
                setVoiceOn((v) => !v);
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={voiceOn ? "Mute Dexter voice" : "Unmute Dexter voice"}
              title={voiceOn ? "Mute voice" : "Unmute voice"}
            >
              {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stopVoice();
              setOpen(false);
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close Dexter"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-border bg-emerald-50/50 px-4 py-1.5 text-[11px] text-muted-foreground dark:bg-emerald-950/20">
        Tap the mic to talk. Dexter sends when you tap again, or after a 10s pause.
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {turns.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-2 py-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
              <Zap className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              Hey — I&apos;m Dexter. Talk it through with me: I&apos;ll think it over, explain, and
              help you get things done in Skout.
            </p>
            <div className="flex w-full flex-col gap-1.5">
              {DEXTER_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={send.isPending}
                  onClick={() => submitText(s)}
                  className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-xs transition hover:border-emerald-500/40 hover:bg-accent"
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
                    ? "rounded-br-md bg-emerald-600 text-white"
                    : "rounded-bl-md border border-border/60 bg-muted/80"
                )}
              >
                {display ? <p className="whitespace-pre-wrap break-words">{display}</p> : null}

                {t.action?.type === "navigate" && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      className="h-7 bg-emerald-600 hover:bg-emerald-500"
                      onClick={() => void runAction(t.action!, i, true)}
                    >
                      <ArrowRight className="mr-1 h-3.5 w-3.5" />
                      {t.action.label}
                    </Button>
                    {t.actionDone && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{t.actionMessage}</p>
                    )}
                  </div>
                )}

                {t.action?.type === "ui_action" && (
                  <div className="mt-2 space-y-1">
                    <Button
                      size="sm"
                      className="h-7 bg-emerald-600 hover:bg-emerald-500"
                      disabled={t.actionDone}
                      onClick={() => void runAction(t.action!, i, true)}
                    >
                      <Zap className="mr-1 h-3.5 w-3.5" />
                      {t.action.confirm ? `Confirm: ${t.action.label}` : t.action.label}
                    </Button>
                    {t.actionMessage && (
                      <p className="text-[11px] text-muted-foreground">{t.actionMessage}</p>
                    )}
                  </div>
                )}

                {t.action?.type === "email" && (
                  <div className="mt-2 space-y-1 rounded-md border border-border bg-background p-2">
                    <p className="text-xs font-semibold">{t.action.subject || "(no subject)"}</p>
                    <div
                      className="prose prose-sm max-w-none text-xs [&_*]:!text-foreground"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.action.html) }}
                    />
                    {t.draftId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => router.push("/ai/review")}
                      >
                        Open AI Review
                      </Button>
                    )}
                  </div>
                )}

                {t.action?.type === "sequence" && (
                  <div className="mt-2 space-y-1 rounded-md border border-border bg-background p-2">
                    <p className="text-xs font-semibold">{t.action.name}</p>
                    <Button
                      size="sm"
                      className="h-7"
                      disabled={commitSequence.isPending || Boolean(t.sequenceId)}
                      onClick={() => commitSequence.mutate(t.action as Extract<ChatAction, { type: "sequence" }>)}
                    >
                      {commitSequence.isPending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Create sequence
                    </Button>
                  </div>
                )}

                {t.exports && t.exports.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {t.exports.map((a) => (
                      <Button
                        key={a.exportKey}
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => void api.downloadExport(a)}
                      >
                        Download {a.filename}
                      </Button>
                    ))}
                  </div>
                )}

                {t.failed && i === turns.length - 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7"
                    disabled={send.isPending}
                    onClick={() => {
                      if (lastAttemptRef.current.length) send.mutate(lastAttemptRef.current);
                    }}
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Dexter is thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background p-3">
        {listening && (
          <p className="mb-1.5 px-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            Listening… tap mic to send now, or pause 10s and Dexter will send.
          </p>
        )}
        {!listening && interim && (
          <p className="mb-1.5 px-1 text-[11px] italic text-muted-foreground">Hearing: {interim}</p>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/20 p-1.5 focus-within:ring-2 focus-within:ring-emerald-500/30">
          {micSupported && (
            <Button
              type="button"
              size="sm"
              variant={listening ? "default" : "ghost"}
              onClick={toggleListen}
              disabled={send.isPending}
              className={cn(
                "h-9 w-9 shrink-0 rounded-lg p-0",
                listening && "bg-red-600 text-white hover:bg-red-500 animate-pulse"
              )}
              aria-label={listening ? "Stop and send" : "Speak to Dexter"}
              title={listening ? "Stop & send" : "Speak"}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <textarea
            rows={1}
            value={input}
            onChange={(e) => {
              inputRef.current = e.target.value;
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              listening
                ? "Keep talking… 10s pause or tap mic to send"
                : micSupported
                  ? "Ask Dexter or tap the mic…"
                  : "Ask Dexter…"
            }
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm focus-visible:outline-none"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || send.isPending}
            className="h-9 w-9 shrink-0 rounded-lg bg-emerald-600 p-0 hover:bg-emerald-500"
            aria-label="Send to Dexter"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {!micSupported && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Voice input needs Chrome/Edge. You can still type — Dexter can speak replies if your
            browser supports speech synthesis.
          </p>
        )}
      </div>
    </div>
  );
}
