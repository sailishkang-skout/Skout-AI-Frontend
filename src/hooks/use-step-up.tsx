"use client";

import { useCallback, useRef, useState } from "react";
import { isStepUpRequiredError, useStepUpApi } from "@/lib/step-up";
import { StepUpModal } from "@/components/auth/step-up-modal";

/**
 * AUTH-FE-12 — wraps a protected action so a step-up-required 401 (assertStepUp, BE-27)
 * transparently prompts for re-authentication and retries the action exactly once with the
 * resulting `x-reauth-token`. `action` must forward that token itself (as a header) when given
 * one — see identity-merge.ts's `resolveProposal` for the pattern.
 */
export function useStepUp() {
  const stepUpApi = useStepUpApi();
  const [modalOpen, setModalOpen] = useState(false);
  // Held only for the lifetime of one pending step-up round trip — never persisted.
  const pendingRef = useRef<{ resolve: (token: string) => void; reject: (err: Error) => void } | null>(null);

  const promptForReauth = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      setModalOpen(true);
    });
  }, []);

  const obtainReauthToken = useCallback((): Promise<string> => {
    return promptForReauth();
  }, [promptForReauth]);

  const withStepUp = useCallback(
    async <T,>(action: (reauthToken?: string) => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (err) {
        if (!isStepUpRequiredError(err)) throw err;
        const reauthToken = await obtainReauthToken();
        return action(reauthToken);
      }
    },
    [obtainReauthToken]
  );

  const modal = (
    <StepUpModal
      open={modalOpen}
      onSubmit={async (password) => {
        const token = await stepUpApi.reauthenticate({ password });
        setModalOpen(false);
        pendingRef.current?.resolve(token);
        pendingRef.current = null;
      }}
      onCancel={() => {
        setModalOpen(false);
        pendingRef.current?.reject(new Error("Step-up cancelled"));
        pendingRef.current = null;
      }}
    />
  );

  return { withStepUp, stepUpModal: modal };
}
