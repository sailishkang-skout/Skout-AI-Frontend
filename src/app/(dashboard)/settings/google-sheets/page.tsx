"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { GoogleSheetsCard } from "@/components/settings/google-sheets-card";
import { Alert } from "@/components/ui/alert";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { SHEETS_CONNECTION_KEY, useGoogleSheetsApi } from "@/lib/google-sheets";

/**
 * Where Google sends the browser back after sign-in (WB2-025). The code is handed to the API as the signed-in person,
 * which is what stops anyone's consent being attached to another account, and is taken out of the address at once.
 */
function GoogleSheetsSettings() {
  const params = useSearchParams();
  const api = useGoogleSheetsApi();
  const client = useQueryClient();
  const authReady = useAuthReady();
  const [returned] = useState(() => ({ code: params.get("code"), state: params.get("state"), error: params.get("error") }));
  const sent = useRef(false);
  const complete = useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) => api.complete(code, state),
    onSettled: () => client.invalidateQueries({ queryKey: SHEETS_CONNECTION_KEY }),
  });
  const { mutate } = complete;

  useEffect(() => {
    if (returned.code || returned.state || returned.error) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [returned]);
  useEffect(() => {
    const { code, state } = returned;
    if (!authReady || !code || !state) return;
    // Once only, as a code works once. Sent a moment later, so that when React runs an effect twice (as it does in
    // development) the request is made by the run that stays and its answer is shown.
    const timer = setTimeout(() => {
      if (sent.current) return;
      sent.current = true;
      mutate({ code, state });
    }, 0);
    return () => clearTimeout(timer);
  }, [authReady, returned, mutate]);

  return (
    <PageShell width="narrow">
      <PageHeader title="Google Sheets" description="Your connection for adding spreadsheet rows to workbooks." />
      {returned.error ? <Alert variant="error">Google Sheets wasn’t connected: the sign-in was cancelled or refused.</Alert> : null}
      {complete.isPending ? <Alert>Finishing the connection…</Alert> : null}
      {complete.error ? <Alert variant="error">{formatQueryError(complete.error, "Google Sheets could not be connected.")}</Alert> : null}
      {complete.data?.status === "connected" ? (
        <Alert variant="success">
          Google Sheets is connected.{" "}
          <Link href="/enrichment/workbooks-v2" className="font-medium underline underline-offset-4">
            Back to your workbooks
          </Link>
        </Alert>
      ) : null}
      <GoogleSheetsCard />
    </PageShell>
  );
}

export default function GoogleSheetsSettingsPage() {
  return (
    <Suspense>
      <GoogleSheetsSettings />
    </Suspense>
  );
}
