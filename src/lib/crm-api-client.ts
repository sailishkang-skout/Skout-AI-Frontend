import { ApiError, getClerkApiToken } from "./api-client";
import { useAuthAdapter, AUTH_ENABLED } from "@/lib/auth";

/** Dev/prod often expose CRM routes on the same API Gateway host as the main API (ALB path rules). */
const CONFIGURED_CRM_API_URL =
  process.env.NEXT_PUBLIC_CRM_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:3002";

const AUTH_LOAD_POLL_MS = 25;
const AUTH_LOAD_TIMEOUT_MS = 8_000;

/**
 * Resolve the CRM service base at call time — mirrors `getApiBase()` in `api-client.ts`
 * (mixed-content HTTPS→HTTP downgrade guard), but for the separate CRM microservice
 * (its own Fastify service/ALB, not proxied through the main API).
 */
export function getCrmApiBase(): string {
  if (typeof window !== "undefined") {
    if (!CONFIGURED_CRM_API_URL) return "";
    try {
      const configured = new URL(CONFIGURED_CRM_API_URL);
      if (window.location.protocol === "https:" && configured.protocol === "http:") {
        return "";
      }
    } catch {
      return "";
    }
  }
  return CONFIGURED_CRM_API_URL;
}

/**
 * Authenticated fetch against the CRM service. Same auth mechanics as `apiFetch`
 * (Clerk Bearer token or `x-stub-user-email`), but the CRM service resolves the
 * workspace server-side from the authenticated user — no `X-Workspace-Id` header
 * is sent or accepted here, unlike the main API's `WORKSPACE_ID` constant pattern.
 */
export async function crmApiFetch<T>(
  path: string,
  options?: RequestInit & { authToken?: string }
): Promise<T> {
  const { authToken, ...init } = options ?? {};
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
  if (body !== undefined && body !== null && body !== "") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${getCrmApiBase()}${path}`, {
    ...init,
    body,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: string }).error)
        : res.statusText;
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

async function waitForClerkLoaded(isLoaded: boolean, getIsLoaded: () => boolean): Promise<void> {
  if (isLoaded) return;
  const start = Date.now();
  while (!getIsLoaded()) {
    if (Date.now() - start > AUTH_LOAD_TIMEOUT_MS) {
      throw new ApiError("Auth is still loading", 401);
    }
    await new Promise((resolve) => setTimeout(resolve, AUTH_LOAD_POLL_MS));
  }
}

function useCrmServiceFetchAdapter() {
  const adapter = useAuthAdapter();
  const session = adapter.useSession();
  const getAccessToken = adapter.useGetAccessToken();

  return async function fetchWithAuth<T>(path: string, options?: RequestInit): Promise<T> {
    await waitForClerkLoaded(session.isLoaded, () => session.isLoaded);

    if (!session.isSignedIn) {
      throw new ApiError("Sign in required", 401);
    }

    const authToken = await getClerkApiToken(() => getAccessToken());

    return crmApiFetch<T>(path, { ...options, authToken });
  };
}

function useCrmServiceFetchStub() {
  return async function fetchWithAuth<T>(path: string, options?: RequestInit): Promise<T> {
    const headers = new Headers(options?.headers);
    if (!AUTH_ENABLED) {
      headers.set("x-stub-user-email", "stub@example.com");
    }
    return crmApiFetch<T>(path, { ...options, headers });
  };
}

export const useCrmServiceFetch = AUTH_ENABLED ? useCrmServiceFetchAdapter : useCrmServiceFetchStub;