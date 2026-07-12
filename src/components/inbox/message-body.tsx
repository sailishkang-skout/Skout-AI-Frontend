"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

function stripTrackingPixels(html: string): string {
  return html
    .replace(/<img\b[^>]*\/api\/v1\/track\/open\/[^>]*>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
}

/** Older sequence sends stored TipTap HTML escaped as text — restore real tags. */
function maybeUnescapeStoredHtml(html: string): string {
  const trimmed = html.trim();
  if (/&lt;\/?[a-z]/i.test(trimmed) && !/<\/?[a-z][\s>]/i.test(trimmed)) {
    return trimmed
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  return html;
}

function wrapEmailDocument(html: string): string {
  const body = stripTrackingPixels(maybeUnescapeStoredHtml(html));
  if (/<html[\s>]/i.test(body) || /<body[\s>]/i.test(body)) {
    return body;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_blank"/><style>
    html,body{margin:0;padding:14px 16px;background:#fff;color:#0f172a;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;word-break:break-word;}
    a{color:#2563eb;text-decoration:underline;} img{max-width:100%;height:auto;}
    p{margin:0 0 0.75em;} p:last-child{margin-bottom:0;}
    h1,h2,h3{margin:0 0 0.5em;line-height:1.25;font-weight:600;}
    ul,ol{margin:0 0 0.75em;padding-left:1.25em;}
    blockquote{margin:0.5em 0;padding-left:0.75em;border-left:3px solid #e2e8f0;color:#475569;}
    pre,code{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;}
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
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    })
    .replace(/(^|[\s(])(https?:\/\/[^\s<&]+)/g, (_m, pre: string, url: string) => {
      const clean = url.replace(/[),.;]+$/g, "");
      const trail = url.slice(clean.length);
      return `${pre}<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${trail}`;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value.trim()) || /&lt;\/?[a-z]/i.test(value.trim());
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
      <div className={cn("overflow-hidden rounded-b-xl bg-white", isOutbound && "ring-1 ring-inset ring-primary/10")}>
        <iframe
          title="Email message"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          srcDoc={srcDoc}
          className="w-full min-h-[140px] max-h-[520px] border-0 bg-white"
          style={{ colorScheme: "light" }}
          onLoad={(e) => {
            const frame = e.currentTarget;
            try {
              const doc = frame.contentDocument;
              if (!doc?.body) return;
              const h = Math.min(Math.max(doc.body.scrollHeight + 28, 140), 520);
              frame.style.height = `${h}px`;
            } catch {
              /* ignore */
            }
          }}
        />
      </div>
    );
  }

  if (plainFormatted) {
    return (
      <div
        className="email-plain px-4 py-3 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_a]:break-all"
        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        dangerouslySetInnerHTML={{ __html: plainFormatted }}
      />
    );
  }

  return (
    <p className="px-4 py-3 text-sm text-muted-foreground italic">(no content)</p>
  );
}
