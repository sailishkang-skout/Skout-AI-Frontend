import { useApiFetch } from "./api-client";

export interface EmailIntelVerifyResult {
  success: boolean;
  email: string;
  domain?: string | null;
  disposable?: boolean;
  verificationStatus?: { status: string };
  catchAll?: boolean;
  sendEligibility?: { allowed: boolean; decision: string; decisionConfidence?: number };
  error?: string;
}

export interface EmailIntelBatchResult {
  success: boolean;
  count: number;
  results: EmailIntelVerifyResult[];
}

export interface EmailIntelDiscoveryCandidate {
  email: string;
  pattern: string;
  finalScore: number;
  decision: string;
  confidence: number;
  reasons: string[];
}

export interface EmailIntelDiscoveryResult {
  success: boolean;
  firstName: string;
  lastName: string | null;
  domain: string;
  recommendedEmail: string | null;
  recommendedPattern: string | null;
  recommendedConfidence: number | null;
  candidates: EmailIntelDiscoveryCandidate[];
  error?: string;
}

export interface EmailIntelPatternCandidate {
  email: string;
  pattern: string;
  finalScore: number;
  decision: string;
  confidence: number;
  historicalSuccessRate: number;
  reasons: string[];
}

export interface EmailIntelPatternResult {
  success: boolean;
  domain: string;
  candidates: EmailIntelPatternCandidate[];
  recommended: EmailIntelPatternCandidate | null;
  error?: string;
}

export function useEmailIntelApi() {
  const fetchApi = useApiFetch();
  return {
    verify: (email: string) =>
      fetchApi<EmailIntelVerifyResult>("/api/v1/email-intel/verify", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    verifyBatch: (emails: string[]) =>
      fetchApi<EmailIntelBatchResult>("/api/v1/email-intel/verify/batch", {
        method: "POST",
        body: JSON.stringify({ emails }),
      }),

    discover: (input: { firstName: string; lastName?: string; domain: string }) =>
      fetchApi<EmailIntelDiscoveryResult>("/api/v1/email-intel/discover", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    patterns: (input: { firstName: string; lastName: string; domain: string }) =>
      fetchApi<EmailIntelPatternResult>("/api/v1/email-intel/patterns", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };
}
