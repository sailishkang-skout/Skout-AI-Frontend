import { useAuth } from "@clerk/nextjs";
import { createClientLogger, logAndCapture } from "@/lib/logger";

const log = createClientLogger("api-client");
const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

/**
 * Resolve the API base at call time. NEXT_PUBLIC_API_URL is baked at Docker build
 * time and can point at the internal HTTP ALB; calling it from an HTTPS page is
 * blocked as mixed content. Behind the API Gateway the API is reachable same-origin
 * (`/api/*` is proxied to the ALB), so in the browser we drop to a relative base
 * whenever the configured URL would downgrade HTTPS→HTTP. Local dev (http page →
 * http API on another port) is left untouched.
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (!CONFIGURED_API_URL) return "";
    try {
      const configured = new URL(CONFIGURED_API_URL);
      if (window.location.protocol === "https:" && configured.protocol === "http:") {
        return "";
      }
    } catch {
      return "";
    }
  }
  return CONFIGURED_API_URL;
}

const API_URL = CONFIGURED_API_URL;
export const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const AUTH_LOAD_POLL_MS = 25;
const AUTH_LOAD_TIMEOUT_MS = 8_000;
const TOKEN_RETRY_ATTEMPTS = 8;
const TOKEN_RETRY_BASE_MS = 50;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** True once Clerk has hydrated and the user has an active session. */
function useAuthReadyClerk(): boolean {
  const { isLoaded, isSignedIn } = useAuth();
  return isLoaded && !!isSignedIn;
}

function useAuthReadyStub(): boolean {
  return true;
}

export const useAuthReady = CLERK_ENABLED ? useAuthReadyClerk : useAuthReadyStub;

export function isRetryableAuthError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) {
    return (
      error.message.includes("Auth is still loading") ||
      error.message.includes("Missing Clerk session token") ||
      error.message.includes("Missing bearer token") ||
      error.message.includes("Invalid Clerk token") ||
      error.message.includes("Invalid authorization token") ||
      error.message.includes("Sign in required")
    );
  }
  return false;
}

/** User-facing message for failed API queries. */
export function formatQueryError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session could not be verified. Sign out and sign in again, or refresh the page.";
    }
    if (error.status >= 500) {
      return "The API returned a server error. Check that Postgres and Redis are running.";
    }
    const body = error.body as
      | { message?: string; error?: string; issues?: Array<{ path?: string; message?: string }> }
      | undefined;
    if (body?.issues?.length) {
      const detail = body.issues
        .slice(0, 3)
        .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
        .join("; ");
      const more = body.issues.length > 3 ? ` (+${body.issues.length - 3} more)` : "";
      return `${body.message ?? "Request validation failed"} — ${detail}${more}`;
    }
    if (body?.message && body.message !== body.error) return body.message;
    if (error.message) return error.message;
  }
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return `Could not reach the API at ${getApiBase() || API_URL} — ensure the backend is running and NEXT_PUBLIC_API_URL matches.`;
  }
  return fallback;
}

/** Shared React Query options — retry brief auth races after hard refresh. */
export const authQueryOptions = {
  retry: (failureCount: number, error: unknown) =>
    isRetryableAuthError(error) ? failureCount < 3 : failureCount < 1,
  retryDelay: (attempt: number) => Math.min(1000, 100 * 2 ** attempt),
} as const;

