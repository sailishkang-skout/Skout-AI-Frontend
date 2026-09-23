"use client";

import { useEffect, useRef, useState } from "react";
import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MERGE_TOKENS, formatToken, validateFallback, type MergeTokenInfo } from "@/lib/merge-tokens";

/**
 * A searchable list of merge tokens. Picking one hands `onPick` the text to insert, e.g.
 * `{{firstName}}` or, after "+ fallback", `{{firstName|there}}`. The panel is `position: fixed`
 * so a scrolling toolbar can't clip it.
 */
export function VariableMenu({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [fallback, setFallback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setQuery("");
    setEditing(null);
    setError(null);
  }

  function toggle() {
    if (open) return close();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)) });
    setOpen(true);
  }

  function pick(text: string) {
    onPick(text);
    close();
  }

  function startFallback(token: MergeTokenInfo) {
    setEditing(token.name);
    setFallback(token.defaultFallback ?? "");
    setError(null);
  }

  function insertWithFallback(token: MergeTokenInfo) {
    const problem = validateFallback(fallback);
    if (problem) return setError(problem);
    pick(formatToken(token.name, fallback));
  }

  useEffect(() => {
    if (!open) return;
    // Capture phase, so Escape closes just this menu and a drawer behind it doesn't also react.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const tokens = needle
    ? MERGE_TOKENS.filter((t) => `${t.name} ${t.label} ${t.description}`.toLowerCase().includes(needle))
    : MERGE_TOKENS;

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
      >
        <Braces className="h-3.5 w-3.5" />
        Variable
      </Button>

      {open && (
        <div
          ref={panelRef}
          role="group"
          aria-label="Variables"
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-[310] w-80 rounded-md border border-border bg-card p-2 shadow-xl"
        >
          <Input
            autoFocus
            aria-label="Search variables"
            placeholder="Search variables…"
            className="mb-2 h-8 text-xs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {tokens.length === 0 ? (
            <p className="p-2 text-center text-xs text-muted-foreground">No variables match</p>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {tokens.map((token) => (
                <li key={token.name}>
                  <div className="flex items-start justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => pick(formatToken(token.name))}>
                      <span className="block text-sm">
                        {token.label}{" "}
                        <code className="text-[11px] text-muted-foreground">{`{{${token.name}}}`}</code>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">e.g. {token.sample}</span>
                      {token.note && (
                        <span className="block text-[11px] text-amber-700 dark:text-amber-400">{token.note}</span>
                      )}
                    </button>
                    {token.allowFallback && (
                      <button
                        type="button"
                        aria-label={`Add fallback for ${token.label}`}
                        className="shrink-0 text-[11px] text-primary underline"
                        onClick={() => startFallback(token)}
                      >
                        + fallback
                      </button>
                    )}
                  </div>

                  {editing === token.name && (
                    <div className="space-y-1 px-2 pb-2">
                      <div className="flex gap-1.5">
                        <Input
                          autoFocus
                          aria-label={`Fallback for ${token.label}`}
                          placeholder="Shown when blank"
                          className="h-8 text-xs"
                          value={fallback}
                          onChange={(e) => {
                            setFallback(e.target.value);
                            setError(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && insertWithFallback(token)}
                        />
                        <Button type="button" size="sm" className="h-8" onClick={() => insertWithFallback(token)}>
                          Insert
                        </Button>
                      </div>
                      {error ? (
                        <p role="alert" className="text-[11px] text-destructive">
                          {error}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Blank recipients see &ldquo;{fallback.trim() || "…"}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
