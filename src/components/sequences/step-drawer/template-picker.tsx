import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteTemplate, loadTemplates, saveTemplate, type EmailTemplate } from "./email-templates";

export function TemplatePicker({
  subject,
  html,
  onApply,
}: {
  subject: string;
  html: string;
  onApply: (template: EmailTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [name, setName] = useState("");

  function toggle() {
    if (!open) setTemplates(loadTemplates());
    setOpen((v) => !v);
  }

  function save() {
    if (!name.trim() || !html.trim()) return;
    setTemplates(saveTemplate({ name: name.trim(), html, subject }));
    setName("");
  }

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={toggle}>
        <FileText className="h-3.5 w-3.5" />
        Templates
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-card p-2 shadow-lg">
          {templates.length === 0 ? (
            <p className="p-2 text-center text-xs text-muted-foreground">No saved templates yet</p>
          ) : (
            <ul className="max-h-48 overflow-auto">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-accent">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm"
                    onClick={() => {
                      onApply(t);
                      setOpen(false);
                    }}
                  >
                    {t.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete template ${t.name}`}
                    className="ml-2 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setTemplates(deleteTemplate(t.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
            <Input
              aria-label="Template name"
              placeholder="Save current as…"
              className="h-8 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            <Button type="button" size="sm" className="h-8" onClick={save} disabled={!name.trim() || !html.trim()}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
