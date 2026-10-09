import { apiFetch, ApiError } from "@/lib/api-client";
import { parseCopsError, retryAfterMs, shouldRetry, type CopsErrorEnvelope } from "@/lib/cops-error";

/** Error thrown by copsFetch: the parsed COPS envelope when the server sent one, else the raw error. */
export class CopsRequestError extends Error {
  constructor(
    message: string,
    public readonly envelope: CopsErrorEnvelope | null,
    public readonly cause: unknown
  ) {
    super(message);
    this.name = "CopsRequestError";
  }
}

/**
 * COPS error adapter. The shared apiFetch owns retries; this wrapper exposes typed error details
 * to COPS forms without retrying the same operation a second time.
 */
export async function copsFetch<T>(
  path: string,
  init?: RequestInit,
  opts: {
    maxAttempts?: number;
    sleep?: (ms: number) => Promise<void>;
    /** Authenticated fetcher from useApiFetch(); defaults to the unauthenticated apiFetch. */
    request?: (path: string, init?: RequestInit) => Promise<T>;
  } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 1;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const request = opts.request ?? ((p: string, i?: RequestInit) => apiFetch<T>(p, i));
  for (let attempt = 1; ; attempt++) {
    try {
      return await request(path, init);
    } catch (err) {
      const body = err instanceof ApiError ? err.body : undefined;
      const envelope = parseCopsError(body);
      const message = envelope?.message ?? (err instanceof Error ? err.message : "Request failed");
      if (!envelope || !shouldRetry(envelope, attempt, maxAttempts)) {
        throw new CopsRequestError(message, envelope, err);
      }
      const wait = retryAfterMs(envelope) ?? 500 * 2 ** (attempt - 1);
      await sleep(wait);
    }
  }
}
