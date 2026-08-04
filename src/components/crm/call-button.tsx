"use client";

/** R20.2 — click-to-call button. Dials the SDR first, then bridges to the given phone number. */

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Phone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useCallsApi } from "@/lib/calls";
import { cn } from "@/lib/utils";

export function CallButton({ phone, taskId }: { phone: string | null | undefined; taskId?: string }) {
  const authReady = useAuthReady();
  const callsApi = useCallsApi();

  const config = useQuery({
    queryKey: ["calls", "config"],
    queryFn: callsApi.getConfig,
    enabled: authReady,
  });

  const dial = useMutation({
    mutationFn: () => callsApi.dial({ to: phone!, taskId }),
  });

  if (!config.data?.data.enabled) {
    return (
      <Button size="sm" variant="outline" disabled title="Calling isn't configured for this workspace yet">
        <Phone className="h-3.5 w-3.5" />
        Call
      </Button>
    );
  }

  if (!phone) {
    return (
      <Button size="sm" variant="outline" disabled title="No phone number on file">
        <Phone className="h-3.5 w-3.5" />
        Call
      </Button>
    );
  }

  if (!config.data.data.agentPhoneSet) {
    return (
      <Link
        href="/settings/calling"
        title="Set your phone number to enable calling"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Phone className="h-3.5 w-3.5" />
        Set up calling
      </Link>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" disabled={dial.isPending} onClick={() => dial.mutate()}>
        {dial.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
        Call {phone}
      </Button>
      {dial.isSuccess && (
        <span className="text-xs text-muted-foreground">Calling your phone now — it'll bridge to {phone} once you answer.</span>
      )}
      {dial.isError && (
        <Alert variant="error" className="max-w-xs py-2 text-xs">
          {formatQueryError(dial.error, "Could not start the call.")}
        </Alert>
      )}
    </div>
  );
}
