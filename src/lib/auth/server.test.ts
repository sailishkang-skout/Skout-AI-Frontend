import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

import { getServerSession } from "./server";

describe("getServerSession", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("returns Clerk userId and getToken", async () => {
    const getToken = vi.fn().mockResolvedValue("jwt");
    authMock.mockResolvedValue({ userId: "user_1", getToken });

    const session = await getServerSession();
    expect(session.userId).toBe("user_1");
    await expect(session.getToken()).resolves.toBe("jwt");
  });

  it("normalizes missing userId to null", async () => {
    authMock.mockResolvedValue({ userId: undefined, getToken: vi.fn() });
    const session = await getServerSession();
    expect(session.userId).toBeNull();
  });
});
