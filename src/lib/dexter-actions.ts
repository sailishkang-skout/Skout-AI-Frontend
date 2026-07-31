import type { ChatAction, UiActionName } from "@/lib/ai-chat";
import type { useSequencesApi } from "@/lib/sequences";

type SequencesApi = ReturnType<typeof useSequencesApi>;

type RouterLike = { push: (href: string) => void };

export type DexterActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/** Resolve a ui_action into an in-app path when it's navigate-only. */
export function pathForUiAction(
  name: UiActionName,
  params?: Record<string, string>
): string | null {
  switch (name) {
    case "open_ai_review":
      return "/ai/review";
    case "open_inbox":
      return "/inbox";
    case "open_deliverability":
      return "/deliverability";
    case "open_sequences":
      return "/sequences";
    case "open_lists":
      return "/lists";
    case "open_analytics":
      return "/analytics";
    case "open_settings":
      return "/settings";
    case "open_search": {
      const q = params?.query?.trim();
      return q
        ? `/prospects/search?q=${encodeURIComponent(q)}`
        : "/prospects/search";
    }
    case "open_list":
      return params?.listId ? `/lists/${params.listId}` : "/lists";
    case "open_sequence":
      return params?.sequenceId ? `/sequences/${params.sequenceId}` : "/sequences";
    case "enroll_list":
      return null;
    default:
      return null;
  }
}

/**
 * Execute a Dexter action on the client.
 * Mutating actions (enroll_list) call the API; navigation uses the router.
 */
export async function executeDexterAction(
  action: Extract<ChatAction, { type: "ui_action" | "navigate" }>,
  deps: {
    router: RouterLike;
    sequences: SequencesApi;
  }
): Promise<DexterActionResult> {
  if (action.type === "navigate") {
    deps.router.push(action.path);
    return { ok: true, message: `Opened ${action.label}` };
  }

  if (action.name === "enroll_list") {
    const listId = action.params?.listId;
    const sequenceId = action.params?.sequenceId;
    if (!listId || !sequenceId) {
      return {
        ok: false,
        message: "I need both a list and a sequence to enroll. Open them first, then ask again.",
      };
    }
    try {
      const result = await deps.sequences.enroll(sequenceId, { listId });
      deps.router.push(`/sequences/${sequenceId}?tab=enroll`);
      return {
        ok: true,
        message:
          result.enrolled > 0
            ? `Enrolled ${result.enrolled} prospect${result.enrolled === 1 ? "" : "s"} into the sequence.`
            : "Enrollment finished — check the sequence Enroll tab.",
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "enroll failed";
      return { ok: false, message: `Could not enroll: ${detail}` };
    }
  }

  const path = pathForUiAction(action.name, action.params);
  if (!path) {
    return { ok: false, message: `I don't know how to run "${action.name}" yet.` };
  }
  deps.router.push(path);
  return { ok: true, message: action.label };
}
