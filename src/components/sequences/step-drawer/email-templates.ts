/** Saved email templates. Same key and shape the old email editor used, so existing templates carry over. */
export const TEMPLATES_KEY = "skout_email_templates_v1";

export interface EmailTemplate {
  id: string;
  name: string;
  html: string;
  subject?: string;
  createdAt: string;
}

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadTemplates(): EmailTemplate[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as EmailTemplate[]) : [];
  } catch {
    return [];
  }
}

function persist(list: EmailTemplate[]) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked — templates are a convenience, never worth failing an edit for.
  }
}

export function saveTemplate(input: { name: string; html: string; subject?: string }): EmailTemplate[] {
  const template: EmailTemplate = {
    id: newId(),
    name: input.name,
    html: input.html,
    subject: input.subject || undefined,
    createdAt: new Date().toISOString(),
  };
  const next = [...loadTemplates(), template];
  persist(next);
  return next;
}

export function deleteTemplate(id: string): EmailTemplate[] {
  const next = loadTemplates().filter((t) => t.id !== id);
  persist(next);
  return next;
}
