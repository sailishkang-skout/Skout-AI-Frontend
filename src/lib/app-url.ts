/** Public site origin (HTTPS API Gateway in dev). Baked at build via NEXT_PUBLIC_APP_URL. */
export function getAppOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}
