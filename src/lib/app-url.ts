/** Public frontend origin for Clerk redirects and OAuth. Never use the API URL here. */
export function getAppOrigin(): string | undefined {
  // In the browser, always trust the URL the user actually opened. NEXT_PUBLIC_* is
  // baked at Docker build time and can still point at the internal ALB if CI used a
  // stale DEV_API_URL — that breaks Google OAuth callbacks (redirect to HTTP ALB).
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
