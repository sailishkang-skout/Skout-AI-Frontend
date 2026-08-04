"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useContactsApi } from "@/lib/crm/contacts";
import { formatQueryError } from "@/lib/api-client";
import { Field } from "./form-field";
import type { Contact, ContactLifecycleStage } from "@/types/crm";

const LIFECYCLE_OPTIONS: ContactLifecycleStage[] = ["lead", "mql", "sql", "customer"];

export function ContactFormSheet({
  open,
  onClose,
  contact,
  /** Preselect a company when creating a contact from a company's detail page. */
  defaultCompanyId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contact?: Contact;
  defaultCompanyId?: string;
  onSaved?: (contact: Contact) => void;
}) {
  const queryClient = useQueryClient();
  const contactsApi = useContactsApi();
  const isEdit = Boolean(contact);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [lifecycleStage, setLifecycleStage] = useState<ContactLifecycleStage>("lead");

  useEffect(() => {
    if (!open) return;
    setFirstName(contact?.firstName ?? "");
    setLastName(contact?.lastName ?? "");
    setEmail(contact?.email ?? "");
    setPhone(contact?.phone ?? "");
    setTitle(contact?.title ?? "");
    setLinkedinUrl(contact?.linkedinUrl ?? "");
    setLifecycleStage(contact?.lifecycleStage ?? "lead");
  }, [open, contact]);

  const save = useMutation({
    mutationFn: () => {
      const input = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        title: title.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        lifecycleStage,
        companyId: contact?.companyId ?? defaultCompanyId ?? undefined,
      };
      return isEdit ? contactsApi.update(contact!.id, input) : contactsApi.create(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["crm", "contacts", contact!.id] });
      onSaved?.(saved);
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit contact" : "New contact"}
      description="Contacts are the people you sell to, at a company."
    >
      <div className="space-y-4">
        {save.isError && (
          <Alert variant="error">{formatQueryError(save.error, "Could not save this contact.")}</Alert>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
          </Field>
          <Field label="Last name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
          </Field>
        </div>
        <Field label="Email" fieldSource={contact?.fieldSources.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" />
        </Field>
        <Field label="Phone" fieldSource={contact?.fieldSources.phone}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Title" fieldSource={contact?.fieldSources.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VP Sales" />
        </Field>
        <Field label="LinkedIn URL" fieldSource={contact?.fieldSources.linkedinUrl}>
          <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
        </Field>
        <Field label="Lifecycle stage" fieldSource={contact?.fieldSources.lifecycleStage}>
          <Select
            value={lifecycleStage}
            onChange={(e) => setLifecycleStage(e.target.value as ContactLifecycleStage)}
          >
            {LIFECYCLE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!firstName.trim() || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create contact"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
