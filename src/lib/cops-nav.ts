/** COPS-01 audit-viewer query helpers, used by the existing dashboard routes. */

export function hasNavPermission(requiredPermission: string | undefined, granted: readonly string[]): boolean {
  return !requiredPermission || granted.includes(requiredPermission);
}

export interface AuditFilters {
  search?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

/** Builds the query string for GET /audit. Empty filters are dropped; limit is clamped to 1..100. */
export function auditQueryString(filters: AuditFilters): string {
  const params = new URLSearchParams();
  const entries: Array<[string, string | undefined]> = [
    ["search", filters.search],
    ["actor_id", filters.actorId],
    ["entity_type", filters.entityType],
    ["entity_id", filters.entityId],
    ["from", filters.from],
    ["to", filters.to],
    ["cursor", filters.cursor],
  ];
  for (const [k, v] of entries) {
    if (v && v.trim()) params.set(k, v.trim());
  }
  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 25)));
  params.set("limit", String(limit));
  return params.toString();
}
