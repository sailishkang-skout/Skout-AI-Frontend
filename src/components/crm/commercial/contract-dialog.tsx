"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "../form-field";
import {
  commercialErrorMessage,
  CONTRACT_KIND_LABEL,
  sha256OfFile,
  useCopsCommercialApi,
  type Contract,
  type ContractKind,
  type Proposal,
} from "@/lib/cops-commercial";

/**
 * Add an MSA, order form or DPA (or a new version of one). Status-tracking scope: the document
 * lives where the user keeps it (link), and its SHA-256 is computed here from the same file so the
 * sent version can be proven unchanged. The file is not uploaded.
 */
export function ContractDialog({
  open,
  onClose,
  opportunityId,
  proposals,
  contract,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  proposals: Proposal[];
  /** When set, adds a new version to this contract. */
  contract?: Contract | null;
  onSaved: () => void;
}) {
  const api = useCopsCommercialApi();
  const [kind, setKind] = useState<ContractKind>("msa");
  const [title, setTitle] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<{ name: string; sha256: string } | null>(null);
  const [hashing, setHashing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind("msa");
    setTitle("");
    setProposalId("");
    setUrl("");
    setFile(null);
    setError(null);
    setBusy(false);
  }, [open]);

  async function pick(f: File | undefined) {
    setFile(null);
    if (!f) return;
    setHashing(true);
    try {
      setFile({ name: f.name, sha256: await sha256OfFile(f) });
    } catch {
      setError("Could not read this file.");
    } finally {
      setHashing(false);
    }
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const doc = { document_url: url.trim(), file_name: file.name, file_sha256: file.sha256 };
    try {
      if (contract) await api.addContractVersion(contract.id, doc);
      else
        await api.createContract(opportunityId, {
          ...doc,
          kind,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(proposalId ? { proposal_id: proposalId } : {}),
        });
      onSaved();
      onClose();
    } catch (err) {
      setError(commercialErrorMessage(err, "Could not save this document."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={contract ? `New version of ${contract.title}` : "Add contract document"}
      description="Link the document and choose the same file so its fingerprint can be recorded. The file is not uploaded."
    >
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {!contract && (
          <>
            <Field label="Document type" required>
              <Select value={kind} onChange={(e) => setKind(e.target.value as ContractKind)}>
                {(Object.keys(CONTRACT_KIND_LABEL) as ContractKind[]).map((k) => (
                  <option key={k} value={k}>
                    {CONTRACT_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Defaults to the document type" />
            </Field>
            {proposals.length > 0 && (
              <Field label="Related proposal">
                <Select value={proposalId} onChange={(e) => setProposalId(e.target.value)}>
                  <option value="">None</option>
                  {proposals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
        <Field label="Document link" required>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2000} placeholder="https://…" />
        </Field>
        <Field label="File (for its fingerprint)" required>
          <input
            type="file"
            onChange={(e) => pick(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
        </Field>
        {hashing && <p className="text-xs text-muted-foreground">Computing fingerprint…</p>}
        {file && (
          <p className="break-all text-xs text-muted-foreground">
            SHA-256 of {file.name}: <code>{file.sha256}</code>
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || hashing || !file || !url.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
