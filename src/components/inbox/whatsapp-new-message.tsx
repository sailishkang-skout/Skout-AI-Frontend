"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MessageSquare, Phone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatQueryError } from "@/lib/api-client";
import {
  useWhatsappMessagingApi,
  type MessagingAccount,
} from "@/lib/linkedin-messaging";

export function WhatsappNewMessage({
  accounts,
  accountId,
  onChangeAccount,
  onSent,
}: {
  accounts: MessagingAccount[];
  accountId: string | undefined;
  onChangeAccount: (id: string | undefined) => void;
  onSent?: () => void;
}) {
  const api = useWhatsappMessagingApi();
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: () =>
      api.outreach({
        accountId,
        phone: phone.trim(),
        text: text.trim(),
      }),
    onSuccess: () => {
      setStatusMsg(`Message sent to ${phone.trim()}.`);
      setText("");
      onSent?.();
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b p-4">
        {accounts.length > 0 && (
          <select
            className="h-8 w-full max-w-sm rounded-md border border-border bg-background px-2 text-xs"
            value={accountId ?? ""}
            onChange={(e) => onChangeAccount(e.target.value || undefined)}
            aria-label="WhatsApp account"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName || a.phone || a.unipileAccountId}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-muted-foreground">
          Start a WhatsApp chat by phone number (include country code, e.g. 14155552671).
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        {statusMsg && <Alert variant="success">{statusMsg}</Alert>}
        {sendMutation.error && (
          <Alert variant="error">
            {formatQueryError(sendMutation.error, "Could not send WhatsApp message.")}
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Phone</label>
          <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9198XXXXXXXX"
              inputMode="tel"
              autoComplete="tel"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Digits only, with country code (no + or spaces).</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Message</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Write your WhatsApp message…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex justify-end">
          <Button
            className="gap-1.5"
            disabled={!phone.trim() || !text.trim() || sendMutation.isPending || !accountId}
            onClick={() => {
              setStatusMsg(null);
              sendMutation.mutate();
            }}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            Send message
          </Button>
        </div>
      </div>
    </div>
  );
}
