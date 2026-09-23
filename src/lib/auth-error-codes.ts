/**
 * §3 stable auth failure codes (AUTH-FE-02 / AUTH-BE-08). Keep in sync with backend
 * `packages/auth/src/auth-error-codes.ts`.
 */
export const AuthErrorCode = {
  AUTH_MISSING_TOKEN: "AUTH_MISSING_TOKEN",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_ACCOUNT_BLOCKED: "AUTH_ACCOUNT_BLOCKED",
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  AUTH_REAUTH_USER_MISMATCH: "AUTH_REAUTH_USER_MISMATCH",
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return (
    typeof value === "string" &&
    (Object.values(AuthErrorCode) as string[]).includes(value)
  );
}

/** Read `code` from API JSON error bodies ({ error, code } or nested shapes). */
export function parseAuthErrorCodeFromBody(body: unknown): AuthErrorCode | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  if (isAuthErrorCode(record.code)) return record.code;
  const nested = record.error;
  if (nested && typeof nested === "object" && isAuthErrorCode((nested as { code?: unknown }).code)) {
    return (nested as { code: AuthErrorCode }).code;
  }
  const details = record.details as { error?: { code?: unknown } } | undefined;
  if (details?.error && isAuthErrorCode(details.error.code)) {
    return details.error.code;
  }
  return undefined;
}

export function isJwtExpiredMessage(message: string): boolean {
  return /jwt is expired/i.test(message) || /\bexpired\b/i.test(message);
}
