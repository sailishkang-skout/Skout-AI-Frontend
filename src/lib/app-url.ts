/** Public path prefix for the product UI on skoutai.io. */
export const APP_BASE_PATH = "/app";

/** Origin only (no /app). Used for Clerk allowedRedirectOrigins. */
export function getAppOrigin(): string | undefined {
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

/** Public app base including /app, e.g. https://www.skoutai.io/app */
export function getAppBaseUrl(): string | undefined {
  const origin = getAppOrigin();
  if (!origin) return undefined;
  try {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (configured) {
      const url = new URL(configured);
      if (url.pathname && url.pathname !== "/") {
        return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
      }
    }
  } catch {
    /* fall through */
  }
  return `${origin}${APP_BASE_PATH}`;
}
