import { useApiFetch } from "./api-client";
import type { CreditTransaction, WorkspaceCurrent } from "@/types/api";

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  amountInr: number;
}

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  monthKey: string;
  packId: string;
  packLabel: string;
  credits: number;
  amountPaise: number;
  amountInr: number;
  currency: string;
  status: string;
  providerOrderId: string;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
}

export function useWorkspaceApi() {
  const fetchApi = useApiFetch();
  return {
    getCurrent: () =>
      fetchApi<{ data: WorkspaceCurrent }>("/api/v1/workspaces/current"),

    rename: (name: string) =>
      fetchApi<{ data: WorkspaceCurrent }>("/api/v1/workspaces/current", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),

    setDealPromotionThreshold: (threshold: number) =>
      fetchApi<{ data: WorkspaceCurrent }>("/api/v1/workspaces/current/deal-promotion-threshold", {
        method: "PUT",
        body: JSON.stringify({ threshold }),
      }),

    getTransactions: (limit = 20, offset = 0) =>
      fetchApi<{ data: CreditTransaction[]; total: number; limit: number; offset: number }>(
        `/api/v1/credits/transactions?limit=${limit}&offset=${offset}`
      ),

    topUpCredits: (amount = 100) =>
      fetchApi<{ data: { balance: number; amount: number } }>("/api/v1/credits/topup", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),

    getBillingConfig: () =>
      fetchApi<{ data: { razorpayEnabled: boolean; keyId: string | null; packs: CreditPack[] } }>(
        "/api/v1/billing/config"
      ),

    listInvoices: () =>
      fetchApi<{
        data: {
          invoices: BillingInvoice[];
          byMonth: { monthKey: string; invoices: BillingInvoice[]; totalInr: number }[];
        };
      }>("/api/v1/billing/invoices"),

    downloadInvoiceUrl: (id: string) => `/api/v1/billing/invoices/${id}?format=download`,

    createRazorpayOrder: (packId: string) =>
      fetchApi<{
        data: {
          orderId: string;
          amount: number;
          currency: string;
          keyId: string;
          credits: number;
          packId: string;
          packLabel: string;
        };
      }>("/api/v1/billing/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ packId }),
      }),

    verifyRazorpayPayment: (result: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) =>
      fetchApi<{ data: { status: string; credits: number } }>("/api/v1/billing/razorpay/verify", {
        method: "POST",
        body: JSON.stringify(result),
      }),
  };
}
