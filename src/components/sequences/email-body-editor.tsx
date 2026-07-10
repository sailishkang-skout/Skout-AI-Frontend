"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  BookmarkPlus,
  ChevronDown,
  FileText,
  Loader2,
  Maximize2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// TipTap uses browser APIs — load client-side only
const EmailEditor = dynamic(
  () => import("./email-editor").then((m) => ({ default: m.EmailEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const TEMPLATES_KEY = "skout_email_templates_v1";

interface EmailTemplate {
  id: string;
  name: string;
  html: string;
  createdAt: string;
}

function loadTemplates(): EmailTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTemplates(t: EmailTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t));
}

interface EmailBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

export function EmailBodyEditor({ value, onChange, disabled }: EmailBodyEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [editorKey, setEditorKey] = useState(0);
  const [templateName, setTemplateName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  function openEditor() {
    setDraft(value);
    setTemplates(loadTemplates());
    setOpen(true);
  }

  function applyAndClose() {
    onChange(draft);
    setOpen(false);
  }

  function discardAndClose() {
    setDraft(value);
    setOpen(false);
  }

  function handleSaveTemplate() {
    if (!templateName.trim()) return;
    const t: EmailTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      html: draft,
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, t];
    saveTemplates(updated);
    setTemplates(updated);
    setTemplateName("");
    setShowSaveInput(false);
  }

  function handleLoadTemplate(t: EmailTemplate) {
    setDraft(t.html);
    setEditorKey((k) => k + 1); // force TipTap to remount with new content
    setShowTemplateList(false);
  }

  function handleDeleteTemplate(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = templates.filter((t) => t.id !== id);
    saveTemplates(updated);
    setTemplates(updated);
  }

  const hasContent = value.trim().length > 0;

  return (
    <>
      {/* ── Preview card ─────────────────────────────────── */}
      <div
        className={cn(
          "group relative min-h-[72px] cursor-pointer rounded-md border border-border bg-background transition-colors hover:border-primary/50",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={openEditor}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && openEditor()}
      >
        {hasContent ? (
          <div
            className="prose prose-sm pointer-events-none max-h-28 overflow-hidden p-3 text-sm [&_*]:!text-foreground"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        ) : (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Maximize2 className="h-3.5 w-3.5" />
            Click to open email editor…
          </div>
        )}
        {hasContent && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Maximize2 className="h-3.5 w-3.5" />
              Edit email body
            </span>
          </div>
        )}
      </div>

      {/* ── Full-screen editor modal ──────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Email body
            </div>

            <div className="flex items-center gap-2">
              {/* Save as template */}
              {showSaveInput ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    placeholder="Template name…"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTemplate();
                      if (e.key === "Escape") setShowSaveInput(false);
                    }}
                    className="h-8 rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" onClick={handleSaveTemplate}>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSaveInput(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveInput(true)}
                  className="gap-1.5"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save as template
                </Button>
              )}

              {/* Load template */}
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTemplateList((v) => !v)}
                  className="gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Templates
                  <ChevronDown className="h-3 w-3" />
                </Button>
                {showTemplateList && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-border bg-card shadow-lg">
                    {templates.length === 0 ? (
                      <p className="p-3 text-center text-xs text-muted-foreground">
                        No saved templates yet
                      </p>
                    ) : (
                      <ul className="max-h-60 overflow-auto py-1">
                        {templates.map((t) => (
                          <li
                            key={t.id}
                            className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-accent"
                            onClick={() => handleLoadTemplate(t)}
                          >
                            <span className="truncate text-sm">{t.name}</span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTemplate(t.id, e)}
                              className="ml-2 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <Button size="sm" onClick={applyAndClose} className="gap-1.5">
                Apply
              </Button>

              <button
                type="button"
                onClick={discardAndClose}
                title="Discard changes"
                className="ml-1 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <EmailEditor
              key={editorKey}
              initialContent={draft}
              onChange={setDraft}
            />
          </div>
        </div>
      )}
    </>
  );
}