function logApiFailure(
  method: string,
  path: string,
  error: unknown,
  fields?: Record<string, unknown>
): void {
  if (isRetryableAuthError(error)) {
    log.debug("api auth race", { method, path, ...fields });
    return;
  }
  if (error instanceof ApiError && error.status >= 500) {
    logAndCapture(log, error, "api request server error", { method, path, status: error.status, ...fields });
    return;
  }
  if (error instanceof ApiError) {
    log.warn("api request failed", { method, path, status: error.status, message: error.message, ...fields });
    return;
  }
  logAndCapture(log, error, "api request network failure", { method, path, ...fields });
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { workspaceId?: string; authToken?: string }
): Promise<T> {
  const { workspaceId, authToken, ...init } = options ?? {};
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  let body = init.body;

  // Fastify rejects Content-Type: application/json with an empty body.
  const sendsJsonBody = ["POST", "PUT", "PATCH"].includes(method);
  if ((body === undefined || body === null || body === "") && sendsJsonBody) {
    body = "{}";
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  if (workspaceId) {
    headers.set("X-Workspace-Id", workspaceId);
  }
  if (body !== undefined && body !== null && body !== "") {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      ...init,
      body,
      headers,
      credentials: "include",
    });
  } catch (err) {
    logApiFailure(method, path, err, { workspaceId });
    throw err;
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    const message =
      typeof errBody === "object" && errBody !== null && "error" in errBody
        ? String((errBody as { error: string }).error)
        : res.statusText;
    const error = new ApiError(message, res.status, errBody);
    logApiFailure(method, path, error, { workspaceId });
    throw error;
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    log.info("api mutation succeeded", { method, path, status: res.status, workspaceId });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Authenticated fetch that returns a Blob (e.g. CSV file download). */
export async function apiFetchBlob(
  path: string,
  options?: RequestInit & { workspaceId?: string; authToken?: string }
): Promise<Blob> {
  const { workspaceId, authToken, ...init } = options ?? {};
  const headers = new Headers(init.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  if (workspaceId) {
    headers.set("X-Workspace-Id", workspaceId);
  }

  const method = (init.method ?? "GET").toUpperCase();
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (err) {
    logApiFailure(method, path, err, { workspaceId });
    throw err;
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    const message =
      typeof errBody === "object" && errBody !== null && "error" in errBody
        ? String((errBody as { error: string }).error)
        : res.statusText;
    const error = new ApiError(message, res.status, errBody);
    logApiFailure(method, path, error, { workspaceId });
    throw error;
  }

  log.info("api blob download succeeded", { method, path, status: res.status, workspaceId });
  return res.blob();
}

async function waitForClerkLoaded(
  isLoaded: boolean,
  getIsLoaded: () => boolean,
  timeoutMs = AUTH_LOAD_TIMEOUT_MS
): Promise<void> {
  if (isLoaded) return;
  const start = Date.now();
  while (!getIsLoaded()) {
    if (Date.now() - start > timeoutMs) {
      throw new ApiError("Auth is still loading", 401);
    }
    await new Promise((resolve) => setTimeout(resolve, AUTH_LOAD_POLL_MS));
  }
}

/** Resolve a Clerk session JWT for API calls (Bearer header). */
export async function getClerkApiToken(
  getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>
): Promise<string> {
  for (let attempt = 0; attempt < TOKEN_RETRY_ATTEMPTS; attempt++) {
    const token = await getToken(attempt > 0 ? { skipCache: true } : undefined);
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, TOKEN_RETRY_BASE_MS * (attempt + 1)));
  }
  throw new ApiError("Missing Clerk session token — sign in again", 401);
}

function useApiFetchClerk() {
  const auth = useAuth();

  return async function fetchWithAuth<T>(
    path: string,
    options?: RequestInit & { workspaceId?: string }
  ): Promise<T> {
    await waitForClerkLoaded(auth.isLoaded, () => auth.isLoaded);

    if (!auth.isSignedIn) {
      throw new ApiError("Sign in required", 401);
    }

    const authToken = await getClerkApiToken(() => auth.getToken());

    return apiFetch<T>(path, {
      ...options,
      authToken,
    });
  };
}

function useApiFetchBlobClerk() {
  const auth = useAuth();

  return async function fetchBlobWithAuth(
    path: string,
    options?: RequestInit & { workspaceId?: string }
  ): Promise<Blob> {
    await waitForClerkLoaded(auth.isLoaded, () => auth.isLoaded);

    if (!auth.isSignedIn) {
      throw new ApiError("Sign in required", 401);
    }

    const authToken = await getClerkApiToken(() => auth.getToken());

    return apiFetchBlob(path, {
      ...options,
      authToken,
    });
  };
}

function useApiFetchStub() {
  return async function fetchWithAuth<T>(
    path: string,
    options?: RequestInit & { workspaceId?: string }
  ): Promise<T> {
    const headers = new Headers(options?.headers);
    if (!CLERK_ENABLED) {
      headers.set("x-stub-user-email", "stub@example.com");
    }
    return apiFetch<T>(path, { ...options, headers });
  };
}

function useApiFetchBlobStub() {
  return async function fetchBlobWithAuth(
    path: string,
    options?: RequestInit & { workspaceId?: string }
  ): Promise<Blob> {
    const headers = new Headers(options?.headers);
    if (!CLERK_ENABLED) {
      headers.set("x-stub-user-email", "stub@example.com");
    }
    return apiFetchBlob(path, { ...options, headers });
  };
}

export const useApiFetch = CLERK_ENABLED ? useApiFetchClerk : useApiFetchStub;
export const useApiFetchBlob = CLERK_ENABLED ? useApiFetchBlobClerk : useApiFetchBlobStub;

export { API_URL };
