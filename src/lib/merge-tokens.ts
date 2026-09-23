/**
 * Merge tokens usable in sequence copy. Keep in step with the API's `MERGE_TOKENS`
 * (`sequence-merge-tokens.ts`) and grammar (`merge-template.ts`):
 *   {{token}}            the recipient's value
 *   {{token|fallback}}   the fallback when the value is blank (1-60 characters, no { } | or line breaks)
 */
export const FALLBACK_MAX = 60;

export interface MergeTokenInfo {
  name: string;
  label: string;
  description: string;
  /** Shown in the picker so people can picture the result. */
  sample: string;
  /** Suggested when someone adds a fallback; null when a default would be misleading. */
  defaultFallback: string | null;
  allowFallback: boolean;
  note: string | null;
}

export const MERGE_TOKENS: MergeTokenInfo[] = [
  { name: "firstName", label: "First name", description: "The prospect's first name", sample: "Ada", defaultFallback: "there", allowFallback: true, note: null },
  { name: "lastName", label: "Last name", description: "The prospect's last name", sample: "Lovelace", defaultFallback: null, allowFallback: true, note: null },
  { name: "fullName", label: "Full name", description: "The prospect's full name", sample: "Ada Lovelace", defaultFallback: "there", allowFallback: true, note: null },
  { name: "companyName", label: "Company", description: "The prospect's company", sample: "Acme", defaultFallback: "your company", allowFallback: true, note: null },
  {
    name: "companyDomain",
    label: "Company website",
    description: "The company's website address",
    sample: "acme.com",
    defaultFallback: null,
    allowFallback: true,
    note: "A web address, not an industry. Avoid it inside sentences.",
  },
  { name: "title", label: "Job title", description: "The prospect's job title", sample: "VP Finance", defaultFallback: "your role", allowFallback: true, note: null },
  { name: "senderName", label: "Your name", description: "The sending inbox's name. Use it in the sign-off", sample: "Sam", defaultFallback: null, allowFallback: true, note: null },
  { name: "senderEmail", label: "Your email", description: "The sending inbox's address", sample: "sam@yourco.com", defaultFallback: null, allowFallback: true, note: null },
  {
    name: "unsubscribeUrl",
    label: "Unsubscribe link",
    description: "The recipient's unsubscribe link",
    sample: "https://…/unsubscribe",
    defaultFallback: null,
    allowFallback: false,
    note: "Use it only inside the unsubscribe link. It can't have a fallback.",
  },
];

/** `{{name}}`, or `{{name|fallback}}` when a non-blank fallback is given. */
export function formatToken(name: string, fallback?: string | null): string {
  const trimmed = fallback?.trim();
  return trimmed ? `{{${name}|${trimmed}}}` : `{{${name}}}`;
}

/** An error message for a fallback the API would reject, or null when it is valid. */
export function validateFallback(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Enter a fallback";
  if (trimmed.length > FALLBACK_MAX) return `Keep it to ${FALLBACK_MAX} characters or fewer`;
  if (/[{}|\r\n]/.test(trimmed)) return "A fallback can't contain { } | or line breaks";
  return null;
}

/** Regex source for one valid token, plain or with a fallback. Malformed placeholders don't match. */
export const TOKEN_PATTERN = String.raw`\{\{\w+(?:\|[^{}|\r\n]*)?\}\}`;

/**
 * Preview-only resolution: a real value wins, then the token's fallback, otherwise the token is
 * left visible (so reviewers can see what fills in at send time). Malformed placeholders are untouched.
 */
export function resolveTokens(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{\{(\w+)(?:\|([^{}|\r\n]*))?\}\}/g, (match, name: string, fallback: string | undefined) => {
    const value = values[name];
    if (value !== undefined && value.trim() !== "") return value;
    if (fallback !== undefined && fallback.trim() !== "") return fallback.trim();
    return match;
  });
}
