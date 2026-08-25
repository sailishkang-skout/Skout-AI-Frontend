import { useCrmServiceFetch } from "../crm-api-client";
import type { CommitteeMember, CommitteeMemberInput } from "@/types/crm";

/** §8.12 CRM Intelligence — deal-scoped BuyingCommittee. `addMember` is an upsert on the
 * backend (unique on committeeId+contactId): posting again for a contact already on the
 * committee updates their role/influence/notes instead of erroring, so this hook's
 * `addMember` doubles as the "edit member" call. */
export function useBuyingCommitteeApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    listForDeal: (dealId: string) =>
      fetchApi<{ members: CommitteeMember[] }>(`/api/v1/deals/${dealId}/buying-committee`),

    addMember: (dealId: string, input: CommitteeMemberInput) =>
      fetchApi<CommitteeMember>(`/api/v1/deals/${dealId}/buying-committee/members`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    removeMember: (memberId: string) =>
      fetchApi<void>(`/api/v1/buying-committee/members/${memberId}`, { method: "DELETE" }),
  };
}
