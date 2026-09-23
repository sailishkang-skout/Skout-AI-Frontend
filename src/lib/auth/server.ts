import { auth } from "@clerk/nextjs/server";

type ClerkAuth = Awaited<ReturnType<typeof auth>>;

export type ServerSession = {
  userId: string | null;
  getToken: ClerkAuth["getToken"];
};

/** Clerk-backed server session for App Router server components (custom mode: FE-07). */
export async function getServerSession(): Promise<ServerSession> {
  const { userId, getToken } = await auth();
  return {
    userId: userId ?? null,
    getToken,
  };
}
