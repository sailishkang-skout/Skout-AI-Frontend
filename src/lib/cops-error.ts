/**
 * COPS-01 — error envelope handling for CustomerOps screens (OpenAPI draft:
 * docs/api/copos-01-platform-foundation.openapi.yaml in Skout-AI-Backend).
 *
 * Envelope: { code, message, details?, request_id, retryable }.
 * 422 details carry field paths; 429 details carry retry_after_seconds.
 */

export interface CopsErrorEnvelope {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id: string;
  retryable: boolean;
}

export interface CopsFieldError {
  path: string;
  code: string;
  message: string;
}

/** Narrow an unknown response body to the COPS error envelope. */
export function parseCopsError(body: unknown): CopsErrorEnvelope | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.code !== "string" || typeof b.message !== "string") return null;
  if (typeof b.request_id !== "string" || typeof b.retryable !== "boolean") return null;
  return {
    code: b.code,
    message: b.message,
    details: (b.details as Record<string, unknown> | undefined) ?? undefined,
    request_id: b.request_id,
    retryable: b.retryable,
  };
}

/** Map 422 field errors to `{ [path]: message }` so a form can show each message under its input. */
export function fieldErrorsByPath(err: CopsErrorEnvelope): Record<string, string> {
  const fields = (err.details?.fields as CopsFieldError[] | undefined) ?? [];
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (typeof f.path === "string" && typeof f.message === "string" && !(f.path in out)) {
      out[f.path] = f.message;
    }
  }
  return out;
}

/** Milliseconds to wait before retrying a 429, or null when the envelope has no retry metadata. */
export function retryAfterMs(err: CopsErrorEnvelope): number | null {
  const seconds = err.details?.retry_after_seconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  return seconds * 1_000;
}

/**
 * Retry policy for queries and mutations: only when the server says the error is retryable, and
 * a 429 waits at least the advertised delay. Capped attempts keep a broken endpoint from looping.
 */
export function shouldRetry(err: CopsErrorEnvelope, attempt: number, maxAttempts = 3): boolean {
  return err.retryable && attempt < maxAttempts;
}
