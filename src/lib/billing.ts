import { useApiFetch } from "./api-client";

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  amountInr: number;
}

export interface BillingConfig {
  razorpayEnabled: boolean;
  keyId: string | null;
  packs: CreditPack[];
}

export interface RazorpayOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  credits: number;
  packId: string;
  packLabel: string;
}

export interface RazorpayCheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

/** COPS-08: the customer's own subscription, as GET /api/v1/billing/subscription returns it. */
export interface CustomerSubscription {
  status: "active" | "past_due" | "restricted" | "suspended" | "closed";
  billing: "payment_link" | "invoiced" | "provider";
  currency: string;
  cadence: "monthly" | "annual";
  seats: number;
  renews_at: string;
  invoices: Array<{ id: string; period_start: string; period_end: string; due_at: string; amount_minor: number; currency: string; status: string; paid_at: string | null }>;
  dunning: { overdue_invoice_id: string; due_at: string; day: number; next_status: CustomerSubscription["status"] | null; next_status_at: string | null } | null;
}

export function useBillingApi() {
  const fetchApi = useApiFetch();
  return {
    getConfig: () => fetchApi<{ data: BillingConfig }>("/api/v1/billing/config"),
    subscription: () => fetchApi<{ data: CustomerSubscription | null }>("/api/v1/billing/subscription"),
    payInvoice: (invoiceId: string) =>
      fetchApi<{ data: { checkout_url: string; status: string } }>(`/api/v1/billing/subscription/invoices/${invoiceId}/pay`, { method: "POST", body: "{}" }),
    createOrder: (packId: string) =>
      fetchApi<{ data: RazorpayOrderResponse }>("/api/v1/billing/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ packId }),
      }),
    verifyPayment: (result: RazorpayCheckoutResult) =>
      fetchApi<{ data: { status: string; credits: number } }>("/api/v1/billing/razorpay/verify", {
        method: "POST",
        body: JSON.stringify(result),
      }),
  };
}

export async function openRazorpayCheckout(
  order: RazorpayOrderResponse,
  options: {
    name?: string;
    email?: string;
    onSuccess?: (result: RazorpayCheckoutResult) => void;
    onDismiss?: () => void;
  }
): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Razorpay unavailable");

  const rzp = new window.Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: "Skout AI",
    description: `${order.packLabel} — ${order.credits.toLocaleString()} credits`,
    order_id: order.orderId,
    prefill: { name: options.name, email: options.email },
    theme: { color: "#0f172a" },
    handler: (result: RazorpayCheckoutResult) => options.onSuccess?.(result),
    modal: { ondismiss: () => options.onDismiss?.() },
  });
  rzp.open();
}
