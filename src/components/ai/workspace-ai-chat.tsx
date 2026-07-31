"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { DexterChat } from "@/components/ai/dexter-chat";
import type { ChatContext } from "@/lib/ai-chat";

/** Page-specific AiChatBox FABs also mount here — offset Dexter so both are usable. */
const SPECIALIZED_CHAT_PREFIXES = ["/sequences", "/inbox"];

/**
 * Global Dexter AI agent — available on every dashboard page.
 * Speaks (TTS), listens (STT), and performs confirmable in-app actions.
 */
export function WorkspaceAiChat() {
  const pathname = usePathname() || "/";
  const offsetForSpecialized = SPECIALIZED_CHAT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const context = useMemo<ChatContext>(() => {
    const ctx: ChatContext = { kind: "general", page: pathname };
    const listMatch = pathname.match(/\/lists\/([a-f0-9-]+)/);
    if (listMatch) ctx.listId = listMatch[1];
    const seqMatch = pathname.match(/\/sequences\/([a-f0-9-]+)/);
    if (seqMatch) ctx.sequenceId = seqMatch[1];
    return ctx;
  }, [pathname]);

  return <DexterChat context={context} offsetLeft={offsetForSpecialized} />;
}
