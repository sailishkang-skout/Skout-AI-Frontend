/** A single key, or a list where any one key is enough (e.g. CRM reads OR CRM writers). */
export function hasNavPermission(
  requiredPermission: string | readonly string[] | undefined,
  granted: readonly string[]
): boolean {
  if (!requiredPermission) return true;
  if (typeof requiredPermission === "string") return granted.includes(requiredPermission);
  return requiredPermission.some((key) => granted.includes(key));
}
