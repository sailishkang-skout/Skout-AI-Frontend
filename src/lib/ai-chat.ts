import { useApiFetch } from "./api-client";
import type { SequenceDetail } from "@/types/api";

export interface GeneratedStep {
  stepType: "email" | "linkedin" | "wait";
  delayDays: number;
  delayUnit?: "minutes" | "hours" | "days" | "weeks";
  linkedinAction?: "connect" | "message";
  subject?: string;
  bodyTemplate?: string;
}

export type ChatAction =
  | { type: "none" }
  | { type: "email"; subject: string; html: string }
  | { type: "sequence"; name: string; steps: GeneratedStep[] };

export interface ChatResponse {
  reply: string;
  action: ChatAction;
  applied: boolean;
  sequenceId?: string;
  draftId?: string;
  mode?: ChatMode;
  /** True when Ask mode queued the email into AI Review. */
  segregated?: boolean;
}

export type ChatMode = "auto" | "ask";

export interface ChatContext {
  subject?: string;
  body?: string;
  kind?: "email" | "sequence" | "general";
  prospectId?: string;
  threadId?: string;
}

export function useAiChatApi() {
  const fetchApi = useApiFetch();

  return {
    chat: (input: {
      messages: { role: "user" | "assistant"; content: string }[];
      mode: ChatMode;
      stageForReview?: boolean;
      context?: ChatContext;
    }) =>
      fetchApi<ChatResponse>("/api/v1/ai/chat", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    createFromSteps: (input: { name: string; steps: GeneratedStep[] }) =>
      fetchApi<SequenceDetail>("/api/v1/sequences/from-steps", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };
}
