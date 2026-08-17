export const GATE_COOKIE_NAME = "skout_gate";

/** 7 days — matches the "temporary, not for a week" scope of the access gate. */
export const GATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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
