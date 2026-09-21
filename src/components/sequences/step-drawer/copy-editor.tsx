import { cn } from "@/lib/utils";
import { RichEmailEditor } from "./rich-email-editor";

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
}: {
  kind: "rich" | "plain";
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  resetKey?: string;
  maxLength?: number;
}) {
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
      <textarea
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
