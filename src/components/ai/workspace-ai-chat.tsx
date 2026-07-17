"use client";

import { usePathname } from "next/navigation";
import { AiChatBox } from "@/components/ai/ai-chat-box";

/** Routes that already mount a page-specific AiChatBox (richer editor context). */
const SPECIALIZED_CHAT_PREFIXES = ["/sequences", "/inbox"];

/**
 * Global workspace + product AI assistant.
 * Hidden on Sequences/Inbox where a specialized chat FAB already exists —
 * those chats still receive workspace facts + guides from the API.
 */
export function WorkspaceAiChat() {
  const pathname = usePathname() || "/";
  const specialized = SPECIALIZED_CHAT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (specialized) return null;

  return (
    <AiChatBox
      title="Skout AI"
      defaultMode="ask"
      context={{ kind: "general", page: pathname }}
    />
  );
}
