"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useSsoScimApi } from "@/lib/sso-scim";
import { useWorkspaceRole } from "@/lib/workspace-role";

/** §11.1 Stage-6 — SSO/SCIM customer binding UI. */
export default function SsoSettingsPage() {
  const authReady = useAuthReady();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const api = useSsoScimApi();
  const qc = useQueryClient();
  const [clerkOrgId, setClerkOrgId] = useState("");
  const [idpProvider, setIdpProvider] = useState("okta");
  const [metadataUrl, setMetadataUrl] = useState("");

  const status = useQuery({
    queryKey: ["sso-status"],
    queryFn: api.getStatus,
    enabled: authReady && isAdmin,
  });

  const config = useQuery({
    queryKey: ["sso-config"],
    queryFn: api.getConfig,
    enabled: authReady && isAdmin,
  });

  const save = useMutation({
    mutationFn: () =>
      api.saveConfig({
        clerkOrgId: clerkOrgId.trim(),
        idpProvider,
        idpMetadataUrl: metadataUrl.trim() || null,
        scimEnabled: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-status"] });
      qc.invalidateQueries({ queryKey: ["sso-config"] });
    },
  });

  const activate = useMutation({
    mutationFn: () => api.activate(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sso-status"] }),
  });

  if (!isAdmin) {
    return (
      <PageShell>
        <Alert variant="error">SSO settings require owner or admin role.</Alert>
      </PageShell>
    );
  }

  const binding = status.data?.data.workspaceBinding;

  return (
    <PageShell width="narrow">
      <PageHeader
        title="SSO & SCIM"
        description="Per-customer IdP binding via Clerk — activate at deal time without a code deploy."
      />

      {status.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Platform status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Platform ready:{" "}
              <Badge tone={status.data?.data.platformReady ? "success" : "muted"}>
                {status.data?.data.platformReady ? "yes" : "no"}
              </Badge>
            </p>
            {binding ? (
              <p>
                Workspace binding: <Badge tone="success">{binding.status}</Badge> · {binding.idpProvider} ·{" "}
                {binding.clerkOrgId}
              </p>
            ) : (
              <p className="text-muted-foreground">No IdP bound for this workspace yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configure IdP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Clerk organization ID"
            value={clerkOrgId || String((config.data?.data as { clerkOrgId?: string })?.clerkOrgId ?? "")}
            onChange={(e) => setClerkOrgId(e.target.value)}
          />
          <Select value={idpProvider} onChange={(e) => setIdpProvider(e.target.value)}>
            <option value="okta">Okta</option>
            <option value="azure_ad">Azure AD</option>
            <option value="google">Google</option>
            <option value="onelogin">OneLogin</option>
            <option value="other">Other</option>
          </Select>
          <Input placeholder="IdP metadata URL (optional)" value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} />
          <div className="flex gap-2">
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save config
            </Button>
            <Button variant="outline" disabled={activate.isPending} onClick={() => activate.mutate()}>
              Activate
            </Button>
          </div>
          {(save.isError || activate.isError) && (
            <Alert variant="error">{formatQueryError(save.error ?? activate.error)}</Alert>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
