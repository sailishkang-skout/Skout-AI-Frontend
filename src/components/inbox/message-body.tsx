"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

function stripTrackingPixels(html: string): string {
  return html
    .replace(/<img\b[^>]*\/api\/v1\/track\/open\/[^>]*>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
}

function wrapEmailDocument(html: string): string {
  const body = stripTrackingPixels(html);
  // Prefer fragment if already a full document
  if (/<html[\s>]/i.test(body) || /<body[\s>]/i.test(body)) {
    return body;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_blank"/><style>
    html,body{margin:0;padding:12px;background:transparent;color:#111;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;word-break:break-word;}
    a{color:#2563eb;} img{max-width:100%;height:auto;} pre{white-space:pre-wrap;}
  </style></head><body>${body}</body></html>`;
}

/** Format mailparser-style plain text: drop [image:…] placeholders, link <urls> and bare URLs. */
export function formatPlainEmailText(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return escaped
    .replace(/\[image:\s*[^\]]*\]/gi, "")
    .replace(/&lt;(https?:\/\/[^&\s]+)&gt;/gi, (_m, url: string) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all">${url}</a>`;
    })
    .replace(/(^|[\s(])(https?:\/\/[^\s<&]+)/g, (_m, pre: string, url: string) => {
      const clean = url.replace(/[),.;]+$/g, "");
      const trail = url.slice(clean.length);
      return `${pre}<a href="${clean}" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all">${clean}</a>${trail}`;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value.trim());
}

export function MessageBody({
  bodyHtml,
  bodyText,
  isOutbound,
}: {
  bodyHtml: string | null | undefined;
  bodyText: string | null | undefined;
  isOutbound?: boolean;
}) {
  const html = useMemo(() => {
    if (bodyHtml && bodyHtml.trim()) return bodyHtml;
    // Some stored "text" bodies are actually HTML fragments
    if (bodyText && looksLikeHtml(bodyText)) return bodyText;
    return null;
  }, [bodyHtml, bodyText]);

  const plainFormatted = useMemo(() => {
    if (!bodyText?.trim()) return null;
    return formatPlainEmailText(bodyText);
  }, [bodyText]);

  if (html) {
    const srcDoc = wrapEmailDocument(html);
    return (
      <iframe
        title="Email message"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        srcDoc={srcDoc}
        className={cn(
          "w-full min-h-[120px] max-h-[480px] rounded-lg border-0 bg-white",
          isOutbound && "bg-white/95"
        )}
        style={{ colorScheme: "light" }}
        onLoad={(e) => {
          const frame = e.currentTarget;
          try {
            const doc = frame.contentDocument;
            if (!doc?.body) return;
            const h = Math.min(Math.max(doc.body.scrollHeight + 24, 120), 480);
            frame.style.height = `${h}px`;
          } catch {
            /* cross-origin guard */
          }
        }}
      />
    );
  }

  if (plainFormatted) {
    return (
      <div
        className={cn(
          "px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isOutbound ? "text-primary-foreground/95" : "text-foreground"
        )}
        dangerouslySetInnerHTML={{ __html: plainFormatted }}
      />
    );
  }

  return (
    <p className="px-3 py-2 text-sm text-muted-foreground italic">(no content)</p>
  );
}
