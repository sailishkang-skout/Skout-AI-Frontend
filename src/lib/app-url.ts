/** Public frontend origin for Clerk redirects and OAuth. Never use the API URL here. */
export function getAppOrigin(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return undefined;
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return undefined;
}
