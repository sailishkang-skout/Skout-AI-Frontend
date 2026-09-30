"use client";

import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * AUTH-FE-12 — re-authentication prompt shown when a protected action returns
 * packages/auth's assertStepUp() 401 (see lib/step-up.ts's isStepUpRequiredError). Password-only:
 * MFA (BE-17) is out of scope until D3 says otherwise.
 */
export function StepUpModal({
  open,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setPassword("");
    setError(null);
    setSubmitting(false);
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onCancel();
      }}
      title="Confirm it's you"
      description="This action needs a fresh sign-in. Enter your password to continue."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          setError(null);
          try {
            await onSubmit(password);
            reset();
          } catch (err) {
            setSubmitting(false);
            setError(err instanceof Error ? err.message : "Could not verify your password.");
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="step-up-password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="step-up-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onCancel();
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !password}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
