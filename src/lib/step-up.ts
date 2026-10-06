"use client";

import { ApiError, useApiFetch } from "./api-client";

interface StepUpResponse {
  data: { reauthToken: string; issuedAt: string; expiresInMinutes: number };
}

/** AUTH-FE-12 — POST /api/v1/auth/step-up (AUTH-BE-27). Password re-auth for own-auth users. */
export function useStepUpApi() {
  const fetchApi = useApiFetch();
  return {
    reauthenticate: (credentials: { password: string }) =>
      fetchApi<StepUpResponse>("/api/v1/auth/step-up", {
        method: "POST",
        body: JSON.stringify(credentials),
      }).then((res) => res.data.reauthToken),
  };
}

/** True when a protected action's 401 is packages/auth's assertStepUp() rejection (the backend
 *  serializes HttpError("step_up_required", 401) with that literal string as both `error` and
 *  `message`, not one of the §3 AUTH_* codes — this is a different control, not a §3 auth code). */
export function isStepUpRequiredError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 401) return false;
  // Global envelope (decided 2026-10-06) carries the machine code in `code`; `error` is the
  // legacy field and is still read so older responses keep working.
  const body = err.body as { code?: string; error?: string } | undefined;
  return body?.code === "step_up_required" || body?.error === "step_up_required";
}
