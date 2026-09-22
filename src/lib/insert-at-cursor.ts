export type TextField = HTMLInputElement | HTMLTextAreaElement;

/** The value after inserting `text` at the field's selection, and where the caret should land. */
export function insertAtSelection(field: TextField, text: string): { value: string; caret: number } {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  return {
    value: field.value.slice(0, start) + text + field.value.slice(end),
    caret: start + text.length,
  };
}

/**
 * Inserts `text` into a controlled field: reports the new value via `onChange`, then (once React
 * has re-rendered) refocuses the field with the caret just after the inserted text.
 */
export function insertIntoField(field: TextField | null, text: string, onChange: (value: string) => void): void {
  if (!field) return;
  const { value, caret } = insertAtSelection(field, text);
  onChange(value);
  setTimeout(() => {
    field.focus();
    field.setSelectionRange(caret, caret);
  }, 0);
}
