/**
 * Browser speech helpers for Dexter AI (Web Speech API).
 * Tuned for a warmer, more human male voice and natural pacing.
 */

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal?: boolean; length: number }
  > & { length: number };
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Continuous listening — caller accumulates transcripts and decides when to send
 * (stop the mic / silence timer). Do not auto-submit on each final chunk.
 */
export function createSpeechRecognition(): SpeechRecognitionLike | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  return recognition;
}

const MALE_VOICE_RE =
  /\b(male|david|daniel|alex|fred|tom|arthur|aaron|gordon|james|mark|george|rishi|thomas|oliver|ryan|guy|eric|nathan|microsoft\s+david|google\s+uk\s+english\s+male|google\s+us\s+english\s+male)\b/i;
const FEMALE_VOICE_RE =
  /\b(female|samantha|karen|moira|tessa|fiona|victoria|zira|susan|hazel|catherine|serena|google\s+us\s+english\s+female|google\s+uk\s+english\s+female)\b/i;
const PREMIUM_VOICE_RE = /\b(natural|neural|premium|enhanced|wavenet|studio|online|google)\b/i;

function voiceScore(v: SpeechSynthesisVoice): number {
  let score = 0;
  if (MALE_VOICE_RE.test(v.name) && !FEMALE_VOICE_RE.test(v.name)) score += 50;
  if (FEMALE_VOICE_RE.test(v.name)) score -= 80;
  if (PREMIUM_VOICE_RE.test(v.name)) score += 25;
  if (/en(-|_)US/i.test(v.lang)) score += 15;
  else if (/en(-|_)GB/i.test(v.lang)) score += 12;
  else if (/^en/i.test(v.lang)) score += 8;
  // Local "compact" voices often sound more robotic.
  if (/compact|eloquence|novelty/i.test(v.name)) score -= 20;
  return score;
}

/** Pick the most natural male English voice the browser exposes. */
export function pickMaleEnglishVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const ranked = [...voices].sort((a, b) => voiceScore(b) - voiceScore(a));
  const best = ranked[0];
  if (!best || voiceScore(best) < -40) return null;
  return best;
}

/**
 * Soften text for TTS: strip markdown, expand common jargon, add gentle pauses
 * so delivery sounds more human and less machine-gun.
 */
export function humanizeForSpeech(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  text = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " that link ")
    .replace(/\bAI Review\b/gi, "A I Review")
    .replace(/\bICP\b/g, "I C P")
    .replace(/\bCSV\b/g, "C S V")
    .replace(/\bGTM\b/g, "G T M")
    .replace(/\bHITL\b/gi, "human review")
    .replace(/\bUI\b/g, "interface")
    .replace(/\bAPI\b/g, "A P I")
    .replace(/\s+/g, " ")
    .trim();

  // Encourage natural pauses between clauses for TTS engines that honor punctuation.
  text = text
    .replace(/([.!?])\s+/g, "$1 ")
    .replace(/:\s+/g, ". ")
    .replace(/;\s+/g, ". ")
    .replace(/\s+—\s+/g, ". ")
    .replace(/\s+–\s+/g, ", ");

  return text.slice(0, 1400);
}

function splitIntoSpeakChunks(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [text];

  // Keep chunks short enough for natural breath pauses between them.
  const chunks: string[] = [];
  let buf = "";
  for (const part of parts) {
    if ((buf + " " + part).trim().length > 180 && buf) {
      chunks.push(buf.trim());
      buf = part;
    } else {
      buf = buf ? `${buf} ${part}` : part;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

/** Speak text aloud with a warmer male voice and human pacing. */
export function speakText(
  text: string,
  opts?: { rate?: number; pitch?: number; onEnd?: () => void }
): { cancel: () => void } {
  if (!isSpeechSynthesisSupported() || !text.trim()) {
    opts?.onEnd?.();
    return { cancel: () => undefined };
  }

  window.speechSynthesis.cancel();

  const spoken = humanizeForSpeech(text);
  if (!spoken) {
    opts?.onEnd?.();
    return { cancel: () => undefined };
  }

  const preferred = pickMaleEnglishVoice();
  const chunks = splitIntoSpeakChunks(spoken);
  let cancelled = false;
  let index = 0;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
    opts?.onEnd?.();
  };

  const speakNext = () => {
    if (cancelled) return;
    if (index >= chunks.length) {
      finish();
      return;
    }

    const chunk = chunks[index++]!;
    const utterance = new SpeechSynthesisUtterance(chunk);
    // Slightly slower than default reads warmer / less robotic.
    utterance.rate = opts?.rate ?? 0.92;
    utterance.pitch = opts?.pitch ?? 0.95;
    utterance.volume = 1;
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      if (cancelled) return;
      // Brief breath between chunks — makes multi-sentence replies feel human.
      if (index < chunks.length) {
        pauseTimer = setTimeout(speakNext, 220);
      } else {
        finish();
      }
    };
    utterance.onerror = () => {
      if (!cancelled) finish();
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();

  return {
    cancel: () => {
      cancelled = true;
      if (pauseTimer) {
        clearTimeout(pauseTimer);
        pauseTimer = null;
      }
      window.speechSynthesis.cancel();
    },
  };
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

/** Chrome often loads voices asynchronously — call once on mount to warm the list. */
export function warmSpeechVoices(): void {
  if (!isSpeechSynthesisSupported()) return;
  void window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    void window.speechSynthesis.getVoices();
  };
}
