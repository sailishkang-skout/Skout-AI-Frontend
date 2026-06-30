"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { CREDITS_QUERY_KEY, WORKSPACE_CURRENT_QUERY_KEY } from "@/lib/enrichment";
import { Button } from "@/components/ui/button";

interface CreditsModalState {
  open: boolean;
  required?: number;
  available?: number;
}

interface CreditsModalContextValue {
  showInsufficientCredits: (details?: { required?: number; available?: number }) => void;
  closeCreditsModal: () => void;
}

const CreditsModalContext = createContext<CreditsModalContextValue | null>(null);

export function isInsufficientCreditsError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 402;
}

export function parseCreditsDetails(error: unknown): { required?: number; available?: number } {
  if (!(error instanceof ApiError) || error.status !== 402) return {};
  // API returns required/available at the top level; older callers nested them under `details`.
  const body = error.body as
    | { required?: number; available?: number; details?: { required?: number; available?: number } }
    | undefined;
  if (body?.required != null || body?.available != null) {
    return { required: body.required, available: body.available };
  }
  return body?.details ?? {};
}

export function CreditsModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CreditsModalState>({ open: false });

  const showInsufficientCredits = useCallback((details?: { required?: number; available?: number }) => {
    setState({ open: true, ...details });
  }, []);

  const closeCreditsModal = useCallback(() => {
    setState({ open: false });
  }, []);

  return (
    <CreditsModalContext.Provider value={{ showInsufficientCredits, closeCreditsModal }}>
      {children}
      {state.open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={closeCreditsModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[61] w-[min(100%,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-xl"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Coins className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold">Insufficient credits</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.required != null && state.available != null ? (
                <>
                  This action needs <strong>{state.required}</strong> credit
                  {state.required === 1 ? "" : "s"}, but you only have{" "}
                  <strong>{state.available}</strong>.
                </>
              ) : (
                <>You don&apos;t have enough credits to complete this action.</>
              )}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Top up credits in{" "}
              <Link href="/settings/workspace" className="font-medium text-primary underline-offset-2 hover:underline">
                workspace settings
              </Link>
              , or contact your admin.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={closeCreditsModal}>
                Close
              </Button>
              <Link
                href="/settings/workspace"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={closeCreditsModal}
              >
                Buy credits
              </Link>
            </div>
          </div>
        </>
      )}
    </CreditsModalContext.Provider>
  );
}

export function useCreditsModal() {
  const ctx = useContext(CreditsModalContext);
  if (!ctx) {
    throw new Error("useCreditsModal must be used within CreditsModalProvider");
  }
  return ctx;
}

/** Show modal when error is 402; returns true if handled. */
export function handleCreditsError(
  error: unknown,
  show: (details?: { required?: number; available?: number }) => void
): boolean {
  if (!isInsufficientCreditsError(error)) return false;
  show(parseCreditsDetails(error));
  return true;
}

/** Read the cached credit balance React Query already keeps for the top bar. */
function readCachedBalance(queryClient: ReturnType<typeof useQueryClient>): number | null {
  const credits = queryClient.getQueryData(CREDITS_QUERY_KEY) as
    | { balance?: number | null }
    | undefined;
  if (credits?.balance != null) return credits.balance;
  const ws = queryClient.getQueryData(WORKSPACE_CURRENT_QUERY_KEY) as
    | { data?: { balance?: number | null } }
    | undefined;
  if (ws?.data?.balance != null) return ws.data.balance;
  return null;
}

/**
 * Proactive credit gate. Call `requireCredits(cost)` BEFORE running any action that
 * spends credits. If the known balance can't cover the cost, it pops the buy-credits
 * modal and returns `false` so the caller can bail out without hitting the API.
 * When the balance is unknown it returns `true` (the API still enforces 402).
 */
export function useCreditGuard() {
  const queryClient = useQueryClient();
  const { showInsufficientCredits } = useCreditsModal();

  return useCallback(
    (cost = 1): boolean => {
      const balance = readCachedBalance(queryClient);
      if (balance != null && balance < cost) {
        showInsufficientCredits({ required: cost, available: balance });
        return false;
      }
      return true;
    },
    [queryClient, showInsufficientCredits]
  );
}
