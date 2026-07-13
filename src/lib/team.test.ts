import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getInviteDetails } from "./team";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const INVITE = {
  id: "inv-1",
  workspaceId: "ws-1",
  workspaceName: "Acme Corp",
  email: "user@acme.com",
  role: "member",
  expiresAt: "2026-08-01T00:00:00.000Z",
  accepted: false,
  expired: false,
};

describe("getInviteDetails", () => {
  it("fetches the public invite endpoint with no auth", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: INVITE }));
    await getInviteDetails("abc123");
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/v1/team/invites/abc123");
  });

  it("resolves to the invite data on success", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: INVITE }));
    const result = await getInviteDetails("abc123");
    expect(result).toEqual(INVITE);
  });

  it("includes the token in the URL", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: INVITE }));
    await getInviteDetails("token-xyz-789");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("token-xyz-789");
  });

  it("resolves with accepted=true for an already-accepted invite", async () => {
    const accepted = { ...INVITE, accepted: true };
    mockFetch.mockResolvedValue(makeResponse(200, { data: accepted }));
    const result = await getInviteDetails("abc123");
    expect(result.accepted).toBe(true);
  });

  it("resolves with expired=true for an expired invite", async () => {
    const expired = { ...INVITE, expired: true };
    mockFetch.mockResolvedValue(makeResponse(200, { data: expired }));
    const result = await getInviteDetails("abc123");
    expect(result.expired).toBe(true);
  });

  it("does not attach Authorization header (public endpoint)", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: INVITE }));
    await getInviteDetails("abc123");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });
});
