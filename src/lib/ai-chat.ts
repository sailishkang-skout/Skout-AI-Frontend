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
}

export type ChatMode = "auto" | "ask";

export interface ChatContext {
  subject?: string;
  body?: string;
  kind?: "email" | "sequence" | "general";
}

export function useAiChatApi() {
  const fetchApi = useApiFetch();

  return {
    chat: (input: {
      messages: { role: "user" | "assistant"; content: string }[];
      mode: ChatMode;
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
