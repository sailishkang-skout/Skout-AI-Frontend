/** Clerk path routing only renders when this matches window.location.pathname. */
export const SIGN_IN_MOUNTS = [
  "/app/signin",
  "/app/sign-in",
  "/app/login",
  "/signin",
  "/sign-in",
  "/login",
] as const;

export const SIGN_UP_MOUNTS = ["/app/sign-up", "/sign-up"] as const;

export function clerkPathFromLocation(
  pathname: string,
  mounts: readonly string[],
  fallback: string
): string {
  const p = pathname.replace(/\/$/, "") || "/";
  const found = mounts.find((base) => p === base || p.startsWith(`${base}/`));
  return found ?? fallback;
}
