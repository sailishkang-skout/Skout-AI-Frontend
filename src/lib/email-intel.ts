import { useApiFetch } from "./api-client";

export interface EmailIntelVerifyResult {
  success: boolean;
  email: string;
  verificationStatus?: { status: string };
  sendEligibility?: { allowed: boolean; decision: string; decisionConfidence?: number };
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
  };
}
