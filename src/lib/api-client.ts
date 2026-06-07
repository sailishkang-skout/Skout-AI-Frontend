const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { workspaceId?: string }
): Promise<T> {
  const { workspaceId, ...init } = options ?? {};
  const headers = new Headers(init.headers);

  headers.set("Content-Type", "application/json");
  if (workspaceId) {
    headers.set("X-Workspace-Id", workspaceId);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(res.statusText, res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export { API_URL };
