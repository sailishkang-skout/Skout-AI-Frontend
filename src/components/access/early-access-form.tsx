"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCESS_QUERY_KEY, useAccess, useAccessApi } from "@/lib/access";
import { ApiError } from "@/lib/api-client";
import { useAuthAdapter } from "@/lib/auth";

const CODE_ERRORS: Record<string, string> = {
  invalid_code: "That code isn't valid.",
  expired_code: "That code has expired — ask us to resend it.",
  used_code: "That code has already been used.",
};

function codeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Too many attempts. Try again in an hour.";
    const code = (err.body as { code?: string } | undefined)?.code;
    if (code && CODE_ERRORS[code]) return CODE_ERRORS[code];
  }
  return "We couldn't check that code. Try again.";
}

/** "You're on the list": request details plus the invite-code box (spec 2026-11-17). */
export function EarlyAccessForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const api = useAccessApi();
  const access = useAccess();
  const request = access.data?.request;
  const signOut = useAuthAdapter().useSignOut();

  const [company, setCompany] = useState(request?.company ?? "");
  const [role, setRole] = useState(request?.role_title ?? "");
  const [useCase, setUseCase] = useState(request?.use_case ?? "");
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState(params.get("code") ?? "");
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (access.data?.status === "active") router.replace("/dashboard");
  }, [access.data?.status, router]);

  // Saved answers can arrive after mount (a full page load): fill fields the user hasn't typed in.
  useEffect(() => {
    if (!request) return;
    setCompany((v) => v || request.company || "");
    setRole((v) => v || request.role_title || "");
    setUseCase((v) => v || request.use_case || "");
  }, [request]);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      setDetailsMessage("Company and role are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.submit({ company: company.trim(), role_title: role.trim(), use_case: useCase.trim() || undefined });
      queryClient.setQueryData(ACCESS_QUERY_KEY, res.data);
      setDetailsMessage("Thanks — we've got your details.");
    } catch {
      setDetailsMessage("We couldn't save your details. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setRedeeming(true);
    setCodeMessage(null);
    try {
      await api.redeem(code.trim());
      await queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
      router.replace("/dashboard");
    } catch (err) {
      setCodeMessage(codeError(err));
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">You&apos;re on the list</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Skout is in early access. We review every request and email you an invite code.
        </p>
      </div>

      <form onSubmit={saveDetails} className="space-y-3" noValidate>
        <label className="block space-y-1 text-sm">
          <span>Company</span>
          <Input aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Role</span>
          <Input aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>What will you use Skout for? (optional)</span>
          <textarea
            aria-label="What will you use Skout for?"
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        {detailsMessage && (
          <p role="status" className="text-sm text-muted-foreground">
            {detailsMessage}
          </p>
        )}
        <Button type="submit" variant="outline" className="w-full" disabled={saving}>
          Save details
        </Button>
      </form>

      <form onSubmit={unlock} className="space-y-3 border-t pt-6">
        <p className="text-sm font-medium">Have an invite code?</p>
        <Input
          aria-label="Invite code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          maxLength={20}
        />
        {codeMessage && (
          <p role="alert" className="text-sm text-destructive">
            {codeMessage}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={redeeming}>
          Unlock
        </Button>
      </form>

      <div className="border-t pt-4 text-center">
        <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
          Use a different account
        </Button>
      </div>
    </div>
  );
}
