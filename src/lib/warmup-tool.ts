import { ApiError, useApiFetch } from "./api-client";

const BASE = "/api/v1/warmup-tool";

export type WarmupProvider = "GMAIL" | "MICROSOFT365";

export type WarmupMailbox = {
  id: string;
  emailAddress?: string;
  email?: string;
  address?: string;
  provider?: WarmupProvider | string;
  status?: string;
  enabled?: boolean;
  displayName?: string;
  timezone?: string;
  [key: string]: unknown;
};

export type WarmupDomain = {
  id: string;
  domainName?: string;
  status?: string;
  verificationStatus?: string;
  provider?: string;
  dnsStatus?: string;
  spfStatus?: string;
  dkimStatus?: string;
  dmarcStatus?: string;
  mxStatus?: string;
  [key: string]: unknown;
};

export type WarmupPool = {
  id: string;
  name?: string;
  status?: string;
  strategy?: string;
  [key: string]: unknown;
};

export type KillSwitch = {
  id: string;
  scope?: string;
  scopeId?: string;
  status?: string;
  reason?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type DnsEvidenceStatus = "PASS" | "FAIL" | "MISSING" | "UNKNOWN" | "ERROR";

export type WarmupSession = {
  id: string;
  mailboxId: string;
  profileId?: string;
  state: string;
  currentDay?: number;
  currentDailyTarget?: number;
  committedVolumeToday?: number;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  stoppedAt?: string;
  lastDecisionAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WarmupDecision = {
  id: string;
  sessionId?: string;
  warmupDay?: number;
  decision?: string;
  reasonCodes?: string[];
  reasons?: string[];
  recommendedVolume?: number;
  maximumVolume?: number;
  riskLevel?: string;
  eligibility?: string;
  generatedAt?: string;
};

export function mailboxLabel(
  m: Pick<WarmupMailbox, "emailAddress" | "email" | "address" | "id" | "displayName">
): string {
  return String(m.displayName || m.emailAddress || m.email || m.address || m.id);
}

function unwrapList<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

const DEFAULT_PROFILE = {
  targetDailyVolume: 30,
  startingDailyVolume: 5,
  maximumDailyVolume: 50,
  rampStrategy: "STANDARD" as const,
  riskTolerance: "MEDIUM" as const,
};

export function useWarmupToolApi() {
  const fetchApi = useApiFetch();

  return {
    get: <T = unknown>(path: string) => fetchApi<T>(`${BASE}${path}`),

    post: <T = unknown>(path: string, body?: unknown) =>
      fetchApi<T>(`${BASE}${path}`, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      }),

    health: () => fetchApi<unknown>(`${BASE}`),

    listMailboxes: async () => {
      const res = await fetchApi<unknown>(`${BASE}/mailboxes`);
      return unwrapList<WarmupMailbox>(res, ["mailboxes", "data"]);
    },

    createMailbox: (body: {
      emailAddress: string;
      provider: WarmupProvider;
      displayName?: string;
      timezone?: string;
    }) =>
      fetchApi<WarmupMailbox>(`${BASE}/mailboxes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    getMailbox: (id: string) => fetchApi<WarmupMailbox>(`${BASE}/mailboxes/${id}`),

    connectGoogle: (id: string) =>
      fetchApi<{ authorizationUrl?: string }>(`${BASE}/mailboxes/${id}/connect/google`, {
        method: "POST",
        body: JSON.stringify({}),
      }),

    connectMicrosoft: (id: string) =>
      fetchApi<{ authorizationUrl?: string }>(`${BASE}/mailboxes/${id}/connect/microsoft`, {
        method: "POST",
        body: JSON.stringify({}),
      }),

    enableMailbox: (id: string) =>
      fetchApi(`${BASE}/mailboxes/${id}/enable`, { method: "POST", body: "{}" }),

    disableMailbox: (id: string) =>
      fetchApi(`${BASE}/mailboxes/${id}/disable`, { method: "POST", body: "{}" }),

    getConnection: (id: string) => fetchApi(`${BASE}/mailboxes/${id}/connection`),

    /** Returns null when no warm-up session exists yet (upstream 404). */
    getWarmup: async (id: string): Promise<{ session: WarmupSession; latestDecision?: WarmupDecision } | null> => {
      try {
        return await fetchApi<{ session: WarmupSession; latestDecision?: WarmupDecision }>(
          `${BASE}/mailboxes/${id}/warmup`
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },

    ensureWarmupProfile: async (id: string) => {
      try {
        return await fetchApi(`${BASE}/mailboxes/${id}/warmup/profile`);
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) throw err;
        return fetchApi(`${BASE}/mailboxes/${id}/warmup/profile`, {
          method: "POST",
          body: JSON.stringify(DEFAULT_PROFILE),
        });
      }
    },

    startWarmup: async (id: string) => {
      await (async () => {
        try {
          await fetchApi(`${BASE}/mailboxes/${id}/warmup/profile`);
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) throw err;
          await fetchApi(`${BASE}/mailboxes/${id}/warmup/profile`, {
            method: "POST",
            body: JSON.stringify(DEFAULT_PROFILE),
          });
        }
      })();
      return fetchApi(`${BASE}/mailboxes/${id}/warmup`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },

    pauseWarmup: (id: string) =>
      fetchApi(`${BASE}/mailboxes/${id}/warmup/pause`, { method: "POST", body: "{}" }),

    resumeWarmup: (id: string) =>
      fetchApi(`${BASE}/mailboxes/${id}/warmup/resume`, { method: "POST", body: "{}" }),

    stopWarmup: (id: string) =>
      fetchApi(`${BASE}/mailboxes/${id}/warmup/stop`, { method: "POST", body: "{}" }),

    getDecisions: async (id: string) => {
      const res = await fetchApi<unknown>(`${BASE}/mailboxes/${id}/warmup/decisions`);
      if (Array.isArray(res)) return res as WarmupDecision[];
      if (res && typeof res === "object") {
        const obj = res as { decisions?: WarmupDecision[]; mailboxId?: string };
        return obj.decisions ?? [];
      }
      return [];
    },

    getIntelligence: (id: string) => fetchApi(`${BASE}/mailboxes/${id}/intelligence`),

    refreshIntelligence: (id: string) =>
      fetchApi(`${BASE}/mailboxes/${id}/intelligence/refresh`, { method: "POST", body: "{}" }),

    getRisk: (id: string) => fetchApi(`${BASE}/mailboxes/${id}/risk`),

    getEligibility: (id: string) => fetchApi(`${BASE}/mailboxes/${id}/eligibility`),

    getReputation: async (id: string) => {
      try {
        return await fetchApi(`${BASE}/mailboxes/${id}/reputation`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },

    /** mailboxId is required by upstream. */
    listConversations: async (mailboxId: string) => {
      const q = `?mailboxId=${encodeURIComponent(mailboxId)}`;
      const res = await fetchApi<unknown>(`${BASE}/conversations${q}`);
      return unwrapList<{
        id: string;
        subject?: string;
        state?: string;
        channel?: string;
        lastMessageAt?: string;
      }>(res, ["conversations", "data"]);
    },

    getConversation: (id: string) => fetchApi(`${BASE}/conversations/${id}`),

    listDomains: async () => {
      const res = await fetchApi<unknown>(`${BASE}/domains`);
      return unwrapList<WarmupDomain>(res, ["domains", "data"]);
    },

    createDomain: (body: { domainName: string; provider?: "GMAIL" | "MICROSOFT365" | "UNKNOWN" }) =>
      fetchApi(`${BASE}/domains`, { method: "POST", body: JSON.stringify(body) }),

    verifyDomain: (
      id: string,
      evidence: { mx: DnsEvidenceStatus; spf: DnsEvidenceStatus; dkim: DnsEvidenceStatus; dmarc: DnsEvidenceStatus }
    ) =>
      fetchApi(`${BASE}/domains/${id}/verify`, {
        method: "POST",
        body: JSON.stringify(evidence),
      }),

    listPools: async () => {
      const res = await fetchApi<unknown>(`${BASE}/warmup/pools`);
      return unwrapList<WarmupPool>(res, ["pools", "data"]);
    },

    createPool: (body: { name: string; strategy?: string }) =>
      fetchApi(`${BASE}/warmup/pools`, { method: "POST", body: JSON.stringify(body) }),

    getPoolHealth: (id: string) =>
      fetchApi<{
        poolId: string;
        status?: string;
        memberships?: number;
        eligibleEstimate?: number;
        membershipsByStatus?: Record<string, number>;
      }>(`${BASE}/warmup/pools/${id}/health`),

    networkHealth: () =>
      fetchApi<{
        networks?: number;
        activeNetworks?: number;
        domains?: number;
        mailboxes?: number;
        domainsByStatus?: Record<string, number>;
        mailboxesByStatus?: Record<string, number>;
        credentialUnavailable?: number;
        remainingMailboxCapacityToday?: number;
      }>(`${BASE}/warmup-network/health`),

    listNetworkDomains: async () => {
      const res = await fetchApi<unknown>(`${BASE}/warmup-network/domains`);
      return unwrapList<{ id: string; domainName?: string; status?: string }>(res, ["domains", "data"]);
    },

    listNetworkMailboxes: async () => {
      const res = await fetchApi<unknown>(`${BASE}/warmup-network/mailboxes`);
      return unwrapList<{ id: string; status?: string; provider?: string }>(res, ["mailboxes", "data"]);
    },

    listKillSwitches: async () => {
      const res = await fetchApi<unknown>(`${BASE}/operations/kill-switches`);
      return unwrapList<KillSwitch>(res, ["killSwitches", "data", "switches"]);
    },

    activateKillSwitch: (body: { scope: string; scopeId?: string; reason: string }) =>
      fetchApi(`${BASE}/operations/kill-switches`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    pollIntegrationEvents: (limit = 50) =>
      fetchApi<{ events: unknown[]; nextCursor: string | null; polled: number }>(
        `${BASE}/integration-events/poll`,
        { method: "POST", body: JSON.stringify({ limit }) }
      ),
  };
}
