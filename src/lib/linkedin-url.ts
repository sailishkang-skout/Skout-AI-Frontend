/**
 * What a pasted LinkedIn link is, before anything is sent: a person or a company, its clean address, or a
 * plain reason it cannot be used. Tracking parameters and sub-pages (/details/skills, /jobs) are dropped.
 */
export type ParsedLinkedinUrl =
  | { ok: true; kind: "person" | "company"; slug: string; url: string }
  | { ok: false; reason: string };

const NOT_SUPPORTED: Array<[RegExp, string]> = [
  [/^\/sales\//i, "Sales Navigator links are not accepted. Open the person or company on LinkedIn and copy that link."],
  [/^\/(search|jobs|feed|posts|pulse|groups|events|school|showcase|learning|messaging|notifications)(\/|$)/i, "That is not a person or company page. Use a link that starts with linkedin.com/in/… or linkedin.com/company/…"],
];

export function parseLinkedinUrl(input: string): ParsedLinkedinUrl {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "Paste a LinkedIn profile or company link." };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: "That does not look like a link." };
  }
  if (!/^(?:[a-z]{2,3}\.|www\.)?linkedin\.com$/i.test(url.hostname)) return { ok: false, reason: "Only linkedin.com links are accepted." };
  for (const [pattern, reason] of NOT_SUPPORTED) if (pattern.test(url.pathname)) return { ok: false, reason };
  const match = url.pathname.match(/^\/(in|company)\/([^/?#]+)/i);
  if (!match) return { ok: false, reason: "Use a profile (linkedin.com/in/…) or company (linkedin.com/company/…) link." };
  const slug = decodeURIComponent(match[2]!);
  if (/[\s/\\<>"'`]/.test(slug)) return { ok: false, reason: "The profile or company name in the link has characters LinkedIn does not use." };
  const kind = match[1]!.toLowerCase() === "in" ? "person" : "company";
  return { ok: true, kind, slug, url: `https://www.linkedin.com/${match[1]!.toLowerCase()}/${encodeURIComponent(slug)}/` };
}
