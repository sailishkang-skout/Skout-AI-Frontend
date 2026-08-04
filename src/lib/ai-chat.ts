import { useApiFetch, useApiFetchBlob } from "./api-client";
import type { SequenceDetail } from "@/types/api";

export interface GeneratedStep {
  stepType: "email" | "linkedin" | "wait";
  delayDays: number;
  delayUnit?: "minutes" | "hours" | "days" | "weeks";
  linkedinAction?: "connect" | "message";
  subject?: string;
  bodyTemplate?: string;
}

export type ChartKind = "pie" | "bar" | "line" | "area" | "table" | "metric";

export interface ChartSpec {
  kind: ChartKind;
  title: string;
  description?: string;
  data: Array<Record<string, string | number | null>>;
  xKey?: string;
  yKeys?: string[];
  columns?: Array<{ key: string; label: string }>;
  value?: string | number;
  unit?: string;
}

export type UiActionName =
  | "open_ai_review"
  | "open_inbox"
  | "open_deliverability"
  | "open_sequences"
  | "open_lists"
  | "open_search"
  | "open_list"
  | "open_sequence"
  | "enroll_list"
  | "open_analytics"
  | "open_settings";

export type ChatAction =
  | { type: "none" }
  | { type: "email"; subject: string; html: string }
  | { type: "sequence"; name: string; steps: GeneratedStep[] }
  | { type: "analysis"; title?: string; summary?: string; charts: ChartSpec[] }
  | { type: "navigate"; path: string; label: string }
  | {
      type: "ui_action";
      name: UiActionName;
      label: string;
      params?: Record<string, string>;
      confirm?: boolean;
    };

export interface ChatExportArtifact {
  dataset: string;
  filename: string;
  rowCount: number;
  downloadUrl: string;
  /** Root-relative API path for authenticated blob download. */
  path?: string;
  exportKey: string;
  inline: boolean;
}

export interface ChatResponse {
  reply: string;
  action: ChatAction;
  applied: boolean;
  sequenceId?: string;
  draftId?: string;
  exports?: ChatExportArtifact[];
  mode?: ChatMode;
  /** True when Ask mode queued the email into AI Review. */
  segregated?: boolean;
}

export type ChatMode = "auto" | "ask";
/** "cro" = R19.2 admin-only CRO Copilot persona. */
export type ChatAgent = "skout" | "dexter" | "cro";

export interface ChatContext {
  subject?: string;
  body?: string;
  kind?: "email" | "sequence" | "general";
  /** Current dashboard path — helps the model pick product guides. */
  page?: string;
  prospectId?: string;
  threadId?: string;
  listId?: string;
  sequenceId?: string;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useAiChatApi() {
  const fetchApi = useApiFetch();
  const fetchBlob = useApiFetchBlob();

  return {
    chat: (input: {
      messages: { role: "user" | "assistant"; content: string }[];
      mode: ChatMode;
      stageForReview?: boolean;
      agent?: ChatAgent;
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

    /** Authenticated download of a CSV the assistant generated via export_dataset. */
    downloadExport: async (artifact: ChatExportArtifact) => {
      const path =
        artifact.path ??
        `/api/v1/ai/exports/download?key=${encodeURIComponent(artifact.exportKey)}`;
      const blob = await fetchBlob(path);
      triggerBlobDownload(blob, artifact.filename);
    },
  };
}
