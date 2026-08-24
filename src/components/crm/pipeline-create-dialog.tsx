"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePipelinesApi } from "@/lib/crm/pipelines";
import { formatQueryError } from "@/lib/api-client";
import { Field } from "./form-field";
import type { Pipeline } from "@/types/crm";

/** New pipelines come pre-seeded with the standard stage set (New/Qualified/Proposal/
 *  Negotiation/Closed Won/Closed Lost) by the backend — same as Pipedrive, a fresh pipeline
 *  is immediately usable on a board, not an empty shell you have to build stages for first. */
export function PipelineCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (pipeline: Pipeline) => void;
}) {
  const queryClient = useQueryClient();
  const pipelinesApi = usePipelinesApi();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const create = useMutation({
    mutationFn: () => pipelinesApi.create(name.trim()),
    onSuccess: (pipeline) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "pipelines"] });
      onCreated?.(pipeline);
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New pipeline"
      description="Starts with the standard stages (New, Qualified, Proposal, Negotiation, Closed Won, Closed Lost) — rename or add stages afterward."
    >
      <div className="space-y-4">
        {create.isError && (
          <Alert variant="error">{formatQueryError(create.error, "Could not create this pipeline.")}</Alert>
        )}

        <Field label="Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enterprise Pipeline"
            autoFocus
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create pipeline
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
