import { useRef } from "react";
import { cn } from "@/lib/utils";
import { insertIntoField } from "@/lib/insert-at-cursor";
import { RichEmailEditor } from "./rich-email-editor";
import { VariableMenu } from "./variable-menu";

/**
 * One copy field. `rich` is the TipTap email editor (uncontrolled: change `resetKey` to load new
 * content, e.g. after applying a suggestion or template). `plain` is a controlled textarea with an
 * optional length counter that turns red over the limit but never blocks typing.
 */
export function CopyEditor({
  kind,
  value,
  onChange,
  ariaLabel,
  placeholder,
  resetKey,
  maxLength,
  withVariables,
}: {
  kind: "rich" | "plain";
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  resetKey?: string;
  maxLength?: number;
  /** Plain fields only: show a Variable menu that inserts at the caret. */
  withVariables?: boolean;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  if (kind === "rich") {
    return (
      <div className="h-[440px] overflow-hidden rounded-md border border-border">
        <RichEmailEditor key={resetKey} initialContent={value} onChange={onChange} />
      </div>
    );
  }

  const over = maxLength !== undefined && value.length > maxLength;
  return (
    <div>
      {withVariables && (
        <div className="mb-1 flex justify-end">
          <VariableMenu onPick={(text) => insertIntoField(fieldRef.current, text, onChange)} />
        </div>
      )}
      <textarea
        ref={fieldRef}
        aria-label={ariaLabel}
        rows={5}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {maxLength !== undefined && (
        <p className={cn("mt-1 text-right text-[11px]", over ? "text-destructive" : "text-muted-foreground")}>
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}
