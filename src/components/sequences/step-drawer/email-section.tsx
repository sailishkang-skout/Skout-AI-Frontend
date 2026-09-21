import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { SequenceVariantKey } from "@/types/api";
import { StepSuggestions } from "../step-suggestions";
import { CopyEditor } from "./copy-editor";
import type { EmailTemplate } from "./email-templates";
import type { SectionProps } from "./section-types";
import { godModePatch, splitPatch, suggestionTarget, updateVariant, weightsOf } from "./step-draft";
import { TemplatePicker } from "./template-picker";
import { TimingRow } from "./timing-row";
import { VariantTabs } from "./variant-tabs";

export function EmailSection({ step, draft, onChange }: SectionProps) {
  const [active, setActive] = useState<SequenceVariantKey>("A");
  // Bumped whenever content is loaded from outside the editor (a suggestion or template), so the
  // uncontrolled rich editor remounts with it.
  const [nonce, setNonce] = useState(0);
  const target = suggestionTarget(draft, "email");
  const variant = draft.variants[active];

  function applyTemplate(template: EmailTemplate) {
    onChange(updateVariant(active, (v) => ({ subject: template.subject ?? v.subject, body: template.html })));
    setNonce((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <TimingRow draft={draft} onChange={onChange} />

      <VariantTabs
        godMode={draft.godMode}
        weights={weightsOf(draft)}
        active={active}
        onActive={setActive}
        onToggleGodMode={(on) => {
          onChange(godModePatch(on));
          if (!on && active === "C") setActive("A");
        }}
        onSplit={(key, pct) => onChange(splitPatch(key, pct))}
      />

      <StepSuggestions
        sequenceId={step.sequenceId}
        stepId={step.id}
        stepType="email"
        empty={target.allBlank}
        autoLoad
        applyLabel={target.replacing ? "Replace Variant A" : `Use in Variant ${target.key}`}
        onApply={(s) => {
          onChange(updateVariant(target.key, (v) => ({ subject: s.subject ?? v.subject, body: s.body })));
          setActive(target.key);
          setNonce((n) => n + 1);
        }}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Subject</span>
          <TemplatePicker subject={variant.subject} html={variant.body} onApply={applyTemplate} />
        </div>
        <Input
          aria-label="Subject"
          placeholder="Subject line — supports {{firstName}}, {{companyName}}, etc."
          value={variant.subject}
          onChange={(e) => onChange(updateVariant(active, { subject: e.target.value }))}
        />
        <CopyEditor
          kind="rich"
          value={variant.body}
          resetKey={`${active}:${nonce}`}
          onChange={(html) => onChange(updateVariant(active, { body: html }))}
        />
      </div>
    </div>
  );
}
