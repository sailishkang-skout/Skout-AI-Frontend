export const GATE_COOKIE_NAME = "skout_gate";

/** 7 days — matches the "temporary, not for a week" scope of the access gate. */
export const GATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const MAX_NEXT_PATH_LENGTH = 180;

export function isGatePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/gate" || normalized === "/app/gate" || normalized.endsWith("/gate");
}

/**
 * Clerk handshake JWTs stuffed into `next` make `/app/gate` URLs exceed proxy
 * header limits (HTTP 431). Keep a short relative path. `redirect()` also
 * prefixes basePath (`/app`), so strip a leading `/app`.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/sign-in";
  let value = raw.trim();
  if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
    return "/sign-in";
  }

  for (let i = 0; i < 3; i += 1) {
    const q = value.indexOf("?");
    const h = value.indexOf("#");
    const cut = [q, h].filter((n) => n >= 0);
    if (cut.length > 0) value = value.slice(0, Math.min(...cut));
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/sign-in";
  }
  if (value === "/app") return "/sign-in";
  if (value.startsWith("/app/")) value = value.slice(4);
  if (isGatePath(value) || value === "/" || value.length > MAX_NEXT_PATH_LENGTH) {
    return "/sign-in";
  }
  return value;
}

/**
 * Cookie holds a digest of GATE_TOKEN, not the raw token, so it isn't the literal shared
 * secret sitting in request logs / browser devtools. Web Crypto (not Node's `crypto` module)
 * so the same function works in both the Node server action and the Edge middleware.
 */
export async function hashGateToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
