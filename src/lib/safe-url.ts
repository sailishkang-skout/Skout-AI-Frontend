/** A captured website as an http(s) link target, or null when it is not a safe web address. */
export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Short text for a website link: no scheme or leading www, no trailing slash. */
export function websiteLabel(value: string): string {
  return value.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}
