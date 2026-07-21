"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AiChatBox } from "@/components/ai/ai-chat-box";
import type { ChatContext } from "@/lib/ai-chat";

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

  const context = useMemo<ChatContext>(() => {
    const ctx: ChatContext = { kind: "general", page: pathname };
    // Inject entity IDs from the URL when on detail pages.
    const listMatch = pathname.match(/\/lists\/([a-f0-9-]+)/);
    if (listMatch) ctx.listId = listMatch[1];
    const seqMatch = pathname.match(/\/sequences\/([a-f0-9-]+)/);
    if (seqMatch) ctx.sequenceId = seqMatch[1];
    return ctx;
  }, [pathname]);

  if (specialized) return null;

  return <AiChatBox title="Skout AI" defaultMode="ask" context={context} />;
}
