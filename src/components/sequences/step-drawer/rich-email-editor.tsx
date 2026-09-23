"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * The TipTap email editor, loaded client-side only (it uses browser APIs).
 * It reads `initialContent` only on mount — remount it with a new `key` to load different content.
 */
export const RichEmailEditor = dynamic(
  () => import("../email-editor").then((m) => ({ default: m.EmailEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);
